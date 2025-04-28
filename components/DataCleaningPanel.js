import React, { useState, useEffect } from 'react';
import styles from '../styles/DataCleaning.module.css';
import axios from 'axios';

const ENABLE_OFFLINE_MODE = false; // Set to true to bypass API and use local analysis

const DataCleaningPanel = ({ 
  isOpen, 
  onClose, 
  sheetData, 
  applyChanges
}) => {
  // States for the different phases
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [selectedSuggestions, setSelectedSuggestions] = useState({});
  const [summaryStats, setSummaryStats] = useState(null);
  const [retryFeedback, setRetryFeedback] = useState('');
  const [feedbackInput, setFeedbackInput] = useState('');
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [testMode, setTestMode] = useState(false);
  const [analysisStage, setAnalysisStage] = useState('initializing'); // 'initializing', 'scanning', 'processing', 'finalizing'
  const [currentColumn, setCurrentColumn] = useState('');
  const [progress, setProgress] = useState(0);
  
  // API service URL
  const API_URL = 'https://unifieddata-api-552541459765.us-central1.run.app';
  
  // Start analysis when panel opens
  useEffect(() => {
    if (isOpen && sheetData && !analysisResults) {
      analyzeData();
    }
  }, [isOpen, sheetData]);
  
  // Function to analyze data
  const analyzeData = async (feedback = null) => {
    setIsAnalyzing(true);
    setAnalysisStage('initializing');
    setProgress(0);
    
    // Set this to false to use the API
    const USE_LOCAL_ANALYSIS = false;
    
    if (USE_LOCAL_ANALYSIS) {
      // Simulate stages for local analysis with a more detailed flow
      await simulateAnalysisStages();
      useOfflineMode();
      return;
    }
    
    try {
      // Begin analysis - update UI to show scanning
      setAnalysisStage('scanning');
      setProgress(10);
      
      console.log("Sending data to API:", { 
        url: `${API_URL}/api/data-cleaning`,
        dataLength: sheetData?.length || 0
      });
      
      // Update progress and stage
      setProgress(20);
      setAnalysisStage('processing');
      
      // Extract headers to show in the loading state
      const headers = sheetData[0] || [];
      
      // Show progress through columns during API call
      const updateInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            clearInterval(updateInterval);
            return 90;
          }
          return prev + 2;
        });
        
        // Show a random column name to create the effect of processing different columns
        if (headers.length > 0) {
          const randomIndex = Math.floor(Math.random() * headers.length);
          setCurrentColumn(headers[randomIndex]);
        }
      }, 200);
      
      // Use fetch with minimal options
      const rawResponse = await fetch(`${API_URL}/api/data-cleaning`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          data: sheetData,
          retry_feedback: feedback
        })
      });
      
      // Clear the interval as the request is complete
      clearInterval(updateInterval);
      
      // Update to finalizing stage
      setAnalysisStage('finalizing');
      setProgress(95);
      
      // Log everything about the response
      console.log("Response status:", rawResponse.status);
      console.log("Response headers:", 
        Object.fromEntries([...rawResponse.headers.entries()]));
      
      // Get the text response
      const responseText = await rawResponse.text();
      console.log("Raw response:", responseText);
      
      // Try to parse it as JSON
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch (parseError) {
        console.error("Error parsing response:", parseError);
        alert("Could not parse server response. Using local analysis instead.");
        setAnalysisStage('scanning');
        await simulateAnalysisStages();
        useOfflineMode();
        return;
      }
      
      // Check for error in the response data
      if (responseData.error) {
        console.error("API returned error:", responseData.error);
        
        // If it's the specific JSON parsing error, use offline mode
        if (responseData.error.includes("Expecting value: line 1 column 1")) {
          alert("The API is having trouble processing the data. Using local analysis instead.");
          setAnalysisStage('scanning');
          await simulateAnalysisStages();
          useOfflineMode();
          return;
        }
        
        throw new Error(responseData.error);
      }
      
      // Complete progress
      setProgress(100);
      
      // Process successful response
      setAnalysisResults(responseData.columns || []);
      setSuggestions(responseData.suggestions || []);
      setSelectedSuggestions({});
      setSummaryStats(responseData.summary || {});
      
      // Clear retry feedback
      setRetryFeedback('');
      setShowFeedbackForm(false);
      
    } catch (error) {
      console.error("Error analyzing data:", error);
      alert(`Data analysis failed: ${error.message || "Unknown error"}. Using local analysis instead.`);
      setAnalysisStage('scanning');
      await simulateAnalysisStages();
      useOfflineMode();
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  // Add a new function to simulate analysis stages with details
  const simulateAnalysisStages = async () => {
    const headers = sheetData[0] || [];
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
    
    // Initial scanning
    setAnalysisStage('scanning');
    setProgress(10);
    setCurrentColumn('');
    await delay(500);
    
    // Detected structure
    setProgress(20);
    await delay(300);
    
    // Processing columns
    setAnalysisStage('processing');
    
    // Process each column with small delays
    for (let i = 0; i < headers.length; i++) {
      const progress = 20 + Math.floor((i / headers.length) * 60);
      setProgress(progress);
      setCurrentColumn(headers[i]);
      await delay(200);
    }
    
    // Finalizing
    setAnalysisStage('finalizing');
    setProgress(90);
    await delay(500);
    
    setProgress(100);
    await delay(200);
  };
  
  // Add a helper function for offline mode
  const useOfflineMode = () => {
    console.log("Using offline analysis mode");
    
    // Extract headers and data rows from the sheet data
    const headers = sheetData[0] || [];
    const dataRows = sheetData.slice(1);
    
    // Analyze each column locally
    const analyzedColumns = headers.map((header, colIndex) => {
      // Extract column values
      const columnValues = dataRows.map(row => 
        colIndex < row.length ? row[colIndex] : null
      );
      
      // Count missing values
      const missingCount = columnValues.filter(val => 
        val === null || val === undefined || val === ''
      ).length;
      
      // Get non-empty values
      const nonEmptyValues = columnValues.filter(val => 
        val !== null && val !== undefined && val !== ''
      );
      
      // Count unique values
      const uniqueValues = new Set(nonEmptyValues).size;
      
      // Try to detect column type
      let columnType = "text";
      let typeConfidence = 0.6;
      
      // Check for numeric values
      const numericValues = nonEmptyValues.filter(val => {
        if (val === null || val === undefined || val === '') return false;
        const num = parseFloat(String(val).replace(/,/g, ''));
        return !isNaN(num) && isFinite(num);
      });
      
      // Determine column type based on data patterns
      if (nonEmptyValues.length > 0) {
        if (numericValues.length / nonEmptyValues.length > 0.7) {
          columnType = "numeric";
          typeConfidence = numericValues.length / nonEmptyValues.length;
        } else if (uniqueValues / nonEmptyValues.length < 0.3) {
          columnType = "categorical";
          typeConfidence = 0.8;
        }
      } else {
        columnType = "unknown";
        typeConfidence = 0;
      }
      
      // Generate stats
      const stats = {
        total: columnValues.length,
        missing: missingCount,
        unique: uniqueValues
      };
      
      // Add numeric stats if applicable
      if (columnType === "numeric" && numericValues.length > 0) {
        const numericValuesFloat = numericValues.map(v => 
          parseFloat(String(v).replace(/,/g, ''))
        );
        stats.min = Math.min(...numericValuesFloat);
        stats.max = Math.max(...numericValuesFloat);
        stats.mean = numericValuesFloat.reduce((sum, v) => sum + v, 0) / numericValuesFloat.length;
      }
      
      // Detect issues
      const issues = [];
      
      // Check for missing values
      if (missingCount > 0) {
        issues.push({
          type: "missing_values",
          count: missingCount,
          description: `${missingCount} missing values detected`,
          severity: missingCount > columnValues.length * 0.2 ? "high" : "medium"
        });
      }
      
      // Check for type mismatches in numeric columns
      if (columnType === "numeric" && numericValues.length < nonEmptyValues.length) {
        const nonNumericCount = nonEmptyValues.length - numericValues.length;
        issues.push({
          type: "type_mismatch",
          count: nonNumericCount,
          description: `${nonNumericCount} non-numeric values found`,
          severity: "high"
        });
      }
      
      return {
        index: colIndex,
        name: header || `Column ${colIndex + 1}`,
        type: columnType,
        confidence: typeConfidence,
        stats,
        issues
      };
    });
    
    // Generate suggestions
    const allSuggestions = [];
    
    analyzedColumns.forEach(column => {
      if (column.issues && column.issues.length > 0) {
        column.issues.forEach(issue => {
          let action = {};
          
          if (issue.type === "missing_values") {
            if (column.type === "numeric" && column.stats.mean !== undefined) {
              action = {
                type: "fill_missing",
                value: column.stats.mean,
                description: `Fill missing values with mean (${column.stats.mean.toFixed(2)})`
              };
            } else {
              action = {
                type: "fill_missing",
                value: "N/A",
                description: "Fill missing values with 'N/A'"
              };
            }
          } else if (issue.type === "type_mismatch") {
            action = {
              type: "convert_type",
              description: `Convert values to ${column.type} format or replace with null`
            };
          } else {
            action = {
              type: "highlight",
              description: "Highlight for manual review"
            };
          }
          
          allSuggestions.push({
            column_index: column.index,
            column_name: column.name,
            issue_type: issue.type,
            action: action,
            severity: issue.severity,
            recommendation: "",
            columnIndex: column.index,
            columnName: column.name,
            columnType: column.type,
            issue: issue,
            preview: `This would affect ${issue.count} cells in column "${column.name}"`
          });
        });
      }
    });
    
    // Calculate summary stats
    const columnsWithIssues = analyzedColumns.filter(col => col.issues && col.issues.length > 0).length;
    const totalIssues = analyzedColumns.reduce((sum, col) => sum + (col.issues ? col.issues.length : 0), 0);
    const criticalIssues = analyzedColumns.reduce((sum, col) => 
      sum + (col.issues ? col.issues.filter(issue => issue.severity === 'high').length : 0), 0
    );
    
    const summary = {
      totalColumns: analyzedColumns.length,
      columnsWithIssues,
      cleanColumns: analyzedColumns.length - columnsWithIssues,
      totalIssues,
      criticalIssues
    };
    
    // Set all the state to update the UI
    setAnalysisResults(analyzedColumns);
    setSuggestions(allSuggestions);
    setSelectedSuggestions({});
    setSummaryStats(summary);
  };
  
  // Handle selecting/deselecting suggestions
  const toggleSuggestion = (index) => {
    setSelectedSuggestions(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };
  
  // Apply selected suggestions
  const applySelectedSuggestions = () => {
    // Get all selected suggestions
    const selectedSugsArray = Object.entries(selectedSuggestions)
      .filter(([_, isSelected]) => isSelected)
      .map(([index]) => suggestions[parseInt(index)]);
    
    // If none selected, return
    if (selectedSugsArray.length === 0) return;
    
    // Apply changes and close panel
    applyChanges(selectedSugsArray);
    onClose();
  };
  
  // Handle retry with feedback
  const handleRetry = () => {
    if (!feedbackInput.trim()) {
      alert("Please provide feedback for the retry");
      return;
    }
    
    setRetryFeedback(feedbackInput);
    analyzeData(feedbackInput);
    setFeedbackInput('');
  };
  
  // Toggle feedback form
  const toggleFeedbackForm = () => {
    setShowFeedbackForm(!showFeedbackForm);
  };
  
  // If panel is not open, don't render anything
  if (!isOpen) return null;
  
  return (
    <div className={styles.dataCleaningContainer}>
      <div className={styles.dataCleaningPanel}>
        <div className={styles.panelHeader}>
          <h2>AI Data Cleaning</h2>
          <button 
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close panel"
          >
            ×
          </button>
        </div>
        
        <div className={styles.panelContent}>
          {isAnalyzing ? (
            <div className={styles.loadingContainer}>
              <div className={styles.progressBar}>
                <div 
                  className={styles.progressFill} 
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <div className={styles.spinner}></div>
              <p className={styles.loadingStatus}>
                {analysisStage === 'initializing' && 'Initializing analysis...'}
                {analysisStage === 'scanning' && 'Scanning your data structure...'}
                {analysisStage === 'processing' && currentColumn && `Analyzing column: ${currentColumn}`}
                {analysisStage === 'finalizing' && 'Finalizing analysis and generating suggestions...'}
              </p>
              <p className={styles.loadingDetails}>
                {progress < 100 ? `${progress}% complete` : 'Analysis complete!'}
              </p>
            </div>
          ) : analysisResults ? (
            <>
              {/* Summary Statistics */}
              {summaryStats && (
                <div className={styles.summarySection}>
                  <h3>Data Quality Overview</h3>
                  <div className={styles.summaryStats}>
                    <div className={styles.statCard}>
                      <div className={styles.statValue}>{summaryStats.totalColumns}</div>
                      <div className={styles.statLabel}>Total Columns</div>
                    </div>
                    <div className={styles.statCard}>
                      <div className={styles.statValue}>{summaryStats.columnsWithIssues}</div>
                      <div className={styles.statLabel}>Columns with Issues</div>
                    </div>
                    <div className={styles.statCard}>
                      <div className={styles.statValue}>{summaryStats.totalIssues}</div>
                      <div className={styles.statLabel}>Total Issues</div>
                    </div>
                    <div className={styles.statCard}>
                      <div className={styles.statValue}>{summaryStats.criticalIssues}</div>
                      <div className={styles.statLabel}>Critical Issues</div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Suggestions Section */}
              {suggestions.length > 0 ? (
                <div className={styles.suggestionsSection}>
                  <h3>AI Cleaning Suggestions</h3>
                  <p>Select the suggestions you want to apply:</p>
                  
                  <div className={styles.suggestionsList}>
                    {suggestions.map((suggestion, index) => (
                      <div 
                        key={index} 
                        className={`${styles.suggestionItem} ${selectedSuggestions[index] ? styles.selected : ''}`}
                      >
                        <div className={styles.suggestionContent}>
                          <div className={styles.suggestionHeader}>
                            <h4>{suggestion.columnName || suggestion.column_name}</h4>
                            {suggestion.issue && suggestion.issue.severity ? (
                              <span className={`${styles.severityBadge} ${styles[suggestion.issue.severity]}`}>
                                {suggestion.issue.severity}
                              </span>
                            ) : suggestion.severity ? (
                              <span className={`${styles.severityBadge} ${styles[suggestion.severity]}`}>
                                {suggestion.severity}
                              </span>
                            ) : (
                              <span className={`${styles.severityBadge} ${styles.medium}`}>
                                medium
                              </span>
                            )}
                          </div>
                          <p className={styles.issueDescription}>
                            {suggestion.issue ? suggestion.issue.description : 
                             `Issue with ${suggestion.columnName || suggestion.column_name}`}
                          </p>
                          <p className={styles.actionDescription}>
                            {suggestion.action ? suggestion.action.description : suggestion.recommendation || 'Review this data'}
                          </p>
                          <p className={styles.previewText}>{suggestion.preview || 
                            `This would affect column "${suggestion.columnName || suggestion.column_name}"`}</p>
                        </div>
                        <div className={styles.suggestionActions}>
                          <label className={styles.checkboxContainer}>
                            <input
                              type="checkbox"
                              checked={!!selectedSuggestions[index]}
                              onChange={() => toggleSuggestion(index)}
                            />
                            <span className={styles.checkmark}></span>
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className={styles.actionsBar}>
                    <button 
                      className={styles.secondaryButton}
                      onClick={toggleFeedbackForm}
                    >
                      {showFeedbackForm ? 'Cancel Retry' : 'Retry with Feedback'}
                    </button>
                    
                    <button 
                      className={styles.primaryButton}
                      onClick={() => {
                        // Select all suggestions
                        const allSelected = {};
                        suggestions.forEach((_, index) => {
                          allSelected[index] = true;
                        });
                        setSelectedSuggestions(allSelected);
                      }}
                    >
                      Select All
                    </button>
                    
                    <button 
                      className={styles.primaryButton}
                      onClick={applySelectedSuggestions}
                      disabled={Object.values(selectedSuggestions).filter(Boolean).length === 0}
                    >
                      Apply Selected
                    </button>
                  </div>
                  
                  {/* Feedback Form */}
                  {showFeedbackForm && (
                    <div className={styles.feedbackForm}>
                      <h4>Provide Feedback for AI Retry</h4>
                      <p>Tell us what you'd like to improve in the analysis:</p>
                      <textarea
                        className={styles.feedbackTextarea}
                        value={feedbackInput}
                        onChange={(e) => setFeedbackInput(e.target.value)}
                        placeholder="Example: 'The column Email should be recognized as an email type' or 'Please suggest how to handle outliers in the Age column'"
                        rows={4}
                      />
                      <button 
                        className={styles.retryButton}
                        onClick={handleRetry}
                        disabled={!feedbackInput.trim()}
                      >
                        Retry Analysis
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className={styles.noIssuesContainer}>
                  <div className={styles.noIssuesIcon}>✓</div>
                  <h3>No Issues Detected</h3>
                  <p>Your data looks clean! No cleaning suggestions available.</p>
                  <button 
                    className={styles.secondaryButton}
                    onClick={() => analyzeData()}
                  >
                    Re-analyze
                  </button>
                </div>
              )}
              
              {/* Column Details Section */}
              <div className={styles.columnsSection}>
                <h3>Column Details</h3>
                <div className={styles.columnsList}>
                  {analysisResults.map((column, index) => (
                    <div key={index} className={styles.columnCard}>
                      <div className={styles.columnHeader}>
                        <h4>{column.name}</h4>
                        <span className={styles.columnType}>{column.type}</span>
                      </div>
                      <div className={styles.columnStats}>
                        <div className={styles.statRow}>
                          <span>Total Values:</span>
                          <span>{column.stats.total}</span>
                        </div>
                        <div className={styles.statRow}>
                          <span>Missing Values:</span>
                          <span>{column.stats.missing}</span>
                        </div>
                        <div className={styles.statRow}>
                          <span>Unique Values:</span>
                          <span>{column.stats.unique}</span>
                        </div>
                        {column.type === 'numeric' && (
                          <>
                            <div className={styles.statRow}>
                              <span>Minimum:</span>
                              <span>{column.stats.min !== undefined ? column.stats.min : 'N/A'}</span>
                            </div>
                            <div className={styles.statRow}>
                              <span>Maximum:</span>
                              <span>{column.stats.max !== undefined ? column.stats.max : 'N/A'}</span>
                            </div>
                            <div className={styles.statRow}>
                              <span>Mean:</span>
                              <span>
                                {column.stats.mean !== undefined ? column.stats.mean.toFixed(2) : 'N/A'}
                              </span>
                            </div>
                            {column.stats.median !== undefined && (
                              <div className={styles.statRow}>
                                <span>Median:</span>
                                <span>{column.stats.median}</span>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                      {column.issues && column.issues.length > 0 && (
                        <div className={styles.issuesList}>
                          <h5>Issues:</h5>
                          <ul>
                            {column.issues.map((issue, i) => (
                              <li key={i} className={styles[issue.severity]}>
                                {issue.description}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className={styles.initialState}>
              <p>Ready to analyze your data for cleaning opportunities.</p>
              <button 
                className={styles.analyzeButton}
                onClick={() => analyzeData()}
              >
                Analyze Data
              </button>
            </div>
          )}
          
          {/* Test Mode Button */}
          
        </div>
      </div>
    </div>
  );
};

export default DataCleaningPanel;
