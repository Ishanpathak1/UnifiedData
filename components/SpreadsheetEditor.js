// components/SpreadsheetEditor.js
import { HotTable } from '@handsontable/react';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/dist/handsontable.full.css';
import { detectDataType } from '../utils/dataTypeUtils';
import { validateCell, VALIDATION_RULES } from '../utils/dataValidation';
import DataInspector from './DataInspector';
import { useState, useRef } from 'react';
import styles from '../styles/SpreadsheetEditor.module.css';

registerAllModules();

export default function SpreadsheetEditor() {
  const [data, setData] = useState([]);
  const [selectedColumn, setSelectedColumn] = useState(null);
  const [validationRules, setValidationRules] = useState({});
  const hotRef = useRef(null);
  
  // Rest of your component implementation...
  
  return (
    <div className={styles.spreadsheetContainer}>
      <div className={styles.gridContainer}>
        <HotTable
          ref={hotRef}
          data={data}
          rowHeaders={true}
          colHeaders={true}
          height="600"
          licenseKey="non-commercial-and-evaluation"
          afterChange={(changes) => {
            if (changes) {
              // Handle data changes, update state
              const newData = [...data];
              changes.forEach(([row, col, oldValue, newValue]) => {
                if (!newData[row]) {
                  newData[row] = [];
                }
                newData[row][col] = newValue;
              });
              setData(newData);
            }
          }}
          afterSelectionEnd={handleAfterSelectionEnd}
          cells={(row, col) => ({
            renderer: cellRenderer
          })}
        />
      </div>
      
      <div className={styles.inspectorContainer}>
        <DataInspector 
          selectedColumn={selectedColumn} 
          data={data} 
        />
        
        {selectedColumn !== null && (
          <div className={styles.validationControls}>
            <h3>Column Validation</h3>
            <button 
              className={styles.controlButton}
              onClick={() => addValidationRule(selectedColumn, VALIDATION_RULES.REQUIRED, true)}
            >
              Make Required
            </button>
            <div className={styles.controlGroup}>
              <label className={styles.controlLabel}>Min Value:</label>
              <input 
                className={styles.controlInput}
                type="number" 
                onChange={(e) => addValidationRule(selectedColumn, VALIDATION_RULES.MIN_VALUE, Number(e.target.value))}
              />
            </div>
            <div className={styles.controlGroup}>
              <label className={styles.controlLabel}>Max Value:</label>
              <input 
                className={styles.controlInput}
                type="number" 
                onChange={(e) => addValidationRule(selectedColumn, VALIDATION_RULES.MAX_VALUE, Number(e.target.value))}
              />
            </div>
            {/* Add more validation controls as needed */}
          </div>
        )}
      </div>
    </div>
  );
}