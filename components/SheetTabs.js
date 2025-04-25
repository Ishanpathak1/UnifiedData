import React, { useState } from 'react';
import styles from '../styles/SheetTabs.module.css';

const SheetTabs = ({ sheets, activeSheet, onSheetChange, onAddSheet }) => {
  return (
    <div className={styles.sheetTabsContainer}>
      <div className={styles.sheetTabs}>
        {sheets.map((sheet) => (
          <div
            key={sheet.id}
            className={`${styles.sheetTab} ${sheet.id === activeSheet ? styles.activeSheet : ''}`}
            onClick={() => onSheetChange(sheet.id)}
          >
            <span className={styles.sheetName}>{sheet.name}</span>
          </div>
        ))}
      </div>
      
      <button 
        className={styles.addSheetButton} 
        onClick={onAddSheet}
      >
        + Add Sheet
      </button>
    </div>
  );
};

export default SheetTabs;
