import HyperFormula from 'hyperformula';

/**
 * Formula Engine for spreadsheet
 * Handles formula calculation and processing using HyperFormula
 */

// Configure HyperFormula instance
const hyperFormulaConfig = {
  licenseKey: 'gpl-v3',
  precisionRounding: 10,
  useColumnIndex: true,
  useRowIndex: true,
  // Match Excel/Google Sheets behavior with functions
  functionsMatch: 'excel-compatible'
};

// Initialize HyperFormula instance
let hfInstance = null;

/**
 * Initialize or get the HyperFormula instance
 * @returns {HyperFormula} The HyperFormula instance
 */
export const getHyperFormulaInstance = () => {
  if (!hfInstance) {
    try {
      // Create a more robust configuration with error handling
      const safeConfig = {
        ...hyperFormulaConfig,
        // Add error handling options
        maxColumns: 1000, // Prevent excessive memory usage
        maxRows: 10000,   // Prevent excessive memory usage
        licenseKey: 'gpl-v3',
        useArrayArithmetic: true, // Better handling of array formulas
        evaluateNullToZero: false, // More Excel-like behavior
      };
      
      // Try to build the instance
      hfInstance = HyperFormula.buildEmpty(safeConfig);
      
      // Add an initial sheet
      hfInstance.addSheet('Main');
      
    } catch (error) {
      console.error("Failed to initialize HyperFormula:", error);
      
      // Try with minimal configuration as fallback
      try {
        hfInstance = HyperFormula.buildEmpty({
          licenseKey: 'gpl-v3'
        });
      } catch (e) {
        console.error("Critical failure initializing formula engine:", e);
        // Create a mock HyperFormula with minimal functionality to prevent crashes
        hfInstance = createMockHyperFormula();
      }
    }
  }
  return hfInstance;
};

/**
 * Creates a minimal mock implementation of HyperFormula that won't crash
 * Used as a last resort if real initialization fails
 */
const createMockHyperFormula = () => {
  return {
    addSheet: (name) => 0,
    getSheetNames: () => ['Main'],
    getSheetId: () => 0,
    setSheetContent: () => {},
    calculateFormula: () => '#ERROR!',
    getCellValue: () => null,
    setCellContents: () => {},
    removeSheet: () => {},
    destroy: () => {}
  };
};

/**
 * Resets the HyperFormula instance
 * Useful when loading a completely new spreadsheet
 */
export const resetFormulaEngine = () => {
  try {
    if (hfInstance) {
      try {
        hfInstance.destroy();
      } catch (e) {
        console.warn("Error destroying HyperFormula instance:", e);
      }
      hfInstance = null;
    }
    
    // Get a fresh instance
    const newInstance = getHyperFormulaInstance();
    
    // Make sure we have at least one sheet
    try {
      const sheetNames = newInstance.getSheetNames();
      if (!sheetNames || sheetNames.length === 0) {
        newInstance.addSheet('Main');
      }
    } catch (e) {
      console.warn("Error checking sheets during reset:", e);
      // Try to add a sheet directly as fallback
      try {
        newInstance.addSheet('Main');
      } catch (sheetError) {
        console.error("Failed to add sheet during reset:", sheetError);
      }
    }
    
    return newInstance;
  } catch (error) {
    console.error("Error resetting formula engine:", error);
    
    // Force a complete new instance if anything fails
    hfInstance = null;
    return getHyperFormulaInstance();
  }
};

/**
 * Update formula engine with new data
 * @param {Array} data - 2D array of spreadsheet data
 * @returns {HyperFormula} Updated HyperFormula instance
 */
export const updateFormulaData = (data) => {
  const hf = getHyperFormulaInstance();
  
  try {
    // Clear existing sheets and add new one
    // Use the correct API method: getSheetId instead of getSheetIds
    const sheetNames = hf.getSheetNames();
    
    // Remove all sheets except the first one (if exists)
    if (sheetNames && sheetNames.length > 0) {
      // Keep only the first sheet or create a new one if none exist
      const firstSheetName = sheetNames[0];
      const firstSheetId = hf.getSheetId(firstSheetName);
      
      // Remove additional sheets (keep the first one)
      sheetNames.slice(1).forEach(name => {
        const id = hf.getSheetId(name);
        if (id !== undefined) {
          try {
            hf.removeSheet(id);
          } catch (e) {
            console.warn("Error removing sheet:", e);
          }
        }
      });
      
      // If we have at least one sheet, clear it and set new content
      if (firstSheetId !== undefined) {
        hf.setSheetContent(firstSheetId, data);
        return hf;
      }
    }
    
    // If we don't have any sheets or couldn't find an existing sheet ID,
    // create a new one
    const newSheetId = hf.addSheet('Main');
    hf.setSheetContent(newSheetId, data);
    
    return hf;
  } catch (error) {
    console.error("Error updating formula data:", error);
    
    // Try a complete reset if updating fails
    resetFormulaEngine();
    const newInstance = getHyperFormulaInstance();
    const newSheetId = newInstance.addSheet('Main');
    newInstance.setSheetContent(newSheetId, data);
    
    return newInstance;
  }
};

/**
 * Add a sheet to the formula engine
 * @param {string} sheetName - Name of the sheet
 * @param {Array} data - 2D array of sheet data
 * @returns {number} The ID of the newly created sheet
 */
export const addFormulaSheet = (sheetName, data) => {
  try {
    const hf = getHyperFormulaInstance();
    
    // Check if a sheet with this name already exists
    const existingSheetNames = hf.getSheetNames();
    const sheetExists = existingSheetNames.includes(sheetName);
    
    if (sheetExists) {
      // If sheet exists, update its content
      const sheetId = hf.getSheetId(sheetName);
      if (sheetId !== undefined) {
        hf.setSheetContent(sheetId, data || [[]]);
        return sheetId;
      }
    }
    
    // Otherwise create a new sheet
    const sheetId = hf.addSheet(sheetName);
    hf.setSheetContent(sheetId, data || [[]]);
    return sheetId;
  } catch (error) {
    console.error("Error adding formula sheet:", error);
    
    // Try with a default approach if the above fails
    try {
      const hf = getHyperFormulaInstance();
      const sheetId = hf.addSheet(sheetName || 'Sheet');
      if (data && data.length > 0) {
        hf.setSheetContent(sheetId, data);
      }
      return sheetId;
    } catch (e) {
      console.error("Failed to add sheet even with fallback approach:", e);
      return 0; // Return default sheet ID as fallback
    }
  }
};

/**
 * Evaluate a formula string
 * @param {string} formula - Formula string (e.g., "=SUM(A1:A5)")
 * @param {number} row - Current row position
 * @param {number} col - Current column position
 * @param {number} sheetId - Sheet ID (default: 0)
 * @returns {*} The calculated result
 */
export const evaluateFormula = (formula, row, col, sheetId = 0) => {
  try {
    const hf = getHyperFormulaInstance();
    
    // If the formula doesn't start with '=', just return it as is
    if (!formula || typeof formula !== 'string' || !formula.startsWith('=')) {
      return formula;
    }
    
    // Make sure we have a valid sheet to work with
    const sheetNames = hf.getSheetNames();
    if (!sheetNames || sheetNames.length === 0) {
      // Create a main sheet if none exist
      sheetId = hf.addSheet('Main');
    } else if (typeof sheetId === 'number') {
      // If a numeric sheetId was provided, ensure it's valid
      const validSheetIds = sheetNames.map(name => hf.getSheetId(name));
      if (!validSheetIds.includes(sheetId)) {
        sheetId = hf.getSheetId(sheetNames[0]);
      }
    }
    
    // Try to parse and calculate the formula
    try {
      // First, try using the formula parser API
      return hf.calculateFormula(formula, { row, col, sheet: sheetId });
    } catch (parseError) {
      console.warn("Formula parse error, trying alternative approach:", parseError);
      
      // Alternative approach: try to set the formula in a temporary location and get the value
      const tempRow = 0;
      const tempCol = 0;
      
      // Store original cell values to restore later
      let originalValue = null;
      try {
        originalValue = hf.getCellValue({ sheet: sheetId, row: tempRow, col: tempCol });
      } catch (e) {
        // Ignore if we can't get the original value
      }
      
      // Set the formula in a temporary cell
      hf.setCellContents({ sheet: sheetId, row: tempRow, col: tempCol }, formula);
      
      // Get the calculated value
      const result = hf.getCellValue({ sheet: sheetId, row: tempRow, col: tempCol });
      
      // Restore the original value
      if (originalValue !== null) {
        hf.setCellContents({ sheet: sheetId, row: tempRow, col: tempCol }, originalValue);
      }
      
      return result;
    }
  } catch (error) {
    console.error('Formula evaluation error:', error);
    return '#ERROR!';
  }
};

/**
 * Convert column letter to index (A -> 0, B -> 1, etc.)
 * @param {string} colStr - Column letter(s)
 * @returns {number} Column index
 */
export const colStrToIndex = (colStr) => {
  if (!colStr || typeof colStr !== 'string') return -1;
  
  let result = 0;
  for (let i = 0; i < colStr.length; i++) {
    result = result * 26 + (colStr.charCodeAt(i) - 64);
  }
  return result - 1; // 0-based index
};

/**
 * Convert column index to letter (0 -> A, 1 -> B, etc.)
 * @param {number} index - Column index
 * @returns {string} Column letter(s)
 */
export const indexToColStr = (index) => {
  if (index < 0) return '';
  
  let colStr = '';
  let n = index;
  
  while (n >= 0) {
    colStr = String.fromCharCode((n % 26) + 65) + colStr;
    n = Math.floor(n / 26) - 1;
  }
  
  return colStr;
};

/**
 * Parse a cell reference (e.g., "A1") into row and column indices
 * @param {string} cellRef - Cell reference (e.g., "A1")
 * @returns {Object} Object with row and col properties (0-based)
 */
export const parseCellReference = (cellRef) => {
  if (!cellRef || typeof cellRef !== 'string') {
    return { row: -1, col: -1 };
  }
  
  const match = cellRef.match(/([A-Za-z]+)([0-9]+)/);
  if (!match) {
    return { row: -1, col: -1 };
  }
  
  const colStr = match[1].toUpperCase();
  const rowStr = match[2];
  
  return {
    row: parseInt(rowStr, 10) - 1, // Convert to 0-based
    col: colStrToIndex(colStr)
  };
};

/**
 * Get cell value from HyperFormula
 * @param {number} row - Row index (0-based)
 * @param {number} col - Column index (0-based)
 * @param {number} sheetId - Sheet ID (default: 0)
 * @returns {*} Cell value
 */
export const getCellValue = (row, col, sheetId = 0) => {
  const hf = getHyperFormulaInstance();
  try {
    return hf.getCellValue({ sheet: sheetId, row, col });
  } catch (error) {
    console.error('Error getting cell value:', error);
    return null;
  }
};

/**
 * Configure Handsontable to use HyperFormula
 * @param {Object} hot - Handsontable instance
 */
export const configureHandsontableFormulas = (hot) => {
  if (!hot) return;
  
  try {
    const hf = getHyperFormulaInstance();
    
    // Make sure we have a default sheet
    const sheetNames = hf.getSheetNames();
    let mainSheetId;
    
    if (!sheetNames || sheetNames.length === 0) {
      mainSheetId = hf.addSheet('Main');
      try {
        hf.setSheetContent(mainSheetId, hot.getData() || [[]]);
      } catch (e) {
        console.warn("Error setting initial sheet content:", e);
      }
    } else {
      mainSheetId = hf.getSheetId(sheetNames[0]);
    }
    
    // Add hook to process formulas when cells change
    hot.addHook('beforeValueRender', (value, cellProperties) => {
      if (typeof value === 'string' && value.startsWith('=')) {
        try {
          const { row, col } = cellProperties;
          return evaluateFormula(value, row, col, mainSheetId);
        } catch (e) {
          console.warn("Formula render error:", e);
          return '#ERROR!';
        }
      }
      return value;
    });
    
    // Update formula engine when data changes
    hot.addHook('afterChange', (changes, source) => {
      if (!changes) return;
      
      try {
        if (source === 'loadData') {
          // When loading data, update the entire formula engine
          updateFormulaData(hot.getData());
        } else if (Array.isArray(changes)) {
          // Get the current active sheet
          const activeSheetId = mainSheetId;
          
          // When making individual changes, update cells one by one
          changes.forEach(([row, col, oldValue, newValue]) => {
            if (row === undefined || col === undefined) return;
            
            try {
              if (typeof newValue === 'string' && newValue.startsWith('=')) {
                // If new value is a formula, make sure it's registered properly
                hf.setCellContents({ sheet: activeSheetId, row, col }, newValue);
              } else {
                // For regular values, just update cell content
                hf.setCellContents({ sheet: activeSheetId, row, col }, newValue);
              }
            } catch (cellError) {
              console.warn(`Error updating cell (${row}, ${col}):`, cellError);
            }
          });
        }
      } catch (hookError) {
        console.error("Error in afterChange hook:", hookError);
      }
    });
  } catch (error) {
    console.error("Error configuring Handsontable formulas:", error);
    
    // Set up a minimal fallback for formula handling if configuration fails
    try {
      hot.addHook('beforeValueRender', (value) => {
        if (typeof value === 'string' && value.startsWith('=')) {
          return '#ERROR!'; // Show error for formulas if HyperFormula setup failed
        }
        return value;
      });
    } catch (e) {
      // Silently fail if even the fallback fails
    }
  }
}; 