import React, { useState, useEffect } from 'react';
import styles from '../styles/DataSelector.module.css';

const DataSelector = ({ data, hotRef, onClose }) => {
  const [selectedColumn, setSelectedColumn] = useState(null);
  const [uniqueValues, setUniqueValues] = useState([]);
  const [selectedValues, setSelectedValues] = useState([]);
  const [targetColumns, setTargetColumns] = useState([]);
  const [operation, setOperation] = useState('sum');
  const [results, setResults] = useState(null);
  const [step, setStep] = useState(1); // Step 1: Column selection, Step 2: Values, Step 3: Operations

  // Get column headers (first row of data)
  const headers = data && data.length > 0 ? data[0] : [];
  
  // Get unique values from the selected column
  useEffect(() => {
    if (selectedColumn !== null) {
      const uniqueVals = getUniqueValues(data, selectedColumn);
      setUniqueValues(uniqueVals);
      setSelectedValues([]); // Reset selected values when column changes
      if (uniqueVals.length > 0) {
        setStep(2);
      }
    }
  }, [selectedColumn, data]);

  // Function to get unique values from a column
  const getUniqueValues = (data, columnIndex) => {
    if (!data || data.length <= 1 || columnIndex === null) return [];
    
    // Get all values (excluding header row)
    const values = data.slice(1).map(row => row[columnIndex]);
    
    // Return unique non-empty values using Set
    return [...new Set(values)].filter(val => val !== null && val !== undefined && val !== '');
  };
  
  // Filter rows based on selected values
  const filterRowsByColumnValues = (data, columnIndex, selectedValues) => {
    if (!data || data.length <= 1) return [];
    
    // Include header row
    const header = data[0];
    
    // Filter data rows
    const filteredRows = data.slice(1).filter(row => 
      selectedValues.includes(row[columnIndex])
    );
    
    // Return header + filtered rows
    return [header, ...filteredRows];
  };

  // Perform operations on filtered data
  const performOperation = (filteredData, targetColumns, operation) => {
    if (!filteredData || filteredData.length <= 1) return { error: 'No data to operate on' };
    
    const results = {};
    
    try {
      // Process each target column
      targetColumns.forEach(colIndex => {
        const columnName = filteredData[0][colIndex];
        
        // Extract values from target column (excluding header)
        const values = filteredData.slice(1)
          .map(row => parseFloat(row[colIndex]))
          .filter(value => !isNaN(value));
        
        if (values.length === 0) {
          results[columnName] = { value: 'No numeric data', operation };
          return;
        }
        
        // Perform the requested operation
        switch (operation) {
          case 'sum':
            results[columnName] = {
              value: values.reduce((sum, val) => sum + val, 0),
              operation: 'Sum',
              count: values.length
            };
            break;
            
          case 'average':
            results[columnName] = {
              value: values.reduce((sum, val) => sum + val, 0) / values.length,
              operation: 'Average',
              count: values.length
            };
            break;
            
          case 'count':
            results[columnName] = {
              value: values.length,
              operation: 'Count',
              count: values.length
            };
            break;
            
          case 'min':
            results[columnName] = {
              value: Math.min(...values),
              operation: 'Minimum',
              count: values.length
            };
            break;
            
          case 'max':
            results[columnName] = {
              value: Math.max(...values),
              operation: 'Maximum',
              count: values.length
            };
            break;
          
          case 'range':
            results[columnName] = {
              value: Math.max(...values) - Math.min(...values),
              operation: 'Range',
              count: values.length
            };
            break;
            
          default:
            results[columnName] = {
              value: values.reduce((sum, val) => sum + val, 0),
              operation: 'Sum',
              count: values.length
            };
        }
      });
      
      return results;
    } catch (error) {
      console.error('Error performing operation:', error);
      return { error: 'Error performing operation' };
    }
  };

  // Handle executing the operations
  const handleExecute = () => {
    if (selectedColumn === null || selectedValues.length === 0 || targetColumns.length === 0) {
      setResults({ error: 'Please make all selections first' });
      return;
    }
    
    // Filter the data based on selected values
    const filteredData = filterRowsByColumnValues(data, selectedColumn, selectedValues);
    
    // Perform the selected operation on target columns
    const operationResults = performOperation(filteredData, targetColumns, operation);
    
    setResults(operationResults);
    setStep(3);
  };

  // Handle selecting all values
  const handleSelectAll = () => {
    setSelectedValues([...uniqueValues]);
  };

  // Handle clearing all values
  const handleClearValues = () => {
    setSelectedValues([]);
  };

  // Handle toggling a single value
  const handleToggleValue = (value) => {
    if (selectedValues.includes(value)) {
      setSelectedValues(selectedValues.filter(v => v !== value));
    } else {
      setSelectedValues([...selectedValues, value]);
    }
  };

  // Handle toggling a target column
  const handleToggleTargetColumn = (index) => {
    if (targetColumns.includes(index)) {
      setTargetColumns(targetColumns.filter(col => col !== index));
    } else {
      setTargetColumns([...targetColumns, index]);
    }
  };

  return (
    <div className={styles.dataSelectorContainer}>
      <div className={styles.dataSelectorHeader}>
        <h2>Data Selector</h2>
        <button 
          onClick={onClose}
          className={styles.closeButton}
        >
          ×
        </button>
      </div>
      
      <div className={styles.dataSelectorContent}>
        {/* Step 1: Column Selection */}
        <div className={styles.sectionHeader}>
          <h3>1. Select Filter Column</h3>
          <div className={styles.stepIndicator}>
            Step {step} of 3
          </div>
        </div>
        <div className={styles.columnSelection}>
          <select 
            value={selectedColumn === null ? '' : selectedColumn}
            onChange={(e) => setSelectedColumn(e.target.value !== '' ? parseInt(e.target.value) : null)}
            className={styles.selectDropdown}
          >
            <option value="">-- Select a column --</option>
            {headers.map((header, index) => (
              <option key={index} value={index}>
                {header || `Column ${index + 1}`}
              </option>
            ))}
          </select>
        </div>
        
        {/* Step 2: Value Selection */}
        {step >= 2 && (
          <>
            <div className={styles.sectionHeader}>
              <h3>2. Select Values from {headers[selectedColumn]}</h3>
              <div className={styles.selectionControls}>
                <button 
                  onClick={handleSelectAll}
                  className={styles.actionButton}
                  disabled={uniqueValues.length === 0}
                >
                  Select All
                </button>
                <button 
                  onClick={handleClearValues}
                  className={styles.actionButton}
                  disabled={selectedValues.length === 0}
                >
                  Clear
                </button>
              </div>
            </div>
            <div className={styles.valuesContainer}>
              {uniqueValues.length > 0 ? (
                <div className={styles.valuesGrid}>
                  {uniqueValues.map((value, index) => (
                    <div 
                      key={index} 
                      className={`${styles.valueItem} ${selectedValues.includes(value) ? styles.selected : ''}`}
                      onClick={() => handleToggleValue(value)}
                    >
                      <input 
                        type="checkbox" 
                        checked={selectedValues.includes(value)}
                        readOnly
                      />
                      <span>{value}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.emptyState}>
                  No unique values found in this column
                </div>
              )}
            </div>
            
            {/* Operation Selection */}
            <div className={styles.sectionHeader}>
              <h3>3. Select Target Columns</h3>
            </div>
            <div className={styles.targetColumnSelection}>
              <div className={styles.valuesGrid}>
                {headers.map((header, index) => (
                  index !== selectedColumn && (
                    <div 
                      key={index} 
                      className={`${styles.valueItem} ${targetColumns.includes(index) ? styles.selected : ''}`}
                      onClick={() => handleToggleTargetColumn(index)}
                    >
                      <input 
                        type="checkbox" 
                        checked={targetColumns.includes(index)}
                        readOnly
                      />
                      <span>{header || `Column ${index + 1}`}</span>
                    </div>
                  )
                ))}
              </div>
            </div>
            
            <div className={styles.sectionHeader}>
              <h3>4. Select Operation</h3>
            </div>
            <div className={styles.operationSelection}>
              <select 
                value={operation}
                onChange={(e) => setOperation(e.target.value)}
                className={styles.selectDropdown}
              >
                <option value="sum">Sum</option>
                <option value="average">Average</option>
                <option value="count">Count</option>
                <option value="min">Minimum</option>
                <option value="max">Maximum</option>
                <option value="range">Range</option>
              </select>
              
              <button 
                onClick={handleExecute}
                className={styles.executeButton}
                disabled={selectedValues.length === 0 || targetColumns.length === 0}
              >
                Execute
              </button>
            </div>
          </>
        )}
        
        {/* Step 3: Results */}
        {step >= 3 && results && (
          <>
            <div className={styles.sectionHeader}>
              <h3>Results</h3>
            </div>
            <div className={styles.resultsContainer}>
              {results.error ? (
                <div className={styles.error}>{results.error}</div>
              ) : (
                <table className={styles.resultsTable}>
                  <thead>
                    <tr>
                      <th>Column</th>
                      <th>Operation</th>
                      <th>Result</th>
                      <th>Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(results).map(([column, result]) => (
                      <tr key={column}>
                        <td>{column}</td>
                        <td>{result.operation}</td>
                        <td className={styles.resultValue}>
                          {typeof result.value === 'number' ? result.value.toLocaleString(undefined, {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 2
                          }) : result.value}
                        </td>
                        <td>{result.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default DataSelector; 