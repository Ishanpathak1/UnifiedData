import React, { useState, useEffect, useRef } from 'react';
import styles from '../../styles/Spreadsheet.module.css';
import { evaluateFormula, indexToColStr } from '../../utils/spreadsheet/formulaEngine';

/**
 * FormulaBar component for spreadsheet formula editing
 * 
 * @param {Object} props - Component props
 * @param {Object} props.hotRef - Reference to Handsontable instance
 * @param {Object} props.selectedCell - Currently selected cell {row, col}
 * @param {Function} props.processFormulaInput - Function to process formula input
 */
const FormulaBar = ({ hotRef, selectedCell, processFormulaInput }) => {
  const [formulaValue, setFormulaValue] = useState('');
  const [isFormulaMode, setIsFormulaMode] = useState(false);
  const inputRef = useRef(null);
  
  // Update formula value when selected cell changes
  useEffect(() => {
    if (!selectedCell || !hotRef.current) return;
    
    const hot = hotRef.current.hotInstance;
    if (!hot) return;
    
    // Validate row and column are within bounds
    const rowCount = hot.countRows();
    const colCount = hot.countCols();
    
    if (selectedCell.row >= 0 && selectedCell.row < rowCount && 
        selectedCell.col >= 0 && selectedCell.col < colCount) {
      
      // Get current cell value
      const value = hot.getDataAtCell(selectedCell.row, selectedCell.col);
      setFormulaValue(value || '');
      
      // Set formula mode if the value is a formula
      setIsFormulaMode(typeof value === 'string' && value.startsWith('='));
    }
  }, [selectedCell, hotRef.current]);
  
  // Handle formula changes
  const handleChange = (e) => {
    const newValue = e.target.value;
    setFormulaValue(newValue);
    
    // If the user types '=', enter formula mode
    if (newValue.startsWith('=') && !isFormulaMode) {
      setIsFormulaMode(true);
    } else if (!newValue.startsWith('=') && isFormulaMode) {
      setIsFormulaMode(false);
    }
  };
  
  // Update the cell when the formula is applied (Enter key or blur)
  const applyFormula = () => {
    if (!selectedCell || !hotRef.current) return;
    
    const hot = hotRef.current.hotInstance;
    if (!hot) return;
    
    // Process the formula before setting the cell value
    const processedValue = processFormulaInput 
      ? processFormulaInput(formulaValue, selectedCell.row, selectedCell.col)
      : formulaValue;
    
    // Update the cell value
    hot.setDataAtCell(selectedCell.row, selectedCell.col, processedValue);
  };
  
  // Handle keyboard events in the formula bar
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      applyFormula();
      e.preventDefault(); // Prevent form submission
    } else if (e.key === 'Escape') {
      // Cancel editing on Escape
      if (selectedCell && hotRef.current) {
        const hot = hotRef.current.hotInstance;
        const currentValue = hot.getDataAtCell(selectedCell.row, selectedCell.col);
        setFormulaValue(currentValue || '');
        inputRef.current.blur();
      }
    }
  };
  
  // Toggle formula mode when clicking the fx button
  const handleFxClick = () => {
    if (!isFormulaMode) {
      setIsFormulaMode(true);
      setFormulaValue(formulaValue.startsWith('=') ? formulaValue : '=');
      // Focus and place cursor at the end
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.selectionStart = formulaValue.startsWith('=') ? 
          formulaValue.length : 1;
        inputRef.current.selectionEnd = formulaValue.startsWith('=') ? 
          formulaValue.length : 1;
      }
    }
  };
  
  // Generate cell reference string like "A1"
  const getCellReference = () => {
    if (!selectedCell) return '';
    
    // Convert column index to letter(s) (0 -> A, 1 -> B, etc.)
    const colStr = indexToColStr(selectedCell.col);
    
    // Convert row to 1-based for display
    const rowStr = selectedCell.row + 1;
    
    return `${colStr}${rowStr}`;
  };
  
  // Get a friendly name for the current column
  const getColumnName = () => {
    if (!selectedCell || !hotRef.current || !hotRef.current.hotInstance) return '';
    
    try {
      const hot = hotRef.current.hotInstance;
      // Get the column header - if it's just a letter, use a more generic name
      const header = hot.getColHeader(selectedCell.col);
      
      // If the header looks like a generic letter-based header, return empty
      if (/^[A-Z]+$/.test(header.trim())) {
        return '';
      }
      
      return header;
    } catch (e) {
      return '';
    }
  };
  
  // Get placeholder text based on selected cell
  const getPlaceholder = () => {
    if (!selectedCell) return 'Select a cell to edit...';
    
    if (isFormulaMode) {
      return 'Enter a formula...';
    }
    
    const cellRef = getCellReference();
    const columnName = getColumnName();
    
    if (columnName) {
      return `Enter value for ${columnName} (${cellRef})...`;
    }
    
    return `Enter value for ${cellRef}...`;
  };
  
  return (
    <div className={styles.formulaBar}>
      <span className={styles.cellReference}>
        {getCellReference()}
      </span>
      <div 
        className={`${styles.formulaBarIcon} ${isFormulaMode ? styles.activeIcon : ''}`}
        onClick={handleFxClick}
        title="Insert formula"
      >
        <span className={styles.fxSymbol}>fx</span>
      </div>
      <input
        ref={inputRef}
        type="text"
        className={`${styles.formulaInput} ${isFormulaMode ? styles.formulaMode : ''}`}
        value={formulaValue}
        onChange={handleChange}
        onBlur={applyFormula}
        onKeyDown={handleKeyDown}
        placeholder={getPlaceholder()}
        spellCheck="false"
        autoComplete="off"
      />
    </div>
  );
};

export default FormulaBar; 