import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'react-hot-toast';

/**
 * Load spreadsheet data from Firestore
 */
export const loadSpreadsheetData = async (
  id,
  user,
  setSpreadsheetId,
  setDocumentTitle,
  setSheets,
  setActiveSheetId,
  setData,
  allSheetsRef,
  router
) => {
  if (!user) return;
  
  try {
    const docRef = doc(db, 'spreadsheets', id);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const sheetData = docSnap.data();
      
      setSpreadsheetId(id);
      
      if (sheetData.ownerId === user.uid) {
        // Set title
        if (sheetData.title) {
          setDocumentTitle(sheetData.title);
        } else {
          setDocumentTitle('Untitled spreadsheet');
        }
        
        // Load sheets data
        if (sheetData.sheets && Array.isArray(sheetData.sheets) && sheetData.sheets.length > 0) {
          // Convert sheet data back to 2D arrays
          const processedSheets = sheetData.sheets.map(sheet => {
            let reconstructedData = [['', '', '', ''], ['', '', '', '']];
            let reconstructedFormatting = [];
            
            // Check if data is in the converted format (objects instead of arrays)
            if (sheet.data && Array.isArray(sheet.data) && 
                sheet.data.length > 0 && typeof sheet.data[0] === 'object' && 
                !Array.isArray(sheet.data[0])) {
              
              // Find the global maximum column index across ALL rows
              let maxColIndex = 0;
              sheet.data.forEach(row => {
                const rowKeys = Object.keys(row).filter(key => key.startsWith('cell_'));
                if (rowKeys.length > 0) {
                  const rowMaxIndex = Math.max(...rowKeys.map(key => 
                    parseInt(key.replace('cell_', ''))
                  ));
                  maxColIndex = Math.max(maxColIndex, rowMaxIndex);
                }
              });
              
              // Convert back to 2D array, ensuring all rows have the same number of columns
              reconstructedData = sheet.data
                .sort((a, b) => (a.rowIndex || 0) - (b.rowIndex || 0))
                .map(row => {
                  const newRow = [];
                  // Ensure each row has cells from 0 to maxColIndex
                  for (let i = 0; i <= maxColIndex; i++) {
                    newRow.push(row[`cell_${i}`] || '');
                  }
                  return newRow;
                });
              
              // Process formatting if available
              if (sheet.formatting && Array.isArray(sheet.formatting) && sheet.formatting.length > 0) {
                reconstructedFormatting = sheet.formatting.map(row => {
                  const formatRow = {};
                  
                  // If the row has a rowIndex, use it
                  if (row.rowIndex !== undefined) {
                    formatRow.rowIndex = row.rowIndex;
                  }
                  
                  // Process each format entry
                  Object.keys(row).forEach(key => {
                    if (key.startsWith('format_')) {
                      formatRow[key] = row[key];
                    }
                  });
                  
                  return formatRow;
                });
              }
            } else if (Array.isArray(sheet.data)) {
              // Data is already a 2D array
              reconstructedData = sheet.data;
            }
            
            return {
              id: sheet.id || `sheet_${Date.now()}_${Math.random().toString(36).substring(7)}`,
              name: sheet.name || `Sheet ${Math.random().toString(36).substring(7)}`,
              data: reconstructedData,
              formatting: reconstructedFormatting
            };
          });
          
          // Set the active sheet ID to the first sheet if we don't have one already
          const activeSheetId = processedSheets[0].id;
          setActiveSheetId(activeSheetId);
          
          // Set the sheets state
          setSheets(processedSheets);
          
          // Also update the ref
          allSheetsRef.current = [...processedSheets];
          
          // Load the data from the active sheet into the grid
          const activeSheet = processedSheets[0];
          if (activeSheet) {
            setData(activeSheet.data || []);
          }
          
          return {
            success: true,
            sheets: processedSheets,
            activeSheetId
          };
        } else {
          // No sheets found, create a default one
          const defaultSheet = {
            id: 'default',
            name: 'Main Sheet',
            data: [['', '', '', ''], ['', '', '', '']]
          };
          
          setSheets([defaultSheet]);
          allSheetsRef.current = [defaultSheet];
          setActiveSheetId(defaultSheet.id);
          setData(defaultSheet.data);
          
          return {
            success: true,
            sheets: [defaultSheet],
            activeSheetId: defaultSheet.id
          };
        }
      } else {
        // Not the owner
        toast.error("You don't have permission to view this spreadsheet");
        router.push('/');
        return {
          success: false,
          error: "Permission denied"
        };
      }
    } else {
      // Document doesn't exist
      console.error('Spreadsheet not found:', id);
      toast.error('Spreadsheet not found');
      router.push('/');
      return {
        success: false,
        error: "Spreadsheet not found"
      };
    }
  } catch (error) {
    console.error('Error loading spreadsheet:', error);
    toast.error('Failed to load spreadsheet');
    return {
      success: false,
      error: error.message
    };
  }
};

export default loadSpreadsheetData; 