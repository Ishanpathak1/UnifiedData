import React from 'react';
import styles from '../styles/ModelComparison.module.css';

const ModelComparison = ({ models, onClose, onDelete }) => {
  if (!models || models.length === 0) {
    return (
      <div className={styles.comparisonContainer}>
        <div className={styles.header}>
          <h3>Model Comparison</h3>
          <button className={styles.closeButton} onClick={onClose}>×</button>
        </div>
        <p>No models saved for comparison yet.</p>
      </div>
    );
  }
  
  // Get all metrics to compare
  const getMetricValue = (model, metric) => {
    if (!model.result) return 'N/A';
    
    // Handle different regression types
    if (metric === 'r_squared' || metric === 'adjusted_r_squared') {
      if (model.type === 'logistic') return 'N/A';
      return model.result[metric] !== undefined ? model.result[metric].toFixed(4) : 'N/A';
    }
    
    if (metric === 'accuracy' || metric === 'auc_score') {
      if (model.type !== 'logistic') return 'N/A';
      return model.result[metric] !== undefined ? model.result[metric].toFixed(4) : 'N/A';
    }
    
    return model.result[metric] !== undefined ? model.result[metric].toFixed(4) : 'N/A';
  };
  
  // Best metric value highlighting
  const getBestMetricValue = (models, metric) => {
    const values = models
      .filter(m => m.type !== 'logistic' || (metric === 'accuracy' || metric === 'auc_score'))
      .filter(m => m.type === 'logistic' || (metric === 'r_squared' || metric === 'adjusted_r_squared' || metric === 'standard_error'))
      .map(m => {
        const val = m.result[metric];
        return !isNaN(val) && isFinite(val) ? val : null;
      })
      .filter(v => v !== null);
    
    if (values.length === 0) return null;
    
    // For these metrics, lower is better
    if (metric === 'standard_error' || metric === 'p_value') {
      return Math.min(...values);
    }
    
    // For all other metrics, higher is better
    return Math.max(...values);
  };
  
  return (
    <div className={styles.comparisonContainer}>
      <div className={styles.header}>
        <h3>Model Comparison</h3>
        <button className={styles.closeButton} onClick={onClose}>×</button>
      </div>
      
      <div className={styles.comparisonTable}>
        <table>
          <thead>
            <tr>
              <th>Metric</th>
              {models.map(model => (
                <th key={model.id}>
                  {model.name}
                  <button 
                    className={styles.deleteButton} 
                    onClick={() => onDelete(model.id)}
                    title="Delete model"
                  >
                    ×
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Model type */}
            <tr>
              <td>Model Type</td>
              {models.map(model => (
                <td key={model.id}>{model.type.charAt(0).toUpperCase() + model.type.slice(1)}</td>
              ))}
            </tr>
            
            {/* Dependent variable */}
            <tr>
              <td>Dependent Variable</td>
              {models.map(model => (
                <td key={model.id}>{model.result.dependent_name}</td>
              ))}
            </tr>
            
            {/* Independent variables */}
            <tr>
              <td>Independent Variables</td>
              {models.map(model => (
                <td key={model.id}>{model.result.independent_names.join(', ')}</td>
              ))}
            </tr>
            
            {/* R-squared (for continuous models) */}
            <tr className={styles.metricRow}>
              <td>R² (coefficient of determination)</td>
              {models.map(model => {
                const value = getMetricValue(model, 'r_squared');
                const bestValue = getBestMetricValue(models, 'r_squared');
                const isBest = bestValue !== null && value !== 'N/A' && parseFloat(value) === bestValue;
                return (
                  <td 
                    key={model.id} 
                    className={isBest ? styles.bestMetric : ''}
                  >
                    {value}
                  </td>
                );
              })}
            </tr>
            
            {/* Adjusted R-squared (for continuous models) */}
            <tr className={styles.metricRow}>
              <td>Adjusted R²</td>
              {models.map(model => {
                const value = getMetricValue(model, 'adjusted_r_squared');
                const bestValue = getBestMetricValue(models, 'adjusted_r_squared');
                const isBest = bestValue !== null && value !== 'N/A' && parseFloat(value) === bestValue;
                return (
                  <td 
                    key={model.id} 
                    className={isBest ? styles.bestMetric : ''}
                  >
                    {value}
                  </td>
                );
              })}
            </tr>
            
            {/* Standard Error */}
            <tr className={styles.metricRow}>
              <td>Standard Error</td>
              {models.map(model => {
                const value = getMetricValue(model, 'standard_error');
                const bestValue = getBestMetricValue(models, 'standard_error');
                const isBest = bestValue !== null && value !== 'N/A' && parseFloat(value) === bestValue;
                return (
                  <td 
                    key={model.id} 
                    className={isBest ? styles.bestMetric : ''}
                  >
                    {value}
                  </td>
                );
              })}
            </tr>
            
            {/* F-statistic */}
            <tr className={styles.metricRow}>
              <td>F-statistic</td>
              {models.map(model => (
                <td key={model.id}>{getMetricValue(model, 'f_statistic')}</td>
              ))}
            </tr>
            
            {/* P-value */}
            <tr className={styles.metricRow}>
              <td>P-value</td>
              {models.map(model => {
                const value = model.result.p_value !== undefined ? 
                  model.result.p_value.toExponential(4) : 'N/A';
                return (
                  <td key={model.id}>{value}</td>
                );
              })}
            </tr>
            
            {/* Accuracy (for logistic models) */}
            <tr className={styles.metricRow}>
              <td>Accuracy (Logistic)</td>
              {models.map(model => {
                const value = getMetricValue(model, 'accuracy');
                const bestValue = getBestMetricValue(models, 'accuracy');
                const isBest = bestValue !== null && value !== 'N/A' && parseFloat(value) === bestValue;
                return (
                  <td 
                    key={model.id} 
                    className={isBest ? styles.bestMetric : ''}
                  >
                    {value}
                  </td>
                );
              })}
            </tr>
            
            {/* AUC Score (for logistic models) */}
            <tr className={styles.metricRow}>
              <td>AUC Score (Logistic)</td>
              {models.map(model => {
                const value = getMetricValue(model, 'auc_score');
                const bestValue = getBestMetricValue(models, 'auc_score');
                const isBest = bestValue !== null && value !== 'N/A' && parseFloat(value) === bestValue;
                return (
                  <td 
                    key={model.id} 
                    className={isBest ? styles.bestMetric : ''}
                  >
                    {value}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
      
      <div className={styles.recommendation}>
        <h4>Model Recommendations</h4>
        <ul>
          {models.some(m => m.type !== 'logistic') && (
            <li>
              <strong>Best predictive model (Continuous):</strong>{' '}
              {(() => {
                const continuousModels = models.filter(m => m.type !== 'logistic');
                if (continuousModels.length === 0) return 'No continuous models to compare';
                
                const bestModel = continuousModels.reduce((best, current) => {
                  const currentR2 = current.result.adjusted_r_squared || 0;
                  const bestR2 = best.result.adjusted_r_squared || 0;
                  return currentR2 > bestR2 ? current : best;
                }, continuousModels[0]);
                
                return `${bestModel.name} (Adjusted R² = ${bestModel.result.adjusted_r_squared?.toFixed(4) || 'N/A'})`;
              })()}
            </li>
          )}
          
          {models.some(m => m.type === 'logistic') && (
            <li>
              <strong>Best classification model:</strong>{' '}
              {(() => {
                const logisticModels = models.filter(m => m.type === 'logistic');
                if (logisticModels.length === 0) return 'No logistic models to compare';
                
                const bestModel = logisticModels.reduce((best, current) => {
                  const currentAUC = current.result.auc_score || 0;
                  const bestAUC = best.result.auc_score || 0;
                  return currentAUC > bestAUC ? current : best;
                }, logisticModels[0]);
                
                return `${bestModel.name} (AUC = ${bestModel.result.auc_score?.toFixed(4) || 'N/A'})`;
              })()}
            </li>
          )}
        </ul>
      </div>
    </div>
  );
};

export default ModelComparison;
