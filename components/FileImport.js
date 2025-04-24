// components/FileImport.js
import { useState, useRef } from 'react';
import styles from '../styles/FileImport.module.css';
import ImportWarningModal from './ImportWarningModal';

const FileImport = ({ 
  onFileImport, 
  onExportCsv, 
  onExportExcel,
  spreadsheetId,
  checkDependencies = async () => [],
  createNewSpreadsheet = (file) => onFileImport(file)
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [dependentDashboards, setDependentDashboards] = useState([]);
  const [fileToImport, setFileToImport] = useState(null);
  const fileInputRef = useRef(null);
  
  // Handle file selection
  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // If we don't have a spreadsheet ID, import directly
    if (!spreadsheetId) {
      onFileImport(file);
      setShowMenu(false);
      return;
    }
    
    // Check if this spreadsheet is used in any dashboards
    const dashboards = await checkDependencies(spreadsheetId);
    
    if (dashboards && dashboards.length > 0) {
      // Store the file temporarily
      setFileToImport(file);
      setDependentDashboards(dashboards);
      setShowWarning(true);
      setShowMenu(false);
    } else {
      // No dependencies, import directly
      onFileImport(file);
      setShowMenu(false);
    }
  };
  
  // Directly trigger the file input click
  const triggerFileInput = () => {
    fileInputRef.current.click();
  };
  
  const handleCreateNew = () => {
    if (fileToImport) {
      createNewSpreadsheet(fileToImport);
      setShowWarning(false);
      setFileToImport(null);
    }
  };
  
  const handleReplace = () => {
    if (fileToImport) {
      onFileImport(fileToImport);
      setShowWarning(false);
      setFileToImport(null);
    }
  };
  
  const closeWarning = () => {
    setShowWarning(false);
    setFileToImport(null);
  };
  
  return (
    <>
      <div className={styles.menuContainer}>
        <button 
          className={styles.menuItem}
          onClick={() => setShowMenu(!showMenu)}
        >
          File
        </button>
        
        {showMenu && (
          <div className={styles.dropdown}>
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            
            {/* Explicit button for Import File */}
            <button 
              className={styles.dropdownItem}
              onClick={triggerFileInput}
            >
              Import File
            </button>
            
            <button 
              className={styles.dropdownItem}
              onClick={() => {
                onExportCsv();
                setShowMenu(false);
              }}
            >
              Export as CSV
            </button>
            
            <button 
              className={styles.dropdownItem}
              onClick={() => {
                onExportExcel();
                setShowMenu(false);
              }}
            >
              Export as Excel
            </button>
          </div>
        )}
      </div>
      
      {showWarning && (
        <ImportWarningModal
          onClose={closeWarning}
          onCreateNew={handleCreateNew}
          onReplace={handleReplace}
          dependentDashboards={dependentDashboards}
        />
      )}
    </>
  );
};

export default FileImport;