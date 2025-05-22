import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from './AuthContext';
import { saveAllSpreadsheetData } from '../utils/spreadsheet/sheetManagement';
import { toast } from 'react-hot-toast';

// Create context
const SpreadsheetContext = createContext();

// Provider component
export const SpreadsheetProvider = ({ children }) => {
  // Router and auth
  const router = useRouter();
  const { user } = useAuth();
  
  // Refs
  const hotRef = useRef(null);
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const isUpdating = useRef(false);
  const dataSnapshotRef = useRef(null);
  const isSavingRef = useRef(false);
  const allSheetsRef = useRef([]);
  const titleChangeRef = useRef(false);
  
  // Core spreadsheet state
  const [data, setData] = useState([
    ['Month', 'Sales', 'Marketing', 'Expenses', 'Profit', 'Growth', 'Units'],
    ['Jan', 1200, 400, 800, 350, 0.15, 120],
    ['Feb', 1350, 450, 850, 450, 0.12, 132],
    ['Mar', 1500, 500, 900, 550, 0.10, 145],
    ['Apr', 1650, 550, 950, 650, 0.08, 158],
    ['May', 1800, 600, 1000, 750, 0.05, 172],
    ['Jun', 1950, 650, 1050, 850, 0.03, 186],
    ['', '', '', '', '', '', ''],
  ]);
  
  // Sheet management
  const [sheets, setSheets] = useState([{ id: 'default', name: 'Main Sheet', data }]);
  const [activeSheetId, setActiveSheetId] = useState('default');
  
  // Document info
  const [documentTitle, setDocumentTitle] = useState('Untitled spreadsheet');
  const [spreadsheetId, setSpreadsheetId] = useState(null);
  const [lastSaved, setLastSaved] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Selection state
  const [selectedCell, setSelectedCell] = useState({ row: 0, col: 0 });
  const [selectedColumn, setSelectedColumn] = useState(null);
  
  // Keep allSheetsRef in sync with sheets state
  useEffect(() => {
    if (sheets && sheets.length > 0) {
      allSheetsRef.current = [...sheets];
    }
  }, [sheets]);
  
  // Auto-save functionality
  useEffect(() => {
    if (!spreadsheetId || !user) return;
    
    const autoSaveInterval = setInterval(() => {
      // Don't auto-save if currently manually saving
      if (!isSaving) {
        // Auto-save current sheets
        saveCurrentSheets();
      }
    }, 60000); // Auto-save every minute
    
    return () => clearInterval(autoSaveInterval);
  }, [spreadsheetId, user, isSaving]);
  
  // Save method using the imported utility function
  const saveSpreadsheet = async () => {
    if (!user || !hotRef.current) return false;
    
    return saveAllSpreadsheetData(
      user,
      hotRef,
      spreadsheetId,
      documentTitle,
      sheets,
      allSheetsRef,
      activeSheetId,
      setIsSaving,
      setSheets,
      setSpreadsheetId,
      setLastSaved,
      router
    );
  };
  
  // Function to safely save current state
  const saveCurrentSheets = async () => {
    if (!user || !hotRef.current || !spreadsheetId || spreadsheetId === 'new') return;
    
    try {
      await saveSpreadsheet();
    } catch (error) {
      console.error('Auto-save error:', error);
      toast.error('Auto-save failed: ' + error.message);
    }
  };
  
  // Value object to be provided by the context
  const value = {
    // Refs
    hotRef,
    chartRef,
    chartInstance,
    isUpdating,
    dataSnapshotRef,
    isSavingRef,
    allSheetsRef,
    titleChangeRef,
    
    // Core state
    data,
    setData,
    sheets,
    setSheets,
    activeSheetId,
    setActiveSheetId,
    
    // Document info
    documentTitle,
    setDocumentTitle,
    spreadsheetId,
    setSpreadsheetId,
    lastSaved,
    setLastSaved,
    isSaving,
    setIsSaving,
    
    // Selection state
    selectedCell,
    setSelectedCell,
    selectedColumn,
    setSelectedColumn,
    
    // Methods
    saveSpreadsheet,
    saveCurrentSheets
  };

  return (
    <SpreadsheetContext.Provider value={value}>
      {children}
    </SpreadsheetContext.Provider>
  );
};

// Custom hook to use the spreadsheet context
export const useSpreadsheet = () => {
  const context = useContext(SpreadsheetContext);
  if (context === undefined) {
    throw new Error('useSpreadsheet must be used within a SpreadsheetProvider');
  }
  return context;
};

export default SpreadsheetContext; 