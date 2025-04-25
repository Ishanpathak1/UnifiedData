import React, { useState, useEffect, useRef } from 'react';
import styles from '../styles/TimeSeriesForecast.module.css';
import Chart from 'chart.js/auto';

const TimeSeriesForecastPanel = ({ hotRef, onClose }) => {
  const [dateColumns, setDateColumns] = useState([]);
  const [valueColumns, setValueColumns] = useState([]);
  const [selectedDateColumn, setSelectedDateColumn] = useState('');
  const [selectedValueColumn, setSelectedValueColumn] = useState('');
  const [forecastPeriods, setForecastPeriods] = useState(7);
  const [forecastMethod, setForecastMethod] = useState('auto');
  const [seasonality, setSeasonality] = useState('auto');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [forecastResult, setForecastResult] = useState(null);
  
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  
  // Scan spreadsheet for date and numeric columns
  useEffect(() => {
    if (!hotRef || !hotRef.current) return;
    
    const hot = hotRef.current.hotInstance;
    const allData = hot.getData();
    const colHeaders = hot.getColHeader();
    
    // Find date columns
    const dateColCandidates = [];
    const valueColCandidates = [];
    
    for (let col = 0; col < allData[0]?.length || 0; col++) {
      let dateCount = 0;
      let numericCount = 0;
      let totalNonEmpty = 0;
      
      // Skip header row and check data rows
      for (let row = 1; row < Math.min(allData.length, 20); row++) {
        const value = allData[row][col];
        if (value !== null && value !== '') {
          totalNonEmpty++;
          
          // Check if it's a date
          const dateObj = new Date(value);
          if (!isNaN(dateObj.getTime())) {
            dateCount++;
          }
          
          // Check if it's numeric
          if (!isNaN(Number(value))) {
            numericCount++;
          }
        }
      }
      
      // Get column name
      let columnName;
      const header = colHeaders?.[col];
      if (header && typeof header === 'string') {
        columnName = header;
      } else {
        const firstRowValue = allData[0]?.[col];
        columnName = (firstRowValue && String(firstRowValue)) || String.fromCharCode(65 + col);
      }
      
      // If >70% of non-empty values are dates, consider it a date column
      if (totalNonEmpty > 0 && dateCount / totalNonEmpty >= 0.7) {
        dateColCandidates.push({ index: col, name: columnName });
      }
      
      // If >80% of non-empty values are numeric, consider it a value column
      if (totalNonEmpty > 0 && numericCount / totalNonEmpty >= 0.8) {
        valueColCandidates.push({ index: col, name: columnName });
      }
    }
    
    setDateColumns(dateColCandidates);
    setValueColumns(valueColCandidates);
    
    // Auto-select first columns if available
    if (dateColCandidates.length > 0) {
      setSelectedDateColumn(dateColCandidates[0].index);
    }
    if (valueColCandidates.length > 0) {
      setSelectedValueColumn(valueColCandidates[0].index);
    }
  }, [hotRef]);
  
  // Generate time series data
  const generateTimeSeriesData = () => {
    if (!hotRef || !hotRef.current) return [];
    if (selectedDateColumn === '' || selectedValueColumn === '') return [];
    
    const hot = hotRef.current.hotInstance;
    const allData = hot.getData();
    
    const timeSeriesData = [];
    
    // Skip header row
    for (let row = 1; row < allData.length; row++) {
      const dateValue = allData[row][selectedDateColumn];
      const numericValue = allData[row][selectedValueColumn];
      
      if (dateValue && numericValue !== null && numericValue !== '' && !isNaN(Number(numericValue))) {
        const dateObj = new Date(dateValue);
        
        if (!isNaN(dateObj.getTime())) {
          timeSeriesData.push({
            date: dateObj,
            value: Number(numericValue)
          });
        }
      }
    }
    
    // Sort by date
    timeSeriesData.sort((a, b) => a.date - b.date);
    
    return timeSeriesData;
  };
  
  // Handle forecast generation
  const handleForecast = async () => {
    setError(null);
    setLoading(true);
    
    try {
      const timeSeriesData = generateTimeSeriesData();
      
      if (timeSeriesData.length < 10) {
        throw new Error("Need at least 10 data points for forecasting");
      }
      
      // Prepare data for API
      const apiData = {
        data: timeSeriesData.map(item => ({
          date: item.date.toISOString().split('T')[0],
          value: item.value
        })),
        periods: Number(forecastPeriods),
        method: forecastMethod,
        seasonality: seasonality === 'auto' ? 'auto' : Number(seasonality)
      };
      
      // Call API
      const response = await fetch('https://unifieddata-api-552541459765.us-central1.run.app/forecast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(apiData)
      });
      
      if (!response.ok) {
        throw new Error(`API returned status ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      setForecastResult(result);
      
      // Render chart
      setTimeout(() => renderForecastChart(timeSeriesData, result), 50);
      
    } catch (err) {
      console.error("Forecast error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  // Render forecast chart
  const renderForecastChart = (historicalData, forecastData) => {
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }
    
    const ctx = chartRef.current.getContext('2d');
    
    // Prepare data for chart
    const labels = [
      ...historicalData.map(item => item.date.toISOString().split('T')[0]),
      ...forecastData.forecast.map(item => item.date)
    ];
    
    // Historical data
    const historicalValues = historicalData.map(item => item.value);
    
    // Forecast data
    const forecastValues = Array(historicalData.length).fill(null).concat(
      forecastData.forecast.map(item => item.value)
    );
    
    // Upper bound
    const upperBound = Array(historicalData.length).fill(null).concat(
      forecastData.forecast.map(item => item.upper_bound)
    );
    
    // Lower bound
    const lowerBound = Array(historicalData.length).fill(null).concat(
      forecastData.forecast.map(item => item.lower_bound)
    );
    
    chartInstance.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Historical Data',
            data: historicalValues,
            borderColor: 'rgba(54, 162, 235, 1)',
            backgroundColor: 'rgba(54, 162, 235, 0.2)',
            borderWidth: 2,
            pointRadius: 3
          },
          {
            label: 'Forecast',
            data: forecastValues,
            borderColor: 'rgba(255, 99, 132, 1)',
            backgroundColor: 'rgba(255, 99, 132, 0.2)',
            borderWidth: 2,
            borderDash: [5, 5],
            pointRadius: 3
          },
          {
            label: 'Upper Bound (95%)',
            data: upperBound,
            borderColor: 'rgba(255, 99, 132, 0.5)',
            backgroundColor: 'transparent',
            borderWidth: 1,
            pointRadius: 0,
            borderDash: [2, 2]
          },
          {
            label: 'Lower Bound (95%)',
            data: lowerBound,
            borderColor: 'rgba(255, 99, 132, 0.5)',
            backgroundColor: 'transparent',
            borderWidth: 1,
            pointRadius: 0,
            borderDash: [2, 2],
            fill: {
              target: '+1',
              above: 'rgba(255, 99, 132, 0.1)'
            }
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: `Forecast for ${valueColumns.find(col => col.index === selectedValueColumn)?.name}`,
            font: { size: 16 }
          },
          tooltip: {
            mode: 'index',
            intersect: false
          },
          legend: {
            position: 'top',
          }
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'Date'
            }
          },
          y: {
            title: {
              display: true,
              text: 'Value'
            }
          }
        }
      }
    });
  };
  
  // Export forecast to spreadsheet
  const exportForecast = () => {
    if (!forecastResult || !hotRef || !hotRef.current) return;
    
    const hot = hotRef.current.hotInstance;
    const dateCol = hot.countCols();
    const valueCol = dateCol + 1;
    const lowerBoundCol = dateCol + 2;
    const upperBoundCol = dateCol + 3;
    
    // Add new columns
    hot.alter('insert_col', dateCol, 4);
    
    // Set headers
    hot.setDataAtCell(0, dateCol, 'Forecast Date');
    hot.setDataAtCell(0, valueCol, 'Forecast Value');
    hot.setDataAtCell(0, lowerBoundCol, 'Lower Bound');
    hot.setDataAtCell(0, upperBoundCol, 'Upper Bound');
    
    // Set data
    forecastResult.forecast.forEach((item, index) => {
      hot.setDataAtCell(index + 1, dateCol, item.date);
      hot.setDataAtCell(index + 1, valueCol, item.value);
      hot.setDataAtCell(index + 1, lowerBoundCol, item.lower_bound);
      hot.setDataAtCell(index + 1, upperBoundCol, item.upper_bound);
    });
    
    // Alert user
    alert('Forecast data exported to spreadsheet');
  };
  
  return (
    <div className={styles.forecastPanel}>
      <h2>Time Series Forecasting</h2>
      
      <div className={styles.instructions}>
        <p>Forecast future values based on historical time series data.</p>
        <ol>
          <li>Select a date column and a value column</li>
          <li>Choose forecast settings</li>
          <li>Click "Generate Forecast" to see predictions</li>
        </ol>
      </div>
      
      <div className={styles.controls}>
        <div className={styles.columnSelectors}>
          <div className={styles.formGroup}>
            <label htmlFor="date-column">Date Column:</label>
            <select 
              id="date-column"
              value={selectedDateColumn}
              onChange={(e) => setSelectedDateColumn(Number(e.target.value))}
              className={styles.select}
            >
              <option value="">-- Select Date Column --</option>
              {dateColumns.map(col => (
                <option key={`date-${col.index}`} value={col.index}>
                  {col.name}
                </option>
              ))}
            </select>
          </div>
          
          <div className={styles.formGroup}>
            <label htmlFor="value-column">Value Column:</label>
            <select 
              id="value-column"
              value={selectedValueColumn}
              onChange={(e) => setSelectedValueColumn(Number(e.target.value))}
              className={styles.select}
            >
              <option value="">-- Select Value Column --</option>
              {valueColumns.map(col => (
                <option key={`value-${col.index}`} value={col.index}>
                  {col.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        
        <div className={styles.forecastSettings}>
          <div className={styles.formGroup}>
            <label htmlFor="forecast-periods">Forecast Periods:</label>
            <input 
              id="forecast-periods"
              type="number"
              min="1"
              max="365"
              value={forecastPeriods}
              onChange={(e) => setForecastPeriods(e.target.value)}
              className={styles.input}
            />
          </div>
          
          <div className={styles.formGroup}>
            <label htmlFor="forecast-method">Forecast Method:</label>
            <select 
              id="forecast-method"
              value={forecastMethod}
              onChange={(e) => setForecastMethod(e.target.value)}
              className={styles.select}
            >
              <option value="auto">Auto (Best Method)</option>
              <option value="arima">ARIMA</option>
              <option value="ets">Exponential Smoothing</option>
            </select>
          </div>
          
          <div className={styles.formGroup}>
            <label htmlFor="seasonality">Seasonality Period:</label>
            <select 
              id="seasonality"
              value={seasonality}
              onChange={(e) => setSeasonality(e.target.value)}
              className={styles.select}
            >
              <option value="auto">Auto-detect</option>
              <option value="4">Quarterly (4)</option>
              <option value="7">Weekly (7)</option>
              <option value="12">Monthly (12)</option>
              <option value="52">Weekly Annual (52)</option>
              <option value="365">Daily Annual (365)</option>
              <option value="0">No Seasonality</option>
            </select>
          </div>
        </div>
      </div>
      
      {error && (
        <div className={styles.error}>
          {error}
        </div>
      )}
      
      <div className={styles.actions}>
        <button 
          onClick={handleForecast}
          className={styles.forecastButton}
          disabled={loading || selectedDateColumn === '' || selectedValueColumn === ''}
        >
          {loading ? 'Generating...' : 'Generate Forecast'}
        </button>
        
        <button 
          onClick={onClose}
          className={styles.cancelButton}
        >
          Close
        </button>
      </div>
      
      {forecastResult && (
        <div className={styles.forecastResult}>
          <div className={styles.chartContainer}>
            <canvas ref={chartRef} height="400"></canvas>
          </div>
          
          <div className={styles.resultActions}>
            <button 
              onClick={exportForecast}
              className={styles.exportButton}
            >
              Export to Spreadsheet
            </button>
          </div>
          
          <div className={styles.forecastMetrics}>
            <h3>Forecast Metrics</h3>
            <div className={styles.metricsGrid}>
              <div className={styles.metricItem}>
                <span className={styles.metricLabel}>Method Used:</span>
                <span className={styles.metricValue}>{forecastResult.method}</span>
              </div>
              <div className={styles.metricItem}>
                <span className={styles.metricLabel}>MAPE:</span>
                <span className={styles.metricValue}>{forecastResult.mape?.toFixed(2)}%</span>
              </div>
              <div className={styles.metricItem}>
                <span className={styles.metricLabel}>MAE:</span>
                <span className={styles.metricValue}>{forecastResult.mae?.toFixed(4)}</span>
              </div>
              <div className={styles.metricItem}>
                <span className={styles.metricLabel}>Seasonality:</span>
                <span className={styles.metricValue}>{forecastResult.seasonality || 'None'}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimeSeriesForecastPanel; 