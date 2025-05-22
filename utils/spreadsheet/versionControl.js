import { db } from '../firebase';
import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  serverTimestamp,
  limit
} from 'firebase/firestore';

/**
 * Version control system for spreadsheets
 * Allows tracking changes, saving versions, and restoring past versions
 */

/**
 * Save a version snapshot of the current spreadsheet
 * 
 * @param {string} spreadsheetId - The ID of the spreadsheet
 * @param {Object} data - Current spreadsheet data
 * @param {Object} user - Current user
 * @param {string} versionName - Optional name for this version
 * @param {string} description - Optional description for this version
 * @returns {Promise<string>} The ID of the created version
 */
export const saveVersion = async (spreadsheetId, data, user, versionName = '', description = '') => {
  if (!spreadsheetId || !data || !user) {
    throw new Error('Missing required parameters');
  }

  try {
    // Get the current spreadsheet document to include metadata in the version
    const spreadsheetRef = doc(db, 'spreadsheets', spreadsheetId);
    const spreadsheetDoc = await getDoc(spreadsheetRef);
    
    if (!spreadsheetDoc.exists()) {
      throw new Error('Spreadsheet not found');
    }
    
    const spreadsheetData = spreadsheetDoc.data();
    
    // Validate the data structure
    const validatedData = {};
    
    // Store full grid data
    if (data.data) {
      validatedData.data = data.data;
    } else if (Array.isArray(data)) {
      validatedData.data = data;
    } else {
      throw new Error('Invalid data structure: missing grid data');
    }
    
    // Store sheet structure if available
    if (data.sheets && Array.isArray(data.sheets)) {
      validatedData.sheets = data.sheets;
    } else if (spreadsheetData.sheets) {
      validatedData.sheets = spreadsheetData.sheets;
    } else {
      validatedData.sheets = [];
    }
    
    // Store active sheet ID
    if (data.activeSheetId) {
      validatedData.activeSheetId = data.activeSheetId;
    } else if (spreadsheetData.activeSheetId) {
      validatedData.activeSheetId = spreadsheetData.activeSheetId;
    }
    
    // Create a new version document in the versions subcollection
    const versionRef = collection(db, 'spreadsheets', spreadsheetId, 'versions');
    
    const versionData = {
      data: JSON.stringify(validatedData), // Store the full spreadsheet data
      sheets: validatedData.sheets, // Store sheets separately for easier access
      activeSheetId: validatedData.activeSheetId,
      createdAt: serverTimestamp(),
      createdBy: {
        uid: user.uid,
        displayName: user.displayName || 'Unknown User',
        email: user.email || ''
      },
      versionName: versionName || `Version ${new Date().toLocaleString()}`,
      description: description,
      size: JSON.stringify(validatedData).length, // Track size for storage management
    };
    
    const docRef = await addDoc(versionRef, versionData);
    
    // Update the spreadsheet document with the latest version ID
    await updateDoc(spreadsheetRef, {
      lastVersionId: docRef.id,
      lastVersionAt: serverTimestamp(),
      lastVersionBy: {
        uid: user.uid,
        displayName: user.displayName || 'Unknown User'
      }
    });
    
    console.log('Version saved successfully:', {
      id: docRef.id,
      name: versionName,
      dataSize: versionData.size,
      sheets: validatedData.sheets?.length || 0
    });
    
    return docRef.id;
  } catch (error) {
    console.error('Error creating version:', error);
    throw error;
  }
};

/**
 * Get version history for a spreadsheet
 * 
 * @param {string} spreadsheetId - The ID of the spreadsheet
 * @param {number} limit - Maximum number of versions to retrieve (default: 50)
 * @returns {Promise<Array>} Array of version objects
 */
export const getVersionHistory = async (spreadsheetId, limitCount = 50) => {
  if (!spreadsheetId) {
    throw new Error('Spreadsheet ID is required');
  }
  
  try {
    const versionsRef = collection(db, 'spreadsheets', spreadsheetId, 'versions');
    const q = query(
      versionsRef,
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    
    const querySnapshot = await getDocs(q);
    const versions = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      // Don't include the full spreadsheet data to keep response size manageable
      const { data: _, ...versionMeta } = data;
      
      // Convert timestamps
      let createdAt = data.createdAt;
      if (createdAt && typeof createdAt.toDate === 'function') {
        createdAt = createdAt.toDate();
      }
      
      versions.push({
        id: doc.id,
        ...versionMeta,
        createdAt
      });
    });
    
    return versions;
  } catch (error) {
    console.error('Error fetching version history:', error);
    throw error;
  }
};

/**
 * Get a specific version of a spreadsheet
 * 
 * @param {string} spreadsheetId - The ID of the spreadsheet
 * @param {string} versionId - The ID of the version to retrieve
 * @returns {Promise<Object>} The version data including spreadsheet contents
 */
export const getVersion = async (spreadsheetId, versionId) => {
  if (!spreadsheetId || !versionId) {
    throw new Error('Spreadsheet ID and Version ID are required');
  }
  
  try {
    const versionRef = doc(db, 'spreadsheets', spreadsheetId, 'versions', versionId);
    const versionDoc = await getDoc(versionRef);
    
    if (!versionDoc.exists()) {
      throw new Error('Version not found');
    }
    
    const versionData = versionDoc.data();
    
    // Parse the stored data
    if (versionData.data) {
      try {
        const parsedData = JSON.parse(versionData.data);
        
        // If the data was stored as an object with a 'data' property,
        // return that directly for backwards compatibility
        if (parsedData.data) {
          versionData.data = parsedData.data;
          
          if (!versionData.sheets && parsedData.sheets) {
            versionData.sheets = parsedData.sheets;
          }
          
          if (!versionData.activeSheetId && parsedData.activeSheetId) {
            versionData.activeSheetId = parsedData.activeSheetId;
          }
        } else {
          versionData.data = parsedData;
        }
      } catch (e) {
        console.error('Error parsing version data:', e);
        throw new Error('Invalid version data format');
      }
    } else {
      throw new Error('Version data is missing');
    }
    
    // Convert timestamps
    let createdAt = versionData.createdAt;
    if (createdAt && typeof createdAt.toDate === 'function') {
      versionData.createdAt = createdAt.toDate();
    }
    
    // Validate the data structure
    if (!Array.isArray(versionData.data)) {
      throw new Error('Invalid data format: expected array');
    }
    
    return {
      id: versionDoc.id,
      ...versionData
    };
  } catch (error) {
    console.error('Error fetching version:', error);
    throw error;
  }
};

/**
 * Restore a specific version of a spreadsheet
 * 
 * @param {string} spreadsheetId - The ID of the spreadsheet
 * @param {string} versionId - The ID of the version to restore
 * @param {Object} user - Current user
 * @returns {Promise<Object>} The restored spreadsheet data
 */
export const restoreVersion = async (spreadsheetId, versionId, user) => {
  if (!spreadsheetId || !versionId || !user) {
    throw new Error('Missing required parameters');
  }
  
  try {
    // Get the version to restore
    const version = await getVersion(spreadsheetId, versionId);
    
    if (!version || !version.data) {
      throw new Error('Invalid version data');
    }
    
    // Prepare the data to update
    const updateData = {
      data: version.data,
      lastModified: serverTimestamp(),
      lastModifiedBy: {
        uid: user.uid,
        displayName: user.displayName || 'Unknown User',
        email: user.email || ''
      },
      restoredFromVersion: {
        id: versionId,
        name: version.versionName,
        timestamp: version.createdAt
      }
    };
    
    // Add sheets data if available
    if (version.sheets && Array.isArray(version.sheets)) {
      updateData.sheets = version.sheets;
    }
    
    // Add active sheet ID if available
    if (version.activeSheetId) {
      updateData.activeSheetId = version.activeSheetId;
    }
    
    // Update the current spreadsheet with this version's data
    const spreadsheetRef = doc(db, 'spreadsheets', spreadsheetId);
    await updateDoc(spreadsheetRef, updateData);
    
    // Create a new version to mark this restoration
    await saveVersion(
      spreadsheetId, 
      version, 
      user, 
      `Restored: ${version.versionName}`, 
      `Restored from version created on ${new Date(version.createdAt).toLocaleString()}`
    );
    
    // Return the data in a format the calling code expects
    return {
      data: version.data,
      sheets: version.sheets || [],
      activeSheetId: version.activeSheetId
    };
  } catch (error) {
    console.error('Error restoring version:', error);
    throw error;
  }
};

/**
 * Automatically save versions at regular intervals or specific triggers
 * 
 * @param {string} spreadsheetId - The ID of the spreadsheet
 * @param {Object} data - Current spreadsheet data
 * @param {Object} user - Current user
 * @returns {Promise<string|null>} The ID of the created version or null if skipped
 */
export const autoSaveVersion = async (spreadsheetId, data, user) => {
  if (!spreadsheetId || !data || !user) {
    return null;
  }
  
  try {
    // Check when the last version was saved
    const spreadsheetRef = doc(db, 'spreadsheets', spreadsheetId);
    const spreadsheetDoc = await getDoc(spreadsheetRef);
    
    if (!spreadsheetDoc.exists()) {
      return null;
    }
    
    const spreadsheetData = spreadsheetDoc.data();
    const lastVersionAt = spreadsheetData.lastVersionAt;
    
    // If no version exists or it's been more than 10 minutes, save a new one
    const shouldSaveNewVersion = !lastVersionAt || 
      (lastVersionAt.toDate && 
       Date.now() - lastVersionAt.toDate().getTime() > 10 * 60 * 1000);
    
    if (shouldSaveNewVersion) {
      return await saveVersion(spreadsheetId, data, user, 'Auto-saved version');
    }
    
    return null;
  } catch (error) {
    console.error('Error in auto-saving version:', error);
    return null;
  }
};

/**
 * Name a specific version
 * 
 * @param {string} spreadsheetId - The ID of the spreadsheet
 * @param {string} versionId - The ID of the version to name
 * @param {string} versionName - New name for the version
 * @param {string} description - Optional description
 * @returns {Promise<void>}
 */
export const nameVersion = async (spreadsheetId, versionId, versionName, description = '') => {
  if (!spreadsheetId || !versionId || !versionName) {
    throw new Error('Missing required parameters');
  }
  
  try {
    const versionRef = doc(db, 'spreadsheets', spreadsheetId, 'versions', versionId);
    
    await updateDoc(versionRef, {
      versionName,
      description: description || ''
    });
  } catch (error) {
    console.error('Error naming version:', error);
    throw error;
  }
}; 