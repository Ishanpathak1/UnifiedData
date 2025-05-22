import { doc, updateDoc, serverTimestamp, getDoc, setDoc, collection } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'react-hot-toast';

/**
 * Handle sheet change - switch to a different sheet and save the current one
 */
export const handleSheetChange = (sheetId, activeSheetId, hotRef, sheets, setSheets, setActiveSheetId, setData) => {
  // First save current sheet data with formatting
  if (hotRef.current && activeSheetId) {
    const hot = hotRef.current.hotInstance;
    const currentData = hot.getData();
    
    // Extract formatting information
    const formattedData = [];
    
    for (let row = 0; row < currentData.length; row++) {
      const rowData = [];
      for (let col = 0; col < currentData[row].length; col++) {
        const cellValue = currentData[row][col];
        const cellMeta = hot.getCellMeta(row, col);
        
        // Create a cell object with value and formatting
        const cellWithFormat = {
          value: cellValue,
          className: cellMeta.className || '',
          fontSize: cellMeta.fontSize || '12px'
        };
        
        rowData.push(cellWithFormat);
      }
      formattedData.push(rowData);
    }
    
    // Update state with current sheet's data and formatting
    setSheets(prevSheets => {
      const updatedSheets = prevSheets.map(sheet => 
        sheet.id === activeSheetId ? 
          {...sheet, data: currentData, formatting: formattedData} : 
          sheet
      );
      
      return updatedSheets;
    });
  }
  
  // Switch to new sheet
  setActiveSheetId(sheetId);
  
  // Load new sheet data
  setTimeout(() => {
    const selectedSheet = sheets.find(sheet => sheet.id === sheetId);
    if (selectedSheet && hotRef.current) {
      hotRef.current.hotInstance.loadData(selectedSheet.data);
      setData(selectedSheet.data);
      
      // Apply formatting after a short delay
      setTimeout(() => {
        if (selectedSheet.formatting) {
          applyFormattingToLoadedSheet(selectedSheet.data, selectedSheet.formatting, hotRef);
        }
      }, 100);
    } else {
      console.error(`Could not find sheet with ID: ${sheetId}`);
    }
  }, 50);
};

/**
 * Apply formatting to a loaded sheet
 */
export const applyFormattingToLoadedSheet = (sheetData, formatting, hotRef) => {
  if (!hotRef.current || !formatting || formatting.length === 0) return;
  
  const hot = hotRef.current.hotInstance;
  
  // Apply formatting to each cell
  formatting.forEach((row, rowIndex) => {
    // Skip if row doesn't have proper format
    if (!row || typeof row !== 'object' || row.rowIndex === undefined) return;
    
    // Get all format keys (format_0, format_1, etc.)
    const formatKeys = Object.keys(row).filter(key => key.startsWith('format_'));
    
    formatKeys.forEach(key => {
      const colIndex = parseInt(key.replace('format_', ''));
      const format = row[key];
      
      if (format && (format.className || format.fontSize)) {
        // Apply className for text formatting
        if (format.className) {
          hot.setCellMeta(row.rowIndex, colIndex, 'className', format.className);
        }
        
        // Apply font size
        if (format.fontSize) {
          hot.setCellMeta(row.rowIndex, colIndex, 'fontSize', format.fontSize);
        }
      }
    });
  });
  
  // Render the changes
  hot.render();
};

/**
 * Add a new sheet to the spreadsheet
 */
export const addSheet = (hotRef, activeSheetId, data, sheets, setSheets, setActiveSheetId, setData) => {
  // Get current data
  const currentData = hotRef.current?.hotInstance.getData() || data;
  
  // CRITICAL: Work with the current state directly in a function
  const safeAddSheet = () => {
    // Create complete copy of current sheets
    const currentSheets = [...sheets];
    
    // Update current sheet with latest data
    const updatedSheets = currentSheets.map(sheet => 
      sheet.id === activeSheetId 
        ? {...sheet, data: currentData} 
        : {...sheet}
    );
    
    // Create new sheet
    const newSheetId = `sheet_${Date.now()}`;
    const newSheet = {
      id: newSheetId,
      name: `Sheet ${updatedSheets.length + 1}`,
      data: [['', '', '', ''], ['', '', '', '']]
    };
    
    // Add the new sheet to the updated list
    const newSheets = [...updatedSheets, newSheet];
    
    // Update state with the combined list
    setSheets(newSheets);
    
    // Switch to new sheet
    setActiveSheetId(newSheetId);
    
    // Load empty data into the grid
    if (hotRef.current) {
      hotRef.current.hotInstance.loadData(newSheet.data);
      setData(newSheet.data);
    }
    
    // Important: Return the new sheets
    return newSheets;
  };
  
  // Execute inside a try/catch to prevent errors
  try {
    return safeAddSheet();
  } catch (error) {
    console.error("❌ Error adding sheet:", error);
    return null;
  }
};

/**
 * Save all spreadsheet data to Firestore
 */
export const saveAllSpreadsheetData = async (
  user, 
  hotRef, 
  spreadsheetId, 
  documentTitle, 
  sheets, 
  allSheetsRef, 
  activeSheetId,
  setIsSaving, 
  setSheets, 
  setSpreadsheetId, 
  setLastSaved, 
  router
) => {
  if (!user || !hotRef.current) return false;
  
  setIsSaving(true);
  
  try {
    // Get current editor data
    const currentData = hotRef.current.hotInstance.getData();
    
    // Get all sheets
    const allSheets = allSheetsRef.current.length > 0 ? 
      JSON.parse(JSON.stringify(allSheetsRef.current)) : 
      JSON.parse(JSON.stringify(sheets));
    
    // Get the Handsontable instance
    const hot = hotRef.current.hotInstance;
    
    // Update the active sheet with current grid data and formatting
    const activeIndex = allSheets.findIndex(s => s.id === activeSheetId);
    
    if (activeIndex >= 0) {
      // Extract formatting information
      const formattedData = [];
      
      for (let row = 0; row < currentData.length; row++) {
        const rowData = [];
        for (let col = 0; col < currentData[row].length; col++) {
          const cellValue = currentData[row][col];
          const cellMeta = hot.getCellMeta(row, col);
          
          // Create a cell object with value and formatting
          const cellWithFormat = {
            value: cellValue,
            className: cellMeta.className || '',
            fontSize: cellMeta.fontSize || '12px'
          };
          
          rowData.push(cellWithFormat);
        }
        formattedData.push(rowData);
      }
      
      allSheets[activeIndex] = {
        ...allSheets[activeIndex],
        data: currentData,
        formatting: formattedData // Store formatting separately
      };
    } else if (activeSheetId) {
      allSheets.push({
        id: activeSheetId,
        name: "New Sheet",
        data: currentData
      });
    }
    
    // Create serialized data
    const serializedSheets = allSheets.map(sheet => ({
      id: sheet.id,
      name: sheet.name,
      data: sheet.data.map((row, rowIndex) => {
        return row.reduce((rowObj, cellValue, colIndex) => {
          rowObj[`cell_${colIndex}`] = cellValue || '';
          return rowObj;
        }, { rowIndex });
      }),
      formatting: sheet.formatting ? sheet.formatting.map((row, rowIndex) => {
        return row.reduce((rowObj, cell, colIndex) => {
          rowObj[`format_${colIndex}`] = {
            className: cell.className || '',
            fontSize: cell.fontSize || '12px'
          };
          return rowObj;
        }, { rowIndex });
      }) : []
    }));
    
    // Get current version from Firestore or localStorage
    let currentVersion = 1;
    const docId = spreadsheetId || router.query.id;
    
    if (docId && docId !== 'new') {
      // Try to get current version from localStorage first (faster)
      const storedVersion = localStorage.getItem(`spreadsheet_${docId}_version`);
      
      if (storedVersion) {
        currentVersion = parseInt(storedVersion) + 1;
      } else {
        // Fetch from Firestore if not in localStorage
        const docRef = doc(db, 'spreadsheets', docId);
        const docSnapshot = await getDoc(docRef);
        
        if (docSnapshot.exists() && docSnapshot.data().version) {
          currentVersion = docSnapshot.data().version + 1;
        }
      }
    }
    
    // Prepare spreadsheet data with versioning
    const spreadsheetData = {
      title: documentTitle,
      sheets: serializedSheets,
      lastModified: serverTimestamp(),
      ownerId: user.uid,
      ownerEmail: user.email,
      ownerName: user.displayName || 'Unknown User',
      version: currentVersion,
      metadata: {
        sheetCount: serializedSheets.length,
        lastEditor: user.displayName || user.email,
        saveSource: 'manual',
        hasFormatting: true // Flag to indicate formatting is included
      }
    };
    
    // Save to Firestore
    if (docId && docId !== 'new') {
      // Update existing document
      await updateDoc(doc(db, 'spreadsheets', docId), spreadsheetData);
      setSpreadsheetId(docId);
      
      // Update localStorage version
      localStorage.setItem(`spreadsheet_${docId}_version`, currentVersion.toString());
      
      // Update toast to show save success
      toast.success("Spreadsheet saved successfully");
      
      // Update state after successful save
      setSheets(allSheets);
      allSheetsRef.current = JSON.parse(JSON.stringify(allSheets));
      setLastSaved(new Date());
      
      return true;
    } else {
      // Create new document
      const newDocRef = doc(collection(db, 'spreadsheets'));
      await setDoc(newDocRef, {
        ...spreadsheetData,
        createdAt: serverTimestamp()
      });
      
      setSpreadsheetId(newDocRef.id);
      router.push(`/spreadsheet?id=${newDocRef.id}`, undefined, { shallow: true });
      
      // Show success toast
      toast.success("New spreadsheet created successfully");
      
      // Update state after successful save
      setSheets(allSheets);
      allSheetsRef.current = JSON.parse(JSON.stringify(allSheets));
      setLastSaved(new Date());
      
      return true;
    }
  } catch (error) {
    console.error('Error saving spreadsheet with formatting:', error);
    toast.error(`Failed to save: ${error.message}`);
    return false;
  } finally {
    setIsSaving(false);
  }
};

export default {
  handleSheetChange,
  applyFormattingToLoadedSheet,
  addSheet,
  saveAllSpreadsheetData
}; 