import React, { useState, useEffect, useRef } from 'react';
import styles from '../styles/CorrelationAnalysis.module.css';
import { 
  Chart, 
  LinearScale, 
  CategoryScale, 
  PointElement,
  LineElement,
  ScatterController,
  Tooltip, 
  Legend, 
  Title 
} from 'chart.js';
import { MatrixController, MatrixElement } from 'chartjs-chart-matrix';

// Register required components
Chart.register(
  MatrixController,
  MatrixElement,
  ScatterController,
  PointElement,
  LineElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend,
  Title
);

const CorrelationAnalysisPanel = ({ hotRef, onClose }) => {
  const [availableColumns, setAvailableColumns] = useState([]);
  const [selectedColumns, setSelectedColumns] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [correlationResult, setCorrelationResult] = useState(null);
  const [selectedCell, setSelectedCell] = useState(null);
  const [correlationMethod, setCorrelationMethod] = useState('pearson');
  const [viewMode, setViewMode] = useState('table');
  
  // Refs for charts
  const scatterChartRef = useRef(null);
  const scatterChartInstance = useRef(null);
  const heatmapChartRef = useRef(null);
  const heatmapChartInstance = useRef(null);
  
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
      // Check if the row has all valid values in selected columns
      const hasAllValues = selectedColumns.every(colIdx => {
        const value = allData[row][colIdx];
        return value !== null && value !== '' && !isNaN(Number(value));
      });
      
      if (hasAllValues) {
        validRows.push(row);
      }
    }
    
    const matrix = [];
    
    for (const rowIdx of validRows) {
      const row = [];
      for (const colIdx of selectedColumns) {
        const value = allData[rowIdx][colIdx];
        row.push(Number(value));
      }
      matrix.push(row);
    }
    
    return matrix;
  };
  
  // Handle column selection
  const handleColumnsChange = (event) => {
    const selectedOptions = Array.from(event.target.selectedOptions, option => Number(option.value));
    setSelectedColumns(selectedOptions);
  };
  
  // Handle method change separately
  const handleMethodChange = (event) => {
    const newMethod = event.target.value;
    setCorrelationMethod(newMethod);
    setSelectedCell(null);
  };
  
  // Completely rewrite the performCorrelation function
  const performCorrelation = async (methodToUse) => {
    setError(null);
    
    if (selectedColumns.length < 2) {
      setError("Please select at least 2 columns for correlation analysis");
      return;
    }
    
    setLoading(true);
    
    try {
      // Ensure methodToUse is a string
      const method = String(methodToUse || correlationMethod);
      
      // Generate matrix data
      const matrixData = generateMatrixFromSelection(selectedColumns);
      
      if (matrixData.length < 3) {
        setError("Need at least 3 valid rows of data for correlation. Please ensure your selected columns have numeric values.");
        setLoading(false);
        return;
      }
      
      // Get column names as plain strings
      const columnNames = selectedColumns.map(idx => {
        const column = availableColumns.find(col => col.index === idx);
        return column ? String(column.name) : `Column ${idx+1}`;
      });
      
      // Create a clean object with primitive values
      const requestBody = JSON.stringify({
        data: matrixData,
        columns: columnNames,
        method: method
      });
      
      console.log("Request body:", requestBody.substring(0, 100) + "...");
      
      // Call API with the data
      const response = await fetch('https://unifieddata-api-552541459765.us-central1.run.app/correlation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: requestBody
      });
      
      if (!response.ok) {
        throw new Error(`API returned status code ${response.status}: ${response.statusText}`);
      }
      
      const responseText = await response.text();
      const result = JSON.parse(responseText);
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      // Save results
      setCorrelationResult({
        matrix: result.matrix,
        p_values: result.p_values,
        columnNames: columnNames,
        size: selectedColumns.length,
        method: method
      });
    } catch (error) {
      console.error("Correlation failed:", error);
      setError(`Failed to perform correlation analysis: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Helper to determine cell color based on correlation value
  const getCorrelationColor = (value) => {
    // Strong positive correlation: blue
    if (value >= 0.7) return 'rgba(25, 118, 210, 0.8)';
    // Moderate positive correlation: light blue
    if (value >= 0.3) return 'rgba(25, 118, 210, 0.5)';
    // Weak positive correlation: very light blue
    if (value > 0) return 'rgba(25, 118, 210, 0.2)';
    // No correlation: white
    if (value === 0) return 'white';
    // Weak negative correlation: very light red
    if (value > -0.3) return 'rgba(220, 0, 78, 0.2)';
    // Moderate negative correlation: light red
    if (value > -0.7) return 'rgba(220, 0, 78, 0.5)';
    // Strong negative correlation: red
    return 'rgba(220, 0, 78, 0.8)';
  };
  
  // Helper to determine text color based on background color
  const getTextColor = (correlationValue) => {
    return Math.abs(correlationValue) >= 0.7 ? 'white' : 'black';
  };
  
  // Helper to get significance indicators based on p-value
  const getSignificanceIndicator = (pValue) => {
    if (pValue === null || pValue === undefined || isNaN(pValue)) return '';
    if (pValue < 0.001) return '***';
    if (pValue < 0.01) return '**';
    if (pValue < 0.05) return '*';
    return '';
  };
  
  // Function to handle cell click and show scatter plot
  const handleCellClick = (rowIdx, colIdx) => {
    if (rowIdx === colIdx) return; // Don't show scatter for self-correlations
    
    setSelectedCell({ row: rowIdx, col: colIdx });
    
    // Get the data for the two selected columns
    if (!hotRef || !hotRef.current) return;
    
    const hot = hotRef.current.hotInstance;
    const allData = hot.getData();
    
    const colA = selectedColumns[rowIdx];
    const colB = selectedColumns[colIdx];
    
    // Prepare data points for the scatter plot
    const dataPoints = [];
    
    for (let row = 1; row < allData.length; row++) {
      const valueA = allData[row][colA];
      const valueB = allData[row][colB];
      
      if (valueA !== null && valueA !== '' && !isNaN(Number(valueA)) &&
          valueB !== null && valueB !== '' && !isNaN(Number(valueB))) {
        dataPoints.push({
          x: Number(valueA),
          y: Number(valueB)
        });
      }
    }
    
    // Create scatter plot
    setTimeout(() => {
      if (scatterChartInstance.current) {
        scatterChartInstance.current.destroy();
      }
      
      const ctx = scatterChartRef.current.getContext('2d');
      
      const xValues = dataPoints.map(point => point.x);
      const yValues = dataPoints.map(point => point.y);
      
      // Calculate regression line
      const n = dataPoints.length;
      const sumX = xValues.reduce((a, b) => a + b, 0);
      const sumY = yValues.reduce((a, b) => a + b, 0);
      const sumXY = xValues.reduce((sum, x, i) => sum + x * yValues[i], 0);
      const sumX2 = xValues.reduce((sum, x) => sum + x * x, 0);
      
      const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
      const intercept = (sumY - slope * sumX) / n;
      
      // Calculate R-squared
      const yMean = sumY / n;
      const ssTotal = yValues.reduce((sum, y) => sum + Math.pow(y - yMean, 2), 0);
      const ssResidual = yValues.reduce((sum, y, i) => {
        const yPred = slope * xValues[i] + intercept;
        return sum + Math.pow(y - yPred, 2);
      }, 0);
      const rSquared = 1 - (ssResidual / ssTotal);
      
      // Create regression line data
      const minX = Math.min(...xValues);
      const maxX = Math.max(...xValues);
      const regressionLine = [
        { x: minX, y: minX * slope + intercept },
        { x: maxX, y: maxX * slope + intercept }
      ];
      
      scatterChartInstance.current = new Chart(ctx, {
        type: 'scatter',
        data: {
          datasets: [
            {
              label: 'Data Points',
              data: dataPoints,
              backgroundColor: 'rgba(25, 118, 210, 0.6)',
              pointRadius: 6,
              pointHoverRadius: 8
            },
            {
              label: `Regression Line (R²: ${rSquared.toFixed(3)})`,
              data: regressionLine,
              type: 'line',
              borderColor: 'rgba(255, 99, 132, 1)',
              borderWidth: 2,
              pointRadius: 0,
              fill: false
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: `Scatter Plot: ${correlationResult.columnNames[colIdx]} vs ${correlationResult.columnNames[rowIdx]}`,
              font: { size: 16 }
            },
            legend: {
              position: 'bottom'
            },
            tooltip: {
              callbacks: {
                label: function(context) {
                  return `(${context.parsed.x.toFixed(2)}, ${context.parsed.y.toFixed(2)})`;
                }
              }
            }
          },
          scales: {
            x: {
              title: {
                display: true,
                text: correlationResult.columnNames[colIdx]
              }
            },
            y: {
              title: {
                display: true,
                text: correlationResult.columnNames[rowIdx]
              }
            }
          }
        }
      });
    }, 50);
  };
  
  // Function to download correlation results
  const downloadResults = (format) => {
    if (!correlationResult) return;
    
    if (format === 'csv') {
      // Create CSV content
      let csvContent = "data:text/csv;charset=utf-8,";
      
      // Add header row with column names
      csvContent += "," + correlationResult.columnNames.join(",") + "\n";
      
      // Add data rows
      correlationResult.matrix.forEach((row, rowIdx) => {
        csvContent += correlationResult.columnNames[rowIdx] + "," + row.map(cell => cell.toFixed(3)).join(",") + "\n";
      });
      
      // Create download link
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", "correlation_matrix.csv");
      document.body.appendChild(link);
      
      // Trigger download
      link.click();
      document.body.removeChild(link);
    } else if (format === 'png') {
      // Take screenshot of the correlation table
      // For simplicity, we'll download the scatter plot if it's visible
      if (scatterChartInstance.current) {
        const link = document.createElement('a');
        link.href = scatterChartRef.current.toDataURL('image/png');
        link.download = 'correlation_scatter.png';
        link.click();
      } else {
        alert('Please select a correlation cell to view the scatter plot first');
      }
    }
  };
  
  // Function to generate insights
  const generateInsights = () => {
    if (!correlationResult || !correlationResult.matrix) return [];
    
    const insights = [];
    const { matrix, columnNames } = correlationResult;
    
    // Find strongest positive correlation (excluding self-correlations)
    let maxCorr = -1;
    let maxCorrRow = -1;
    let maxCorrCol = -1;
    
    // Find strongest negative correlation
    let minCorr = 1;
    let minCorrRow = -1;
    let minCorrCol = -1;
    
    for (let i = 0; i < matrix.length; i++) {
      for (let j = 0; j < matrix[i].length; j++) {
        if (i !== j) {
          if (matrix[i][j] > maxCorr) {
            maxCorr = matrix[i][j];
            maxCorrRow = i;
            maxCorrCol = j;
          }
          if (matrix[i][j] < minCorr) {
            minCorr = matrix[i][j];
            minCorrRow = i;
            minCorrCol = j;
          }
        }
      }
    }
    
    if (maxCorrRow >= 0) {
      insights.push(`Strongest positive correlation: ${columnNames[maxCorrRow]} and ${columnNames[maxCorrCol]} (${maxCorr.toFixed(2)})`);
    }
    
    if (minCorrRow >= 0) {
      insights.push(`Strongest negative correlation: ${columnNames[minCorrRow]} and ${columnNames[minCorrCol]} (${minCorr.toFixed(2)})`);
    }
    
    // Find variables with multiple strong correlations
    const strongCorrelations = {};
    
    for (let i = 0; i < matrix.length; i++) {
      let strongCount = 0;
      for (let j = 0; j < matrix[i].length; j++) {
        if (i !== j && Math.abs(matrix[i][j]) >= 0.7) {
          strongCount++;
        }
      }
      
      if (strongCount >= 2) {
        strongCorrelations[columnNames[i]] = strongCount;
      }
    }
    
    Object.keys(strongCorrelations).forEach(column => {
      insights.push(`${column} has strong correlations with ${strongCorrelations[column]} other variables`);
    });
    
    // If no strong correlations found
    if (insights.length === 0) {
      insights.push("No particularly strong correlations found in the dataset");
    }
    
    // Add multicollinearity warning if we have very strong correlations
    if (maxCorr >= 0.9) {
      insights.push(`Warning: Potential multicollinearity detected between ${columnNames[maxCorrRow]} and ${columnNames[maxCorrCol]}`);
    }
    
    return insights;
  };
  
  // Add buttons manually without using a function parameter
  const handleRunCorrelation = () => {
    performCorrelation(correlationMethod);
  };
  
  // Add function to toggle view mode
  const toggleViewMode = () => {
    const newMode = viewMode === 'table' ? 'heatmap' : 'table';
    setViewMode(newMode);
    
    if (newMode === 'heatmap' && correlationResult) {
      setTimeout(() => renderHeatmap(), 50);
    }
  };
  
  // Add function to render heatmap
  const renderHeatmap = () => {
    if (!correlationResult || !heatmapChartRef.current) return;
    
    if (heatmapChartInstance.current) {
      heatmapChartInstance.current.destroy();
    }
    
    const ctx = heatmapChartRef.current.getContext('2d');
    const { matrix, columnNames } = correlationResult;
    
    // Create datasets for the heatmap
    const datasets = [];
    const labels = columnNames;
    
    // Create a dataset for each row in the correlation matrix
    for (let i = 0; i < matrix.length; i++) {
      const rowData = [];
      
      for (let j = 0; j < matrix[i].length; j++) {
        rowData.push({
          x: j,
          y: i,
          v: matrix[i][j] // Store the actual correlation value
        });
      }
      
      datasets.push({
        label: columnNames[i],
        data: rowData
      });
    }
    
    // Use flat data for the heatmap
    const data = [];
    for (let i = 0; i < matrix.length; i++) {
      for (let j = 0; j < matrix[i].length; j++) {
        data.push({
          x: columnNames[j],
          y: columnNames[i],
          v: matrix[i][j]
        });
      }
    }
    
    // Color scale for correlation values
    const getColor = (value) => {
      if (value >= 0.7) return 'rgba(25, 118, 210, 0.8)';
      if (value >= 0.3) return 'rgba(25, 118, 210, 0.5)';
      if (value > 0) return 'rgba(25, 118, 210, 0.3)';
      if (value === 0) return 'rgba(200, 200, 200, 0.3)';
      if (value > -0.3) return 'rgba(220, 0, 78, 0.3)';
      if (value > -0.7) return 'rgba(220, 0, 78, 0.5)';
      return 'rgba(220, 0, 78, 0.8)';
    };
    
    // Create the heatmap
    heatmapChartInstance.current = new Chart(ctx, {
      type: 'matrix',
      data: {
        datasets: [{
          label: 'Correlation Matrix',
          data: data,
          backgroundColor: function(context) {
            const value = context.dataset.data[context.dataIndex].v;
            return getColor(value);
          },
          borderColor: function(context) {
            return 'white';
          },
          borderWidth: 1,
          width: ({ chart }) => (chart.chartArea || {}).width / columnNames.length - 1,
          height: ({ chart }) => (chart.chartArea || {}).height / columnNames.length - 1
        }]
      },
      options: {
        plugins: {
          tooltip: {
            callbacks: {
              title: function(context) {
                const item = context[0];
                return `${item.raw.y} vs ${item.raw.x}`;
              },
              label: function(context) {
                return `Correlation: ${context.raw.v.toFixed(3)}`;
              }
            }
          },
          legend: {
            display: false
          },
          title: {
            display: true,
            text: `Correlation Heatmap (${correlationResult.method.charAt(0).toUpperCase() + correlationResult.method.slice(1)})`,
            font: {
              size: 16
            }
          }
        },
        scales: {
          x: {
            type: 'category',
            labels: columnNames,
            ticks: {
              maxRotation: 45,
              minRotation: 45
            }
          },
          y: {
            type: 'category',
            labels: columnNames,
            reverse: true
          }
        }
      }
    });
  };
  
  // Update useEffect to detect when correlation results change
  useEffect(() => {
    if (viewMode === 'heatmap' && correlationResult) {
      setTimeout(() => renderHeatmap(), 50);
    }
  }, [correlationResult]);
  
  return (
    <div className={styles.correlationPanel}>
      <h2>Correlation Analysis</h2>
      
      <div className={styles.instructions}>
        <p><strong>Instructions:</strong></p>
        <ol>
          <li>Select numeric columns from the dropdown</li>
          <li>Click "Calculate Correlation" to perform the analysis</li>
          <li>The result will show how variables relate to each other</li>
        </ol>
        
        <div className={styles.correlationHelp}>
          <p><strong>Correlation Tips:</strong></p>
          <ul>
            <li>Values range from -1 (perfect negative correlation) to 1 (perfect positive correlation)</li>
            <li>Values close to 0 indicate little or no linear relationship</li>
            <li>Color intensity shows correlation strength</li>
            <li>Blue = positive correlation (variables move together)</li>
            <li>Red = negative correlation (variables move in opposite directions)</li>
            <li>Significance indicators: * p&lt;0.05, ** p&lt;0.01, *** p&lt;0.001</li>
          </ul>
        </div>
      </div>
      
      <div className={styles.methodSelector}>
        <label htmlFor="correlation-method">Correlation Method:</label>
        <select 
          id="correlation-method"
          value={correlationMethod}
          onChange={handleMethodChange}
          className={styles.methodSelect}
          disabled={loading}
        >
          <option value="pearson">Pearson (Linear)</option>
          <option value="spearman">Spearman (Monotonic)</option>
          <option value="kendall">Kendall (Ordinal)</option>
        </select>
        <div className={styles.methodInfo}>
          {correlationMethod === 'pearson' && (
            <span>Measures linear relationships. Sensitive to outliers.</span>
          )}
          {correlationMethod === 'spearman' && (
            <span>Measures monotonic relationships. Less sensitive to outliers.</span>
          )}
          {correlationMethod === 'kendall' && (
            <span>Robust measure for ordinal data. Best for small samples.</span>
          )}
        </div>
      </div>
      
      <div className={styles.columnSelectors}>
        <div className={styles.columnSelector}>
          <h3>Select Columns for Correlation</h3>
          <select 
            multiple 
            size="5"
            onChange={handleColumnsChange}
            className={styles.columnMultiSelect}
          >
            {availableColumns.map(column => (
              <option key={`col-${column.index}`} value={column.index}>
                {column.name}
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
          onClick={handleRunCorrelation}
          className={styles.runButton}
          disabled={loading || selectedColumns.length < 2}
        >
          {loading ? 'Calculating...' : 'Calculate Correlation'}
        </button>
        <button 
          onClick={onClose}
          className={styles.cancelButton}
        >
          Close
        </button>
      </div>
      
      {correlationResult && (
        <div className={styles.correlationResult}>
          <div className={styles.resultHeader}>
            <h3>Correlation Matrix</h3>
            <button 
              onClick={toggleViewMode}
              className={styles.viewToggleButton}
            >
              {viewMode === 'table' ? 'Switch to Heatmap' : 'Switch to Table'}
            </button>
          </div>
          
          <div className={styles.downloadButtons}>
            <button 
              onClick={() => downloadResults('csv')}
              className={styles.downloadButton}
            >
              Download CSV
            </button>
            <button 
              onClick={() => downloadResults('png')}
              className={styles.downloadButton}
            >
              Download Chart PNG
            </button>
          </div>
          
          {viewMode === 'table' ? (
            <div className={styles.correlationTable}>
              <div className={styles.tableHeader}>
                <div className={styles.cornerCell}></div>
                {correlationResult.columnNames.map((name, idx) => (
                  <div key={`header-${idx}`} className={styles.headerCell}>
                    {name}
                  </div>
                ))}
              </div>
              
              {correlationResult.matrix.map((row, rowIdx) => (
                <div key={`row-${rowIdx}`} className={styles.tableRow}>
                  <div className={styles.rowHeader}>
                    {correlationResult.columnNames[rowIdx]}
                  </div>
                  
                  {row.map((cell, colIdx) => {
                    const pValue = correlationResult.p_values?.[rowIdx]?.[colIdx];
                    const significanceIndicator = getSignificanceIndicator(pValue);
                    
                    return (
                      <div 
                        key={`cell-${rowIdx}-${colIdx}`} 
                        className={styles.correlationCell}
                        style={{
                          backgroundColor: getCorrelationColor(cell),
                          color: getTextColor(cell),
                          cursor: rowIdx !== colIdx ? 'pointer' : 'default'
                        }}
                        title={pValue !== undefined ? `p-value: ${pValue.toFixed(4)}` : ''}
                        onClick={() => rowIdx !== colIdx && handleCellClick(rowIdx, colIdx)}
                      >
                        {cell.toFixed(2)}
                        <span className={styles.significanceIndicator}>{significanceIndicator}</span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.heatmapContainer}>
              <canvas ref={heatmapChartRef} height="400"></canvas>
            </div>
          )}
          
          <div className={styles.insightsSection}>
            <h3>Key Insights</h3>
            <ul>
              {generateInsights().map((insight, idx) => (
                <li key={`insight-${idx}`}>{insight}</li>
              ))}
            </ul>
          </div>
          
          {selectedCell && (
            <div className={styles.scatterPlotContainer}>
              <h3>Scatter Plot</h3>
              <div className={styles.canvasContainer}>
                <canvas ref={scatterChartRef} height="300"></canvas>
              </div>
            </div>
          )}
          
          <div className={styles.correlationLegend}>
            <div style={{ textAlign: 'center', marginBottom: '10px', fontWeight: 'bold' }}>
              Legend
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '10px', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ width: '20px', height: '20px', backgroundColor: 'rgba(220, 0, 78, 0.8)', marginRight: '5px' }}></div>
                <span>Strong negative</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ width: '20px', height: '20px', backgroundColor: 'white', border: '1px solid #ccc', marginRight: '5px' }}></div>
                <span>No correlation</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ width: '20px', height: '20px', backgroundColor: 'rgba(25, 118, 210, 0.8)', marginRight: '5px' }}></div>
                <span>Strong positive</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span>* p&lt;0.05</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span>** p&lt;0.01</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span>*** p&lt;0.001</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CorrelationAnalysisPanel; 