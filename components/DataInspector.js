// components/DataInspector.js
import React, { useEffect, useState, useRef } from 'react';
import styles from '../styles/DataInspector.module.css';
import { detectDataType, DATA_TYPES } from '../utils/dataTypeUtils';

export default function DataInspector({ selectedColumn, data }) {
  const [stats, setStats] = useState(null);
  const [columnName, setColumnName] = useState("");
  const [snapshotData, setSnapshotData] = useState(null);
  const prevColumnRef = useRef(null);
  
  // Only take a snapshot when column selection changes
  useEffect(() => {
    if (selectedColumn === null || !data || data.length === 0) {
      setStats(null);
      setColumnName("");
      return;
    }
    
    // Only update snapshot if column selection changed
    if (prevColumnRef.current !== selectedColumn) {
      // Take a snapshot of data when column is selected
      setSnapshotData(JSON.parse(JSON.stringify(data)));
      prevColumnRef.current = selectedColumn;
    }
  }, [selectedColumn]);
  
  // Calculate stats when snapshot data changes
  useEffect(() => {
    if (!snapshotData || selectedColumn === null) return;
    
    // Get column name from header row
    if (snapshotData[0] && snapshotData[0][selectedColumn]) {
      setColumnName(snapshotData[0][selectedColumn]);
    }
    
    // Calculate statistics for the selected column
    calculateStats();
  }, [snapshotData]);
  
  const calculateStats = () => {
    if (selectedColumn === null || !snapshotData) return;
    
    // Skip the header row (index 0) and get values from the data
    const columnData = snapshotData
      .slice(1) // Skip header row
      .map(row => row[selectedColumn])
      .filter(val => val !== null && val !== undefined && val !== '');
    
    if (columnData.length === 0) {
      setStats({
        count: 0,
        unique: 0,
        empty: snapshotData.length - 1, // Subtract header row
        type: DATA_TYPES.EMPTY
      });
      return;
    }
    
    // Determine predominant type
    const typeCount = {};
    columnData.forEach(value => {
      const type = detectDataType(value);
      typeCount[type] = (typeCount[type] || 0) + 1;
    });
    
    const predominantType = Object.entries(typeCount)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || DATA_TYPES.EMPTY;
    
    // Calculate basic stats
    const stats = {
      count: columnData.length,
      unique: new Set(columnData).size,
      empty: (snapshotData.length - 1) - columnData.length, // Subtract header row
      type: predominantType,
    };
    
    // Add type-specific stats
    if (predominantType === DATA_TYPES.NUMBER) {
      const numericValues = columnData
        .map(v => {
          // Handle different formats of numbers
          if (typeof v === 'string') {
            return parseFloat(v.replace(/,/g, ''));
          }
          return parseFloat(v);
        })
        .filter(v => !isNaN(v));
      
      if (numericValues.length > 0) {
        stats.min = Math.min(...numericValues);
        stats.max = Math.max(...numericValues);
        stats.sum = numericValues.reduce((sum, val) => sum + val, 0);
        stats.average = stats.sum / numericValues.length;
        
        // Calculate standard deviation
        const mean = stats.average;
        const squaredDiffs = numericValues.map(val => Math.pow(val - mean, 2));
        stats.stdDev = Math.sqrt(squaredDiffs.reduce((sum, val) => sum + val, 0) / numericValues.length);
      }
    } else if (predominantType === DATA_TYPES.DATE) {
      const dateValues = columnData
        .map(v => new Date(v))
        .filter(v => !isNaN(v.getTime()));
      
      if (dateValues.length > 0) {
        stats.oldest = new Date(Math.min(...dateValues.map(d => d.getTime())));
        stats.newest = new Date(Math.max(...dateValues.map(d => d.getTime())));
        
        // Calculate average date (approximate)
        const avgTime = dateValues.reduce((sum, date) => sum + date.getTime(), 0) / dateValues.length;
        stats.avgDate = new Date(avgTime);
      }
    } else if (predominantType === DATA_TYPES.BOOLEAN) {
      const trueCount = columnData.filter(v => 
        v === true || v === 'true' || v === 'TRUE' || v === 'yes' || v === 'YES').length;
      const falseCount = columnData.length - trueCount;
      
      stats.trueCount = trueCount;
      stats.falseCount = falseCount;
      stats.truePercent = (trueCount / columnData.length * 100).toFixed(1) + '%';
      stats.falsePercent = (falseCount / columnData.length * 100).toFixed(1) + '%';
    } else if (predominantType === DATA_TYPES.TEXT) {
      // Text statistics
      const lengths = columnData.map(v => String(v).length);
      stats.minLength = Math.min(...lengths);
      stats.maxLength = Math.max(...lengths);
      stats.avgLength = lengths.reduce((sum, len) => sum + len, 0) / lengths.length;
      
      // Most common value
      const valueCounts = {};
      columnData.forEach(value => {
        valueCounts[value] = (valueCounts[value] || 0) + 1;
      });
      
      const mostCommon = Object.entries(valueCounts)
        .sort((a, b) => b[1] - a[1])[0];
      
      if (mostCommon) {
        stats.mostCommonValue = mostCommon[0];
        stats.mostCommonCount = mostCommon[1];
      }
    }
    
    setStats(stats);
  };
  
  // Manual refresh function (only call this when a refresh button is clicked)
  const refreshStats = () => {
    if (selectedColumn !== null && data && data.length > 0) {
      setSnapshotData(JSON.parse(JSON.stringify(data)));
    }
  };
  
  if (!stats) {
    return (
      <div className={styles.inspector}>
        <div className={styles.emptyState}>
          Select a column to view statistics
        </div>
      </div>
    );
  }
  
  // Format a date nicely
  const formatDate = (date) => {
    if (!date) return 'N/A';
    return date.toLocaleDateString();
  };
  
  // Format a number nicely
  const formatNumber = (num) => {
    if (num === undefined || num === null) return 'N/A';
    if (Number.isInteger(num)) return num.toString();
    return num.toFixed(2);
  };
  
  return (
    <div className={styles.inspector}>
      <h3>{columnName || `Column ${selectedColumn + 1}`}</h3>
      <div className={styles.typeLabel}>
        Data Type: {stats.type}
      </div>
      
      <div className={styles.statGrid}>
        <div className={styles.statItem}>
          <span className={styles.statLabel}>Total Values:</span>
          <span className={styles.statValue}>{stats.count}</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statLabel}>Unique Values:</span>
          <span className={styles.statValue}>{stats.unique}</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statLabel}>Empty Cells:</span>
          <span className={styles.statValue}>{stats.empty}</span>
        </div>
        
        {stats.type === DATA_TYPES.NUMBER && (
          <>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Minimum:</span>
              <span className={styles.statValue}>{formatNumber(stats.min)}</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Maximum:</span>
              <span className={styles.statValue}>{formatNumber(stats.max)}</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Average:</span>
              <span className={styles.statValue}>{formatNumber(stats.average)}</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Sum:</span>
              <span className={styles.statValue}>{formatNumber(stats.sum)}</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Std Deviation:</span>
              <span className={styles.statValue}>{formatNumber(stats.stdDev)}</span>
            </div>
          </>
        )}
        
        {stats.type === DATA_TYPES.DATE && (
          <>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Oldest:</span>
              <span className={styles.statValue}>{formatDate(stats.oldest)}</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Newest:</span>
              <span className={styles.statValue}>{formatDate(stats.newest)}</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Average Date:</span>
              <span className={styles.statValue}>{formatDate(stats.avgDate)}</span>
            </div>
          </>
        )}
        
        {stats.type === DATA_TYPES.BOOLEAN && (
          <>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>True Count:</span>
              <span className={styles.statValue}>{stats.trueCount}</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>False Count:</span>
              <span className={styles.statValue}>{stats.falseCount}</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>True Percentage:</span>
              <span className={styles.statValue}>{stats.truePercent}</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>False Percentage:</span>
              <span className={styles.statValue}>{stats.falsePercent}</span>
            </div>
          </>
        )}
        
        {stats.type === DATA_TYPES.TEXT && (
          <>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Min Length:</span>
              <span className={styles.statValue}>{stats.minLength}</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Max Length:</span>
              <span className={styles.statValue}>{stats.maxLength}</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Avg Length:</span>
              <span className={styles.statValue}>{formatNumber(stats.avgLength)}</span>
            </div>
            {stats.mostCommonValue && (
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Most Common:</span>
                <span className={styles.statValue} title={stats.mostCommonValue}>
                  {stats.mostCommonValue.length > 10 
                    ? stats.mostCommonValue.substring(0, 10) + '...' 
                    : stats.mostCommonValue} 
                  ({stats.mostCommonCount})
                </span>
              </div>
            )}
          </>
        )}
      </div>
      
      <div className={styles.quickActions}>
        <button className={styles.quickActionButton} onClick={refreshStats}>
          Refresh Stats
        </button>
        <button className={styles.quickActionButton}>
          Export Stats
        </button>
      </div>
    </div>
  );
}