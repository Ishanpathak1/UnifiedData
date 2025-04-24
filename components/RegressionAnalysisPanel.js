import React, { useState, useEffect, useRef, useCallback } from 'react';
import styles from '../styles/RegressionAnalysis.module.css';
import Chart from 'chart.js/auto';
import ModelComparison from './ModelComparison';

const RegressionAnalysisPanel = ({ hotRef, onClose }) => {
  const [availableColumns, setAvailableColumns] = useState([]);
  const [dependentColumn, setDependentColumn] = useState('');
  const [independentColumns, setIndependentColumns] = useState([]);
  const [regressionType, setRegressionType] = useState('linear');
  const [polynomialDegree, setPolynomialDegree] = useState(2);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [regressionResult, setRegressionResult] = useState(null);
  const [predictionResult, setPredictionResult] = useState(null);
  const [savedModels, setSavedModels] = useState([]);
  const [showComparison, setShowComparison] = useState(false);
  
  const scatterChartRef = useRef(null);
  const scatterChartInstance = useRef(null);
  const residualChartRef = useRef(null);
  const residualChartInstance = useRef(null);
  const rocChartRef = useRef(null);
  const rocChartInstance = useRef(null);
  
  // When component mounts, scan spreadsheet for numerical columns
  useEffect(() => {
    if (!hotRef || !hotRef.current) return;
    
    const hot = hotRef.current.hotInstance;
    const allData = hot.getData();
    
    // Find numerical columns
    const numericColumns = [];
    
    for (let col = 0; col < allData[0]?.length || 0; col++) {
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
          name: columnName
        });
      }
    }
    
    setAvailableColumns(numericColumns);
  }, [hotRef]);
  
  // Generate data for regression
  const generateRegressionData = () => {
    if (!hotRef || !hotRef.current) return [];
    if (dependentColumn === '' || independentColumns.length === 0) return [];
    
    const hot = hotRef.current.hotInstance;
    const allData = hot.getData();
    
    const regressionData = [];
    
    // Skip header row
    for (let row = 1; row < allData.length; row++) {
      const depValue = allData[row][dependentColumn];
      
      // Check if dependent value is valid
      if (depValue === null || depValue === '' || isNaN(Number(depValue))) {
        continue;
      }
      
      // Create array of independent values
      const indValues = [];
      let validRow = true;
      
      for (const col of independentColumns) {
        const value = allData[row][col];
        if (value === null || value === '' || isNaN(Number(value))) {
          validRow = false;
          break;
        }
        indValues.push(Number(value));
      }
      
      if (validRow) {
        regressionData.push({
          y: Number(depValue),
          x: indValues
        });
      }
    }
    
    return regressionData;
  };
  
  // Handle dependent column change
  const handleDependentChange = (e) => {
    setDependentColumn(Number(e.target.value));
  };
  
  // Handle independent columns change
  const handleIndependentChange = (e) => {
    const selectedOptions = Array.from(e.target.selectedOptions, option => Number(option.value));
    
    // For polynomial regression, only allow one independent variable
    if (regressionType === 'polynomial' && selectedOptions.length > 1) {
      // Only keep the first selected option
      setIndependentColumns([selectedOptions[0]]);
      
      // Show a message to the user
      alert('Polynomial regression only supports one independent variable. Only the first selected variable will be used.');
    } else {
      setIndependentColumns(selectedOptions);
    }
  };
  
  // Perform regression analysis
  const performRegression = async () => {
    setError(null);
    
    if (dependentColumn === '') {
      setError("Please select a dependent variable");
      return;
    }
    
    if (independentColumns.length === 0) {
      setError("Please select at least one independent variable");
      return;
    }
    
    // Special handling for logistic regression
    if (regressionType === 'logistic') {
      // Generate regression data first
      const regressionData = generateRegressionData();
      
      if (regressionData.length < 3) {
        setError("Need at least 3 valid rows of data for regression analysis");
        return;
      }
      
      // Extract just the dependent variable values
      const yValues = regressionData.map(d => d.y);
      
      // Check if they are already 0/1 or convertible to 0/1
      const uniqueValues = [...new Set(yValues)];
      
      if (uniqueValues.length !== 2) {
        setError(`Logistic regression requires a binary dependent variable. Found ${uniqueValues.length} unique values.`);
        return;
      }
      
      // If the values aren't 0/1, ask to convert them
      if (!(uniqueValues.includes(0) && uniqueValues.includes(1)) && 
          !(uniqueValues.includes("0") && uniqueValues.includes("1"))) {
        
        const confirmed = confirm(`The selected column contains values [${uniqueValues.join(', ')}]. Would you like to convert these to 0/1 for logistic regression?`);
        
        if (!confirmed) {
          setError("Logistic regression requires a binary dependent variable with values 0 and 1");
          return;
        }
        
        // If confirmed, we'll transform the values when we call the API
      }
    }
    
    setLoading(true);
    
    try {
      const regressionData = generateRegressionData();
      
      if (regressionData.length < 3) {
        throw new Error("Need at least 3 valid rows of data for regression analysis");
      }
      
      // Get column names
      const depName = availableColumns.find(col => col.index === dependentColumn)?.name || `Column ${dependentColumn}`;
      const indNames = independentColumns.map(idx => 
        availableColumns.find(col => col.index === idx)?.name || `Column ${idx}`
      );
      
      // Special processing for logistic regression
      let yValues = regressionData.map(d => d.y);
      
      if (regressionType === 'logistic') {
        // Get unique values
        const uniqueValues = [...new Set(yValues)];
        
        // If not already 0/1, convert the first value to 0, second to 1
        if (!(uniqueValues.includes(0) && uniqueValues.includes(1)) && 
            !(uniqueValues.includes("0") && uniqueValues.includes("1"))) {
          
          // Map first unique value to 0, second to 1
          const valueMap = {
            [uniqueValues[0]]: 0,
            [uniqueValues[1]]: 1
          };
          
          // Transform the values
          yValues = yValues.map(val => valueMap[val]);
        }
      }
      
      // Call API with the possibly transformed values
      const response = await fetch('http://localhost:8000/regression', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dependent_variable: yValues,
          independent_variables: regressionData.map(d => d.x),
          column_names: indNames,
          regression_type: regressionType,
          polynomial_degree: regressionType === 'polynomial' ? polynomialDegree : null
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `API request failed with status ${response.status}`;
        
        // Try to parse the error message for more details
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.detail) {
            // Extract just the main error message without status codes
            const detailMatch = errorJson.detail.match(/\d+:\s*(.*)/);
            errorMessage = detailMatch ? detailMatch[1] : errorJson.detail;
          }
        } catch (parseError) {
          // If parsing fails, just use the raw error text
          errorMessage = errorText;
        }
        
        throw new Error(errorMessage);
      }
      
      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      // Handle any NaN or Infinity values that might have passed through
      Object.keys(result).forEach(key => {
        if (typeof result[key] === 'number' && (isNaN(result[key]) || !isFinite(result[key]))) {
          result[key] = 0;
        }
      });
      
      // Add additional info to the result
      result.dependent_name = depName;
      result.independent_names = indNames;
      result.data_points = regressionData;
      
      setRegressionResult(result);
      
      // Render charts if simple regression (one independent variable)
      if (independentColumns.length === 1) {
        setTimeout(() => {
          try {
            if (regressionType !== 'logistic') {
              renderScatterPlot(regressionData, result, depName, indNames[0]);
              renderResidualPlot(result);
            } else if (regressionType === 'logistic' && result.roc_points) {
              renderROCCurve(result);
            }
          } catch (err) {
            console.error("Error rendering charts:", err);
          }
        }, 50);
      }
    } catch (err) {
      console.error("Regression failed:", err);
      setError(`Failed to perform regression analysis: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Render scatter plot with regression line
  const renderScatterPlot = (data, result, depName, indName) => {
    if (!scatterChartRef || !scatterChartRef.current) {
      console.warn("Scatter chart reference is null");
      return;
    }
    
    if (scatterChartInstance.current) {
      scatterChartInstance.current.destroy();
    }
    
    const ctx = scatterChartRef.current.getContext('2d');
    
    // Extract x and y values for plotting
    const xValues = data.map(point => point.x[0]);
    const yValues = data.map(point => point.y);
    
    // Skip chart creation if not enough valid data
    if (xValues.length < 2 || yValues.length < 2) {
      return;
    }
    
    // Create predicted points for the regression line
    const xMin = Math.min(...xValues);
    const xMax = Math.max(...xValues);
    const xRange = xMax - xMin;
    
    // Generate points for the regression line
    const linePoints = [];
    
    // Check if we have valid coefficients
    const hasValidCoefficients = result.coefficients && 
      result.coefficients.every(c => !isNaN(c) && isFinite(c));
    
    if (!hasValidCoefficients) {
      console.warn("Invalid coefficients detected, skipping regression line");
    } else if (regressionType === 'linear') {
      // Linear regression line: y = intercept + slope * x
      const intercept = result.intercept;
      const slope = result.coefficients[0];
      
      linePoints.push({ x: xMin - 0.1 * xRange, y: intercept + slope * (xMin - 0.1 * xRange) });
      linePoints.push({ x: xMax + 0.1 * xRange, y: intercept + slope * (xMax + 0.1 * xRange) });
    } 
    else if (regressionType === 'polynomial') {
      // Polynomial regression line: y = intercept + coef1 * x + coef2 * x^2 + ...
      const intercept = result.intercept;
      const coefficients = result.coefficients;
      
      // Create more points for a smooth curve
      const step = xRange / 100;
      for (let x = xMin - 0.1 * xRange; x <= xMax + 0.1 * xRange; x += step) {
        let y = intercept;
        for (let i = 0; i < coefficients.length; i++) {
          y += coefficients[i] * Math.pow(x, i + 1);
        }
        linePoints.push({ x, y });
      }
    }
    
    // Create the chart
    scatterChartInstance.current = new Chart(ctx, {
      type: 'scatter',
      data: {
        datasets: [
          {
            label: 'Data Points',
            data: data.map(point => ({ x: point.x[0], y: point.y })),
            backgroundColor: 'rgba(54, 162, 235, 0.5)',
            pointRadius: 5,
            pointHoverRadius: 7
          },
          {
            label: 'Regression Line',
            data: linePoints,
            showLine: true,
            fill: false,
            borderColor: 'rgba(255, 99, 132, 1)',
            backgroundColor: 'rgba(255, 99, 132, 0.5)',
            borderWidth: 2,
            pointRadius: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: `${regressionType.charAt(0).toUpperCase() + regressionType.slice(1)} Regression: ${depName} vs ${indName}`,
            font: { size: 16 }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const point = context.raw;
                return `${indName}: ${point.x.toFixed(2)}, ${depName}: ${point.y.toFixed(2)}`;
              }
            }
          }
        },
        scales: {
          x: {
            title: {
              display: true,
              text: indName
            }
          },
          y: {
            title: {
              display: true,
              text: depName
            }
          }
        }
      }
    });
  };
  
  // Render residual plot
  const renderResidualPlot = (result) => {
    if (!residualChartRef || !residualChartRef.current) {
      console.warn("Residual chart reference is null");
      return;
    }
    
    if (residualChartInstance.current) {
      residualChartInstance.current.destroy();
    }
    
    const ctx = residualChartRef.current.getContext('2d');
    
    // Extract residuals and predicted values
    const predicted = result.predicted_values;
    const residuals = result.residuals;
    
    // Skip if we don't have valid data
    if (!predicted || !residuals || predicted.length === 0 || residuals.length === 0) {
      console.warn("Missing predicted values or residuals, skipping residual plot");
      return;
    }
    
    // Filter out any NaN or Infinity values
    const validPoints = predicted.map((pred, i) => ({ x: pred, y: residuals[i] }))
      .filter(point => !isNaN(point.x) && !isNaN(point.y) && 
                       isFinite(point.x) && isFinite(point.y));
    
    if (validPoints.length === 0) {
      console.warn("No valid residual points to plot");
      return;
    }
    
    residualChartInstance.current = new Chart(ctx, {
      type: 'scatter',
      data: {
        datasets: [{
          label: 'Residuals',
          data: validPoints,
          backgroundColor: 'rgba(153, 102, 255, 0.5)',
          pointRadius: 5,
          pointHoverRadius: 7
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Residual Plot',
            font: { size: 16 }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const point = context.raw;
                return `Predicted: ${point.x.toFixed(2)}, Residual: ${point.y.toFixed(2)}`;
              }
            }
          }
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'Predicted Values'
            }
          },
          y: {
            title: {
              display: true,
              text: 'Residuals'
            },
            grid: {
              color: function(context) {
                if (context.tick.value === 0) {
                  return 'rgba(0, 0, 0, 0.5)';
                }
                return 'rgba(0, 0, 0, 0.1)';
              },
              lineWidth: function(context) {
                if (context.tick.value === 0) {
                  return 2;
                }
                return 1;
              }
            }
          }
        }
      }
    });
  };
  
  // Render ROC curve
  const renderROCCurve = (result) => {
    if (!rocChartRef || !rocChartRef.current || !result.roc_points) {
      console.warn("ROC chart reference is null or no ROC data");
      return;
    }
    
    if (rocChartInstance.current) {
      rocChartInstance.current.destroy();
    }
    
    const ctx = rocChartRef.current.getContext('2d');
    
    // Add reference diagonal line (random classifier)
    const diagonalLine = [
      { x: 0, y: 0 },
      { x: 1, y: 1 }
    ];
    
    // Format ROC points
    const rocData = result.roc_points.map(point => ({
      x: point.fpr,
      y: point.tpr
    }));
    
    rocChartInstance.current = new Chart(ctx, {
      type: 'scatter',
      data: {
        datasets: [
          {
            label: 'ROC Curve',
            data: rocData,
            showLine: true,
            fill: false,
            borderColor: 'rgba(54, 162, 235, 1)',
            backgroundColor: 'rgba(54, 162, 235, 0.5)',
            borderWidth: 2,
            pointRadius: 0
          },
          {
            label: 'Random Classifier',
            data: diagonalLine,
            showLine: true,
            fill: false,
            borderColor: 'rgba(200, 200, 200, 1)',
            borderWidth: 1,
            borderDash: [5, 5],
            pointRadius: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: `ROC Curve (AUC: ${result.auc_score.toFixed(3)})`,
            font: { size: 16 }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const point = context.raw;
                return `FPR: ${point.x.toFixed(3)}, TPR: ${point.y.toFixed(3)}`;
              }
            }
          }
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'False Positive Rate'
            },
            min: 0,
            max: 1
          },
          y: {
            title: {
              display: true,
              text: 'True Positive Rate'
            },
            min: 0,
            max: 1
          }
        }
      }
    });
  };
  
  // Export regression model to spreadsheet
  const exportToSpreadsheet = () => {
    if (!regressionResult || !hotRef || !hotRef.current) return;
    
    const hot = hotRef.current.hotInstance;
    
    // Get column for export
    const exportColIndex = hot.countCols();
    hot.alter('insert_col', exportColIndex, 3); // Add 3 columns
    
    // Set headers
    hot.setDataAtCell(0, exportColIndex, 'Regression Analysis');
    hot.setDataAtCell(0, exportColIndex + 1, 'Values');
    hot.setDataAtCell(0, exportColIndex + 2, 'Statistics');
    
    // Add regression type info
    hot.setDataAtCell(1, exportColIndex, 'Type');
    hot.setDataAtCell(1, exportColIndex + 1, regressionType.charAt(0).toUpperCase() + regressionType.slice(1));
    
    // Add equation
    hot.setDataAtCell(2, exportColIndex, 'Equation');
    
    let equationText = `${regressionResult.dependent_name} = ${regressionResult.intercept.toFixed(4)}`;
    regressionResult.independent_names.forEach((name, i) => {
      const coef = regressionResult.coefficients[i];
      if (regressionType === 'polynomial') {
        for (let j = 0; j < regressionResult.coefficients.length; j++) {
          const power = j + 1;
          const coef = regressionResult.coefficients[j];
          const sign = coef >= 0 ? ' + ' : ' - ';
          equationText += `${sign}${Math.abs(coef).toFixed(4)} × ${name}${power > 1 ? `^${power}` : ''}`;
        }
      } else {
        const sign = coef >= 0 ? ' + ' : ' - ';
        equationText += `${sign}${Math.abs(coef).toFixed(4)} × ${name}`;
      }
    });
    
    hot.setDataAtCell(2, exportColIndex + 1, equationText);
    
    // Add statistics
    hot.setDataAtCell(3, exportColIndex, 'R²');
    hot.setDataAtCell(3, exportColIndex + 1, regressionResult.r_squared.toFixed(4));
    
    hot.setDataAtCell(4, exportColIndex, 'Adjusted R²');
    hot.setDataAtCell(4, exportColIndex + 1, regressionResult.adjusted_r_squared.toFixed(4));
    
    hot.setDataAtCell(5, exportColIndex, 'Standard Error');
    hot.setDataAtCell(5, exportColIndex + 1, regressionResult.standard_error.toFixed(4));
    
    hot.setDataAtCell(6, exportColIndex, 'F-statistic');
    hot.setDataAtCell(6, exportColIndex + 1, regressionResult.f_statistic.toFixed(4));
    
    hot.setDataAtCell(7, exportColIndex, 'p-value');
    hot.setDataAtCell(7, exportColIndex + 1, regressionResult.p_value.toExponential(4));
    
    // Add coefficients
    hot.setDataAtCell(9, exportColIndex, 'Coefficients');
    hot.setDataAtCell(9, exportColIndex + 1, 'Value');
    hot.setDataAtCell(9, exportColIndex + 2, 'p-value');
    
    hot.setDataAtCell(10, exportColIndex, 'Intercept');
    hot.setDataAtCell(10, exportColIndex + 1, regressionResult.intercept.toFixed(4));
    hot.setDataAtCell(10, exportColIndex + 2, regressionResult.intercept_p_value !== null && regressionResult.intercept_p_value !== undefined 
      ? regressionResult.intercept_p_value.toExponential(4) 
      : 'N/A');
    
    regressionResult.independent_names.forEach((name, i) => {
      hot.setDataAtCell(11 + i, exportColIndex, name);
      hot.setDataAtCell(11 + i, exportColIndex + 1, regressionResult.coefficients[i].toFixed(4));
      hot.setDataAtCell(11 + i, exportColIndex + 2, regressionResult.coefficient_p_values && regressionResult.coefficient_p_values[i] !== null
        ? regressionResult.coefficient_p_values[i].toExponential(4)
        : 'N/A');
    });
    
    alert('Regression model exported to spreadsheet');
  };
  
  // Add this function after useEffect that populates availableColumns
  const suggestVariablePairs = useCallback(() => {
    if (!hotRef?.current || availableColumns.length < 2) return;
    
    const hot = hotRef.current.hotInstance;
    const allData = hot.getData();
    
    // Create a correlation matrix between numeric columns
    const correlations = [];
    
    // Calculate basic correlation between each pair of columns
    for (let i = 0; i < availableColumns.length; i++) {
      for (let j = i + 1; j < availableColumns.length; j++) {
        // Get column indices
        const col1 = availableColumns[i].index;
        const col2 = availableColumns[j].index;
        
        // Get values
        const col1Values = [];
        const col2Values = [];
        
        // Skip header row
        for (let row = 1; row < allData.length; row++) {
          const val1 = parseFloat(allData[row][col1]);
          const val2 = parseFloat(allData[row][col2]);
          
          if (!isNaN(val1) && !isNaN(val2)) {
            col1Values.push(val1);
            col2Values.push(val2);
          }
        }
        
        // Need at least 3 pairs of values
        if (col1Values.length < 3) continue;
        
        // Calculate correlation (simplified)
        const mean1 = col1Values.reduce((a, b) => a + b, 0) / col1Values.length;
        const mean2 = col2Values.reduce((a, b) => a + b, 0) / col2Values.length;
        
        let num = 0;
        let den1 = 0;
        let den2 = 0;
        
        for (let k = 0; k < col1Values.length; k++) {
          const dev1 = col1Values[k] - mean1;
          const dev2 = col2Values[k] - mean2;
          num += dev1 * dev2;
          den1 += dev1 * dev1;
          den2 += dev2 * dev2;
        }
        
        const corr = num / (Math.sqrt(den1) * Math.sqrt(den2));
        
        correlations.push({
          col1Index: col1,
          col2Index: col2,
          col1Name: availableColumns[i].name,
          col2Name: availableColumns[j].name,
          correlation: Math.abs(corr)
        });
      }
    }
    
    // Sort by correlation (highest first)
    correlations.sort((a, b) => b.correlation - a.correlation);
    
    // Find the best pair for regression
    if (correlations.length > 0 && correlations[0].correlation > 0.5) {
      const bestPair = correlations[0];
      // Suggest the columns with highest correlation
      setDependentColumn(bestPair.col1Index);
      setIndependentColumns([bestPair.col2Index]);
      alert(`Suggested variables based on correlation: ${bestPair.col1Name} (dependent) and ${bestPair.col2Name} (independent) with correlation of ${bestPair.correlation.toFixed(2)}`);
    }
  }, [availableColumns, hotRef]);
  
  // Replace the existing calculatePrediction function with this updated version
  const calculatePrediction = async () => {
    if (!regressionResult) return;
    
    setError(null);
    
    // Get values from inputs
    const inputValues = [];
    for (let i = 0; i < independentColumns.length; i++) {
      const inputValue = document.getElementById(`pred-${i}`).value;
      if (!inputValue || isNaN(parseFloat(inputValue))) {
        alert("Please enter valid numbers for all variables");
        return;
      }
      inputValues.push(parseFloat(inputValue));
    }
    
    // Prepare model parameters based on regression type
    const modelParams = {
      intercept: regressionResult.intercept,
      coefficients: regressionResult.coefficients,
      standard_error: regressionResult.standard_error
    };
    
    // Add classes for logistic regression
    if (regressionType === 'logistic' && regressionResult.classes) {
      modelParams.classes = regressionResult.classes;
    }
    
    // Get column names
    const indNames = independentColumns.map(idx => 
      availableColumns.find(col => col.index === idx)?.name || `Column ${idx}`
    );
    
    // Call the prediction API
    try {
      setPredictionResult(null);
      setLoading(true);
      
      const response = await fetch('http://localhost:8000/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input_values: inputValues,
          regression_type: regressionType,
          model_params: modelParams,
          polynomial_degree: regressionType === 'polynomial' ? polynomialDegree : null,
          column_names: indNames
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to get prediction');
      }
      
      const predictionData = await response.json();
      
      // Format the result based on regression type
      if (regressionType === 'logistic') {
        setPredictionResult({
          value: predictionData.predicted_class,
          probability: predictionData.probability,
          details: predictionData.details,
          type: 'binary'
        });
      } else {
        setPredictionResult({
          value: predictionData.predicted_value,
          details: predictionData.details,
          confidenceIntervals: predictionData.confidence_intervals,
          type: 'continuous'
        });
      }
    } catch (err) {
      console.error('Prediction error:', err);
      setError(`Prediction failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Updated approach that doesn't require column insertion

  // Update your onChange handler for regression type:
  const handleRegressionTypeChange = (e) => {
    const newType = e.target.value;
    setRegressionType(newType);
    
    // If switching to logistic, check if dependent variable is binary
    if (newType === 'logistic' && dependentColumn !== '') {
      const binaryInfo = checkBinaryColumn(dependentColumn);
      
      if (!binaryInfo.binary) {
        alert(`The selected column isn't binary (0/1). You'll be prompted to convert it when you run the regression.`);
      }
    }
  };

  // Add this helper function:
  const checkBinaryColumn = (columnIndex) => {
    if (!hotRef || !hotRef.current) return { binary: false };
    
    const hot = hotRef.current.hotInstance;
    const allData = hot.getData();
    
    // Skip header row and collect non-empty values
    const values = [];
    for (let row = 1; row < allData.length; row++) {
      const value = allData[row][columnIndex];
      if (value !== null && value !== undefined && value !== '') {
        values.push(value);
      }
    }
    
    if (values.length < 3) return { binary: false };
    
    // Check unique values
    const uniqueValues = [...new Set(values)];
    
    // Perfect case: exactly 0 and 1
    if (uniqueValues.length === 2 && 
        ((uniqueValues.includes(0) && uniqueValues.includes(1)) || 
         (uniqueValues.includes('0') && uniqueValues.includes('1')))) {
      return { binary: true };
    }
    
    // Not binary but convertible case
    if (uniqueValues.length === 2) {
      return { 
        binary: false, 
        convertible: true,
        values: uniqueValues 
      };
    }
    
    return { binary: false };
  };

  // Simplify the Create Binary button:
  {regressionType === 'logistic' && dependentColumn !== '' && (
    <div className={styles.binaryHelper}>
      <button
        onClick={() => {
          alert(`When you run the regression, any two unique values will be automatically converted to 0 and 1 for logistic regression.`);
        }}
        className={styles.helpButton}
        title="Information about binary variables"
      >
        Binary Variable Help
      </button>
    </div>
  )}

  const saveCurrentModel = () => {
    if (!regressionResult) return;
    
    // Create a unique name for the model
    const modelName = `${regressionType.charAt(0).toUpperCase() + regressionType.slice(1)} - ${
      regressionResult.dependent_name} (${new Date().toLocaleTimeString()})`;
    
    // Add the model to the saved models list
    const newModel = {
      id: Date.now(),
      name: modelName,
      type: regressionType,
      result: regressionResult,
      dependentColumn,
      independentColumns,
      polynomialDegree: regressionType === 'polynomial' ? polynomialDegree : null
    };
    
    setSavedModels(prevModels => [...prevModels, newModel]);
    alert(`Model "${modelName}" saved for comparison`);
  };

  const deleteModel = (modelId) => {
    setSavedModels(prevModels => prevModels.filter(model => model.id !== modelId));
  };

  return (
    <div className={styles.regressionPanel}>
      <h2>Regression Analysis</h2>
      
      <div className={styles.instructions}>
        <p>Build a regression model to predict a dependent variable based on independent variables.</p>
        <ol>
          <li>Select a dependent variable (what you want to predict)</li>
          <li>Select one or more independent variables (predictors)</li>
          <li>Choose the regression type</li>
          <li>Click "Run Regression" to analyze</li>
        </ol>
        <p><strong>Note:</strong> For visualization, select only one independent variable.</p>
      </div>
      
      <div className={styles.controls}>
        <button 
          onClick={suggestVariablePairs}
          className={styles.suggestButton}
          disabled={availableColumns.length < 2}
        >
          Auto-suggest Best Variables
        </button>
        
        <div className={styles.variableSelectors}>
          <div className={styles.formGroup}>
            <label htmlFor="dependent-var">Dependent Variable (Y):</label>
            <select 
              id="dependent-var"
              value={dependentColumn}
              onChange={handleDependentChange}
              className={styles.select}
            >
              <option value="">-- Select --</option>
              {availableColumns.map(col => (
                <option key={`dep-${col.index}`} value={col.index}>
                  {col.name}
                </option>
              ))}
            </select>
          </div>
          
          <div className={styles.formGroup}>
            <label htmlFor="independent-vars">Independent Variables (X):</label>
            <select 
              id="independent-vars"
              multiple={regressionType !== 'polynomial'}
              value={independentColumns}
              onChange={handleIndependentChange}
              className={styles.multiSelect}
              disabled={loading}
            >
              {availableColumns
                .filter(col => col.index !== dependentColumn)
                .map(col => (
                  <option key={`ind-${col.index}`} value={col.index}>
                    {col.name}
                  </option>
                ))
              }
            </select>
            <div className={styles.helpText}>
              {regressionType === 'polynomial' 
                ? 'Select only one independent variable for polynomial regression' 
                : 'Hold Ctrl/Cmd to select multiple variables'}
            </div>
          </div>
        </div>
        
        <div className={styles.regressionOptions}>
          <div className={styles.formGroup}>
            <label htmlFor="regression-type">Regression Type:</label>
            <select 
              id="regression-type"
              value={regressionType}
              onChange={handleRegressionTypeChange}
              className={styles.select}
            >
              <option value="linear">Linear</option>
              <option value="polynomial">Polynomial</option>
              <option value="ridge">Ridge</option>
              <option value="lasso">Lasso</option>
              <option value="logistic">Logistic</option>
            </select>
          </div>
          
          {regressionType === 'polynomial' && (
            <div className={styles.formGroup}>
              <label htmlFor="polynomial-degree">Polynomial Degree:</label>
              <select 
                id="polynomial-degree"
                value={polynomialDegree}
                onChange={(e) => setPolynomialDegree(Number(e.target.value))}
                className={styles.select}
              >
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5">5</option>
              </select>
            </div>
          )}
        </div>
      </div>
      
      {error && (
        <div className={styles.error}>
          {error}
        </div>
      )}
      
      <div className={styles.actions}>
        <button 
          onClick={performRegression}
          className={styles.runButton}
          disabled={loading || dependentColumn === '' || independentColumns.length === 0}
        >
          {loading ? 'Running...' : 'Run Regression'}
        </button>
        
        <button 
          onClick={onClose}
          className={styles.cancelButton}
        >
          Close
        </button>
      </div>
      
      {regressionResult && (
        <div className={styles.regressionResult}>
          <h3>Regression Results</h3>
          
          <div className={styles.summaryPanel}>
            <div className={styles.equationBox}>
              <h4>Model Equation</h4>
              <div className={styles.equation}>
                {regressionResult.dependent_name} = {regressionResult.intercept.toFixed(4)}
                {regressionType === 'polynomial' ? (
                  // Display polynomial terms
                  regressionResult.coefficients.map((coef, i) => {
                    const power = i + 1;
                    const sign = coef >= 0 ? ' + ' : ' - ';
                    return (
                      <span key={i}>
                        {sign}{Math.abs(coef).toFixed(4)} × {regressionResult.independent_names[0]}
                        {power > 1 ? <sup>{power}</sup> : ''}
                      </span>
                    );
                  })
                ) : (
                  // Display linear terms
                  regressionResult.coefficients.map((coef, i) => {
                    const sign = coef >= 0 ? ' + ' : ' - ';
                    return (
                      <span key={i}>
                        {sign}{Math.abs(coef).toFixed(4)} × {regressionResult.independent_names[i]}
                      </span>
                    );
                  })
                )}
              </div>
            </div>
            
            <div className={styles.metricsPanel}>
              <div className={styles.metricGrid}>
                <div className={styles.metricItem}>
                  <div className={styles.metricLabel}>
                    {regressionType === 'logistic' ? 'Accuracy' : 'R²'}
                  </div>
                  <div className={styles.metricValue}>
                    {regressionType === 'logistic' ? 
                      (!isNaN(regressionResult.accuracy) && isFinite(regressionResult.accuracy) 
                        ? regressionResult.accuracy.toFixed(4) 
                        : 'N/A') :
                      (!isNaN(regressionResult.r_squared) && isFinite(regressionResult.r_squared) 
                        ? regressionResult.r_squared.toFixed(4) 
                        : 'N/A')
                    }
                  </div>
                </div>
                
                <div className={styles.metricItem}>
                  <div className={styles.metricLabel}>
                    {regressionType === 'logistic' ? 'AUC Score' : 'Adjusted R²'}
                  </div>
                  <div className={styles.metricValue}>
                    {regressionType === 'logistic' ?
                      (regressionResult.auc_score !== null && !isNaN(regressionResult.auc_score) && isFinite(regressionResult.auc_score)
                        ? regressionResult.auc_score.toFixed(4) 
                        : 'N/A') :
                      (!isNaN(regressionResult.adjusted_r_squared) && isFinite(regressionResult.adjusted_r_squared) 
                        ? regressionResult.adjusted_r_squared.toFixed(4) 
                        : 'N/A')
                    }
                  </div>
                </div>
                
                {regressionType !== 'logistic' && (
                  <div className={styles.metricItem}>
                    <div className={styles.metricLabel}>F-statistic</div>
                    <div className={styles.metricValue}>
                      {!isNaN(regressionResult.f_statistic) && isFinite(regressionResult.f_statistic) 
                        ? regressionResult.f_statistic.toFixed(4) 
                        : 'N/A'}
                    </div>
                  </div>
                )}
                
                {regressionType !== 'logistic' && (
                  <div className={styles.metricItem}>
                    <div className={styles.metricLabel}>p-value</div>
                    <div className={styles.metricValue}>
                      {regressionResult.p_value !== null && !isNaN(regressionResult.p_value) && isFinite(regressionResult.p_value)
                        ? regressionResult.p_value.toExponential(4) 
                        : 'N/A'}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className={styles.coefficientTable}>
            <h4>Coefficients</h4>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Variable</th>
                  <th>Coefficient</th>
                  <th>p-value</th>
                  <th>Significance</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Intercept</td>
                  <td>{regressionResult.intercept.toFixed(4)}</td>
                  <td>{regressionResult.intercept_p_value !== null && regressionResult.intercept_p_value !== undefined 
                    ? regressionResult.intercept_p_value.toExponential(4) 
                    : 'N/A'}</td>
                  <td>{getSignificanceStars(regressionResult.intercept_p_value)}</td>
                </tr>
                {regressionResult.coefficients.map((coef, i) => (
                  <tr key={i}>
                    <td>
                      {regressionType === 'polynomial' && independentColumns.length === 1 
                        ? `${regressionResult.independent_names[0]}^${i+1}` 
                        : regressionResult.independent_names[i]}
                    </td>
                    <td>{coef.toFixed(4)}</td>
                    <td>{regressionResult.coefficient_p_values && regressionResult.coefficient_p_values[i] !== null
                      ? regressionResult.coefficient_p_values[i].toExponential(4)
                      : 'N/A'}</td>
                    <td>{getSignificanceStars(regressionResult.coefficient_p_values && regressionResult.coefficient_p_values[i])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className={styles.significanceNote}>
              Significance: *** p&lt;0.001, ** p&lt;0.01, * p&lt;0.05, . p&lt;0.1
            </div>
          </div>
          
          <div className={styles.resultActions}>
            <button 
              onClick={exportToSpreadsheet} 
              className={styles.exportButton}
            >
              Export Results
            </button>
            <button 
              onClick={saveCurrentModel} 
              className={styles.saveModelButton}
              title="Save model for comparison"
            >
              Save Model
            </button>
            <button 
              onClick={() => setShowComparison(true)} 
              className={styles.compareButton}
              title="Compare saved models"
              disabled={savedModels.length === 0}
            >
              Compare Models ({savedModels.length})
            </button>
          </div>
          
          {independentColumns.length === 1 && regressionType !== 'logistic' && (
            <div className={styles.chartSection}>
              <div className={styles.chartContainer}>
                <canvas ref={scatterChartRef} height="300"></canvas>
              </div>
              
              <div className={styles.chartContainer}>
                <canvas ref={residualChartRef} height="300"></canvas>
              </div>
            </div>
          )}
          
          {regressionType === 'logistic' && regressionResult?.roc_points && (
            <div className={styles.chartContainer}>
              <h4>ROC Curve</h4>
              <canvas ref={rocChartRef} height="300"></canvas>
            </div>
          )}
          
          <div className={styles.interpretation}>
            <h4>Model Interpretation</h4>
            <div className={styles.interpretationText}>
              {regressionType === 'logistic' ? (
                <p>This logistic regression model predicts {regressionResult.dependent_name} with 
                  an accuracy of {(regressionResult.accuracy * 100).toFixed(1)}%.
                  {regressionResult.auc_score && 
                    ` The AUC score is ${regressionResult.auc_score.toFixed(3)}, indicating ${
                      regressionResult.auc_score > 0.8 ? 'excellent' : 
                      regressionResult.auc_score > 0.7 ? 'good' : 
                      regressionResult.auc_score > 0.6 ? 'fair' : 'poor'
                    } discriminative ability.`
                  }
                </p>
              ) : (
                <p>The overall model is {
                  regressionType === 'logistic' ? 
                  (regressionResult.accuracy > 0.5 ? 
                    <strong>performing better than random chance</strong> : 
                    <strong>not performing better than random chance</strong>
                  ) : (
                    regressionResult.p_value && regressionResult.p_value < 0.05 ? 
                    <strong>statistically significant</strong> : 
                    <strong>not statistically significant</strong>
                  )} 
                  {regressionType === 'logistic' ? 
                    `(accuracy: ${(regressionResult.accuracy * 100).toFixed(1)}%)` : 
                    regressionResult.p_value ? 
                      `(p-value: ${regressionResult.p_value.toExponential(4)})` : 
                      ''}
                </p>
              )}
              
              <p><strong>Key findings:</strong></p>
              {regressionType === 'logistic' ? (
                // Logistic regression interpretation
                <li key="logistic-main">
                  This logistic regression model predicts {regressionResult.dependent_name} with 
                  an accuracy of {(regressionResult.accuracy * 100).toFixed(1)}%.
                  {regressionResult.auc_score && 
                    ` The AUC score is ${regressionResult.auc_score.toFixed(3)}, indicating ${
                      regressionResult.auc_score > 0.8 ? 'excellent' : 
                      regressionResult.auc_score > 0.7 ? 'good' : 
                      regressionResult.auc_score > 0.6 ? 'fair' : 'poor'
                    } discriminative ability.`
                  }
                </li>
              ) : (
                // Linear/other regression coefficients interpretation
                regressionResult.coefficients.map((coef, i) => {
                  // Original coefficient interpretation code
                  const varName = regressionType === 'polynomial' && independentColumns.length === 1 
                    ? `${regressionResult.independent_names[0]}^${i+1}` 
                    : regressionResult.independent_names[i];
                  
                  const pValue = regressionResult.coefficient_p_values && regressionResult.coefficient_p_values[i];
                  const isSignificant = pValue < 0.05;
                  
                  return (
                    <li key={i}>
                      {varName} has a {coef > 0 ? 'positive' : 'negative'} relationship 
                      with {regressionResult.dependent_name} 
                      ({Math.abs(coef).toFixed(4)} units {coef > 0 ? 'increase' : 'decrease'} per unit change)
                      {isSignificant 
                        ? ', and this effect is statistically significant' 
                        : ', but this effect is not statistically significant'}.
                    </li>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
      
      {regressionResult && regressionResult.collinearity_warning && (
        <div className={styles.collinearityWarning}>
          <h4>⚠️ Multicollinearity Warning</h4>
          <p>Some independent variables are strongly correlated, which may make your model unstable or difficult to interpret.</p>
          
          <div className={styles.vifTable}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Variable</th>
                  <th>VIF Value</th>
                  <th>Interpretation</th>
                </tr>
              </thead>
              <tbody>
                {regressionResult.vif_values && Object.entries(regressionResult.vif_values).map(([variable, vif]) => (
                  <tr key={variable} className={vif > 10 ? styles.severeVIF : vif > 5 ? styles.moderateVIF : styles.normalVIF}>
                    <td>{variable}</td>
                    <td>{vif.toFixed(2)}</td>
                    <td>
                      {vif > 10 ? 'Severe multicollinearity' : 
                       vif > 5 ? 'Moderate multicollinearity' : 
                       'Acceptable'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className={styles.warningTips}>
            <p><strong>Recommended actions:</strong></p>
            <ul>
              <li>Remove one or more of the correlated predictors</li>
              <li>Use dimensionality reduction (like PCA) before regression</li>
              <li>Use regularization methods (Ridge or Lasso regression)</li>
            </ul>
          </div>
        </div>
      )}
      
      {regressionResult && independentColumns.length > 0 && (
        <div className={styles.predictionSection}>
          <h4>Predict Outcome</h4>
          <div className={styles.predictionForm}>
            {independentColumns.map((colIndex, index) => {
              const colName = availableColumns.find(col => col.index === colIndex)?.name || `Column ${colIndex}`;
              return (
                <div key={index} className={styles.inputGroup}>
                  <label htmlFor={`pred-${index}`}>{colName}:</label>
                  <input 
                    id={`pred-${index}`}
                    type="number" 
                    placeholder="Enter value"
                    className={styles.predictionInput}
                  />
                </div>
              );
            })}
            <button onClick={calculatePrediction} className={styles.predictButton}>
              Calculate Prediction
            </button>
            {predictionResult !== null && (
              <div className={styles.predictionResult}>
                {predictionResult.type === 'continuous' ? (
                  <>
                    <div>
                      <strong>Predicted {regressionResult.dependent_name}:</strong> {predictionResult.value.toFixed(4)}
                    </div>
                    
                    {predictionResult.confidenceIntervals && (
                      <div className={styles.confidenceIntervals}>
                        <div>95% Confidence Interval: [{predictionResult.confidenceIntervals['95%'][0].toFixed(4)}, {predictionResult.confidenceIntervals['95%'][1].toFixed(4)}]</div>
                        <div>90% Confidence Interval: [{predictionResult.confidenceIntervals['90%'][0].toFixed(4)}, {predictionResult.confidenceIntervals['90%'][1].toFixed(4)}]</div>
                      </div>
                    )}
                    
                    {predictionResult.details && (
                      <div className={styles.predictionDetails}>
                        <h5>Calculation Breakdown:</h5>
                        <ul>
                          {predictionResult.details.equation_terms.map((term, idx) => (
                            <li key={idx}>
                              {term.term === 'intercept' ? 
                                <>Intercept: {term.value.toFixed(4)}</> :
                                <>{term.term}: {term.coefficient.toFixed(4)} × {term.value.toFixed(4)} = {term.contribution.toFixed(4)}</>
                              }
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div>
                      <strong>Predicted {regressionResult.dependent_name}:</strong> {predictionResult.value}
                    </div>
                    <div>
                      <strong>Probability:</strong> {(predictionResult.probability * 100).toFixed(2)}%
                    </div>
                    
                    {predictionResult.details && (
                      <div className={styles.predictionDetails}>
                        <h5>Calculation Breakdown:</h5>
                        <p>Log-odds: {predictionResult.details.log_odds.toFixed(4)}</p>
                        <ul>
                          {predictionResult.details.equation_terms.map((term, idx) => (
                            <li key={idx}>
                              {term.term === 'intercept' ? 
                                <>Intercept: {term.value.toFixed(4)}</> :
                                <>{term.term}: {term.coefficient.toFixed(4)} × {term.value.toFixed(4)} = {term.contribution.toFixed(4)}</>
                              }
                            </li>
                          ))}
                        </ul>
                        <p>Probability = 1 / (1 + e<sup>-({predictionResult.details.log_odds.toFixed(2)})</sup>) = {predictionResult.probability.toFixed(4)}</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      
      {regressionType === 'logistic' && dependentColumn !== '' && (
        <div className={styles.binaryHelper}>
          <button
            onClick={() => {
              alert(`When you run the regression, any two unique values will be automatically converted to 0 and 1 for logistic regression.`);
            }}
            className={styles.helpButton}
            title="Information about binary variables"
          >
            Binary Variable Help
          </button>
        </div>
      )}
      
      {regressionType === 'logistic' && regressionResult && (
        <div className={styles.logisticResults}>
          <h4>Classification Results</h4>
          
          <div className={styles.metricsPanel}>
            <div className={styles.metricGrid}>
              <div className={styles.metricItem}>
                <div className={styles.metricLabel}>Accuracy</div>
                <div className={styles.metricValue}>
                  {regressionResult.accuracy ? regressionResult.accuracy.toFixed(4) : 'N/A'}
                </div>
              </div>
              
              {regressionResult.auc_score && (
                <div className={styles.metricItem}>
                  <div className={styles.metricLabel}>AUC Score</div>
                  <div className={styles.metricValue}>
                    {regressionResult.auc_score.toFixed(4)}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <div className={styles.confusionMatrix}>
            <h4>Confusion Matrix</h4>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th></th>
                  <th>Predicted: {regressionResult.classes[0]}</th>
                  <th>Predicted: {regressionResult.classes[1]}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Actual: {regressionResult.classes[0]}</strong></td>
                  <td>{regressionResult.confusion_matrix[0][0]}</td>
                  <td>{regressionResult.confusion_matrix[0][1]}</td>
                </tr>
                <tr>
                  <td><strong>Actual: {regressionResult.classes[1]}</strong></td>
                  <td>{regressionResult.confusion_matrix[1][0]}</td>
                  <td>{regressionResult.confusion_matrix[1][1]}</td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <div className={styles.classificationReport}>
            <h4>Classification Report</h4>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Class</th>
                  <th>Precision</th>
                  <th>Recall</th>
                  <th>F1-Score</th>
                  <th>Support</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(regressionResult.classification_report).map(([className, metrics]) => {
                  if (className !== 'accuracy' && className !== 'macro avg' && className !== 'weighted avg') {
                    return (
                      <tr key={className}>
                        <td>{className}</td>
                        <td>{metrics && metrics.precision ? metrics.precision.toFixed(2) : 'N/A'}</td>
                        <td>{metrics && metrics.recall ? metrics.recall.toFixed(2) : 'N/A'}</td>
                        <td>{metrics && metrics.f1_score ? metrics.f1_score.toFixed(2) : 'N/A'}</td>
                        <td>{metrics && metrics.support ? metrics.support : 'N/A'}</td>
                      </tr>
                    );
                  }
                  return null;
                })}
                {regressionResult.classification_report && regressionResult.classification_report['macro avg'] && (
                  <tr>
                    <td><strong>Macro Avg</strong></td>
                    <td>{regressionResult.classification_report['macro avg'].precision ? 
                      regressionResult.classification_report['macro avg'].precision.toFixed(2) : 'N/A'}</td>
                    <td>{regressionResult.classification_report['macro avg'].recall ? 
                      regressionResult.classification_report['macro avg'].recall.toFixed(2) : 'N/A'}</td>
                    <td>{regressionResult.classification_report['macro avg'].f1_score ? 
                      regressionResult.classification_report['macro avg'].f1_score.toFixed(2) : 'N/A'}</td>
                    <td>{regressionResult.classification_report['macro avg'].support ? 
                      regressionResult.classification_report['macro avg'].support : 'N/A'}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {showComparison && (
        <ModelComparison 
          models={savedModels} 
          onClose={() => setShowComparison(false)}
          onDelete={deleteModel}
        />
      )}
    </div>
  );
};

// Helper function for significance stars
function getSignificanceStars(pValue) {
  if (pValue === null || pValue === undefined) return '-';
  
  if (pValue < 0.001) return '***';
  if (pValue < 0.01) return '**';
  if (pValue < 0.05) return '*';
  if (pValue < 0.1) return '.';
  return '';
}

export default RegressionAnalysisPanel; 