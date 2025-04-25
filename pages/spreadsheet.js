import { useRef, useState, useEffect, useCallback } from 'react';
import { HotTable } from '@handsontable/react';
import { registerAllModules } from 'handsontable/registry';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { Chart, registerables } from 'chart.js';
import 'handsontable/dist/handsontable.full.min.css';
import styles from '../styles/Spreadsheet.module.css';
import FileImport from '../components/FileImport';
import ChartToolbar from '../components/ChartToolbar';
import AIPanel from '../components/AIPanel';
import DataInspector from '../components/DataInspector';
import { detectDataType, DATA_TYPES } from '../utils/dataTypeUtils';
import Handsontable from 'handsontable';
import MatrixOperationsPanel from '../components/MatrixOperationsPanel';
import PCAAnalysisPanel from '../components/PCAAnalysisPanel';
import CorrelationAnalysisPanel from '../components/CorrelationAnalysisPanel';
import TimeSeriesForecastPanel from '../components/TimeSeriesForecastPanel';
import RegressionAnalysisPanel from '../components/RegressionAnalysisPanel';
import { useRouter } from 'next/router';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../utils/firebase';
import { query as firestoreQuery } from 'firebase/firestore';
import { where as firestoreWhere } from 'firebase/firestore';
import { orderBy as firestoreOrderBy } from 'firebase/firestore';

// Register Chart.js components
Chart.register(...registerables);
// Register Handsontable modules
registerAllModules();

// Add this helper function to sanitize the chart config
const sanitizeForFirestore = (obj) => {
  // Handle null and undefined
  if (obj === null || obj === undefined) {
    return null;
  }
  
  // Handle functions - functions are not allowed in Firestore
  if (typeof obj === 'function') {
    return null;
  }
  
  // Handle other primitive values
  if (typeof obj !== 'object') {
    return obj;
  }
  
  // Handle arrays
  if (Array.isArray(obj)) {
    // Filter out undefined values and sanitize each item
    return obj
      .map(item => sanitizeForFirestore(item))
      .filter(item => item !== undefined);
  }
  
  // Handle objects
  const newObj = {};
  
  // Process each key, skip undefined values and functions
  Object.keys(obj).forEach(key => {
    if (typeof obj[key] !== 'function') {
      const value = sanitizeForFirestore(obj[key]);
      if (value !== undefined) {
        newObj[key] = value;
      }
    }
  });
  
  return newObj;
};

// Add this function to deeply remove any functions from the chart config
const removeFunctionsFromConfig = (config) => {
  if (!config) return null;
  
  // Create a deep copy to avoid modifying the original
  const newConfig = JSON.parse(JSON.stringify(
    config,
    // Custom replacer function to exclude functions
    (key, value) => {
      if (typeof value === 'function') {
        return undefined; // Skip functions
      }
      return value;
    }
  ));
  
  return newConfig;
};

export default function Home() {
  const hotRef = useRef(null);
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const isUpdating = useRef(false);
  const dataSnapshotRef = useRef(null);
  const router = useRouter();
  const { user } = useAuth();
  
  // State variables
  const [data, setData] = useState([
    ['Month', 'Sales', 'Marketing', 'Expenses', 'Profit', 'Growth', 'Units'],
    ['Jan', 1200, 400, 800, 350, 0.15, 120],
    ['Feb', 1350, 450, 850, 450, 0.12, 132],
    ['Mar', 1500, 500, 900, 550, 0.10, 145],
    ['Apr', 1650, 550, 950, 650, 0.08, 158],
    ['May', 1800, 600, 1000, 750, 0.05, 172],
    ['Jun', 1950, 650, 1050, 850, 0.03, 186],
    ['', '', '', '', '', '', ''],
    ['Matrix A', 2, 3, 4, '', '', ''],
    ['', 5, 6, 7, '', '', ''],
    ['', 8, 9, 10, '', '', ''],
    ['', '', '', '', '', '', ''],
    ['Matrix B', 11, 12, '', '', '', ''],
    ['', 13, 14, '', '', '', ''],
    ['', 15, 16, '', '', '', ''],
    ['', '', '', '', '', '', ''],
  ]);
  const [selectedCell, setSelectedCell] = useState({ row: 0, col: 0 });
  const [selectedColumn, setSelectedColumn] = useState(null);
  const [query, setQuery] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [chartConfig, setChartConfig] = useState(null);
  const [showChartModal, setShowChartModal] = useState(false);
  const [documentTitle, setDocumentTitle] = useState('Untitled spreadsheet');
  const [testChartType, setTestChartType] = useState('bar');
  const [showDataInspector, setShowDataInspector] = useState(false);
  const [showCleaningTools, setShowCleaningTools] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [aiPanelWidth, setAiPanelWidth] = useState(400); // Set a good default width
  const [isResizing, setIsResizing] = useState(false);
  const [showAdvancedPanel, setShowAdvancedPanel] = useState(false);
  const [showAdvancedMenu, setShowAdvancedMenu] = useState(false);
  const [advancedOperation, setAdvancedOperation] = useState('matrix');
  const [showForecastPanel, setShowForecastPanel] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [spreadsheetId, setSpreadsheetId] = useState(null);
  const [showChartMenu, setShowChartMenu] = useState(false);
  const [showAddToDashboardModal, setShowAddToDashboardModal] = useState(false);
  const [isLoadingDashboards, setIsLoadingDashboards] = useState(false);
  const [dashboards, setDashboards] = useState([]);
  const [newDashboardTitle, setNewDashboardTitle] = useState('');
  const [isCreatingDashboard, setIsCreatingDashboard] = useState(false);
  const [sheets, setSheets] = useState([{ id: 'default', name: 'Main Sheet', data }]);
  const [activeSheetId, setActiveSheetId] = useState('default');

  // Import file handler
  const handleFileImport = (file) => {
    const reader = new FileReader();
    const fileExtension = file.name.split('.').pop().toLowerCase();
    
    reader.onload = (e) => {
      const content = e.target.result;
      
      if (fileExtension === 'csv') {
        Papa.parse(content, {
          complete: (results) => {
            if (results.data && results.data.length) {
              // Create a new sheet for CSV data
              const newSheet = {
                id: `sheet_${Date.now()}`,
                name: file.name.split('.')[0],
                data: results.data
              };
              
              setSheets(prev => [...prev, newSheet]);
              setActiveSheetId(newSheet.id);
              
              if (hotRef.current) {
                hotRef.current.hotInstance.loadData(results.data);
                setData(results.data);
              }
            }
          },
          header: false
        });
      } else if (['xlsx', 'xls'].includes(fileExtension)) {
        const workbook = XLSX.read(content, { type: 'binary' });
        const newSheets = [];
        
        workbook.SheetNames.forEach((sheetName, index) => {
          const worksheet = workbook.Sheets[sheetName];
          const excelData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          
          newSheets.push({
            id: `sheet_${Date.now()}_${index}`,
            name: sheetName,
            data: excelData
          });
        });
        
        if (newSheets.length > 0) {
          setSheets(prev => [...prev, ...newSheets]);
          setActiveSheetId(newSheets[0].id);
          
          if (hotRef.current) {
            hotRef.current.hotInstance.loadData(newSheets[0].data);
            setData(newSheets[0].data);
          }
        }
      }
    };
    
    if (fileExtension === 'csv') {
      reader.readAsText(file);
    } else {
      reader.readAsBinaryString(file);
    }
  };

  // Export handlers
  const handleExportCsv = () => {
    if (!hotRef.current) return;
    
    const hot = hotRef.current.hotInstance;
    const csvData = Papa.unparse(hot.getData());
    
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${documentTitle}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportExcel = () => {
    if (!hotRef.current) return;
    
    const hot = hotRef.current.hotInstance;
    const wsData = hot.getData();
    
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, `${documentTitle}.xlsx`);
  };

  // Grid manipulation
  const addRow = () => {
    if (!hotRef.current) return;
    
    const hot = hotRef.current.hotInstance;
    const newData = [...data];
    newData.push(Array(newData[0].length).fill(''));
    setData(newData);
    hot.loadData(newData);
  };

  const addColumn = () => {
    if (!hotRef.current) return;
    
    const hot = hotRef.current.hotInstance;
    const newData = data.map(row => [...row, '']);
    setData(newData);
    hot.loadData(newData);
  };

  // Enhanced chart creation function to replace your current one
  const createChart = (chartType = 'bar') => {
    if (!hotRef.current) {
      toast.error('Spreadsheet not initialized');
      return;
    }
    
    const hot = hotRef.current.hotInstance;
    const selection = hot.getSelected();
    
    if (!selection) {
      toast.error('Please select data first');
      return;
    }
    
    console.log("Creating chart with source from spreadsheet:", spreadsheetId);
    
    // Extract data using hot
    const [startRow, startCol, endRow, endCol] = selection[0];
    console.log("Selection range:", { startRow, startCol, endRow, endCol });
    
    // Get selected column headers for source tracking
    const headers = hot.getDataAtRow(0);
    const sourceColumns = [];
    
    for (let col = startCol; col <= endCol; col++) {
      if (headers[col]) {
        sourceColumns.push(headers[col]);
      }
    }
    
    console.log("Selected columns:", sourceColumns);
    
    // Extract data for the chart
    const chartData = [];
    for (let row = startRow; row <= endRow; row++) {
      const rowData = hot.getDataAtRow(row);
      if (rowData) {
        const selectedData = [];
        for (let col = startCol; col <= endCol; col++) {
          selectedData.push(rowData[col]);
        }
        chartData.push(selectedData);
      }
    }
    
    console.log("Chart data:", chartData);
    
    // Create chart config based on type
    let config;
    
    // First row as headers, rest as data
    const labels = chartData[0] ? chartData[0].slice(1) : [];
    
    if (['pie', 'doughnut', 'polarArea'].includes(chartType)) {
      // For these chart types, use first column as labels, second column as data
      const pieLabels = chartData.map(row => row[0]);
      const pieData = chartData.map(row => parseFloat(row[1]) || 0);
      
      // Generate colors
      const colors = pieLabels.map((_, index) => {
        const hue = (index * 137.5) % 360;
        return `hsla(${hue}, 70%, 60%, 0.7)`;
      });
      
      config = {
        type: chartType,
        data: {
          labels: pieLabels,
          datasets: [{
            data: pieData,
            backgroundColor: colors,
            borderColor: colors.map(color => color.replace('0.7)', '1)')),
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          plugins: {
            title: {
              display: true,
              text: 'Chart from Spreadsheet Data'
            },
            legend: {
              position: 'top',
            }
          }
        },
        // Store source tracking info directly in the config
        sourceInfo: {
          spreadsheetId: spreadsheetId,
          range: { startRow, startCol, endRow, endCol },
          columns: sourceColumns
        }
      };
    } else {
      // For other chart types (bar, line, etc.), use first column as categories
      // and other columns as data series
      const datasets = [];
      
      // Second row and onwards are data
      for (let dataIndex = 1; dataIndex < chartData.length; dataIndex++) {
        const rowData = chartData[dataIndex];
        const hue = ((dataIndex - 1) * 137.5) % 360;
        const color = `hsla(${hue}, 70%, 60%, 0.7)`;
        
        datasets.push({
          label: rowData[0] || `Series ${dataIndex}`,
          data: rowData.slice(1).map(val => parseFloat(val) || 0),
          backgroundColor: color,
          borderColor: color.replace('0.7)', '1)'),
          borderWidth: 1
        });
      }
      
      config = {
        type: chartType,
        data: {
          labels: labels,
          datasets: datasets
        },
        options: {
          responsive: true,
          plugins: {
            title: {
              display: true,
              text: 'Chart from Spreadsheet Data'
            },
            legend: {
              position: 'top',
            }
          },
          scales: {
            y: {
              beginAtZero: true
            }
          }
        },
        // Store source tracking info directly in the config
        sourceInfo: {
          spreadsheetId: spreadsheetId,
          range: { startRow, startCol, endRow, endCol },
          columns: sourceColumns
        }
      };
    }
    
    console.log("Created chart with source info:", config.sourceInfo);
    
    // Set chart config and show modal
    setChartConfig(config);
    setShowChartModal(true);
  };

  // Initialize or update chart when config changes
  useEffect(() => {
    if (chartConfig && chartRef.current) {
      // If there's already a chart, destroy it
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
      
      // Create new chart
      const ctx = chartRef.current.getContext('2d');
      chartInstance.current = new Chart(ctx, chartConfig);
    }
  }, [chartConfig]);

  // Export the chart as an image
  const exportChart = () => {
    if (!chartRef.current) return;
    
    const link = document.createElement('a');
    link.download = `${documentTitle}-chart.png`;
    link.href = chartRef.current.toDataURL('image/png');
    link.click();
  };

  // Add this function in your component, right after the other handler functions
  const handleAskAI = async () => {
    if (!query.trim()) return;
    
    // Check if the query is about visualization
    const visualizationTerms = ['chart', 'graph', 'plot', 'visualization', 'visualize', 'show me'];
    const isVisualizationQuery = visualizationTerms.some(term => query.toLowerCase().includes(term));
    
    try {
      if (isVisualizationQuery) {
        // Send to the visualization endpoint
        const res = await fetch('/api/visualize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            query,
            data: hotRef.current ? hotRef.current.hotInstance.getData() : data
          }),
        });
        
        const json = await res.json();
        
        if (json.chartType) {
          // Create and display the chart
          createChart(json.chartType);
          setAiResponse(`I've created a ${json.chartType} chart based on your data. ${json.explanation || ''}`);
        } else {
          setAiResponse(json.answer);
        }
      } else {
        // Regular query
    const res = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            query, 
            data: hotRef.current ? hotRef.current.hotInstance.getData() : data
          }),
    });

    const json = await res.json();
    setAiResponse(json.answer);
      }
    } catch (error) {
      console.error('Error with AI query:', error);
      setAiResponse('Sorry, there was an error processing your request.');
    }
  };

  // Update the resizing functions
  const startResizing = (e) => {
    console.log("Start resizing");
    setIsResizing(true);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', stopResizing);
    document.body.classList.add('resizing');
    // Prevent text selection during resize
    e.preventDefault();
  };

  const handleMouseMove = useCallback((e) => {
    if (isResizing) {
      const containerRect = document.querySelector(`.${styles.contentArea}`).getBoundingClientRect();
      const newWidth = containerRect.right - e.clientX;
      const minWidth = 320;
      const maxWidth = Math.min(600, containerRect.width * 0.6);
      
      setAiPanelWidth(Math.min(Math.max(newWidth, minWidth), maxWidth));
    }
  }, [isResizing]);

  const stopResizing = useCallback(() => {
    console.log("Stop resizing");
    setIsResizing(false);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', stopResizing);
    document.body.classList.remove('resizing');
  }, [handleMouseMove]);

  // Cleanup event listeners
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', stopResizing);
      document.body.classList.remove('resizing');
    };
  }, [handleMouseMove, stopResizing]);

  // Add this effect to update body class during resize
  useEffect(() => {
    if (isResizing) {
      document.body.classList.add('resizing');
    } else {
      document.body.classList.remove('resizing');
    }
  }, [isResizing]);

  // Add this function to recommend chart types based on data
  const recommendChartType = (data, columnTypes) => {
    // Count different data types
    const numericCount = columnTypes.filter(type => type === 'numeric').length;
    const dateCount = columnTypes.filter(type => type === 'date').length;
    const textCount = columnTypes.filter(type => type === 'text').length;
    
    // Single numeric column with categories - pie/doughnut
    if (numericCount === 1 && textCount >= 1 && data.length <= 10) {
      return 'pie';
    }
    
    // Time series data - line chart
    if (dateCount >= 1 && numericCount >= 1) {
      return 'line';
    }
    
    // Multiple numeric columns - bar chart
    if (numericCount > 1) {
      return 'bar';
    }
    
    // Multiple text categories with one numeric - bar chart
    if (textCount >= 1 && numericCount >= 1) {
      return 'bar';
    }
    
    // Two numeric columns - scatter plot
    if (numericCount === 2 && textCount === 0) {
      return 'scatter';
    }
    
    // Fallback to bar chart
    return 'bar';
  };

  // Add this function to handle opening the forecast panel
  const handleOpenForecastPanel = () => {
    setShowForecastPanel(true);
  };

  // Add a function to navigate back to home
  const navigateToHome = () => {
    router.push('/');
  };

  // Add this function to save the spreadsheet
  const saveSpreadsheet = async () => {
    if (!user || !hotRef.current) return;
    
    // Update current sheet with latest data
    const currentData = hotRef.current.hotInstance.getData();
    const updatedSheets = sheets.map(sheet => 
      sheet.id === activeSheetId ? {...sheet, data: currentData} : sheet
    );
    setSheets(updatedSheets);
    
    setIsSaving(true);
    
    try {
      // Use current spreadsheet ID or one from URL
      const docId = spreadsheetId || router.query.id;
      
      // Create serialized data for Firestore
      const serializedData = {
        title: documentTitle,
        sheets: sanitizeForFirestore(updatedSheets),
        lastModified: serverTimestamp(),
        ownerId: user.uid,
        ownerEmail: user.email,
        ownerName: user.displayName || 'Unknown User'
      };
      
      if (docId && docId !== 'new') {
        await updateDoc(doc(db, 'spreadsheets', docId), serializedData);
        setSpreadsheetId(docId);
      } else {
        const newDocRef = doc(collection(db, 'spreadsheets'));
        await setDoc(newDocRef, {
          ...serializedData,
          createdAt: serverTimestamp()
        });
        
        setSpreadsheetId(newDocRef.id);
        router.push(`/spreadsheet?id=${newDocRef.id}`, undefined, { shallow: true });
      }
      
      setLastSaved(new Date());
      toast.success('Spreadsheet saved successfully');
    } catch (error) {
      console.error('Error saving spreadsheet:', error);
      toast.error('Failed to save spreadsheet');
    } finally {
      setIsSaving(false);
    }
  };

  // Add this useEffect to check for an existing spreadsheet ID in the URL
  useEffect(() => {
    const { id } = router.query;
    if (id && id !== 'new') {
      setSpreadsheetId(id);
      // Load the spreadsheet data
      loadSpreadsheetData(id);
    }
  }, [router.query]);

  // Function to load spreadsheet data
  const loadSpreadsheetData = async (id) => {
    if (!user) return;
    
    try {
      const docRef = doc(db, 'spreadsheets', id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const sheetData = docSnap.data();
        
        setSpreadsheetId(id);
        
        if (sheetData.ownerId === user.uid) {
          if (sheetData.title) {
            setDocumentTitle(sheetData.title);
          }
          
          // Load sheets data
          if (sheetData.sheets && Array.isArray(sheetData.sheets)) {
            setSheets(sheetData.sheets);
            
            // Set first sheet as active and load it
            if (sheetData.sheets.length > 0) {
              const firstSheet = sheetData.sheets[0];
              setActiveSheetId(firstSheet.id);
              
              if (hotRef.current && firstSheet.data) {
                hotRef.current.hotInstance.loadData(firstSheet.data);
                setData(firstSheet.data);
              }
            }
          }
          
          if (sheetData.lastModified) {
            setLastSaved(sheetData.lastModified.toDate());
          }
        } else {
          toast.error("You don't have permission to access this spreadsheet");
          router.push('/');
        }
      } else {
        toast.error('Spreadsheet not found');
      }
    } catch (error) {
      console.error('Error loading spreadsheet:', error);
      toast.error('Failed to load spreadsheet');
    }
  };

  // Helper function to format time ago
  const formatTimeAgo = (date) => {
    if (!date) return '';
    
    // Ensure date is a Date object
    const dateObj = date instanceof Date ? date : new Date(date);
    
    // Check if the date is valid
    if (isNaN(dateObj.getTime())) {
      return 'Invalid date';
    }
    
    const now = new Date();
    const diffInSeconds = Math.floor((now - dateObj) / 1000);
    
    if (diffInSeconds < 60) {
      return 'just now';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days} day${days > 1 ? 's' : ''} ago`;
    }
  };

  // Add this useEffect for auto-saving
  useEffect(() => {
    if (!spreadsheetId || !user) return;
    
    const autoSaveInterval = setInterval(() => {
      // Don't auto-save if currently manually saving
      if (!isSaving) {
        autoSaveSpreadsheet();
      }
    }, 60000); // Auto-save every minute
    
    return () => clearInterval(autoSaveInterval);
  }, [spreadsheetId, user, isSaving]);

  // Auto-save function (simplified version without UI updates)
  const autoSaveSpreadsheet = async () => {
    if (!user || !hotRef.current) return;
    
    // Use the current spreadsheet ID or the one from the URL
    const docId = spreadsheetId || router.query.id;
    
    if (!docId || docId === 'new') {
      console.log("No spreadsheet ID for auto-save, skipping");
      return;
    }
    
    try {
      console.log("Auto-saving spreadsheet:", docId);
      const currentData = hotRef.current.hotInstance.getData();
      
      // Serialize the data
      const serializedData = {
        rows: currentData.map((row, rowIndex) => ({
          rowId: rowIndex.toString(),
          cells: row.map((cell, colIndex) => ({
            colId: colIndex.toString(),
            value: cell
          }))
        }))
      };
      
      await setDoc(doc(db, 'spreadsheets', docId), {
        serializedData: serializedData,
        lastModified: serverTimestamp()
      }, { merge: true });
      
      // Update last saved time
      setLastSaved(new Date());
      
      console.log('Auto-saved spreadsheet:', docId);
      
      // After successful save, try to update dependent dashboards
      await updateDependentDashboards();
    } catch (error) {
      console.error("Error auto-saving spreadsheet:", error);
    }
  };

  // Add this useEffect for keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Save on Ctrl+S or Command+S
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault(); // Prevent browser save dialog
        saveSpreadsheet();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Add this useEffect to fetch dashboards
  useEffect(() => {
    if (!user) return;
    
    setIsLoadingDashboards(true);
    
    const fetchDashboards = async () => {
      try {
        const q = firestoreQuery(
          collection(db, 'dashboards'),
          firestoreWhere('ownerId', '==', user.uid),
          firestoreOrderBy('lastModified', 'desc')
        );
        
        const querySnapshot = await getDocs(q);
        const dashboardsData = [];
        
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          
          // Safely convert timestamps
          let lastModified = data.lastModified;
          if (lastModified && typeof lastModified.toDate === 'function') {
            lastModified = lastModified.toDate();
          } else if (lastModified) {
            // If it's already a date string or timestamp
            lastModified = new Date(lastModified);
          } else {
            // Default to current time if no lastModified
            lastModified = new Date();
          }
          
          dashboardsData.push({
            id: doc.id,
            ...data,
            lastModified: lastModified // Use the safely converted timestamp
          });
        });
        
        setDashboards(dashboardsData);
      } catch (error) {
        console.error('Error fetching dashboards:', error);
        alert('Failed to load dashboards');
      } finally {
        setIsLoadingDashboards(false);
      }
    };
    
    fetchDashboards();
  }, [user]);

  // Add this function to fetch user's dashboards
  const fetchUserDashboards = async () => {
    if (!user) return;
    
    setIsLoadingDashboards(true);
    try {
      const q = firestoreQuery(
        collection(db, 'dashboards'),
        firestoreWhere('ownerId', '==', user.uid),
        firestoreOrderBy('lastModified', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const dashboardsData = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        
        // Safely convert timestamps
        let lastModified = data.lastModified;
        if (lastModified && typeof lastModified.toDate === 'function') {
          lastModified = lastModified.toDate();
        } else if (lastModified) {
          // If it's already a date string or timestamp
          lastModified = new Date(lastModified);
        } else {
          // Default to current time if no lastModified
          lastModified = new Date();
        }
        
        dashboardsData.push({
          id: doc.id,
          ...data,
          lastModified: lastModified // Use the safely converted timestamp
        });
      });
      
      setDashboards(dashboardsData);
    } catch (error) {
      console.error('Error fetching dashboards:', error);
      alert('Failed to load dashboards');
    } finally {
      setIsLoadingDashboards(false);
    }
  };

  // Add this function to add a chart to an existing dashboard
  const addChartToDashboard = async (dashboardId) => {
    if (!user || !chartConfig) {
      console.log("Missing user or chart config");
      return;
    }
    
    console.log("Adding chart to dashboard:", dashboardId);
    console.log("Current spreadsheet ID:", spreadsheetId);
    
    try {
      // First, make a clean copy without functions
      let cleanConfig;
      try {
        cleanConfig = removeFunctionsFromConfig(chartConfig);
      } catch (e) {
        cleanConfig = JSON.parse(JSON.stringify(chartConfig, (key, value) => 
          typeof value === 'function' ? undefined : value
        ));
      }
      
      // Extract source info before sanitizing
      const sourceRange = chartConfig.sourceInfo?.range || null;
      const sourceColumns = chartConfig.sourceInfo?.columns || [];
      
      // Then sanitize for Firestore
      const sanitizedConfig = sanitizeForFirestore(cleanConfig);
      
      // Remove sourceInfo from chartConfig to avoid duplication
      if (sanitizedConfig.sourceInfo) {
        delete sanitizedConfig.sourceInfo;
      }
      
      // Create chart item
      const chartItem = {
        id: `chart_${Date.now()}`,
        type: 'chart',
        chartConfig: sanitizedConfig,
        position: {
          x: 0,
          y: 0,
          w: 6,
          h: 4
        },
        title: chartConfig.type ? 
          `${chartConfig.type.charAt(0).toUpperCase() + chartConfig.type.slice(1)} Chart` : 
          'Chart',
        createdAt: new Date().toISOString(),
        sourceSpreadsheetId: spreadsheetId,
        sourceInfo: {
          spreadsheetId: spreadsheetId,
          range: sourceRange,
          columns: sourceColumns,
          lastUpdated: new Date().toISOString()
        }
      };
      
      console.log("Chart item to add:", chartItem.id);
      console.log("Source info:", chartItem.sourceInfo);
      
      // Get the dashboard document
      const dashboardRef = doc(db, 'dashboards', dashboardId);
      const dashboardSnap = await getDoc(dashboardRef);
      
      if (dashboardSnap.exists()) {
        // Get current items
        const dashboardData = dashboardSnap.data();
        const items = Array.isArray(dashboardData.items) ? dashboardData.items : [];
        
        // Add the new chart item
        const updatedItems = [...items, chartItem];
        
        // Final sanitization before update
        const sanitizedItems = sanitizeForFirestore(updatedItems);
        
        // Update dashboard
        await updateDoc(dashboardRef, {
          items: sanitizedItems,
          lastModified: serverTimestamp()
        });
        
        console.log("Chart added successfully to dashboard:", dashboardId);
        toast.success('Chart added to dashboard successfully!');
        setShowAddToDashboardModal(false);
      } else {
        toast.error('Dashboard not found');
      }
    } catch (error) {
      console.error('Error adding chart to dashboard:', error);
      toast.error('Failed to add chart to dashboard');
    }
  };

  // Add this function to create a new dashboard and add the chart
  const createAndAddToDashboard = async () => {
    if (!user || !chartConfig || !newDashboardTitle.trim()) {
      console.log("Missing required data:", {
        user: !!user,
        chartConfig: !!chartConfig,
        title: newDashboardTitle.trim()
      });
      return;
    }
    
    setIsCreatingDashboard(true);
    console.log("Creating new dashboard:", newDashboardTitle);
    
    try {
      // First strip out any functions from the config
      let cleanConfig;
      try {
        cleanConfig = removeFunctionsFromConfig(chartConfig);
      } catch (error) {
        console.error("Error removing functions:", error);
        cleanConfig = JSON.parse(JSON.stringify(chartConfig, (key, value) => 
          typeof value === 'function' ? undefined : value
        ));
      }
      
      // Then sanitize
      const sanitizedConfig = sanitizeForFirestore(cleanConfig);
      
      // Ensure source info is included
      const sourceInfo = {
        spreadsheetId: spreadsheetId,
        range: sanitizedConfig.sourceInfo?.range || chartConfig.sourceInfo?.range,
        columns: sanitizedConfig.sourceInfo?.columns || chartConfig.sourceInfo?.columns || []
      };
      
      // Create a chart item with source information
      const chartItem = {
        id: `chart_${Date.now()}`,
        type: 'chart',
        chartConfig: sanitizedConfig,
        position: {
          x: 0,
          y: 0,
          w: 6,
          h: 4
        },
        title: chartConfig.type ? 
          `${chartConfig.type.charAt(0).toUpperCase() + chartConfig.type.slice(1)} Chart` : 
          'Chart',
        createdAt: new Date().toISOString(),
        sourceSpreadsheetId: spreadsheetId,
        sourceInfo: {
          spreadsheetId: spreadsheetId,
          range: sourceInfo.range || null,
          columns: sourceInfo.columns || [],
          lastUpdated: new Date().toISOString()
        }
      };
      
      console.log("Creating dashboard with chart:", chartItem);
      
      // Create a new dashboard document with auto-generated ID
      const dashboardRef = doc(collection(db, 'dashboards'));
      const dashboardId = dashboardRef.id;
      
      // Create the dashboard data
      const dashboardData = {
        title: newDashboardTitle.trim(),
        ownerId: user.uid,
        items: [chartItem], // Include the chart item
        createdAt: serverTimestamp(),
        lastModified: serverTimestamp()
      };
      
      // Save the dashboard to Firestore
      await setDoc(dashboardRef, dashboardData);
      
      console.log("Dashboard created successfully:", dashboardId);
      
      // Close the modal and reset form
      setShowAddToDashboardModal(false);
      setNewDashboardTitle('');
      
      // Show success message
      toast.success("Dashboard created and chart added!");
      
      // Refresh the dashboards list
      fetchUserDashboards();
    } catch (error) {
      console.error("Error creating dashboard:", error);
      alert(`Failed to create dashboard: ${error.message}`);
    } finally {
      setIsCreatingDashboard(false);
    }
  };

  // Add this effect to load dashboards when the modal opens
  useEffect(() => {
    if (showAddToDashboardModal && user) {
      console.log("Modal opened, fetching dashboards");
      fetchUserDashboards();
    }
  }, [showAddToDashboardModal, user]);

  // Add this function after autoSaveSpreadsheet
  const updateDependentDashboards = async () => {
    // Get the ID from either state or URL
    const docId = spreadsheetId || router.query.id;
    
    if (!user || !docId || !hotRef.current) {
      console.log("Cannot update dashboards:", {
        user: !!user,
        spreadsheetId: docId,
        hotRef: !!hotRef.current
      });
      return;
    }
    
    console.log("Updating dependent dashboards for spreadsheet:", docId);
    
    try {
      // Get current data from the spreadsheet
      const currentData = hotRef.current.hotInstance.getData();
      console.log("Current spreadsheet data length:", currentData.length);
      
      // First, find dashboards that belong to this user
      console.log("Querying for dashboards");
      
      // Query all user's dashboards
      const dashboardsRef = collection(db, 'dashboards');
      const q = firestoreQuery(dashboardsRef, firestoreWhere('ownerId', '==', user.uid));
      
      const querySnapshot = await getDocs(q);
      console.log("Found", querySnapshot.size, "dashboards to check");
      
      // Process each dashboard
      let updatedCount = 0;
      
      for (const dashboardDoc of querySnapshot.docs) {
        const dashboard = dashboardDoc.data();
        const dashboardId = dashboardDoc.id;
        
        console.log(`Checking dashboard ${dashboardId}:`, dashboard.title);
        
        // Skip if no items
        if (!dashboard.items || !Array.isArray(dashboard.items)) {
          console.log("Dashboard has no items:", dashboardId);
          continue;
        }
        
        const items = dashboard.items;
        console.log(`Dashboard has ${items.length} items`);
        
        // Log each item to see what we're working with
        items.forEach((item, index) => {
          console.log(`Item ${index}:`, {
            id: item.id,
            type: item.type,
            sourceSpreadsheetId: item.sourceSpreadsheetId,
            sourceInfo: item.sourceInfo ? {
              spreadsheetId: item.sourceInfo.spreadsheetId,
              hasRange: !!item.sourceInfo.range
            } : null
          });
        });
        
        let itemsNeedUpdate = false;
        
        // Check each item to see if it uses this spreadsheet
        const updatedItems = items.map(item => {
          // Skip if not a chart
          if (item.type !== 'chart') {
            return item;
          }
          
          // Check for source spreadsheet ID in different possible locations
          const itemSpreadsheetId = 
            item.sourceInfo?.spreadsheetId || 
            item.sourceSpreadsheetId || 
            item.chartConfig?.sourceInfo?.spreadsheetId;
          
          console.log(`Chart ${item.id} sourceSpreadsheetId:`, itemSpreadsheetId);
          
          // Skip if doesn't use this spreadsheet
          if (itemSpreadsheetId !== docId) {
            console.log(`Chart ${item.id} doesn't use this spreadsheet`);
            return item;
          }
          
          console.log("Found chart using this spreadsheet:", item.id);
          
          // Get range info from wherever it might be stored
          const range = 
            item.sourceInfo?.range || 
            item.chartConfig?.sourceInfo?.range;
          
          if (!range) {
            console.log("Chart has no range info:", item.id);
            return item;
          }
          
          console.log("Chart range:", range);
          
          // Extract the relevant data based on the range
          const { startRow, startCol, endRow, endCol } = range;
          
          // Extract data for the chart from current spreadsheet data
          const extractedData = [];
          for (let row = startRow; row <= Math.min(endRow, currentData.length - 1); row++) {
            if (!currentData[row]) continue;
            
            const rowData = [];
            for (let col = startCol; col <= Math.min(endCol, currentData[row].length - 1); col++) {
              rowData.push(currentData[row][col]);
            }
            
            if (rowData.some(cell => cell !== '')) {
              extractedData.push(rowData);
            }
          }
          
          console.log("Extracted data for chart update:", extractedData);
          
          // No data to update
          if (extractedData.length === 0) {
            console.log("No data extracted for chart:", item.id);
            return item;
          }
          
          // Update the chart config based on chart type
          const updatedConfig = updateChartDataInConfig(item.chartConfig, extractedData);
          
          // Return updated item
          itemsNeedUpdate = true;
          return {
            ...item,
            chartConfig: updatedConfig,
            sourceInfo: {
              ...item.sourceInfo,
              lastUpdated: new Date().toISOString()
            }
          };
        });
        
        // Only update if something changed
        if (itemsNeedUpdate) {
          console.log("Updating dashboard with new chart data:", dashboardId);
          
          // Sanitize for Firestore and update
          const sanitizedItems = sanitizeForFirestore(updatedItems);
          
          await updateDoc(doc(db, 'dashboards', dashboardId), {
            items: sanitizedItems,
            lastModified: serverTimestamp()
          });
          
          updatedCount++;
        } else {
          console.log("No items needed updates in dashboard:", dashboardId);
        }
      }
      
      console.log(`Updated ${updatedCount} dashboards with new data`);
      
      if (updatedCount > 0) {
        toast.success(`Updated ${updatedCount} dashboard${updatedCount > 1 ? 's' : ''} with latest data`);
      }
    } catch (error) {
      console.error("Error updating dependent dashboards:", error);
      toast.error("Failed to update dashboards with latest data");
    }
  };

  // Function to update chart data in config based on chart type
  const updateChartDataInConfig = (chartConfig, newData) => {
    if (!chartConfig || !newData || newData.length === 0) return chartConfig;
    
    // Clone the config to avoid modifying the original
    const updatedConfig = JSON.parse(JSON.stringify(chartConfig));
    
    // Handle different chart types
    if (['bar', 'line', 'radar'].includes(chartConfig.type)) {
      // For these chart types, first row should be labels, remaining rows are data series
      if (newData.length >= 2) {
        // Update labels
        if (updatedConfig.data) {
          updatedConfig.data.labels = newData[0].slice(1); // Skip first cell which is often empty
          
          // Update datasets
          updatedConfig.data.datasets = newData.slice(1).map((row, index) => {
            // Preserve original dataset properties if they exist
            const originalDataset = (updatedConfig.data.datasets && updatedConfig.data.datasets[index]) || {};
            return {
              ...originalDataset,
              label: row[0] || `Series ${index + 1}`,
              data: row.slice(1).map(val => typeof val === 'string' ? parseFloat(val) || 0 : val)
            };
          });
        }
      }
    } else if (['pie', 'doughnut', 'polarArea'].includes(chartConfig.type)) {
      // For these chart types, we typically need labels and a single data series
      if (newData.length >= 2) {
        if (updatedConfig.data) {
          updatedConfig.data.labels = newData[0];
          
          // Get data from the second row
          const dataValues = newData[1].map(val => 
            typeof val === 'string' ? parseFloat(val) || 0 : val
          );
          
          // Update or create the dataset
          if (updatedConfig.data.datasets && updatedConfig.data.datasets.length > 0) {
            updatedConfig.data.datasets[0].data = dataValues;
          } else {
            updatedConfig.data.datasets = [{
              data: dataValues,
              backgroundColor: dataValues.map((_, idx) => {
                const hue = (idx * 137.5) % 360;
                return `hsla(${hue}, 70%, 60%, 0.7)`;
              })
            }];
          }
        }
      }
    } else if (chartConfig.type === 'scatter') {
      // For scatter plots, we need pairs of x,y values
      if (updatedConfig.data && updatedConfig.data.datasets) {
        updatedConfig.data.datasets = [{
          ...updatedConfig.data.datasets[0],
          data: newData.slice(1).map(row => ({
            x: typeof row[0] === 'string' ? parseFloat(row[0]) || 0 : row[0],
            y: typeof row[1] === 'string' ? parseFloat(row[1]) || 0 : row[1]
          }))
        }];
      }
    }
    
    return updatedConfig;
  };

  // Inside your Home component, add this function before the return statement
  const checkSpreadsheetDependencies = async (spreadsheetId) => {
    if (!user || !spreadsheetId) {
      return [];
    }
    
    try {
      console.log("Checking if spreadsheet has dashboard dependencies:", spreadsheetId);
      
      // Query for dashboards that use this spreadsheet
      const dashboardsRef = collection(db, 'dashboards');
      const q = firestoreQuery(dashboardsRef, firestoreWhere('ownerId', '==', user.uid));
      
      const querySnapshot = await getDocs(q);
      const dependentDashboards = [];
      
      querySnapshot.forEach((doc) => {
        const dashboard = doc.data();
        const items = dashboard.items || [];
        
        // Check if any item uses this spreadsheet as a source
        const usesSpreadsheet = items.some(item => {
          const itemSpreadsheetId = 
            item.sourceInfo?.spreadsheetId || 
            item.sourceSpreadsheetId || 
            item.chartConfig?.sourceInfo?.spreadsheetId;
          
          return itemSpreadsheetId === spreadsheetId;
        });
        
        if (usesSpreadsheet) {
          dependentDashboards.push({
            id: doc.id,
            title: dashboard.title || 'Untitled Dashboard',
            itemCount: items.length
          });
        }
      });
      
      console.log("Found dependent dashboards:", dependentDashboards.length);
      return dependentDashboards;
    } catch (error) {
      console.error("Error checking spreadsheet dependencies:", error);
      return [];
    }
  };

  // Also add this function inside the Home component
  const createNewSpreadsheetFromFile = (file) => {
    // First reset the current spreadsheet ID to create a new one
    setSpreadsheetId(null);
    
    // Then import the file
    handleFileImport(file);
  };

  // Add this component function inside your spreadsheet.js file but outside your main component
  const SheetTabs = ({ sheets, activeSheetId, onChangeSheet, onAddSheet }) => {
    return (
      <div style={{
        display: 'flex',
        padding: '4px 8px',
        backgroundColor: '#f5f5f5',
        borderTop: '1px solid #ddd'
      }}>
        <div style={{ display: 'flex', overflow: 'auto', flex: 1 }}>
          {sheets.map(sheet => (
            <div 
              key={sheet.id}
              onClick={() => onChangeSheet(sheet.id)}
              style={{
                padding: '8px 16px',
                borderRight: '1px solid #ddd',
                borderBottom: sheet.id === activeSheetId ? '2px solid #4F46E5' : '2px solid transparent',
                backgroundColor: sheet.id === activeSheetId ? 'white' : 'transparent',
                cursor: 'pointer',
                fontWeight: sheet.id === activeSheetId ? '500' : 'normal'
              }}
            >
              {sheet.name}
            </div>
          ))}
        </div>
        <button
          onClick={onAddSheet}
          style={{
            marginLeft: '8px',
            padding: '4px 12px',
            backgroundColor: '#4F46E5',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          + Add Sheet
        </button>
      </div>
    );
  };

  // Add these functions to your main component
  const addSheet = () => {
    const newSheet = {
      id: `sheet_${Date.now()}`,
      name: `Sheet ${sheets.length + 1}`,
      data: [['', '', '', ''], ['', '', '', '']]
    };
    setSheets([...sheets, newSheet]);
    setActiveSheetId(newSheet.id);
    
    // Load empty data into the spreadsheet
    if (hotRef.current) {
      hotRef.current.hotInstance.loadData(newSheet.data);
      setData(newSheet.data);
    }
  };
  
  const handleSheetChange = (sheetId) => {
    // First save current sheet data
    if (hotRef.current) {
      const currentData = hotRef.current.hotInstance.getData();
      setSheets(prevSheets => prevSheets.map(sheet => 
        sheet.id === activeSheetId ? {...sheet, data: currentData} : sheet
      ));
    }
    
    // Switch to new sheet
    setActiveSheetId(sheetId);
    
    // Load new sheet data
    const selectedSheet = sheets.find(sheet => sheet.id === sheetId);
    if (selectedSheet && hotRef.current) {
      hotRef.current.hotInstance.loadData(selectedSheet.data);
      setData(selectedSheet.data);
    }
  };

  // Add this useEffect
  useEffect(() => {
    // Initialize sheets with data if not already done
    if (sheets.length === 0 && data.length > 0) {
      setSheets([{ id: 'default', name: 'Main Sheet', data }]);
      setActiveSheetId('default');
    }
  }, [data]);

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.logo}>📊</div>
          <div className={styles.titleArea}>
            <input 
              type="text" 
              value={documentTitle}
              onChange={(e) => setDocumentTitle(e.target.value)}
              className={styles.titleInput}
            />
            <div className={styles.subtitle}>
              <span>File</span>
              <span className={styles.separator}>·</span>
              <span>
                {lastSaved ? (
                  `Last edit ${formatTimeAgo(lastSaved)}`
                ) : (
                  'Not saved yet'
                )}
              </span>
            </div>
          </div>
        </div>
        
        <div className={styles.headerRight}>
          <button 
            onClick={() => setShowAiPanel(!showAiPanel)}
            className={styles.aiButton}
          >
            <span className={styles.aiIcon}>🧠</span>
            <span>Ask AI</span>
          </button>
          
          <button 
            onClick={() => setShowDataInspector(!showDataInspector)}
            className={`${styles.aiButton} ${showDataInspector ? styles.active : ''}`}
          >
            <span className={styles.aiIcon}>📊</span>
            <span>Data Inspector</span>
          </button>
          
          <button 
            onClick={saveSpreadsheet}
            className={styles.saveButton}
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <div className={styles.buttonSpinner}></div>
                Saving...
              </>
            ) : (
              <>
                <svg className={styles.saveIcon} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M7.707 10.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V6h5a2 2 0 012 2v7a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2h5v5.586l-1.293-1.293zM9 4a1 1 0 012 0v2H9V4z" />
                </svg>
                Save
              </>
            )}
          </button>
        </div>
      </header>

      {/* Menu Bar */}
      <nav className={styles.menuBar}>
        <FileImport 
          onFileImport={handleFileImport}
          onExportCsv={handleExportCsv}
          onExportExcel={handleExportExcel}
          spreadsheetId={spreadsheetId}
          checkDependencies={checkSpreadsheetDependencies}
          createNewSpreadsheet={createNewSpreadsheetFromFile}
        />
        
        <button className={styles.menuItem}>Edit</button>
        <button className={styles.menuItem}>View</button>
        <button className={styles.menuItem}>Insert</button>
        <button className={styles.menuItem}>Format</button>
        <button className={styles.menuItem}>Data</button>
        <button className={styles.menuItem}>Tools</button>
        <button className={styles.menuItem}>Help</button>
        <div className={styles.menuItemWithDropdown}>
          <button 
            className={`${styles.menuItem} ${showAdvancedMenu ? styles.active : ''}`}
            onClick={() => setShowAdvancedMenu(!showAdvancedMenu)}
          >
            Advanced
          </button>
          
          {showAdvancedMenu && (
            <div className={styles.dropdownMenu}>
              <button 
                className={styles.dropdownItem}
                onClick={() => {
                  setShowAdvancedMenu(false);
                  setShowAdvancedPanel(true);
                  setAdvancedOperation('matrix');
                }}
              >
                Matrix Operations
              </button>
              
              <button 
                className={styles.dropdownItem}
                onClick={() => {
                  setShowAdvancedMenu(false);
                  setShowAdvancedPanel(true);
                  setAdvancedOperation('pca');
                }}
              >
                Principal Component Analysis
              </button>
              
              <button 
                className={styles.dropdownItem}
                onClick={() => {
                  setShowAdvancedMenu(false);
                  setShowAdvancedPanel(true);
                  setAdvancedOperation('correlation');
                }}
              >
                Correlation Analysis
              </button>
              
              <button 
                className={styles.dropdownItem}
                onClick={() => {
                  setShowAdvancedMenu(false);
                  setShowAdvancedPanel(true);
                  setAdvancedOperation('statistics');
                }}
              >
                Descriptive Statistics
              </button>
              
              <button 
                className={styles.dropdownItem}
                onClick={() => {
                  setShowAdvancedMenu(false);
                  setShowAdvancedPanel(true);
                  setAdvancedOperation('regression');
                }}
              >
                Regression Models
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarGroup}>
          <button onClick={addRow} className={styles.toolbarButton}>
            Add Row
          </button>
          <button onClick={addColumn} className={styles.toolbarButton}>
            Add Column
          </button>
          
          <select 
            className={styles.toolbarSelect}
            value={testChartType}
            onChange={(e) => setTestChartType(e.target.value)}
          >
            <option value="bar">Bar Chart</option>
            <option value="line">Line Chart</option>
            <option value="pie">Pie Chart</option>
            <option value="doughnut">Doughnut Chart</option>
            <option value="polarArea">Polar Area</option>
            <option value="radar">Radar</option>
          </select>
          
          <button 
            onClick={() => {
              if (!hotRef.current) return;
              
              const hot = hotRef.current.hotInstance;
              const currentData = hot.getData();
              
              // Filter out rows that are completely empty
              const filteredData = currentData.filter(row => row.some(cell => cell !== ''));
              
              if (filteredData.length < 2) {
                alert('Please add some data to your spreadsheet first.');
                return;
              }
              
              // Get the first row as labels (excluding empty cells)
              const labels = filteredData[0].filter(cell => cell !== '');
              
              // For pie charts we need a single dataset
              if (['pie', 'doughnut', 'polarArea'].includes(testChartType)) {
                // Get the second row as data values (only for the columns with labels)
                const dataValues = filteredData[1].slice(0, labels.length).map(val => {
                  return parseFloat(val) || 0;
                });
                
                // Generate colors
                const colors = labels.map((_, index) => {
                  const hue = (index * 137.5) % 360;
                  return `hsla(${hue}, 70%, 60%, 0.7)`;
                });
                
                const testConfig = {
                  type: testChartType,
                  data: {
                    labels: labels,
                    datasets: [{
                      data: dataValues,
                      backgroundColor: colors,
                      borderColor: colors,
                      borderWidth: 1
                    }]
                  },
                  options: {
                    responsive: true,
                    plugins: {
                      title: {
                        display: true,
                        text: 'Chart from Spreadsheet Data'
                      },
                      legend: {
                        position: 'top',
                      }
                    }
                  }
                };
                
                setChartConfig(testConfig);
                setShowChartModal(true);
              } else {
                // For other chart types, we can handle multiple datasets
                // First column can be labels
                const rowLabels = filteredData.slice(1).map(row => row[0] || '');
                
                // Create datasets from the rest of the columns
                const datasets = [];
                for (let colIndex = 1; colIndex < labels.length; colIndex++) {
                  const dataPoints = filteredData.slice(1).map(row => {
                    return parseFloat(row[colIndex]) || 0;
                  });
                  
                  const hue = ((colIndex - 1) * 137.5) % 360;
                  const color = `hsla(${hue}, 70%, 60%, 0.7)`;
                  
                  datasets.push({
                    label: labels[colIndex],
                    data: dataPoints,
                    backgroundColor: color,
                    borderColor: color,
                    borderWidth: 1
                  });
                }
                
                const testConfig = {
                  type: testChartType,
                  data: {
                    labels: rowLabels,
                    datasets: datasets
                  },
                  options: {
                    responsive: true,
                    plugins: {
                      title: {
                        display: true,
                        text: 'Chart from Spreadsheet Data'
                      },
                      legend: {
                        position: 'top',
                      }
                    },
                    scales: {
                      y: {
                        beginAtZero: true
                      }
                    }
                  }
                };
                
                setChartConfig(testConfig);
                setShowChartModal(true);
              }
            }}
            className={styles.toolbarButton}
          >
            Chart Current Data
          </button>
          <button 
            className={styles.toolbarButton}
            onClick={() => setShowCleaningTools(!showCleaningTools)}
          >
            Data Cleaning ▾
          </button>
          
          {showCleaningTools && (
            <div className={styles.dropdownMenu}>
              <button 
                className={styles.dropdownItem}
                onClick={() => {
                  if (!hotRef.current || selectedColumn === null) return;
                  
                  const hot = hotRef.current.hotInstance;
                  const newData = [...data];
                  
                  // Remove empty rows
                  for (let row = 1; row < newData.length; row++) {
                    if (newData[row][selectedColumn] === '') {
                      newData[row][selectedColumn] = null;
                    }
                  }
                  
                  setData(newData);
                  hot.loadData(newData);
                }}
              >
                Remove Empty Cells
              </button>
              <button 
                className={styles.dropdownItem}
                onClick={() => {
                  if (!hotRef.current || selectedColumn === null) return;
                  
                  const hot = hotRef.current.hotInstance;
                  const newData = [...data];
                  const columnData = newData.slice(1).map(row => row[selectedColumn]);
                  
                  // Get numeric values
                  const numericValues = columnData
                    .filter(val => val !== null && val !== '' && !isNaN(parseFloat(val)))
                    .map(val => parseFloat(val));
                  
                  if (numericValues.length === 0) {
                    alert('No numeric values found in this column');
                    return;
                  }
                  
                  // Calculate mean and standard deviation
                  const mean = numericValues.reduce((sum, val) => sum + val, 0) / numericValues.length;
                  const stdDev = Math.sqrt(
                    numericValues.map(val => Math.pow(val - mean, 2))
                      .reduce((sum, val) => sum + val, 0) / numericValues.length
                  );
                  
                  // Remove outliers (values more than 2 standard deviations from mean)
                  for (let row = 1; row < newData.length; row++) {
                    const val = parseFloat(newData[row][selectedColumn]);
                    if (!isNaN(val) && Math.abs(val - mean) > 2 * stdDev) {
                      newData[row][selectedColumn] = null;
                    }
                  }
                  
                  setData(newData);
                  hot.loadData(newData);
                }}
              >
                Remove Outliers
              </button>
              <button 
                className={styles.dropdownItem}
                onClick={() => {
                  if (!hotRef.current || selectedColumn === null) return;
                  
                  const hot = hotRef.current.hotInstance;
                  const newData = [...data];
                  const columnData = newData.slice(1).map(row => row[selectedColumn]);
                  
                  // Get numeric values
                  const numericValues = columnData
                    .filter(val => val !== null && val !== '' && !isNaN(parseFloat(val)))
                    .map(val => parseFloat(val));
                  
                  if (numericValues.length === 0) {
                    alert('No numeric values found in this column');
                    return;
                  }
                  
                  // Calculate mean
                  const mean = numericValues.reduce((sum, val) => sum + val, 0) / numericValues.length;
                  
                  // Fill missing values with mean
                  for (let row = 1; row < newData.length; row++) {
                    if (newData[row][selectedColumn] === '' || newData[row][selectedColumn] === null) {
                      newData[row][selectedColumn] = mean.toFixed(2);
                    }
                  }
                  
                  setData(newData);
                  hot.loadData(newData);
                }}
              >
                Fill Missing Values
              </button>
            </div>
          )}
          <button 
            className={styles.toolbarButton}
            onClick={() => setShowTemplates(!showTemplates)}
          >
            Templates
          </button>
          <button 
            onClick={handleOpenForecastPanel}
            className={styles.toolbarButton}
            title="Time Series Forecast"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
              <path d="M7.5 1.018a7 7 0 0 0-4.79 11.566L7.5 7.793V1.018zm1 0v6.775l4.79 4.79A7 7 0 0 0 8.5 1.018zm4.084 12.273-4.79-4.79v-1.568l6.36 6.36a6.98 6.98 0 0 1-1.57.028zM1.018 8.5h1.57l6.36 6.36A6.98 6.98 0 0 1 7.5 16a6.98 6.98 0 0 1-6.482-4.032zM1 7.5a6.5 6.5 0 1 1 13 0 6.5 6.5 0 0 1-13 0z"/>
            </svg>
            Forecast
          </button>
        </div>
        
        <ChartToolbar onCreateChart={createChart} />
      </div>

      {/* Main Content */}
      <div className={styles.contentArea}>
        {/* This wrapper will ensure proper layout */}
        <div className={styles.contentWrapper}>
          {/* Main spreadsheet area */}
          <div className={styles.mainContentLayout} style={{ 
            width: showAiPanel ? `calc(100% - ${aiPanelWidth}px)` : '100%' 
          }}>
            <div className={styles.spreadsheetContainer}>
              <div className={styles.formulaBar}>
                <span className={styles.cellReference}>
                  {selectedCell ? `${String.fromCharCode(65 + selectedCell.col)}${selectedCell.row + 1}` : ''}
                </span>
                <input
                  type="text"
                  className={styles.formulaInput}
                  value={
                    selectedCell && hotRef.current
                      ? hotRef.current.hotInstance.getDataAtCell(selectedCell.row, selectedCell.col) || ''
                      : ''
                  }
                  onChange={(e) => {
                    if (selectedCell && hotRef.current) {
                      hotRef.current.hotInstance.setDataAtCell(selectedCell.row, selectedCell.col, e.target.value);
                    }
                  }}
                  placeholder="Enter value or formula..."
                />
              </div>
      <HotTable
        ref={hotRef}
        data={data}
        colHeaders={data.length > 0 ? data[0] : true}
        rowHeaders={true}
        width="100%"
        height="calc(100% - 40px)" /* Make room for tabs */
        licenseKey="non-commercial-and-evaluation"
        contextMenu={true}
        manualColumnResize={true}
        manualRowResize={true}
        comments={true}
        filters={true}
        columnSorting={true}
        dropdownMenu={true}
        stretchH="all"
        afterSelectionEnd={(row, col) => {
          setSelectedCell({ row, col });
          setSelectedColumn(col);
        }}
        afterChange={(changes, source) => {
          // Only update when the user manually edits data
          if (source === 'edit' && changes && changes.length > 0) {
            // Get a copy of current data
            const newData = JSON.parse(JSON.stringify(data));
            
            // Apply the changes
            changes.forEach(([row, col, oldValue, newValue]) => {
              if (newData[row]) {
                newData[row][col] = newValue;
              }
            });
            
            // Update the state with the new data
            setData(newData);
            
            // If we have an open spreadsheet, update any dashboards that depend on it
            if (spreadsheetId) {
              // Wait a moment for state to update, then auto-save and update dashboards
              setTimeout(() => {
                autoSaveSpreadsheet().then(() => {
                  console.log("Triggering dashboard updates after data change");
                  updateDependentDashboards();
                });
              }, 300);
            }
          }
        }}
      />
      
      {/* Add SheetTabs component here */}
      <SheetTabs
        sheets={sheets}
        activeSheetId={activeSheetId}
        onChangeSheet={handleSheetChange}
        onAddSheet={addSheet}
      />
            </div>
            
            {showDataInspector && (
              <div className={styles.dataInspectorContainer}>
                <DataInspector
                  selectedColumn={selectedColumn}
                  data={data}
                />
                <button 
                  className={styles.refreshButton}
                  onClick={() => {
                    if (hotRef?.current) {
                      dataSnapshotRef.current = hotRef.current.hotInstance.getData();
                      // Re-run your analysis
                      analyzeColumns();
                    }
                  }}
                >
                  Refresh Data
                </button>
                <button 
                  className="saveButton"
                  onClick={() => {
                    if (hotRef?.current?.hotInstance) {
                      const currentData = hotRef.current.hotInstance.getData();
                      // Use a simple flag to prevent recursive updates
                      const updatingRef = hotRef.current.updating;
                      if (!updatingRef) {
                        hotRef.current.updating = true;
                        setData(currentData);
                        setTimeout(() => {
                          hotRef.current.updating = false;
                        }, 100);
                      }
                    }
                  }}
                >
                  Save Changes
                </button>
              </div>
            )}
          </div>
          
          {/* AI Panel */}
          {showAiPanel && (
            <div 
              className={styles.aiPanelContainer} 
              style={{ width: `${aiPanelWidth}px` }}
            >
              <div 
                className={styles.resizeHandle}
                onMouseDown={startResizing}
              ></div>
              <AIPanel 
                query={query}
                setQuery={setQuery}
                aiResponse={aiResponse}
                onAskAI={handleAskAI}
                onClose={() => setShowAiPanel(false)}
                hotRef={hotRef}
              />
            </div>
          )}
        </div>
      </div>

      {/* Chart Modal */}
      {showChartModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.chartModal}>
            <div className={styles.modalHeader}>
              <h3>Chart Preview</h3>
              <div className={styles.modalActions}>
                <button 
                  className={styles.menuButton}
                  onClick={() => setShowChartMenu(!showChartMenu)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M9.5 13a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0-5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0-5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z"/>
                  </svg>
                </button>
                {showChartMenu && (
                  <div className={styles.chartMenu}>
                    <button 
                      className={styles.chartMenuItem}
                      onClick={() => {
                        setShowChartMenu(false);
                        setShowAddToDashboardModal(true);
                      }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M0 2a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2zm15 0a1 1 0 0 0-1-1H2a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V2z"/>
                        <path d="M2 3.5a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5zm0 3a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5zm0 3a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5zm8-6a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5zm0 3a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5zm0 3a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5z"/>
                      </svg>
                      Add to Dashboard
                    </button>
                    <button 
                      className={styles.chartMenuItem}
                      onClick={exportChart}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
                        <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
                      </svg>
                      Export as PNG
                    </button>
                  </div>
                )}
                <button 
                  onClick={() => setShowChartModal(false)}
                  className={styles.closeButton}
                >
                  ×
                </button>
              </div>
            </div>
            <div className={styles.chartContainer}>
              <canvas ref={chartRef}></canvas>
            </div>
            <div className={styles.modalFooter}>
              <button 
                onClick={() => setShowAddToDashboardModal(true)}
                className={styles.dashboardButton}
              >
                <svg className={styles.dashboardIcon} xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M0 2a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2zm15 0a1 1 0 0 0-1-1H2a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V2z"/>
                  <path d="M2 3.5a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5zm0 3a.5.5 0 0 1 .5-.5h8a.5.5 0 0 1 0 1h-8a.5.5 0 0 1-.5-.5zm0 3a.5.5 0 0 1 .5-.5h4a.5.5 0 0 1 0 1h-4a.5.5 0 0 1-.5-.5zm8-6a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5zm0 3a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5zm0 3a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5z"/>
                </svg>
                Add to Dashboard
              </button>
              <button 
                onClick={exportChart}
                className={styles.exportButton}
              >
                Export as PNG
              </button>
              <button 
                onClick={() => setShowChartModal(false)}
                className={styles.closeModalButton}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showTemplates && (
        <div className={styles.templatesModal}>
          <div className={styles.modalHeader}>
            <h3>Template Gallery</h3>
        <button
              onClick={() => setShowTemplates(false)}
              className={styles.closeButton}
        >
              ×
        </button>
          </div>
          <div className={styles.templateGrid}>
            <div 
              className={styles.templateCard}
              onClick={() => {
                // Sample data for A/B test template
                const abTestData = [
                  ['Group', 'Visitors', 'Conversions', 'Conversion Rate', 'Revenue'],
                  ['Control', 5000, 150, '3.0%', 7500],
                  ['Variant A', 4800, 168, '3.5%', 8400],
                  ['Variant B', 5100, 204, '4.0%', 10200],
                  ['', '', '', '', ''],
                ];
                
                setData(abTestData);
                if (hotRef.current) {
                  hotRef.current.hotInstance.loadData(abTestData);
                }
                setShowTemplates(false);
              }}
            >
              <h4>A/B Test Results</h4>
              <p>Template for analyzing experiment results</p>
            </div>
            
            <div 
              className={styles.templateCard}
              onClick={() => {
                // Sample data for cohort analysis
                const cohortData = [
                  ['Cohort', 'Month 0', 'Month 1', 'Month 2', 'Month 3'],
                  ['Jan 2023', '100%', '65%', '42%', '38%'],
                  ['Feb 2023', '100%', '70%', '45%', ''],
                  ['Mar 2023', '100%', '68%', '', ''],
                  ['Apr 2023', '100%', '', '', ''],
                  ['', '', '', '', ''],
                ];
                
                setData(cohortData);
                if (hotRef.current) {
                  hotRef.current.hotInstance.loadData(cohortData);
                }
                setShowTemplates(false);
              }}
            >
              <h4>Cohort Analysis</h4>
              <p>Track retention across different cohorts</p>
            </div>
            
            <div 
              className={styles.templateCard}
              onClick={() => {
                // Sample data for sales forecasting
                const forecastData = [
                  ['Month', 'Sales ($)', 'Marketing Spend ($)', 'Season'],
                  ['Jan 2023', 32500, 5000, 'Winter'],
                  ['Feb 2023', 36000, 5200, 'Winter'],
                  ['Mar 2023', 42000, 5500, 'Spring'],
                  ['Apr 2023', 45000, 5800, 'Spring'],
                  ['May 2023', 48000, 6000, 'Spring'],
                  ['Jun 2023', 52000, 6200, 'Summer'],
                  ['', '', '', ''],
                ];
                
                setData(forecastData);
                if (hotRef.current) {
                  hotRef.current.hotInstance.loadData(forecastData);
                }
                setShowTemplates(false);
              }}
            >
              <h4>Sales Forecast</h4>
              <p>Analyze and predict sales performance</p>
            </div>
            
            <div 
              className={styles.templateCard}
              onClick={() => {
                // Sample data for matrix operations testing
                const matrixData = [
                  ['', 'Col A1', 'Col A2', 'Col A3', 'Col B1', 'Col B2', 'Col B3'],
                  ['Row 1', 1, 4, 7, 2, 5, 8],
                  ['Row 2', 2, 5, 8, 4, 6, 10],
                  ['Row 3', 3, 6, 9, 6, 7, 12],
                  ['Row 4', 10, 11, 12, 9, 8, 7],
                  ['Row 5', 13, 14, 15, 6, 5, 4],
                  ['', '', '', '', '', '', ''],
                ];
                
                setData(matrixData);
                if (hotRef.current) {
                  hotRef.current.hotInstance.loadData(matrixData);
                }
                setShowTemplates(false);
              }}
            >
              <h4>Matrix Operations Test</h4>
              <p>Data for testing matrix calculations</p>
            </div>
            
            <div 
              className={styles.templateCard}
              onClick={() => {
                // Sample data specifically designed for eigenvalue analysis
                const eigenvalueTestData = [
                  ['', 'Matrix Col 1', 'Matrix Col 2', 'Matrix Col 3', 'Values'],
                  ['Row 1', 4, 2, 1, 100],
                  ['Row 2', 2, 5, 3, 200],
                  ['Row 3', 1, 3, 6, 300],
                  ['Analysis', 'Symmetric', 'Positive Definite', 'Real Eigenvalues', ''],
                  ['', '', '', '', ''],
                  ['Simple 2x2', 2, 1, '', ''],
                  ['', 1, 3, '', ''],
                  ['', '', '', '', ''],
                  ['Rotation', 0, -1, '', ''],
                  ['', 1, 0, '', ''],
                  ['', '', '', '', ''],
                ];
                
                setData(eigenvalueTestData);
                if (hotRef.current) {
                  hotRef.current.hotInstance.loadData(eigenvalueTestData);
                }
                setShowTemplates(false);
              }}
            >
              <h4>Eigenvalue Analysis</h4>
              <p>Special matrices to test eigenvalues and eigenvectors</p>
            </div>
            
            <div 
              className={styles.templateCard}
              onClick={() => {
                // Sample data designed for PCA analysis
                const pcaTestData = [
                  ['Sample', 'Height', 'Weight', 'Age', 'Income', 'Education'],
                  ['P1', 175, 70, 32, 65000, 16],
                  ['P2', 182, 85, 45, 120000, 20],
                  ['P3', 168, 65, 27, 45000, 16],
                  ['P4', 173, 72, 29, 70000, 18],
                  ['P5', 165, 58, 51, 95000, 16],
                  ['P6', 179, 78, 36, 85000, 21],
                  ['P7', 163, 55, 23, 35000, 14],
                  ['P8', 177, 76, 33, 78000, 17],
                  ['P9', 171, 69, 39, 92000, 19],
                  ['P10', 180, 83, 41, 110000, 18],
                  ['', '', '', '', '', ''],
                  ['Info', 'cm', 'kg', 'years', 'USD', 'years'],
                ];
                
                setData(pcaTestData);
                if (hotRef.current) {
                  hotRef.current.hotInstance.loadData(pcaTestData);
                }
                setShowTemplates(false);
              }}
            >
              <h4>PCA Analysis</h4>
              <p>Dataset for dimensionality reduction and feature correlation</p>
            </div>
            
            <div 
              className={styles.templateCard}
              onClick={() => {
                // Sample data designed for correlation analysis
                const correlationData = [
                  ['Player', 'Points', 'Rebounds', 'Assists', 'Steals', 'Blocks'],
                  ['Player 1', 28.4, 6.2, 8.7, 1.4, 0.5],
                  ['Player 2', 25.3, 10.8, 2.1, 1.1, 2.3],
                  ['Player 3', 18.2, 4.5, 7.3, 2.0, 0.2],
                  ['Player 4', 12.5, 8.2, 3.5, 1.5, 1.9],
                  ['Player 5', 22.1, 7.1, 5.8, 1.8, 0.8],
                  ['Player 6', 15.6, 9.4, 1.2, 0.9, 2.1],
                  ['Player 7', 19.8, 3.2, 9.5, 1.7, 0.3],
                  ['Player 8', 10.2, 6.5, 6.2, 1.2, 0.7],
                  ['', '', '', '', '', ''],
                  ['Stat Type', 'Scoring', 'Rebounding', 'Playmaking', 'Defense', 'Defense'],
                ];
                
                setData(correlationData);
                if (hotRef.current) {
                  hotRef.current.hotInstance.loadData(correlationData);
                }
                setShowTemplates(false);
              }}
            >
              <h4>Correlation Analysis</h4>
              <p>Dataset for exploring relationships between variables</p>
            </div>
            
            <div 
              className={styles.templateCard}
              onClick={() => {
                // Sample data for time series forecasting
                const timeSeriesData = [
                  ['Date', 'Sales'],
                  ['2023-01-01', 1200],
                  ['2023-01-02', 1250],
                  ['2023-01-03', 1180],
                  ['2023-01-04', 1300],
                  ['2023-01-05', 1220],
                  ['2023-01-06', 950],
                  ['2023-01-07', 850],
                  ['2023-01-08', 1210],
                  ['2023-01-09', 1280],
                  ['2023-01-10', 1220],
                  ['2023-01-11', 1340],
                  ['2023-01-12', 1270],
                  ['2023-01-13', 980],
                  ['2023-01-14', 890],
                  ['2023-01-15', 1240],
                  ['2023-01-16', 1320],
                  ['2023-01-17', 1280],
                  ['2023-01-18', 1390],
                  ['2023-01-19', 1330],
                  ['2023-01-20', 1100],
                  ['2023-01-21', 950],
                  ['2023-01-22', 1270],
                  ['2023-01-23', 1350],
                  ['2023-01-24', 1310],
                  ['2023-01-25', 1420],
                  ['2023-01-26', 1350],
                  ['2023-01-27', 1150],
                  ['2023-01-28', 1050],
                  ['2023-01-29', 1320],
                  ['2023-01-30', 1400],
                ];
                
                setData(timeSeriesData);
                if (hotRef.current) {
                  hotRef.current.hotInstance.loadData(timeSeriesData);
                }
                setShowTemplates(false);
              }}
            >
              <h4>Time Series Forecast</h4>
              <p>Daily sales data with weekly patterns for forecasting</p>
            </div>
            
            <div 
              className={styles.templateCard}
              onClick={() => {
                // Sample data for regression analysis with clear patterns
                const regressionData = [
                  ['X1', 'X2', 'Temperature', 'Sales', 'Category'],
                  [1, 5, 20, 100, 'A'],
                  [2, 6, 22, 150, 'A'],
                  [3, 7, 24, 200, 'A'],
                  [4, 8, 26, 250, 'A'],
                  [5, 9, 28, 300, 'B'],
                  [6, 10, 30, 350, 'B'],
                  [7, 11, 32, 390, 'B'],
                  [8, 12, 34, 420, 'B'],
                  [9, 13, 36, 440, 'C'],
                  [10, 14, 38, 450, 'C'],
                  [11, 15, 40, 440, 'C'],
                  [12, 16, 42, 420, 'C'],
                  [13, 17, 44, 390, 'D'],
                  [14, 18, 46, 350, 'D'],
                  [15, 19, 48, 300, 'D'],
                  [16, 20, 50, 250, 'D'],
                  ['', '', '', '', ''],
                  ['Info', 'Linear Regression', 'X1→Sales', 'R²=0.92', ''],
                  ['', 'Polynomial', 'Temp→Sales', 'Quad. pattern', ''],
                  ['', 'Multiple Reg.', 'X1+X2→Sales', 'VIF test', ''],
                  ['', '', '', '', ''],
                ];
                
                setData(regressionData);
                if (hotRef.current) {
                  hotRef.current.hotInstance.loadData(regressionData);
                }
                setShowTemplates(false);
              }}
            >
              <h4>Regression Analysis</h4>
              <p>Dataset for testing various regression models</p>
            </div>
            
            <div 
              className={styles.templateCard}
              onClick={() => {
                // Sample data for logistic regression analysis with binary outcome
                const logisticData = [
                  ['Age', 'Income', 'Education', 'CreditScore', 'Approved'],
                  [25, 45000, 12, 680, 0],
                  [35, 60000, 16, 720, 1],
                  [45, 55000, 14, 710, 1],
                  [22, 30000, 12, 590, 0],
                  [28, 48000, 16, 640, 0],
                  [52, 95000, 18, 820, 1],
                  [41, 70000, 16, 750, 1],
                  [31, 52000, 14, 680, 1],
                  [38, 65000, 16, 730, 1],
                  [24, 35000, 12, 610, 0],
                  [29, 51000, 14, 660, 0],
                  [43, 80000, 16, 770, 1],
                  [50, 85000, 14, 730, 1],
                  [27, 42000, 12, 620, 0],
                  [33, 58000, 16, 700, 1],
                  [48, 90000, 18, 800, 1],
                  [23, 32000, 12, 600, 0],
                  [36, 62000, 16, 720, 1],
                  [44, 78000, 14, 760, 1],
                  [26, 40000, 12, 630, 0],
                  [42, 75000, 16, 750, 1],
                  [39, 68000, 14, 730, 1],
                  [47, 88000, 16, 790, 1],
                  [30, 50000, 14, 650, 0],
                  [32, 56000, 16, 690, 1],
                  [46, 82000, 18, 780, 1],
                  [34, 59000, 14, 710, 1],
                  [37, 64000, 16, 720, 1],
                  [49, 92000, 18, 810, 1],
                  ['', '', '', '', ''],
                  ['Reference', 'Years', 'USD', 'Years', 'Credit Score'],
                  ['Range', '22-52', '30k-95k', '12-18', '590-820'],
                  ['Target', '', '', '', 'Loan Approval (0/1)'],
                ];
                
                setData(logisticData);
                if (hotRef.current) {
                  hotRef.current.hotInstance.loadData(logisticData);
                }
                setShowTemplates(false);
              }}
            >
              <h4>Logistic Regression</h4>
              <p>Binary classification dataset for loan approval modeling</p>
            </div>
            
            <div 
              className={styles.templateCard}
              onClick={() => {
                // Sample data for medical diagnostic logistic regression model
                const medicalDiagnosticData = [
                  ['Age', 'BMI', 'Glucose', 'BloodPressure', 'Insulin', 'Diagnosis'],
                  [28, 23.5, 85, 120, 15, 0],
                  [45, 26.7, 145, 135, 45, 1],
                  [52, 28.3, 165, 140, 55, 1],
                  [31, 22.8, 90, 125, 20, 0],
                  [43, 31.2, 155, 145, 50, 1],
                  [25, 20.5, 80, 115, 10, 0],
                  [48, 29.6, 160, 150, 48, 1],
                  [37, 24.1, 105, 130, 25, 0],
                  [55, 32.4, 180, 155, 60, 1],
                  [29, 21.3, 88, 118, 12, 0],
                  [51, 30.8, 170, 148, 58, 1],
                  [34, 23.7, 95, 128, 18, 0],
                  [42, 27.5, 150, 138, 47, 1],
                  [26, 20.9, 82, 117, 11, 0],
                  [54, 31.5, 175, 152, 56, 1],
                  [39, 25.2, 110, 132, 28, 0],
                  [47, 28.9, 158, 142, 49, 1],
                  [32, 22.1, 92, 122, 16, 0],
                  [56, 33.1, 182, 158, 62, 1],
                  [33, 23.0, 94, 126, 17, 0],
                  [50, 30.2, 168, 145, 52, 1],
                  [38, 24.7, 108, 130, 26, 0],
                  [49, 29.3, 162, 146, 51, 1],
                  [27, 21.0, 84, 116, 13, 0],
                  [44, 27.9, 153, 140, 48, 1],
                  [41, 26.8, 148, 136, 46, 1],
                  [36, 23.9, 100, 129, 21, 0],
                  [53, 31.0, 172, 150, 54, 1],
                  [30, 22.0, 91, 120, 15, 0],
                  ['', '', '', '', '', ''],
                  ['Reference', 'Years', 'kg/m²', 'mg/dL', 'mmHg', 'μU/mL'],
                  ['Note', '', '', '', '', 'Diabetes (0=No, 1=Yes)'],
                ];
                
                setData(medicalDiagnosticData);
                if (hotRef.current) {
                  hotRef.current.hotInstance.loadData(medicalDiagnosticData);
                }
                setShowTemplates(false);
              }}
            >
              <h4>Medical Diagnosis</h4>
              <p>Health metrics dataset for diabetes prediction</p>
            </div>
            
            <div 
              className={styles.templateCard}
              onClick={() => {
                // Sample data for marketing campaign response prediction
                const marketingData = [
                  ['CustomerID', 'Age', 'Income', 'PrevPurchases', 'EmailOpen', 'WebsiteVisits', 'Responded'],
                  [1001, 34, 58000, 3, 12, 8, 1],
                  [1002, 28, 42000, 1, 5, 2, 0],
                  [1003, 45, 75000, 5, 15, 10, 1],
                  [1004, 52, 82000, 4, 8, 4, 0],
                  [1005, 39, 67000, 7, 18, 12, 1],
                  [1006, 31, 45000, 2, 6, 3, 0],
                  [1007, 43, 72000, 6, 14, 9, 1],
                  [1008, 29, 39000, 1, 4, 2, 0],
                  [1009, 47, 78000, 8, 20, 15, 1],
                  [1010, 36, 60000, 3, 7, 5, 0],
                  [1011, 41, 70000, 5, 16, 11, 1],
                  [1012, 33, 52000, 2, 5, 3, 0],
                  [1013, 48, 85000, 9, 22, 16, 1],
                  [1014, 27, 38000, 0, 3, 1, 0],
                  [1015, 44, 73000, 6, 17, 12, 1],
                  [1016, 35, 59000, 3, 8, 6, 0],
                  [1017, 50, 88000, 10, 25, 18, 1],
                  [1018, 30, 44000, 1, 4, 2, 0],
                  [1019, 42, 71000, 7, 19, 13, 1],
                  [1020, 26, 36000, 0, 2, 1, 0],
                  [1021, 49, 86000, 8, 21, 16, 1],
                  [1022, 37, 63000, 4, 10, 7, 1],
                  [1023, 32, 48000, 2, 6, 4, 0],
                  [1024, 46, 80000, 8, 23, 17, 1],
                  [1025, 38, 65000, 5, 13, 9, 1],
                  [1026, 25, 35000, 0, 1, 0, 0],
                  [1027, 51, 90000, 11, 26, 20, 1],
                  [1028, 40, 68000, 6, 15, 10, 1],
                  [1029, 24, 32000, 0, 1, 0, 0],
                  [1030, 53, 92000, 12, 28, 22, 1],
                  ['', '', '', '', '', '', ''],
                  ['Type', 'ID', 'Years', 'USD', 'Count', 'Count', 'Count'],
                  ['Description', '', '', '', '12-month', '30-day', 'Campaign Response'],
                  ['', '', '', '', 'history', 'activity', '(0=No, 1=Yes)'],
                ];
                
                setData(marketingData);
                if (hotRef.current) {
                  hotRef.current.hotInstance.loadData(marketingData);
                }
                setShowTemplates(false);
              }}
            >
              <h4>Marketing Campaign</h4>
              <p>Customer data for campaign response prediction</p>
            </div>
          </div>
        </div>
      )}

      {showAdvancedPanel && (
        <div className={styles.advancedPanelContainer}>
          <div className={styles.advancedPanelHeader}>
            <h2>
              {advancedOperation === 'matrix' && 'Matrix Operations'}
              {advancedOperation === 'pca' && 'Principal Component Analysis'}
              {advancedOperation === 'correlation' && 'Correlation Analysis'}
              {advancedOperation === 'statistics' && 'Statistical Analysis'}
              {advancedOperation === 'regression' && 'Regression Models'}
            </h2>
            <button 
              onClick={() => setShowAdvancedPanel(false)}
              className={styles.closeButton}
            >
              ×
            </button>
          </div>
          <div className={styles.advancedPanelContent}>
            {advancedOperation === 'matrix' && (
              <MatrixOperationsPanel 
                hotRef={hotRef}
                onClose={() => setShowAdvancedPanel(false)}
              />
            )}
            {advancedOperation === 'pca' && (
              <PCAAnalysisPanel 
                hotRef={hotRef}
                onClose={() => setShowAdvancedPanel(false)}
              />
            )}
            {advancedOperation === 'correlation' && (
              <CorrelationAnalysisPanel 
                hotRef={hotRef}
                onClose={() => setShowAdvancedPanel(false)}
              />
            )}
            {advancedOperation === 'statistics' && (
              <div>Statistical analysis tools coming soon...</div>
            )}
            {advancedOperation === 'regression' && (
              <RegressionAnalysisPanel 
                hotRef={hotRef}
                onClose={() => setShowAdvancedPanel(false)}
              />
            )}
          </div>
        </div>
      )}

      {showForecastPanel && (
        <div className={styles.panelOverlay}>
          <div className={styles.panel}>
            <TimeSeriesForecastPanel 
              hotRef={hotRef} 
              onClose={() => setShowForecastPanel(false)} 
            />
          </div>
        </div>
      )}

     

      {/* Add to Dashboard Modal */}
      {showAddToDashboardModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.dashboardModal}>
            <div className={styles.modalHeader}>
              <h3>Add to Dashboard</h3>
              <button 
                onClick={() => setShowAddToDashboardModal(false)}
                className={styles.closeButton}
              >
                ×
              </button>
            </div>
            <div className={styles.dashboardModalContent}>
              {isLoadingDashboards ? (
                <div className={styles.loadingState}>
                  <div className={styles.loadingSpinner}></div>
                  <p>Loading your dashboards...</p>
                </div>
              ) : dashboards.length === 0 ? (
                <div className={styles.emptyDashboardState}>
                  <div className={styles.emptyStateIcon}>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm0 8a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zm12 0a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                    </svg>
                  </div>
                  <h4>No dashboards yet</h4>
                  <p>Create your first dashboard to add this chart</p>
                </div>
              ) : (
                <div className={styles.dashboardsList}>
                  <h4>Select a dashboard:</h4>
                  <div className={styles.dashboardsGrid}>
                    {dashboards.map(dashboard => {
                      // Safely convert lastModified to a Date object
                      const lastModifiedDate = dashboard.lastModified ? 
                        (typeof dashboard.lastModified.toDate === 'function' ? 
                          dashboard.lastModified.toDate() : 
                          new Date(dashboard.lastModified)) : 
                        new Date();
                      
                      return (
                        <div 
                          key={dashboard.id}
                          className={styles.dashboardCard}
                          onClick={() => addChartToDashboard(dashboard.id)}
                        >
                          <div className={styles.dashboardIcon}>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm0 8a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zm12 0a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                            </svg>
                          </div>
                          <div className={styles.dashboardInfo}>
                            <h5>{dashboard.title || 'Untitled Dashboard'}</h5>
                            <p>{dashboard.items?.length || 0} items • Last edited {formatTimeAgo(lastModifiedDate)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              
              <div className={styles.createDashboardSection}>
                <h4>Create a new dashboard:</h4>
                <div className={styles.createDashboardForm}>
                  <input
                    type="text"
                    placeholder="Dashboard name"
                    value={newDashboardTitle}
                    onChange={(e) => setNewDashboardTitle(e.target.value)}
                    className={styles.dashboardInput}
                  />
                  <button 
                    onClick={createAndAddToDashboard}
                    disabled={!newDashboardTitle.trim() || isCreatingDashboard}
                    className={styles.createDashboardButton}
                  >
                    {isCreatingDashboard ? (
                      <>
                        <div className={styles.buttonSpinner}></div>
                        Creating...
                      </>
                    ) : (
                      'Create & Add'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

