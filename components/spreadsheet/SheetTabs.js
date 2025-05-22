import React from 'react';
import styles from '../../styles/Spreadsheet.module.css';

const SheetTabs = ({ sheets, activeSheetId, onChangeSheet, onAddSheet }) => {
  // Safely handle sheet change
  const handleSheetChange = (sheetId) => {
    if (typeof onChangeSheet === 'function' && sheetId) {
      onChangeSheet(sheetId);
    }
  };

  // Safely handle adding a new sheet
  const handleAddSheet = () => {
    if (typeof onAddSheet === 'function') {
      onAddSheet();
    }
  };

  return (
    <div className={styles.sheetTabs}>
      <div className={styles.tabsContainer}>
        {Array.isArray(sheets) && sheets.map(sheet => (
          <div 
            key={sheet.id || Math.random().toString()}
            onClick={() => handleSheetChange(sheet.id)}
            className={`${styles.sheetTab} ${sheet.id === activeSheetId ? styles.activeTab : ''}`}
          >
            {sheet.name || 'Unnamed Sheet'}
          </div>
        ))}
      </div>
      <button
        onClick={handleAddSheet}
        className={styles.addSheetButton}
      >
        + Add Sheet
      </button>
    </div>
  );
};

export default SheetTabs; 