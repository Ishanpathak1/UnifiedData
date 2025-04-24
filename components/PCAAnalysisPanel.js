import React, { useState, useEffect } from 'react';
import styles from '../styles/PCAAnalysis.module.css';

export default function PCAAnalysisPanel({ hotRef, onClose }) {
  const [availableColumns, setAvailableColumns] = useState([]);
  const [selectedColumns, setSelectedColumns] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pcaResult, setPcaResult] = useState(null);
  
  // When component mounts, scan spreadsheet for numerical columns
  useEffect(() => {
    if (!hotRef || !hotRef.current) return;
    
    const hot = hotRef.current.hotInstance;
    const allData = hot.getData();
    const colHeaders = hot.getColHeader();
    
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
      // Check if the row has at least one non-empty value in selected columns
      const hasValue = selectedColumns.some(colIdx => {
        const value = allData[row][colIdx];
        return value !== null && value !== '' && !isNaN(Number(value));
      });
      
      if (hasValue) {
        validRows.push(row);
      }
    }
    
    const matrix = [];
    
    for (const rowIdx of validRows) {
      const row = [];
      let rowIsValid = true;
      
      for (const colIdx of selectedColumns) {
        const value = allData[rowIdx][colIdx];
        // Convert to number or use 0 as fallback
        const numValue = value !== null && value !== '' && !isNaN(Number(value)) 
          ? Number(value) 
          : null;
        
        // If any cell is null, skip the entire row
        if (numValue === null) {
          rowIsValid = false;
          break;
        }
        
        row.push(numValue);
      }
      
      // Only add rows where all cells are valid numbers
      if (rowIsValid && row.length === selectedColumns.length) {
        matrix.push(row);
      }
    }
    
    return matrix;
  };
  
  // Handle column selection
  const handleColumnsChange = (event) => {
    const selectedOptions = Array.from(event.target.selectedOptions, option => Number(option.value));
    setSelectedColumns(selectedOptions);
  };
  
  // Perform PCA analysis
  const performPCA = async () => {
    setError(null);
    
    if (selectedColumns.length < 2) {
      setError("Please select at least 2 columns for PCA");
      return;
    }
    
    setLoading(true);
    
    try {
      const matrixData = generateMatrixFromSelection(selectedColumns);
      
      if (matrixData.length < 2) {
        setError("Need at least 2 valid rows of data for PCA. Please ensure your selected columns have numeric values.");
        setLoading(false);
        return;
      }
      
      // Make sure there are no null values
      const hasNulls = matrixData.some(row => 
        row.some(cell => cell === null || cell === undefined || isNaN(cell))
      );
      
      if (hasNulls) {
        setError("Cannot perform PCA with missing or non-numeric values. Please clean your data first.");
        setLoading(false);
        return;
      }
      
      // Call your API to perform PCA
      const response = await fetch('http://localhost:8000/matrix-operations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          matrix_a: matrixData,
          operation: 'pca'
        }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}: ${await response.text()}`);
      }
      
      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      setPcaResult(result);
    } catch (error) {
      console.error("PCA failed:", error);
      setError(`Failed to perform PCA: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Export PCA results to spreadsheet
  const exportToSpreadsheet = () => {
    if (!hotRef || !hotRef.current || !pcaResult) return;
    
    const hot = hotRef.current.hotInstance;
    const selected = hot.getSelected();
    let startRow = 0, startCol = 0;
    
    if (selected && selected.length > 0) {
      [startRow, startCol] = selected[0];
    }
    
    // Export transformed data
    const transformedData = pcaResult.result;
    
    // First row: PC headers
    for (let i = 0; i < transformedData[0].length; i++) {
      hot.setDataAtCell(startRow, startCol + i, `PC${i+1}`);
    }
    
    // Additional column for explained variance
    hot.setDataAtCell(startRow, startCol + transformedData[0].length, "Explained Variance");
    
    // Data rows
    for (let r = 0; r < transformedData.length; r++) {
      for (let c = 0; c < transformedData[r].length; c++) {
        hot.setDataAtCell(startRow + r + 1, startCol + c, transformedData[r][c]);
      }
    }
    
    // Explained variance column
    for (let i = 0; i < pcaResult.explained_variance.length; i++) {
      hot.setDataAtCell(startRow + 1 + i, startCol + transformedData[0].length, 
                        pcaResult.explained_variance[i]);
    }
  };
  
  return (
    <div className={styles.pcaPanel}>
      <h2>Principal Component Analysis (PCA)</h2>
      
      <div className={styles.instructions}>
        <p><strong>Instructions:</strong></p>
        <ol>
          <li>Select numeric columns from the dropdown</li>
          <li>Click "Run PCA" to perform the analysis</li>
          <li>Use "Export Results" to send the principal components to your spreadsheet</li>
        </ol>
        
        <div className={styles.pcaHelp}>
          <p><strong>PCA Tips:</strong></p>
          <ul>
            <li>Select <strong>at least 2 numeric columns</strong> for meaningful results</li>
            <li>Each column represents a different variable or feature</li>
            <li>Each row represents an observation or sample</li>
            <li>PCA works best with variables on different scales (e.g., height, weight, age)</li>
          </ul>
        </div>
      </div>
      
      <div className={styles.columnSelectors}>
        <div className={styles.columnSelector}>
          <h3>Select Columns for PCA</h3>
          <select 
            multiple 
            size="5"
            onChange={handleColumnsChange}
            className={styles.columnMultiSelect}
          >
            {availableColumns.map(column => (
              <option key={`col-${column.index}`} value={column.index}>
                {column.name} {column.sample.slice(0, 2).map(v => v !== null && v !== '' ? Number(v) : 0).join(', ')}...
              </option>
            ))}
          </select>
          <p className={styles.selectionHint}>
            {selectedColumns.length > 0 
              ? `Selected ${selectedColumns.length} columns` 
              : 'Hold Ctrl/Cmd to select multiple columns'}
          </p>
        </div>
      </div>
      
      {error && (
        <div className={styles.error}>
          {error}
        </div>
      )}
      
      <div className={styles.actions}>
        <button 
          onClick={performPCA}
          className={styles.runButton}
          disabled={loading}
        >
          {loading ? 'Running PCA...' : 'Run PCA'}
        </button>
        <button 
          onClick={onClose}
          className={styles.cancelButton}
        >
          Close
        </button>
      </div>
      
      {pcaResult && (
        <div className={styles.pcaResult}>
          <h3>PCA Results</h3>
          
          <div className={styles.explainedVariance}>
            <h4>Explained Variance</h4>
            {pcaResult.explained_variance.map((val, i) => (
              <div key={`var-${i}`} className={styles.varianceBar}>
                <div className={styles.varianceLabel}>PC{i+1}</div>
                <div 
                  className={styles.varianceValue} 
                  style={{width: `${Math.min(val * 100, 100)}%`}}
                >
                  {(val * 100).toFixed(1)}%
                </div>
              </div>
            ))}
            <p className={styles.totalVariance}>
              Total variance explained: 
              {(pcaResult.explained_variance.reduce((a, b) => a + b, 0) * 100).toFixed(1)}%
            </p>
          </div>
          
          <div className={styles.componentLoadings}>
            <h4>Component Loadings (Feature Importance)</h4>
            <p className={styles.loadingsExplanation}>
              These values show how much each original feature contributes to each principal component.
              Higher absolute values (positive or negative) indicate stronger influence.
            </p>
            
            <div className={styles.dataTable}>
              <div className={styles.tableHeader}>
                <div className={styles.headerCell}>Feature</div>
                {pcaResult.components && pcaResult.components[0] && 
                  Array.from({length: pcaResult.components.length}).map((_, i) => (
                    <div key={`header-${i}`} className={styles.headerCell}>PC{i+1}</div>
                  ))}
              </div>
              
              {pcaResult.components && pcaResult.components[0] && 
                pcaResult.components[0].map((_, colIdx) => (
                  <div key={`row-${colIdx}`} className={styles.tableRow}>
                    <div className={styles.featureCell}>
                      {availableColumns.find(col => col.index === selectedColumns[colIdx])?.name || `Feature ${colIdx+1}`}
                    </div>
                    
                    {pcaResult.components.map((component, pcIdx) => {
                      const value = component[colIdx];
                      const absValue = Math.abs(value);
                      // Color based on importance (darker = more important)
                      const isImportant = absValue > 0.3;
                      
                      return (
                        <div 
                          key={`loading-${colIdx}-${pcIdx}`} 
                          className={`${styles.loadingCell} ${isImportant ? styles.importantLoading : ''}`}
                          style={{
                            backgroundColor: value > 0 
                              ? `rgba(25, 118, 210, ${Math.min(absValue * 0.8, 0.8)})` 
                              : `rgba(220, 0, 78, ${Math.min(absValue * 0.8, 0.8)})`,
                            color: absValue > 0.4 ? 'white' : 'black'
                          }}
                        >
                          {value.toFixed(2)}
                        </div>
                      );
                    })}
                  </div>
                ))
              }
            </div>
            
            <div className={styles.loadingsLegend}>
              <div className={styles.legendItem}>
                <span className={styles.positiveLoading}></span> Positive correlation
              </div>
              <div className={styles.legendItem}>
                <span className={styles.negativeLoading}></span> Negative correlation
              </div>
              <div className={styles.legendNote}>
                Stronger colors indicate more important features for each component
              </div>
            </div>
          </div>
          
          <div className={styles.transformedData}>
            <h4>Transformed Data (First 5 rows)</h4>
            <div className={styles.dataTable}>
              <div className={styles.tableHeader}>
                {Array.from({length: pcaResult.result[0].length}).map((_, i) => (
                  <div key={`header-${i}`} className={styles.headerCell}>PC{i+1}</div>
                ))}
              </div>
              {pcaResult.result.slice(0, 5).map((row, rowIndex) => (
                <div key={`row-${rowIndex}`} className={styles.tableRow}>
                  {row.map((cell, colIndex) => (
                    <div key={`cell-${rowIndex}-${colIndex}`} className={styles.tableCell}>
                      {typeof cell === 'number' ? cell.toFixed(2) : cell}
                    </div>
                  ))}
                </div>
              ))}
              {pcaResult.result.length > 5 && (
                <div className={styles.tableFooter}>
                  ...and {pcaResult.result.length - 5} more rows
                </div>
              )}
            </div>
          </div>
          
          <div className={styles.resultActions}>
            <button 
              onClick={exportToSpreadsheet}
              className={styles.exportButton}
            >
              Export Results to Spreadsheet
            </button>
          </div>
        </div>
      )}
    </div>
  );
} 