import { useState, useEffect } from 'react';
import styles from '../../styles/widgets/KPIWidget.module.css';

export default function KPIWidget({ id, config, onRefresh }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const {
    title = 'Metric',
    value = 0,
    prefix = '',
    suffix = '',
    comparison = { value: null, type: 'previous', showPercentage: true },
    colorCoding = { enabled: true, positiveColor: '#4caf50', negativeColor: '#f44336', neutralColor: '#757575' }
  } = config || {};

  // Calculate comparison details
  const comparisonValue = comparison?.value || 0;
  const diff = value - comparisonValue;
  const percentChange = comparisonValue !== 0 ? (diff / Math.abs(comparisonValue)) * 100 : 0;
  
  // Determine color based on value comparison and colorCoding settings
  const getValueColor = () => {
    if (!colorCoding?.enabled) return colorCoding?.neutralColor || '#757575';
    if (diff > 0) return colorCoding?.positiveColor || '#4caf50';
    if (diff < 0) return colorCoding?.negativeColor || '#f44336';
    return colorCoding?.neutralColor || '#757575';
  };

  // Format the main value
  const formattedValue = formatValue(value);
  
  // Handle refresh
  const handleRefresh = () => {
    if (onRefresh) {
      setIsLoading(true);
      setError(null);
      
      // Simulate refresh delay
      setTimeout(() => {
        setIsLoading(false);
        onRefresh(id);
      }, 500);
    }
  };

  return (
    <div className={styles.kpiWidget}>
      <div className={styles.kpiTitle}>{title}</div>
      
      {isLoading ? (
        <div className={styles.loading}>Loading...</div>
      ) : error ? (
        <div className={styles.error}>{error}</div>
      ) : (
        <>
          <div className={styles.kpiValue} style={{ color: getValueColor() }}>
            {prefix}{formattedValue}{suffix}
          </div>
          
          {comparison?.value !== null && (
            <div className={styles.comparison}>
              <span className={styles.changeIndicator} style={{ color: getValueColor() }}>
                {diff > 0 ? '↑' : diff < 0 ? '↓' : '–'}
              </span>
              
              <span className={styles.changeValue}>
                {comparison.showPercentage 
                  ? `${Math.abs(percentChange).toFixed(1)}%` 
                  : formatValue(Math.abs(diff))}
                  
                {comparison.type === 'previous' && ' vs previous'}
                {comparison.type === 'target' && ' vs target'}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Helper function to format values
function formatValue(value) {
  // Format based on value magnitude
  if (typeof value !== 'number') return value;
  
  if (Math.abs(value) >= 1000000) {
    return (value / 1000000).toFixed(1) + 'M';
  } else if (Math.abs(value) >= 1000) {
    return (value / 1000).toFixed(1) + 'K';
  } else if (Number.isInteger(value)) {
    return value.toString();
  } else {
    return value.toFixed(1);
  }
}
