import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../utils/firebase';
import { collection, addDoc, query, where, getDocs, updateDoc, doc, arrayUnion, deleteDoc, orderBy } from 'firebase/firestore';
import { Chart as ChartJS } from 'chart.js/auto';
import { Bar, Line, Pie, Scatter } from 'react-chartjs-2';
import styles from '../styles/Reports.module.css';
import ReportViewer from '../components/ReportViewer';
import SignIn from '../components/auth/SignIn';
import Head from 'next/head';
import { useRouter } from 'next/router';

// Dynamically set API base URL based on environment
const API_BASE_URL = typeof window !== 'undefined' && window.location.hostname === 'localhost'
  ? 'http://localhost:8000'
  : 'https://unifieddata-api-552541459765.us-central1.run.app';

// Chart.js default styles
ChartJS.defaults.color = '#6B7280';
ChartJS.defaults.borderColor = '#E5E7EB';
ChartJS.defaults.plugins.tooltip.backgroundColor = '#4F46E5';

// Format date function - move to top level, before any components
const formatDate = (timestamp) => {
  if (!timestamp) return 'N/A';
  
  // Handle Firestore Timestamp
  if (timestamp?.seconds) {
    return new Date(timestamp.seconds * 1000).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }
  
  // Handle regular date string or Date object
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return 'N/A';
  
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
};

// Add a function to check the OpenAI API status
const checkOpenAIStatus = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/openai-status`);
    const result = await response.json();
    
    return {
      status: result.status === 'active',
      message: result.message,
      solution: result.solution
    };
  } catch (error) {
    console.error("Error checking OpenAI API status:", error);
    return {
      status: false,
      message: "Could not connect to API service",
      solution: "Check if the backend server is running and accessible"
    };
  }
};

// Separate CreateReportModal component
const CreateReportModal = ({ onClose, onSubmit }) => {
  const { user } = useAuth();
  const [spreadsheets, setSpreadsheets] = useState([]);
  const [selectedSpreadsheet, setSelectedSpreadsheet] = useState(null);
  const [selectedSheets, setSelectedSheets] = useState([]);
  const [fetchingSheets, setFetchingSheets] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [apiStatus, setApiStatus] = useState(null);
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [config, setConfig] = useState({
    data_quality: {
      missing_values: true,
      type_detection: true,
      anomaly_detection: true
    },
    statistical_analysis: {
      correlation: true,
      correlation_method: "pearson",
      basic_stats: true
    },
    predictive_analysis: {
      regression: false,
      regression_type: "linear",
      forecast: false,
      forecast_periods: 7
    },
    visualizations: [
      {
        type: "line",
        columns: ["all"]
      },
      {
        type: "bar",
        columns: ["all"]
      }
    ],
    ai_analysis: {
      trends: true,
      insights: true,
      recommendations: true
    }
  });

  // Fetch spreadsheets when modal opens
  useEffect(() => {
    const fetchSpreadsheets = async () => {
      setFetchingSheets(true);
      try {
        const sheetsRef = collection(db, 'spreadsheets');
        const q = query(
          sheetsRef,
          where('ownerId', '==', user.uid)
        );

        const snapshot = await getDocs(q);
        const sheetsData = snapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().metadata?.title || doc.data().title || 'Untitled Spreadsheet',
          createdAt: doc.data().createdAt,
          lastModified: doc.data().lastModified,
          metadata: doc.data().metadata || {},
          sheets: doc.data().sheets?.map(sheet => ({
            ...sheet,
            name: sheet.title || sheet.name || 'Untitled Sheet'
          })) || []
        }));

        console.log('Fetched spreadsheets:', sheetsData);
        setSpreadsheets(sheetsData);
      } catch (err) {
        console.error('Error fetching spreadsheets:', err);
        setError('Failed to load spreadsheets');
      } finally {
        setFetchingSheets(false);
      }
    };

    if (user) {
      fetchSpreadsheets();
    }
  }, [user]);

  // Check OpenAI API status when modal opens
  useEffect(() => {
    const checkApiStatus = async () => {
      const status = await checkOpenAIStatus();
      setApiStatus(status);
    };
    
    checkApiStatus();
  }, []);

  const handleSpreadsheetSelect = (spreadsheetId) => {
    const selected = spreadsheets.find(s => s.id === spreadsheetId);
    if (selected) {
      console.log('Processing spreadsheet:', selected);

      // Process sheets data
      const processedSheets = selected.sheets.map(sheet => {
        // Convert the cell_0, cell_1 format to array format
        const processedData = sheet.data.map(row => {
          const rowData = [];
          // Get all cell keys and sort them numerically
          const cellKeys = Object.keys(row)
            .filter(key => key.startsWith('cell_'))
            .sort((a, b) => parseInt(a.split('_')[1]) - parseInt(b.split('_')[1]));
          
          // Build the row data array
          cellKeys.forEach(key => {
            rowData.push(row[key]);
          });
          return rowData;
        });

        return {
          ...sheet,
          id: sheet.id || 'default',
          name: sheet.name || sheet.title || 'Main Sheet',
          processedData: processedData,
          originalData: sheet.data // Keep original format for reference
        };
      });

      console.log('Processed sheets:', processedSheets);

      setSelectedSpreadsheet({
        ...selected,
        sheets: processedSheets
      });
      setSelectedSheets([]);
    }
  };

  const handleConfigChange = (section, field, value) => {
    setConfig(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  const handleVisualizationChange = (index, field, value) => {
    setConfig(prev => ({
      ...prev,
      visualizations: prev.visualizations.map((viz, i) => 
        i === index ? { ...viz, [field]: value } : viz
      )
    }));
  };

  const addVisualization = () => {
    setConfig(prev => ({
      ...prev,
      visualizations: [
        ...prev.visualizations,
        { type: "bar", columns: ["all"] }
      ]
    }));
  };

  const removeVisualization = (index) => {
    setConfig(prev => ({
      ...prev,
      visualizations: prev.visualizations.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!selectedSpreadsheet || selectedSheets.length === 0) {
        throw new Error('Please select at least one sheet');
      }

      // Log the selected data for debugging
      console.log('Selected Spreadsheet:', selectedSpreadsheet);
      console.log('Selected Sheets:', selectedSheets);

      // Validate AI analysis configuration
      if (config.ai_analysis) {
        // Make sure at least one AI analysis option is enabled
        const hasEnabledAIOption = Object.values(config.ai_analysis).some(value => value === true);
        if (!hasEnabledAIOption) {
          console.warn('No AI analysis options are enabled. Setting insights to true as default.');
          config.ai_analysis.insights = true;
        }
      }

      const reportRequest = {
        title: title.trim() || 'Untitled Report',
        description: description.trim() || 'Generated report',
        selected_sheets: selectedSheets.map(sheet => ({
          spreadsheet_id: selectedSpreadsheet.id,
          sheet_id: sheet.id || 'default',
          sheet_name: sheet.name || sheet.title || 'Main Sheet',
          data: sheet.processedData || sheet.data, // Ensure we have the data in correct format
          selected_columns: null,
          data_range: null
        })),
        config: config,
        user_id: user.uid
      };

      // Log the request for debugging
      console.log('Sending report request:', JSON.stringify(reportRequest, null, 2));

      const apiUrl = API_BASE_URL + '/api/reports/generate';
      
      console.log(`Sending request to: ${apiUrl}`);
      
      // Implement timeout to avoid hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout
      
      try {
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(reportRequest),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        const responseText = await response.text();
        let result;
        
        try {
          result = JSON.parse(responseText);
        } catch (jsonError) {
          console.error('Error parsing JSON response:', jsonError);
          console.log('Raw response:', responseText);
          throw new Error(`Invalid response format: ${responseText.substring(0, 100)}...`);
        }
        
        if (!response.ok) {
          console.error('API Error Response:', result);
          throw new Error(`API error: ${result.error || result.message || JSON.stringify(result)}`);
        }

        console.log('Report generation successful:', result);
        
        // AI insights are working correctly, no need to add error messages
        // Just submit the result as is
        onSubmit(result);
        onClose();
      } catch (fetchError) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          throw new Error('Request timed out. The server took too long to respond.');
        }
        throw fetchError;
      }
    } catch (error) {
      console.error('Error generating report:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2>Create New Report</h2>
          <button 
            className={styles.closeButton}
            onClick={onClose}
            disabled={loading}
          >
            ×
          </button>
        </div>

        {error && (
          <div className={styles.error}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className={styles.formSection}>
            <label htmlFor="title">Report Title</label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter report title"
              required
              disabled={loading}
              className={styles.input}
            />
          </div>

          <div className={styles.formSection}>
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter report description"
              disabled={loading}
              className={styles.textarea}
            />
          </div>

          <div className={styles.formSection}>
            <h3>Select Data</h3>
            {fetchingSheets ? (
              <div className={styles.loading}>
                <div className={styles.spinner}></div>
                Loading spreadsheets...
              </div>
            ) : spreadsheets.length === 0 ? (
              <div className={styles.empty}>
                No spreadsheets found. Please upload a spreadsheet first.
              </div>
            ) : (
              <>
                <select
                  value={selectedSpreadsheet?.id || ''}
                  onChange={(e) => handleSpreadsheetSelect(e.target.value)}
                  className={styles.select}
                  disabled={loading}
                >
                  <option value="">Choose a spreadsheet</option>
                  {spreadsheets.map(sheet => (
                    <option key={sheet.id} value={sheet.id}>
                      {sheet.name} - {formatDate(sheet.lastModified)}
                    </option>
                  ))}
                </select>

                {selectedSpreadsheet && (
                  <div className={styles.sheetSelection}>
                    <div className={styles.spreadsheetInfo}>
                      <p className={styles.metadata}>
                        Created: {formatDate(selectedSpreadsheet.createdAt)}
                      </p>
                      <p className={styles.metadata}>
                        Last modified: {formatDate(selectedSpreadsheet.lastModified)}
                      </p>
                      <p className={styles.metadata}>
                        Last editor: {selectedSpreadsheet.metadata?.lastEditor || 'Unknown'}
                      </p>
                    </div>

                    <h4>Available Sheets</h4>
                    {selectedSpreadsheet.sheets.map((sheet, index) => (
                      <div key={index} className={styles.sheetItem}>
                        <label className={styles.checkboxLabel}>
                          <input
                            type="checkbox"
                            checked={selectedSheets.includes(sheet)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedSheets([...selectedSheets, sheet]);
                              } else {
                                setSelectedSheets(selectedSheets.filter(s => s !== sheet));
                              }
                            }}
                            disabled={loading}
                          />
                          <span>{sheet.name}</span>
                        </label>
                        {selectedSheets.includes(sheet) && (
                          <DataPreview data={sheet.processedData} />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <div className={styles.formSection}>
            <h3>Report Configuration</h3>
            
            {/* Only show warning if explicitly debugging API issues */}
            {false && apiStatus && !apiStatus.status && (
              <div className={styles.apiWarning}>
                <h4>⚠️ OpenAI API Status Warning</h4>
                <p>{apiStatus.message}</p>
                {apiStatus.solution && (
                  <p className={styles.apiSolution}><strong>Solution:</strong> {apiStatus.solution}</p>
                )}
                <p>AI insights may not be generated for your report.</p>
              </div>
            )}
            
            <div className={styles.configSection}>
              <h4>Data Quality Analysis</h4>
              <div className={styles.checkboxGroup}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={config.data_quality.missing_values}
                    onChange={(e) => handleConfigChange('data_quality', 'missing_values', e.target.checked)}
                    disabled={loading}
                  />
                  Check Missing Values
                </label>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={config.data_quality.type_detection}
                    onChange={(e) => handleConfigChange('data_quality', 'type_detection', e.target.checked)}
                    disabled={loading}
                  />
                  Detect Data Types
                </label>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={config.data_quality.anomaly_detection}
                    onChange={(e) => handleConfigChange('data_quality', 'anomaly_detection', e.target.checked)}
                    disabled={loading}
                  />
                  Detect Anomalies
                </label>
              </div>
            </div>

            <div className={styles.configSection}>
              <h4>Statistical Analysis</h4>
              <div className={styles.checkboxGroup}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={config.statistical_analysis.basic_stats}
                    onChange={(e) => handleConfigChange('statistical_analysis', 'basic_stats', e.target.checked)}
                    disabled={loading}
                  />
                  Basic Statistics
                </label>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={config.statistical_analysis.correlation}
                    onChange={(e) => handleConfigChange('statistical_analysis', 'correlation', e.target.checked)}
                    disabled={loading}
                  />
                  Correlation Analysis
                </label>
                {config.statistical_analysis.correlation && (
                  <select
                    value={config.statistical_analysis.correlation_method}
                    onChange={(e) => handleConfigChange('statistical_analysis', 'correlation_method', e.target.value)}
                    disabled={loading}
                    className={styles.select}
                  >
                    <option value="pearson">Pearson</option>
                    <option value="spearman">Spearman</option>
                    <option value="kendall">Kendall</option>
                  </select>
                )}
              </div>
            </div>

            <div className={styles.configSection}>
              <h4>Predictive Analysis</h4>
              <div className={styles.checkboxGroup}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={config.predictive_analysis.regression}
                    onChange={(e) => handleConfigChange('predictive_analysis', 'regression', e.target.checked)}
                    disabled={loading}
                  />
                  Regression Analysis
                </label>
                {config.predictive_analysis.regression && (
                  <select
                    value={config.predictive_analysis.regression_type}
                    onChange={(e) => handleConfigChange('predictive_analysis', 'regression_type', e.target.value)}
                    disabled={loading}
                    className={styles.select}
                  >
                    <option value="linear">Linear</option>
                    <option value="polynomial">Polynomial</option>
                    <option value="logistic">Logistic</option>
                  </select>
                )}
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={config.predictive_analysis.forecast}
                    onChange={(e) => handleConfigChange('predictive_analysis', 'forecast', e.target.checked)}
                    disabled={loading}
                  />
                  Time Series Forecast
                </label>
                {config.predictive_analysis.forecast && (
                  <input
                    type="number"
                    value={config.predictive_analysis.forecast_periods}
                    onChange={(e) => handleConfigChange('predictive_analysis', 'forecast_periods', parseInt(e.target.value))}
                    min="1"
                    max="30"
                    disabled={loading}
                    className={styles.input}
                  />
                )}
              </div>
            </div>

            <div className={styles.configSection}>
              <h4>Visualizations</h4>
              {config.visualizations.map((viz, index) => (
                <div key={index} className={styles.visualizationItem}>
                  <select
                    value={viz.type}
                    onChange={(e) => handleVisualizationChange(index, 'type', e.target.value)}
                    disabled={loading}
                    className={styles.select}
                  >
                    <option value="bar">Bar Chart</option>
                    <option value="line">Line Chart</option>
                    <option value="pie">Pie Chart</option>
                    <option value="scatter">Scatter Plot</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => removeVisualization(index)}
                    disabled={loading}
                    className={styles.removeButton}
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addVisualization}
                disabled={loading}
                className={styles.addButton}
              >
                Add Visualization
              </button>
            </div>

            <div className={styles.configSection}>
              <h4>AI Analysis</h4>
              <div className={styles.checkboxGroup}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={config.ai_analysis.trends}
                    onChange={(e) => handleConfigChange('ai_analysis', 'trends', e.target.checked)}
                    disabled={loading}
                  />
                  Trend Analysis
                </label>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={config.ai_analysis.insights}
                    onChange={(e) => handleConfigChange('ai_analysis', 'insights', e.target.checked)}
                    disabled={loading}
                  />
                  Generate Insights
                </label>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={config.ai_analysis.recommendations}
                    onChange={(e) => handleConfigChange('ai_analysis', 'recommendations', e.target.checked)}
                    disabled={loading}
                  />
                  Generate Recommendations
                </label>
              </div>
            </div>
          </div>

          <div className={styles.modalFooter}>
            <button
              type="button"
              onClick={onClose}
              className={styles.cancelButton}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.submitButton}
              disabled={loading || !selectedSpreadsheet || selectedSheets.length === 0}
            >
              {loading ? (
                <>
                  <div className={styles.spinner}></div>
                  Generating...
                </>
              ) : (
                'Generate Report'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const DataPreview = ({ data }) => {
  if (!data || data.length === 0) return null;

  return (
    <div className={styles.dataPreview}>
      <h5>Data Preview:</h5>
      <div className={styles.previewTable}>
        {data.slice(0, 3).map((row, rowIndex) => (
          <div key={rowIndex} className={styles.previewRow}>
            {row.slice(0, 5).map((cell, cellIndex) => (
              <div key={cellIndex} className={styles.previewCell}>
                {cell !== '' ? cell : '-'}
              </div>
            ))}
            {row.length > 5 && <div className={styles.previewCell}>...</div>}
          </div>
        ))}
        {data.length > 3 && (
          <div className={styles.previewRow}>
            <div className={styles.previewCell}>...</div>
          </div>
        )}
      </div>
    </div>
  );
};

const Reports = () => {
  const { user } = useAuth();
  const router = useRouter();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [deletingReportId, setDeletingReportId] = useState(null);
  const [spreadsheets, setSpreadsheets] = useState([]);
  const [selectedSpreadsheet, setSelectedSpreadsheet] = useState(null);
  const [selectedSheets, setSelectedSheets] = useState([]);
  const [currentReport, setCurrentReport] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [selectedReportId, setSelectedReportId] = useState(null);

  // Get current path for active nav state
  const currentPath = router.pathname;

  useEffect(() => {
    if (user) {
      fetchReports();
      fetchSpreadsheets();
    }
  }, [user]);

  // Add useEffect to handle click outside context menu
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (contextMenu && !event.target.closest(`.${styles.contextMenu}`)) {
        setContextMenu(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [contextMenu]);

  const fetchSpreadsheets = async () => {
    try {
      const sheetsRef = collection(db, 'spreadsheets');
      const q = query(sheetsRef, where('userId', '==', user.uid));
      const snapshot = await getDocs(q);
      setSpreadsheets(snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })));
    } catch (err) {
      console.error('Error fetching spreadsheets:', err);
    }
  };

  const fetchReports = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const reportsRef = collection(db, 'reports');
      const q = query(
        reportsRef, 
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const reportsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt || new Date().toISOString(),
        updatedAt: doc.data().updatedAt || new Date().toISOString()
      }));
      
      setReports(reportsData);
    } catch (err) {
      console.error('Error fetching reports:', err);
      setError('Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  const validateAndTransformData = (sheet) => {
    // Ensure we have data
    if (!sheet.processedData || !Array.isArray(sheet.processedData)) {
      throw new Error('Invalid sheet data format');
    }

    // Get headers from first row
    const headers = sheet.processedData[0];
    if (!headers || !Array.isArray(headers)) {
      throw new Error('Missing headers in sheet data');
    }

    // Transform data to ensure all values are properly formatted
    const transformedData = sheet.processedData.map((row, rowIndex) => {
      if (rowIndex === 0) return row; // Keep headers as is
      
      return row.map((cell, cellIndex) => {
        // Try to convert numeric strings to numbers
        if (typeof cell === 'string' && !isNaN(cell) && cell.trim() !== '') {
          return Number(cell);
        }
        return cell;
      });
    });

    return {
      name: sheet.name || `Sheet ${sheet.index + 1}`,
      data: transformedData,
      headers: headers
    };
  };

  const handleDeleteReport = async (reportId) => {
    if (deletingReportId !== reportId) {
      setDeletingReportId(reportId);
      return;
    }

    if (!window.confirm('Are you sure you want to delete this report?')) {
      setDeletingReportId(null);
      return;
    }

    try {
      await deleteDoc(doc(db, 'reports', reportId));
      setReports(reports.filter(report => report.id !== reportId));
      if (selectedReport?.id === reportId) {
        setSelectedReport(null);
      }
    } catch (err) {
      console.error('Error deleting report:', err);
      setError('Failed to delete report');
    } finally {
      setDeletingReportId(null);
    }
  };

  const handleCreateReport = async (report) => {
    try {
      setLoading(true);
      
      // Add timestamp and user ID to the report
      const reportData = {
        ...report,
        userId: user.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'completed'
      };

      // Save to Firebase
      const docRef = await addDoc(collection(db, 'reports'), reportData);
      
      // Add the ID to the report object
      const newReport = {
        ...reportData,
        id: docRef.id
      };

      // Update local state
      setReports(prevReports => [...prevReports, newReport]);
      setShowCreateModal(false);
      setCurrentReport(newReport);
    } catch (error) {
      console.error('Error creating report:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleContextMenu = (e, reportId) => {
    e.preventDefault();
    setSelectedReportId(reportId);
    setContextMenu({
      x: e.pageX,
      y: e.pageY,
    });
  };

  const handleDelete = async () => {
    if (!selectedReportId) return;

    if (window.confirm('Are you sure you want to delete this report?')) {
      try {
        await deleteDoc(doc(db, 'reports', selectedReportId));
        setReports(reports.filter(report => report.id !== selectedReportId));
        if (selectedReport?.id === selectedReportId) {
          setSelectedReport(null);
        }
      } catch (err) {
        console.error('Error deleting report:', err);
        setError('Failed to delete report');
      }
    }
    setContextMenu(null);
    setSelectedReportId(null);
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        Loading reports...
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Head>
        <title>Reports | UnifiedData</title>
      </Head>
      
      <header className={styles.header}>
        <h1 className={styles.logo}>UnifiedData</h1>
        <nav className={styles.nav}>
          <button 
            className={`${styles.navButton} ${currentPath === '/' ? styles.active : ''}`}
            onClick={() => router.push('/')}
          >
            Spreadsheets
          </button>
          <button 
            className={`${styles.navButton} ${currentPath === '/dashboard' ? styles.active : ''}`}
            onClick={() => router.push('/dashboard')}
          >
            Dashboards
          </button>
          <button 
            className={`${styles.navButton} ${currentPath === '/reports' ? styles.active : ''}`}
            onClick={() => router.push('/reports')}
          >
            Reports
          </button>
        </nav>
        <div className={styles.headerRight}>
          <SignIn />
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.actionsBar}>
          <h2 className={styles.pageTitle}>Your Reports</h2>
          <button
            className={styles.createButton}
            onClick={() => setShowCreateModal(true)}
          >
            Create Report
          </button>
        </div>

        {error && (
          <div className={styles.error}>
            {error}
          </div>
        )}

        <div className={styles.reportsGrid}>
          {reports.map((report) => (
            <div 
              key={report.id} 
              className={styles.reportCard}
              onContextMenu={(e) => handleContextMenu(e, report.id)}
            >
              <div className={styles.reportHeader}>
                <h3>{report.title}</h3>
                <div className={styles.reportActions}>
                  <button
                    onClick={() => setSelectedReport(report)}
                    className={styles.actionButton}
                  >
                    Open
                  </button>
                </div>
              </div>
              
              <p className={styles.reportDescription}>{report.description}</p>
              <div className={styles.reportMeta}>
                <span>Created: {formatDate(report.createdAt)}</span>
                {report.sharedWith?.length > 0 && (
                  <span>Shared with {report.sharedWith.length} users</span>
                )}
              </div>
            </div>
          ))}

          {reports.length === 0 && (
            <div className={styles.empty}>
              No reports found. Create your first report to get started.
            </div>
          )}
        </div>

        {contextMenu && (
          <div 
            className={styles.contextMenu}
            style={{
              top: contextMenu.y,
              left: contextMenu.x,
            }}
          >
            <div 
              className={`${styles.contextMenuItem} ${styles.delete}`}
              onClick={handleDelete}
            >
              Delete Report
            </div>
          </div>
        )}

        {selectedReport && (
          <div className={styles.reportViewerContainer}>
            <div className={styles.reportViewerHeader}>
              <h2>{selectedReport.title}</h2>
              <button
                onClick={() => setSelectedReport(null)}
                className={styles.closeButton}
              >
                Close
              </button>
            </div>
            <ReportViewer report={selectedReport} />
          </div>
        )}

        {showCreateModal && (
          <CreateReportModal
            onClose={() => setShowCreateModal(false)}
            onSubmit={handleCreateReport}
          />
        )}
      </main>
    </div>
  );
};

// Add these additional styles
const additionalStyles = `
  .spreadsheetInfo {
    background-color: #F3F4F6;
    padding: 0.75rem;
    border-radius: 0.375rem;
    margin-bottom: 1rem;
  }

  .metadata {
    color: #4B5563;
    font-size: 0.875rem;
    margin: 0.25rem 0;
  }

  .spinner {
    width: 1rem;
    height: 1rem;
    border: 2px solid #E5E7EB;
    border-top-color: #4F46E5;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    display: inline-block;
    margin-right: 0.5rem;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .previewTable {
    background-color: white;
    border: 1px solid #E5E7EB;
    border-radius: 0.375rem;
    overflow: hidden;
    margin-top: 0.5rem;
  }

  .previewRow {
    display: flex;
    border-bottom: 1px solid #E5E7EB;
  }

  .previewRow:last-child {
    border-bottom: none;
  }

  .previewCell {
    padding: 0.5rem;
    border-right: 1px solid #E5E7EB;
    min-width: 80px;
    max-width: 150px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .previewCell:last-child {
    border-right: none;
  }
`;

export default Reports;