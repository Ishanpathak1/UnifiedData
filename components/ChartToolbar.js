// components/ChartToolbar.js
import { useState } from 'react';
import styles from '../styles/ChartToolbar.module.css';

export default function ChartToolbar({ onCreateChart }) {
  const [showDropdown, setShowDropdown] = useState(false);
  
  const chartTypes = [
    { type: 'bar', label: 'Bar Chart' },
    { type: 'line', label: 'Line Chart' },
    { type: 'pie', label: 'Pie Chart' },
    { type: 'doughnut', label: 'Doughnut Chart' },
    { type: 'radar', label: 'Radar Chart' },
    { type: 'polarArea', label: 'Polar Area Chart' },
    { type: 'scatter', label: 'Scatter Plot' }
  ];

  return (
    <div className={styles.chartMenu}>
      <button 
        className={styles.chartButton}
        onClick={() => setShowDropdown(!showDropdown)}
      >
        Create Chart
      </button>
      
      {showDropdown && (
        <div className={styles.dropdown}>
          {chartTypes.map((chart) => (
            <button 
              key={chart.type}
              className={styles.dropdownItem}
              onClick={() => {
                onCreateChart(chart.type);
                setShowDropdown(false);
              }}
            >
              {chart.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}