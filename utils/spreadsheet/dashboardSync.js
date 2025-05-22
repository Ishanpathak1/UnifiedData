import { 
  collection, 
  query as firestoreQuery, 
  where as firestoreWhere, 
  orderBy as firestoreOrderBy, 
  getDocs, 
  doc, 
  getDoc, 
  updateDoc, 
  serverTimestamp, 
  addDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'react-hot-toast';

/**
 * Deep sanitize objects for Firestore to ensure no nested arrays
 */
export const deepSanitizeForFirestore = (data) => {
  if (data === null || data === undefined) return data;
  
  // Convert arrays to objects with numeric keys
  if (Array.isArray(data)) {
    const result = {};
    data.forEach((item, index) => {
      result[`_${index}`] = deepSanitizeForFirestore(item);
    });
    return result;
  }
  
  // Handle objects
  if (typeof data === 'object' && !(data instanceof Date)) {
    const result = {};
    Object.keys(data).forEach(key => {
      if (data[key] !== undefined) {
        result[key] = deepSanitizeForFirestore(data[key]);
      }
    });
    return result;
  }
  
  // Return primitives and Dates as is
  return data;
};

/**
 * Remove functions from chart config for storage
 */
export const removeFunctionsFromConfig = (config) => {
  if (!config) return null;
  
  // Create a deep copy to avoid modifying the original
  try {
    const newConfig = JSON.parse(JSON.stringify(
      config,
      // Custom replacer function to exclude functions
      (key, value) => {
        if (typeof value === 'function') {
          return undefined; // Skip functions
        }
        return value;
      }
    ));
    
    return newConfig;
  } catch (error) {
    console.error("Error removing functions from config:", error);
    // Fallback method if JSON.stringify fails
    const cleanConfig = {};
    Object.keys(config).forEach(key => {
      const value = config[key];
      if (typeof value !== 'function') {
        if (value === null || value === undefined) {
          cleanConfig[key] = value;
        } else if (typeof value === 'object') {
          cleanConfig[key] = removeFunctionsFromConfig(value);
        } else {
          cleanConfig[key] = value;
        }
      }
    });
    return cleanConfig;
  }
};

/**
 * Sanitize objects for Firestore
 */
export const sanitizeForFirestore = (obj) => {
  // Handle null and undefined
  if (obj === null || obj === undefined) {
    return null;
  }
  
  // Handle functions - functions are not allowed in Firestore
  if (typeof obj === 'function') {
    return null;
  }
  
  // Handle other primitive values
  if (typeof obj !== 'object') {
    return obj;
  }
  
  // Handle arrays
  if (Array.isArray(obj)) {
    // Filter out undefined values and sanitize each item
    return obj
      .map(item => sanitizeForFirestore(item))
      .filter(item => item !== undefined);
  }
  
  // Handle objects
  const newObj = {};
  
  // Process each key, skip undefined values and functions
  Object.keys(obj).forEach(key => {
    if (typeof obj[key] !== 'function') {
      const value = sanitizeForFirestore(obj[key]);
      if (value !== undefined) {
        newObj[key] = value;
      }
    }
  });
  
  return newObj;
};

/**
 * Update chart data in config based on chart type
 */
export const updateChartDataInConfig = (chartConfig, newData) => {
  if (!chartConfig || !newData || newData.length === 0) return chartConfig;
  
  // Clone the config to avoid modifying the original
  const updatedConfig = JSON.parse(JSON.stringify(chartConfig));
  
  // Handle different chart types
  if (['bar', 'line', 'radar'].includes(chartConfig.type)) {
    // For these chart types, first row should be labels, remaining rows are data series
    if (newData.length >= 2) {
      // Update labels
      if (updatedConfig.data) {
        updatedConfig.data.labels = newData[0].slice(1); // Skip first cell which is often empty
        
        // Update datasets
        updatedConfig.data.datasets = newData.slice(1).map((row, index) => {
          // Preserve original dataset properties if they exist
          const originalDataset = (updatedConfig.data.datasets && updatedConfig.data.datasets[index]) || {};
          return {
            ...originalDataset,
            label: row[0] || `Series ${index + 1}`,
            data: row.slice(1).map(val => typeof val === 'string' ? parseFloat(val) || 0 : val)
          };
        });
      }
    }
  } else if (['pie', 'doughnut', 'polarArea'].includes(chartConfig.type)) {
    // For pie/doughnut/polar charts, use first column as labels, second as data
    if (newData.length >= 2) {
      if (updatedConfig.data) {
        // Update labels - use first column of data rows (skip header)
        updatedConfig.data.labels = newData.slice(1).map(row => String(row[0] || ''));
        
        // Use second column for data values
        const dataValues = newData.slice(1).map(row => 
          typeof row[1] === 'number' ? row[1] : parseFloat(row[1]) || 0
        );
        
        // Update or create datasets
        if (!updatedConfig.data.datasets || !updatedConfig.data.datasets.length) {
          updatedConfig.data.datasets = [{
            data: dataValues,
            backgroundColor: updatedConfig.data.labels.map((_, i) => {
              const hue = (i * 137.5) % 360;
              return `hsla(${hue}, 70%, 60%, 0.7)`;
            })
          }];
        } else {
          updatedConfig.data.datasets[0].data = dataValues;
        }
      }
    }
  }
  
  // Add a metadata field to track the format
  updatedConfig._dataFormat = {
    headers: newData[0] || [],
    rows: newData.slice(1) || []
  };
  
  return updatedConfig;
};

/**
 * Main function to update dependent dashboards with the latest spreadsheet data
 */
export const updateDependentDashboards = async (user, spreadsheetId, hotRef) => {
  // Skip if missing data or new document without ID
  const docId = spreadsheetId;
  if (!user || !docId || docId === 'new' || !hotRef.current) {
    console.log("Missing required data for dashboard update");
    return false;
  }

  // Show a loading indicator
  const loadingToast = toast.loading("Syncing dashboards...");
  
  try {
    // Add sync status to the spreadsheet
    await updateDoc(doc(db, 'spreadsheets', docId), {
      syncStatus: 'in_progress',
      syncStarted: serverTimestamp()
    });

    // STEP 1: Fetch the latest spreadsheet data from Firestore to ensure consistency
    const spreadsheetRef = doc(db, 'spreadsheets', docId);
    const spreadsheetSnap = await getDoc(spreadsheetRef);
    
    if (!spreadsheetSnap.exists()) {
      console.error("Cannot update dashboards: Spreadsheet not found");
      toast.dismiss(loadingToast);
      toast.error("Spreadsheet not found");
      return false;
    }
    
    const spreadsheetData = spreadsheetSnap.data();
    
    // Query for dashboards that might use this spreadsheet
    const dashboardsRef = collection(db, 'dashboards');
    const q = firestoreQuery(dashboardsRef, firestoreWhere('ownerId', '==', user.uid));
    const querySnapshot = await getDocs(q);
    
    // Track metrics for user feedback
    let updatedCount = 0;
    let totalChartsChecked = 0;
    let chartsUpdated = 0;
    let dashboardNames = [];
    
    // Process each dashboard
    for (const dashboardDoc of querySnapshot.docs) {
      const dashboardId = dashboardDoc.id;
      const dashboard = dashboardDoc.data();
      
      // Skip if no items
      if (!dashboard.items || !Array.isArray(dashboard.items) || dashboard.items.length === 0) {
        continue;
      }
      
      let dashboardNeedsUpdate = false;
      const updatedItems = [...dashboard.items];
      
      // Check each chart item
      for (let index = 0; index < dashboard.items.length; index++) {
        const item = dashboard.items[index];
        totalChartsChecked++;
        
        // Skip non-chart items
        if (item.type !== 'chart') {
          continue;
        }
        
        // Look for items using this spreadsheet
        const itemSpreadsheetId = 
          item.sourceInfo?.spreadsheetId || 
          item.sourceSpreadsheetId || 
          item.chartConfig?.sourceInfo?.spreadsheetId;
        
        if (itemSpreadsheetId !== docId) {
          continue;
        }
        
        try {
          // Get sheet data from the fetched spreadsheet data
          const sheetsData = spreadsheetData.sheets || [];
          const sheetToUse = item.sourceInfo?.sheetId ? 
            sheetsData.find(s => s.id === item.sourceInfo.sheetId) : 
            sheetsData[0];
            
          if (!sheetToUse) {
            console.error("Referenced sheet not found in spreadsheet");
            continue;
          }
          
          // Deserialize data from Firestore format (cell_0, cell_1, etc.) to 2D array
          const sheetRows = sheetToUse.data || [];
          const processedData = [];
          
          for (const row of sheetRows) {
            if (!row || typeof row !== 'object') continue;
            
            const rowIndex = row.rowIndex;
            const rowArray = [];
            
            // Get all cell_X keys and convert to array
            const cellKeys = Object.keys(row).filter(key => key.startsWith('cell_'));
            const maxColIndex = cellKeys.length > 0 ? 
              Math.max(...cellKeys.map(key => parseInt(key.replace('cell_', '')))) : 0;
              
            for (let i = 0; i <= maxColIndex; i++) {
              rowArray.push(row[`cell_${i}`] || '');
            }
            
            processedData[rowIndex] = rowArray;
          }
          
          // Process data according to chart's needs (range or all)
          let extractedData = processedData;
          
          if (item.sourceInfo?.range) {
            const { startRow, startCol, endRow, endCol } = item.sourceInfo.range;
            
            // Extract just the needed range
            const rangeData = [];
            for (let row = startRow; row <= Math.min(endRow, processedData.length - 1); row++) {
              if (!processedData[row]) continue;
              
              const rowData = [];
              for (let col = startCol; col <= Math.min(endCol, (processedData[row].length || 0) - 1); col++) {
                rowData.push(processedData[row][col] || '');
              }
              rangeData.push(rowData);
            }
            
            extractedData = rangeData;
          }
          
          if (extractedData.length === 0) {
            console.warn("No data extracted for chart");
            continue;
          }
          
          // Create a hash of the data to check if it's actually changed
          const dataHash = JSON.stringify(extractedData);
          const previousHash = item.sourceInfo?.dataHash;
          
          // Only update if data has changed
          if (dataHash !== previousHash) {
            // Ensure the data is in the expected format for the dashboard
            const formattedData = {
              headers: extractedData[0] || [],
              data: extractedData.slice(1) || []
            };
            
            // Update the chart config with new data
            const updatedChartConfig = updateChartDataInConfig(
              JSON.parse(JSON.stringify(item.chartConfig)), 
              extractedData
            );
            
            updatedItems[index] = {
              ...item,
              chartConfig: updatedChartConfig,
              sourceInfo: {
                ...item.sourceInfo,
                lastUpdated: new Date().toISOString(),
                dataHash: dataHash,
                formattedData: formattedData // Add the formatted data
              }
            };
            
            dashboardNeedsUpdate = true;
            chartsUpdated++;
          }
        } catch (error) {
          console.error(`Error updating chart in dashboard ${dashboard.title}:`, error);
        }
      }
      
      // If any items were updated, update the dashboard
      if (dashboardNeedsUpdate) {
        try {
          // Create a completely sanitized version of the items
          const completelySanitizedItems = deepSanitizeForFirestore(updatedItems);
          
          // Use this for the Firestore update
          await updateDoc(doc(db, 'dashboards', dashboardId), {
            items: completelySanitizedItems,
            lastModified: serverTimestamp(),
            lastSyncedWith: {
              spreadsheetId: docId,
              syncedAt: serverTimestamp()
            }
          });
          
          updatedCount++;
          dashboardNames.push(dashboard.title || 'Untitled dashboard');
        } catch (error) {
          console.error(`Error saving dashboard ${dashboard.title}:`, error);
        }
      }
    }
    
    // Update sync status when complete
    await updateDoc(doc(db, 'spreadsheets', docId), {
      syncStatus: 'completed',
      lastSyncedAt: serverTimestamp(),
      syncStats: {
        dashboardsUpdated: updatedCount,
        chartsUpdated: chartsUpdated,
        totalChartsChecked: totalChartsChecked
      }
    });
    
    // Add to sync history
    const syncHistoryRef = collection(db, 'spreadsheets', docId, 'syncHistory');
    await addDoc(syncHistoryRef, {
      timestamp: serverTimestamp(),
      status: 'success',
      dashboardsUpdated: updatedCount,
      chartsUpdated: chartsUpdated,
      dashboards: dashboardNames
    });
    
    // Show success message
    if (updatedCount > 0) {
      toast.dismiss(loadingToast);
      toast.success(`Updated ${chartsUpdated} charts across ${updatedCount} dashboards`);
      
      // Store the sync time for reference
      localStorage.setItem('lastDashboardSync', new Date().toISOString());
      localStorage.setItem('lastSyncedSpreadsheet', docId);
      
      return true;
    } else {
      toast.dismiss(loadingToast);
      toast("All dashboards are already up to date");  // Just basic toast
      return true;
    }
    
  } catch (error) {
    console.error("Error updating dashboards:", error);
    
    // Update sync status with error
    await updateDoc(doc(db, 'spreadsheets', docId), {
      syncStatus: 'error',
      syncError: error.message
    });
    
    toast.dismiss(loadingToast);
    toast.error("Failed to update dashboards: " + error.message);
    return false;
  }
};

/**
 * Check which dashboards depend on a specific spreadsheet
 */
export const checkSpreadsheetDependencies = async (user, spreadsheetId) => {
  if (!user || !spreadsheetId) {
    return [];
  }
  
  try {
    // Query for dashboards that use this spreadsheet
    const dashboardsRef = collection(db, 'dashboards');
    const q = firestoreQuery(dashboardsRef, firestoreWhere('ownerId', '==', user.uid));
    
    const querySnapshot = await getDocs(q);
    const dependentDashboards = [];
    
    querySnapshot.forEach((doc) => {
      const dashboard = doc.data();
      const items = dashboard.items || [];
      
      // Check if any item uses this spreadsheet as a source
      const usesSpreadsheet = items.some(item => {
        const itemSpreadsheetId = 
          item.sourceInfo?.spreadsheetId || 
          item.sourceSpreadsheetId || 
          item.chartConfig?.sourceInfo?.spreadsheetId;
        
        return itemSpreadsheetId === spreadsheetId;
      });
      
      if (usesSpreadsheet) {
        dependentDashboards.push({
          id: doc.id,
          title: dashboard.title || 'Untitled Dashboard',
          itemCount: items.length
        });
      }
    });
    
    return dependentDashboards;
  } catch (error) {
    console.error("Error checking spreadsheet dependencies:", error);
    return [];
  }
};

export default {
  updateDependentDashboards,
  checkSpreadsheetDependencies,
  updateChartDataInConfig,
  sanitizeForFirestore,
  removeFunctionsFromConfig,
  deepSanitizeForFirestore
}; 