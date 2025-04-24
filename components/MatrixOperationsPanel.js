import React, { useState, useEffect } from 'react';
import styles from '../styles/MatrixOperations.module.css';

export default function MatrixOperationsPanel({ hotRef, onClose }) {
  const [matrixA, setMatrixA] = useState(Array(3).fill().map(() => Array(3).fill(0)));
  const [matrixB, setMatrixB] = useState(Array(3).fill().map(() => Array(3).fill(0)));
  const [rowsA, setRowsA] = useState(3);
  const [colsA, setColsA] = useState(3);
  const [rowsB, setRowsB] = useState(3);
  const [colsB, setColsB] = useState(3);
  const [operation, setOperation] = useState('multiply');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // State for available columns
  const [availableColumns, setAvailableColumns] = useState([]);
  const [selectedColumnsA, setSelectedColumnsA] = useState([]);
  const [selectedColumnsB, setSelectedColumnsB] = useState([]);
  const [dataIsReady, setDataIsReady] = useState(false);
  const [useTransposeB, setUseTransposeB] = useState(false);

  // When component mounts, scan the spreadsheet to find numeric columns
  useEffect(() => {
    if (!hotRef || !hotRef.current) return;
    
    const hot = hotRef.current.hotInstance;
    const allData = hot.getData();
    const colHeaders = hot.getColHeader();
    
    // Determine numeric columns
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
        numericColumns.push({
          index: col,
          // Use column header if available, otherwise use column letter
          name: colHeaders[col] || String.fromCharCode(65 + col),
          // Store a sample of data from this column
          sample: allData.slice(1, 5).map(row => row[col])
        });
      }
    }
    
    setAvailableColumns(numericColumns);
  }, [hotRef]);

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

  // Function to generate matrix from selected columns
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

  // Handle changes to column selection for Matrix A
  const handleColumnsChangeA = (event) => {
    const selectedOptions = Array.from(event.target.selectedOptions, option => Number(option.value));
    setSelectedColumnsA(selectedOptions);
    
    // Update matrix A with the new selection
    const newMatrix = generateMatrixFromSelection(selectedOptions);
    setMatrixA(newMatrix);
    setRowsA(newMatrix.length);
    setColsA(selectedOptions.length);
  };

  // Handle changes to column selection for Matrix B
  const handleColumnsChangeB = (event) => {
    const selectedOptions = Array.from(event.target.selectedOptions, option => Number(option.value));
    setSelectedColumnsB(selectedOptions);
    
    // Update matrix B with the new selection
    const newMatrix = generateMatrixFromSelection(selectedOptions);
    setMatrixB(newMatrix);
    setRowsB(newMatrix.length);
    setColsB(selectedOptions.length);
  };

  // Generate matrices from the selections
  const prepareMatrices = () => {
    if (selectedColumnsA.length === 0) {
      setError("Please select columns for Matrix A");
      return false;
    }
    
    if (needsMatrixB && selectedColumnsB.length === 0) {
      setError("Please select columns for Matrix B");
      return false;
    }
    
    const matrixAData = generateMatrixFromSelection(selectedColumnsA);
    const matrixBData = generateMatrixFromSelection(selectedColumnsB);
    
    setMatrixA(matrixAData);
    setMatrixB(matrixBData);
    setRowsA(matrixAData.length);
    setColsA(selectedColumnsA.length);
    setRowsB(matrixBData.length);
    setColsB(selectedColumnsB.length);
    setDataIsReady(true);
    setError(null);
    return true;
  };

  // Call API to perform matrix operation
  const performOperation = async () => {
    setError(null);
    
    // If matrices aren't ready yet, prepare them first
    if (!dataIsReady && !prepareMatrices()) {
      return;
    }
    
    setLoading(true);
    
    try {
      let matrixAForCalc = matrixA;
      let matrixBForCalc = useTransposeB ? transposeMatrix(matrixB) : matrixB;
      let rowsBForCalc = useTransposeB ? colsB : rowsB;
      let colsBForCalc = useTransposeB ? rowsB : colsB;
      
      // Validate matrices based on the operation
      if (operation === 'add' || operation === 'subtract') {
        if (rowsA !== rowsB || colsA !== colsB) {
          throw new Error(`Matrices must have the same dimensions for ${operation} operation`);
        }
      } else if (operation === 'multiply') {
        if (colsA !== rowsBForCalc) {
          throw new Error(`For multiplication, columns of matrix A (${colsA}) must equal rows of matrix B (${rowsBForCalc})`);
        }
      } else if (operation === 'determinant' || operation === 'inverse') {
        if (rowsA !== colsA) {
          throw new Error(`Matrix A must be square for ${operation} operation`);
        }
      }
      
      console.log("Sending matrices to server:", {
        matrix_a: matrixAForCalc,
        matrix_b: operation === 'add' || operation === 'subtract' || operation === 'multiply' ? matrixBForCalc : null,
        operation: operation
      });
      
      // If doing local calculation for development (set to false when server is available)
      const useLocalCalculation = false;
      
      if (useLocalCalculation) {
        let resultData = null;
        
        if (operation === 'add') {
          resultData = matrixAForCalc.map((row, i) => row.map((val, j) => val + matrixBForCalc[i][j]));
          setResult({
            result: resultData,
            result_type: 'matrix',
            error: null
          });
        } else if (operation === 'subtract') {
          resultData = matrixAForCalc.map((row, i) => row.map((val, j) => val - matrixBForCalc[i][j]));
          setResult({
            result: resultData,
            result_type: 'matrix',
            error: null
          });
        } else if (operation === 'transpose') {
          resultData = transposeMatrix(matrixAForCalc);
          setResult({
            result: resultData,
            result_type: 'matrix',
            error: null
          });
        } else {
          throw new Error("This operation requires the server to be running");
        }
      } else {
        const response = await fetch('http://localhost:8000/matrix-operations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            matrix_a: matrixAForCalc,
            matrix_b: operation === 'add' || operation === 'subtract' || operation === 'multiply' ? matrixBForCalc : null,
            operation: operation
          }),
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}: ${await response.text()}`);
        }
        
        const data = await response.json();
        
        if (data.error) {
          setError(data.error);
          setResult(null);
        } else {
          setResult(data);
        }
      }
    } catch (error) {
      console.error("Operation failed:", error);
      setError(`Failed to perform operation: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Export result to spreadsheet
  const exportToSpreadsheet = () => {
    if (!hotRef || !hotRef.current || !result || result.result_type === 'error') {
      return;
    }

    const hot = hotRef.current.hotInstance;
    const selected = hot.getSelected();
    let startRow = 0, startCol = 0;
    
    if (selected && selected.length > 0) {
      [startRow, startCol] = selected[0];
    }
    
    if (result.result_type === 'matrix') {
      const matrix = result.result;
      
      for (let r = 0; r < matrix.length; r++) {
        for (let c = 0; c < matrix[0].length; c++) {
          hot.setDataAtCell(startRow + r, startCol + c, matrix[r][c]);
        }
      }
    } else if (result.result_type === 'scalar') {
      hot.setDataAtCell(startRow, startCol, result.result);
    } else if (result.result_type === 'vector') {
      const vector = result.result;
      for (let i = 0; i < vector.length; i++) {
        const value = typeof vector[i] === 'object' 
          ? `${vector[i].real.toFixed(4)}${vector[i].imag >= 0 ? '+' : ''}${vector[i].imag.toFixed(4)}i` 
          : vector[i];
        hot.setDataAtCell(startRow + i, startCol, value);
      }
    }
  };

  const needsMatrixB = ['add', 'subtract', 'multiply'].includes(operation);

  return (
    <div className={styles.matrixPanel}>
      <h2>Matrix Operations</h2>
      
      <div className={styles.instructions}>
        <p><strong>Instructions:</strong></p>
        <ol>
          <li>Select columns for Matrix A and B from the dropdowns</li>
          <li>Choose an operation from the dropdown</li>
          <li>Click Calculate to perform the operation</li>
          <li>Use "Export to Spreadsheet" to send results back to the sheet</li>
        </ol>
        {operation === 'eigenvalues' && (
          <div className={styles.eigenvalueHelp}>
            <p><strong>Eigenvalue Tips:</strong></p>
            <ul>
              <li>Select a <strong>square matrix</strong> (same number of rows and columns)</li>
              <li>Complex eigenvalues will be shown in the form a+bi</li>
              <li>Use the Eigenvalue Analysis template for testing</li>
              <li>The 3×3 matrix in that template has all real eigenvalues</li>
              <li>The 2×2 rotation matrix has complex eigenvalues</li>
            </ul>
          </div>
        )}
      </div>
      
      <div className={styles.controlPanel}>
        <div className={styles.operationSelector}>
          <label>Operation:</label>
          <select 
            value={operation} 
            onChange={(e) => {
              setOperation(e.target.value);
              setDataIsReady(false);
              setResult(null);
              setError(null);
            }}
            className={styles.operationSelect}
          >
            <option value="add">Addition (A + B)</option>
            <option value="subtract">Subtraction (A - B)</option>
            <option value="multiply">Multiplication (A × B)</option>
            <option value="transpose">Transpose (A^T)</option>
            <option value="determinant">Determinant (|A|)</option>
            <option value="inverse">Inverse (A^-1)</option>
            <option value="eigenvalues">Eigenvalues</option>
          </select>
        </div>
        
        {operation === 'multiply' && (
          <div className={styles.transposeOption}>
            <input
              type="checkbox"
              id="transposeB"
              checked={useTransposeB}
              onChange={(e) => {
                setUseTransposeB(e.target.checked);
                setDataIsReady(false);
                setResult(null);
              }}
            />
            <label htmlFor="transposeB">Transpose Matrix B before multiplication</label>
          </div>
        )}
        
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
                ? `Selected ${selectedColumnsA.length} columns with ${matrixA.length} rows.` 
                : 'Hold Ctrl/Cmd to select multiple columns'}
            </p>
          </div>
          
          {needsMatrixB && (
            <div className={styles.matrixColumnSelector}>
              <h3>Matrix B Columns</h3>
              {operation === 'multiply' && (
                <p className={styles.matrixHelp}>
                  {useTransposeB 
                    ? `For matrix multiplication A×B with B transposed, columns of A (${colsA}) should equal columns of B (${colsB}).`
                    : `For matrix multiplication A×B, columns of A (${colsA}) should equal rows of B (${rowsB}).`}
                </p>
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
                  ? `Selected ${selectedColumnsB.length} columns with ${matrixB.length} rows.` 
                  : 'Hold Ctrl/Cmd to select multiple columns'}
              </p>
            </div>
          )}
        </div>
        
        {dataIsReady && (
          <div className={styles.matrixInputs}>
            <div className={styles.matrixContainer}>
              <h3>Matrix A {rowsA}×{colsA}</h3>
              <div className={styles.matrixGrid}>
                {matrixA.map((row, rowIndex) => (
                  <div key={`row-a-${rowIndex}`} className={styles.matrixRow}>
                    {row.map((cell, colIndex) => (
                      <div key={`cell-a-${rowIndex}-${colIndex}`} className={styles.resultCell}>
                        {cell.toFixed(2)}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
            
            {needsMatrixB && dataIsReady && (
              <div className={styles.matrixContainer}>
                <h3>Matrix B {rowsB}×{colsB}{useTransposeB ? ` (will be transposed to ${colsB}×${rowsB})` : ''}</h3>
                <div className={styles.matrixGrid}>
                  {matrixB.map((row, rowIndex) => (
                    <div key={`row-b-${rowIndex}`} className={styles.matrixRow}>
                      {row.map((cell, colIndex) => (
                        <div key={`cell-b-${rowIndex}-${colIndex}`} className={styles.resultCell}>
                          {cell.toFixed(2)}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        
        <div className={styles.actions}>
          <button 
            onClick={performOperation}
            className={styles.calculateButton}
            disabled={loading}
          >
            {loading ? 'Calculating...' : dataIsReady ? 'Calculate' : 'Prepare Matrices'}
          </button>
        </div>
        
        {error && (
          <div className={styles.error}>
            {error}
          </div>
        )}
        
        {result && (
          <div className={styles.result}>
            <h3>Result</h3>
            
            {result.result_type === 'matrix' && (
              <div className={styles.matrixResult}>
                <div className={styles.matrixGrid}>
                  {result.result.map((row, rowIndex) => (
                    <div key={`row-result-${rowIndex}`} className={styles.matrixRow}>
                      {row.map((cell, colIndex) => (
                        <div key={`cell-result-${rowIndex}-${colIndex}`} className={styles.resultCell}>
                          {typeof cell === 'number' ? cell.toFixed(4) : cell}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {result.result_type === 'scalar' && (
              <div className={styles.scalarResult}>
                {typeof result.result === 'number' ? result.result.toFixed(4) : result.result}
              </div>
            )}
            
            {result.result_type === 'vector' && (
              <div className={styles.vectorResult}>
                {result.result.map((val, i) => (
                  <div key={`val-${i}`} className={styles.vectorValue}>
                    {typeof val === 'object' 
                      ? `λ${i+1} = ${val.real.toFixed(4)}${val.imag >= 0 ? '+' : ''}${val.imag.toFixed(4)}i` 
                      : val}
                  </div>
                ))}
              </div>
            )}
            
            <button 
              onClick={exportToSpreadsheet}
              className={styles.exportButton}
            >
              Export to Spreadsheet
            </button>
          </div>
        )}
      </div>
    </div>
  );
}