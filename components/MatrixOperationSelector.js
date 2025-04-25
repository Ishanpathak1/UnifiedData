import React, { useState, useEffect } from 'react';
import styles from '../styles/MatrixOperationSelector.module.css';

export default function MatrixOperationSelector({ operation, hotRef, onCalculate, onCancel }) {
  const [availableColumns, setAvailableColumns] = useState([]);
  const [selectedColumnsA, setSelectedColumnsA] = useState([]);
  const [selectedColumnsB, setSelectedColumnsB] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [useTransposeB, setUseTransposeB] = useState(false);
  
  // Check if operation needs matrix B
  const needsMatrixB = ['multiply', 'add', 'subtract'].includes(operation);
  
  // Scan spreadsheet for numerical columns
  useEffect(() => {
    if (!hotRef || !hotRef.current) return;
    
    const hot = hotRef.current.hotInstance;
    const allData = hot.getData();
    
    // Find numerical columns
    const numericColumns = [];
    
    for (let col = 0; col < allData[0].length; col++) {
      let numericCount = 0;
      let totalNonEmpty = 0;
      
      // Skip header row and check data rows
      for (let row = 1; row < allData.length; row++) {
        const cellValue = allData[row][col];
        if (cellValue !== null && cellValue !== '') {
          totalNonEmpty++;
          if (!isNaN(Number(cellValue))) {
            numericCount++;
          }
        }
      }
      
      // If more than 80% of non-empty cells are numeric, consider it a numeric column
      if (totalNonEmpty > 0 && numericCount / totalNonEmpty >= 0.8) {
        // Try to get meaningful column name
        let columnName;
        
        // First try to get the header directly from Handsontable
        const header = hot.getColHeader(col);
        if (header && typeof header === 'string' && header !== String.fromCharCode(65 + col)) {
          columnName = header;
        } else {
          // Then try to use first row value
          const firstRowValue = allData[0][col];
          if (firstRowValue && firstRowValue !== '') {
            columnName = firstRowValue;
          } else {
            // Fall back to A, B, C... format
            columnName = String.fromCharCode(65 + col);
          }
        }
        
        numericColumns.push({
          index: col,
          name: columnName,
          sample: allData.slice(1, 5).map(row => row[col])
        });
      }
    }
    
    setAvailableColumns(numericColumns);
  }, [hotRef]);
  
  // Generate matrix from selected columns
  const generateMatrixFromSelection = (selectedColumns) => {
    if (!hotRef || !hotRef.current) return [];
    if (selectedColumns.length === 0) return [];
    
    const hot = hotRef.current.hotInstance;
    const allData = hot.getData();
    
    // Get valid data rows (skip header, skip empty rows)
    const validRows = [];
    for (let row = 1; row < allData.length; row++) {
      if (allData[row].some(cell => cell !== null && cell !== '')) {
        validRows.push(row);
      }
    }
    
    const matrix = [];
    
    for (const rowIdx of validRows) {
      const row = [];
      for (const colIdx of selectedColumns) {
        const value = allData[rowIdx][colIdx];
        row.push(value === null || value === '' ? 0 : Number(value));
      }
      matrix.push(row);
    }
    
    return matrix;
  };
  
  // Helper function to transpose a matrix
  const transposeMatrix = (matrix) => {
    if (!matrix.length) return [];
    const rows = matrix.length;
    const cols = matrix[0].length;
    const result = Array(cols).fill().map(() => Array(rows).fill(0));
    
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        result[c][r] = matrix[r][c];
      }
    }
    
    return result;
  };
  
  // Handle calculation button click
  const handleCalculate = async () => {
    setError(null);
    
    if (selectedColumnsA.length === 0) {
      setError("Please select columns for Matrix A");
      return;
    }
    
    if (needsMatrixB && selectedColumnsB.length === 0) {
      setError("Please select columns for Matrix B");
      return;
    }
    
    setLoading(true);
    
    try {
      const matrixA = generateMatrixFromSelection(selectedColumnsA);
      let matrixB = needsMatrixB ? generateMatrixFromSelection(selectedColumnsB) : null;
      
      const rowsA = matrixA.length;
      const colsA = matrixA[0].length;
      
      let rowsB = 0, colsB = 0;
      if (matrixB) {
        rowsB = matrixB.length;
        colsB = matrixB[0].length;
        
        if (useTransposeB) {
          matrixB = transposeMatrix(matrixB);
          const temp = rowsB;
          rowsB = colsB;
          colsB = temp;
        }
      }
      
      // Validate matrices based on the operation
      if (operation === 'add' || operation === 'subtract') {
        if (rowsA !== rowsB || colsA !== colsB) {
          throw new Error(`Matrices must have the same dimensions for ${operation} operation`);
        }
      } else if (operation === 'multiply') {
        if (colsA !== rowsB) {
          throw new Error(`For multiplication, columns of Matrix A (${colsA}) must equal rows of Matrix B (${rowsB})`);
        }
      } else if (['determinant', 'inverse', 'eigenvalues'].includes(operation)) {
        if (rowsA !== colsA) {
          throw new Error(`Matrix must be square for ${operation} operation`);
        }
      }
      
      // Call your API to perform the operation
      const response = await fetch('https://unifieddata-api-552541459765.us-central1.run.app/matrix-operations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          matrix_a: matrixA,
          matrix_b: ['add', 'subtract', 'multiply'].includes(operation) ? matrixB : null,
          operation: operation
        }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}: ${await response.text()}`);
      }
      
      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      const selectedColumnNames = selectedColumnsA.map(idx => {
        // Try to get the actual column header from Handsontable
        if (hotRef && hotRef.current) {
          const hot = hotRef.current.hotInstance;
          const header = hot.getColHeader(idx);
          
          // If it's a meaningful header (not just a letter or number)
          if (header && typeof header === 'string' && header !== String.fromCharCode(65 + idx)) {
            return header;
          }
          
          // Try to get the value from the first row, which often contains column titles
          const firstRowValue = hot.getDataAtCell(0, idx);
          if (firstRowValue && firstRowValue !== '') {
            return firstRowValue;
          }
        }
        
        // Fall back to the name from availableColumns or A, B, C... format
        return availableColumns.find(col => col.index === idx)?.name || String.fromCharCode(65 + idx);
      });
      
      // Pass the result back to parent component
      onCalculate(result, selectedColumnNames);
    } catch (error) {
      console.error("Operation failed:", error);
      setError(`Failed to perform operation: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Handle column selection for Matrix A
  const handleColumnsChangeA = (event) => {
    const selectedOptions = Array.from(event.target.selectedOptions, option => Number(option.value));
    setSelectedColumnsA(selectedOptions);
  };
  
  // Handle column selection for Matrix B
  const handleColumnsChangeB = (event) => {
    const selectedOptions = Array.from(event.target.selectedOptions, option => Number(option.value));
    setSelectedColumnsB(selectedOptions);
  };
  
  // Render the component
  return (
    <div className={styles.operationSelector}>
      <h4>{operation.charAt(0).toUpperCase() + operation.slice(1)} Operation</h4>
      
      <div className={styles.columnSelectors}>
        <div className={styles.matrixColumnSelector}>
          <h3>Matrix A Columns</h3>
          <select 
            multiple 
            size="5"
            onChange={handleColumnsChangeA}
            className={styles.columnMultiSelect}
          >
            {availableColumns.map(column => (
              <option key={`col-a-${column.index}`} value={column.index}>
                {column.name} {column.sample.slice(0, 2).map(v => v !== null && v !== '' ? Number(v) : 0).join(', ')}...
              </option>
            ))}
          </select>
          <p className={styles.selectionHint}>
            {selectedColumnsA.length > 0 
              ? `Selected ${selectedColumnsA.length} columns` 
              : 'Hold Ctrl/Cmd to select multiple columns'}
          </p>
        </div>
        
        {needsMatrixB && (
          <div className={styles.matrixColumnSelector}>
            <h3>Matrix B Columns</h3>
            {operation === 'multiply' && (
              <div className={styles.transposeOption}>
                <input
                  type="checkbox"
                  id="aiTransposeB"
                  checked={useTransposeB}
                  onChange={(e) => setUseTransposeB(e.target.checked)}
                />
                <label htmlFor="aiTransposeB">Transpose Matrix B</label>
              </div>
            )}
            <select 
              multiple 
              size="5"
              onChange={handleColumnsChangeB}
              className={styles.columnMultiSelect}
            >
              {availableColumns.map(column => (
                <option key={`col-b-${column.index}`} value={column.index}>
                  {column.name} {column.sample.slice(0, 2).map(v => v !== null && v !== '' ? Number(v) : 0).join(', ')}...
                </option>
              ))}
            </select>
            <p className={styles.selectionHint}>
              {selectedColumnsB.length > 0 
                ? `Selected ${selectedColumnsB.length} columns` 
                : 'Hold Ctrl/Cmd to select multiple columns'}
            </p>
          </div>
        )}
      </div>
      
      {error && (
        <div className={styles.error}>
          {error}
        </div>
      )}
      
      <div className={styles.actions}>
        <button 
          onClick={handleCalculate}
          className={styles.calculateButton}
          disabled={loading}
        >
          {loading ? 'Calculating...' : 'Calculate'}
        </button>
        <button 
          onClick={onCancel}
          className={styles.cancelButton}
        >
          Cancel
        </button>
      </div>
      
      {operation === 'pca' && (
        <div className={styles.pcaHelp}>
          <p><strong>PCA Tips:</strong></p>
          <ul>
            <li>Select <strong>numeric columns</strong> that you want to analyze</li>
            <li>PCA works best with standardized data (which will be handled automatically)</li>
            <li>The result will show how much variance each principal component explains</li>
            <li>You can export the transformed data to your spreadsheet</li>
          </ul>
        </div>
      )}
    </div>
  );
} 