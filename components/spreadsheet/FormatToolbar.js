import React, { useState, useEffect } from 'react';
import styles from '../../styles/Spreadsheet.module.css';

const FormatToolbar = ({ hotRef }) => {
  // State for tracking which formats are currently active
  const [activeFormats, setActiveFormats] = useState({
    bold: false,
    italic: false,
    underline: false,
    alignLeft: true,
    alignCenter: false,
    alignRight: false
  });

  // State for tracking font size
  const [fontSize, setFontSize] = useState('12px');
  
  // Available font sizes
  const fontSizes = ['8px', '9px', '10px', '11px', '12px', '14px', '16px', '18px', '20px', '22px', '24px', '26px', '28px', '36px', '48px', '72px'];
  
  // Update active formats when selection changes
  useEffect(() => {
    if (!hotRef.current) return;
    
    const hot = hotRef.current.hotInstance;
    
    // Function to check formats of selected cells
    const checkFormats = () => {
      const selectedRanges = hot.getSelected();
      if (!selectedRanges || selectedRanges.length === 0) return;
      
      // Get the first selected cell to initialize
      const [startRow, startCol, endRow, endCol] = selectedRanges[0];
      
      // Ensure we have valid row and column indices (non-negative integers)
      const row = Math.max(0, parseInt(startRow, 10) || 0);
      const col = Math.max(0, parseInt(startCol, 10) || 0);
      
      // Also validate that we're within the data bounds
      const rowCount = hot.countRows();
      const colCount = hot.countCols();
      
      if (row >= rowCount || col >= colCount) {
        return; // Out of bounds, don't proceed
      }
      
      const cellMeta = hot.getCellMeta(row, col);
      
      // Default values if metadata doesn't exist
      let isBold = false;
      let isItalic = false;
      let isUnderline = false;
      let align = 'left';
      let cellFontSize = '12px';
      
      // Check the cell format if it exists
      if (cellMeta.className) {
        isBold = cellMeta.className.includes('htBold');
        isItalic = cellMeta.className.includes('htItalic');
        isUnderline = cellMeta.className.includes('htUnderline');
        
        if (cellMeta.className.includes('htCenter')) align = 'center';
        if (cellMeta.className.includes('htRight')) align = 'right';
      }
      
      // Check for font size
      if (cellMeta.fontSize) {
        cellFontSize = cellMeta.fontSize;
      }
      
      // Update the active formats
      setActiveFormats({
        bold: isBold,
        italic: isItalic,
        underline: isUnderline,
        alignLeft: align === 'left',
        alignCenter: align === 'center',
        alignRight: align === 'right'
      });
      
      setFontSize(cellFontSize);
    };
    
    // Attach the hook to selection change
    hot.addHook('afterSelectionEnd', checkFormats);
    
    return () => {
      // Clean up - check if hot still exists and isn't destroyed
      if (hot && typeof hot.isDestroyed === 'function' && !hot.isDestroyed() && typeof hot.removeHook === 'function') {
        hot.removeHook('afterSelectionEnd', checkFormats);
      }
    };
  }, [hotRef]);
  
  // Function to toggle a format
  const toggleFormat = (format) => {
    if (!hotRef.current) return;
    
    const hot = hotRef.current.hotInstance;
    const selectedRanges = hot.getSelected();
    
    if (!selectedRanges || selectedRanges.length === 0) return;
    
    // Process each selected range
    selectedRanges.forEach(([startRow, startCol, endRow, endCol]) => {
      // Make sure we have valid indices
      const minRow = Math.min(Math.max(0, startRow), Math.max(0, endRow));
      const maxRow = Math.max(Math.max(0, startRow), Math.max(0, endRow));
      const minCol = Math.min(Math.max(0, startCol), Math.max(0, endCol));
      const maxCol = Math.max(Math.max(0, startCol), Math.max(0, endCol));
      
      // Get data bounds
      const rowCount = hot.countRows();
      const colCount = hot.countCols();
      
      // Process all cells in this range
      for (let row = minRow; row <= maxRow && row < rowCount; row++) {
        for (let col = minCol; col <= maxCol && col < colCount; col++) {
          const currentMeta = hot.getCellMeta(row, col);
          let className = currentMeta.className || '';
          
          // Helper to add or remove a class
          const toggleClass = (cls) => {
            if (className.includes(cls)) {
              className = className.replace(cls, '').trim();
            } else {
              className = (className + ' ' + cls).trim();
            }
          };
          
          // Apply formatting based on the format type
          switch (format) {
            case 'bold':
              toggleClass('htBold');
              break;
            case 'italic':
              toggleClass('htItalic');
              break;
            case 'underline':
              toggleClass('htUnderline');
              break;
            case 'alignLeft':
              className = className.replace('htCenter', '').replace('htRight', '');
              break;
            case 'alignCenter':
              className = className.replace('htRight', '');
              if (!className.includes('htCenter')) className += ' htCenter';
              break;
            case 'alignRight':
              className = className.replace('htCenter', '');
              if (!className.includes('htRight')) className += ' htRight';
              break;
          }
          
          // Update the cell metadata
          hot.setCellMeta(row, col, 'className', className.trim());
        }
      }
    });
    
    // Update active formats state based on toggled format
    if (['bold', 'italic', 'underline'].includes(format)) {
      setActiveFormats(prev => ({
        ...prev,
        [format]: !prev[format]
      }));
    } else if (format === 'alignLeft') {
      setActiveFormats(prev => ({
        ...prev,
        alignLeft: true,
        alignCenter: false,
        alignRight: false
      }));
    } else if (format === 'alignCenter') {
      setActiveFormats(prev => ({
        ...prev,
        alignLeft: false,
        alignCenter: true,
        alignRight: false
      }));
    } else if (format === 'alignRight') {
      setActiveFormats(prev => ({
        ...prev,
        alignLeft: false,
        alignCenter: false,
        alignRight: true
      }));
    }
    
    // Render the changes
    hot.render();
  };
  
  // Function to change font size
  const changeFontSize = (size) => {
    if (!hotRef.current) return;
    
    const hot = hotRef.current.hotInstance;
    const selectedRanges = hot.getSelected();
    
    if (!selectedRanges || selectedRanges.length === 0) return;
    
    // Process each selected range
    selectedRanges.forEach(([startRow, startCol, endRow, endCol]) => {
      // Make sure we have valid indices
      const minRow = Math.min(Math.max(0, startRow), Math.max(0, endRow));
      const maxRow = Math.max(Math.max(0, startRow), Math.max(0, endRow));
      const minCol = Math.min(Math.max(0, startCol), Math.max(0, endCol));
      const maxCol = Math.max(Math.max(0, startCol), Math.max(0, endCol));
      
      // Get data bounds
      const rowCount = hot.countRows();
      const colCount = hot.countCols();
      
      // Process all cells in this range
      for (let row = minRow; row <= maxRow && row < rowCount; row++) {
        for (let col = minCol; col <= maxCol && col < colCount; col++) {
          // Update font size metadata for the cell
          hot.setCellMeta(row, col, 'fontSize', size);
          
          // Also update any custom renderer CSS
          const td = hot.getCell(row, col);
          if (td) {
            td.style.fontSize = size;
          }
        }
      }
    });
    
    // Update the state
    setFontSize(size);
    
    // Render the changes
    hot.render();
  };
  
  return (
    <div className={styles.formatToolbar}>
      {/* Font size dropdown */}
      <select 
        value={fontSize}
        onChange={(e) => changeFontSize(e.target.value)}
        className={styles.fontSizeSelect}
      >
        {fontSizes.map(size => (
          <option key={size} value={size}>{size}</option>
        ))}
      </select>
      
      {/* Text formatting buttons */}
      <button 
        className={`${styles.formatButton} ${activeFormats.bold ? styles.active : ''}`}
        onClick={() => toggleFormat('bold')}
        title="Bold"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
          <path d="M8.21 13c2.106 0 3.412-1.087 3.412-2.823 0-1.306-.984-2.283-2.324-2.386v-.055a2.176 2.176 0 0 0 1.852-2.14c0-1.51-1.162-2.46-3.014-2.46H3.843V13H8.21zM5.908 4.674h1.696c.963 0 1.517.451 1.517 1.244 0 .834-.629 1.32-1.73 1.32H5.908V4.673zm0 6.788V8.598h1.73c1.217 0 1.88.492 1.88 1.415 0 .943-.643 1.449-1.832 1.449H5.907z"/>
        </svg>
      </button>
      
      <button 
        className={`${styles.formatButton} ${activeFormats.italic ? styles.active : ''}`}
        onClick={() => toggleFormat('italic')}
        title="Italic"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
          <path d="M7.991 11.674 9.53 4.455c.123-.595.246-.71 1.347-.807l.11-.52H7.211l-.11.52c1.06.096 1.128.212 1.005.807L6.57 11.674c-.123.595-.246.71-1.346.806l-.11.52h3.774l.11-.52c-1.06-.095-1.129-.211-1.006-.806z"/>
        </svg>
      </button>
      
      <button 
        className={`${styles.formatButton} ${activeFormats.underline ? styles.active : ''}`}
        onClick={() => toggleFormat('underline')}
        title="Underline"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
          <path d="M5.313 3.136h-1.23V9.54c0 2.105 1.47 3.623 3.917 3.623s3.917-1.518 3.917-3.623V3.136h-1.23v6.323c0 1.49-.978 2.57-2.687 2.57-1.709 0-2.687-1.08-2.687-2.57V3.136zM12.5 15h-9v-1h9v1z"/>
        </svg>
      </button>
      
      <div className={styles.divider}></div>
      
      {/* Alignment buttons */}
      <button 
        className={`${styles.formatButton} ${activeFormats.alignLeft ? styles.active : ''}`}
        onClick={() => toggleFormat('alignLeft')}
        title="Align Left"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
          <path d="M2 13.5a.5.5 0 0 0 .5.5h6a.5.5 0 0 0 0-1h-6a.5.5 0 0 0-.5.5zm0-4a.5.5 0 0 0 .5.5h11a.5.5 0 0 0 0-1h-11a.5.5 0 0 0-.5.5zm0-4a.5.5 0 0 0 .5.5h8a.5.5 0 0 0 0-1h-8a.5.5 0 0 0-.5.5zm0-4a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 0-1h-3a.5.5 0 0 0-.5.5z"/>
        </svg>
      </button>
      
      <button 
        className={`${styles.formatButton} ${activeFormats.alignCenter ? styles.active : ''}`}
        onClick={() => toggleFormat('alignCenter')}
        title="Align Center"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
          <path d="M4 13.5a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 0-1h-7a.5.5 0 0 0-.5.5zm-2-4a.5.5 0 0 0 .5.5h11a.5.5 0 0 0 0-1h-11a.5.5 0 0 0-.5.5zm2-4a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 0-1h-7a.5.5 0 0 0-.5.5zm-2-4a.5.5 0 0 0 .5.5h11a.5.5 0 0 0 0-1h-11a.5.5 0 0 0-.5.5z"/>
        </svg>
      </button>
      
      <button 
        className={`${styles.formatButton} ${activeFormats.alignRight ? styles.active : ''}`}
        onClick={() => toggleFormat('alignRight')}
        title="Align Right"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
          <path d="M6 13.5a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 0-1h-7a.5.5 0 0 0-.5.5zm-4-4a.5.5 0 0 0 .5.5h11a.5.5 0 0 0 0-1h-11a.5.5 0 0 0-.5.5zm4-4a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 0-1h-7a.5.5 0 0 0-.5.5zm-4-4a.5.5 0 0 0 .5.5h11a.5.5 0 0 0 0-1h-11a.5.5 0 0 0-.5.5z"/>
        </svg>
      </button>
    </div>
  );
};

export default FormatToolbar; 