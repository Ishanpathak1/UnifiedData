import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../utils/firebase';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import styles from '../../styles/Dashboard.module.css';
import Head from 'next/head';
import Chart from 'chart.js/auto';
import { Responsive, WidthProvider } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { useWindowSize } from '../../hooks/useWindowSize';

// Create responsive grid layout
const ResponsiveGridLayout = WidthProvider(Responsive);

// Add this helper function at the top of your component (or outside it)
const sanitizeForFirestore = (obj) => {
  if (obj === null || obj === undefined) {
    return null;
  }
  
  if (typeof obj !== 'object') {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeForFirestore(item)).filter(item => item !== undefined);
  }
  
  const newObj = {};
  Object.keys(obj).forEach(key => {
    if (obj[key] !== undefined) {
      newObj[key] = sanitizeForFirestore(obj[key]);
    }
  });
  
  return newObj;
};

export default function DashboardView() {
  const router = useRouter();
  const { id } = router.query;
  const { user, loading } = useAuth();
  const [dashboard, setDashboard] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [layouts, setLayouts] = useState({ lg: [] });
  const [isSaving, setIsSaving] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  const { width } = useWindowSize();
  const chartRefs = useRef({});
  const chartInstances = useRef({});

  // Set mounted after component mounts (important for SSR)
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Fetch dashboard data
  useEffect(() => {
    if (!id || !user) return;

    const fetchDashboard = async () => {
      try {
        const docRef = doc(db, 'dashboards', id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.ownerId === user.uid) {
            console.log("Dashboard data:", data);
            setDashboard({
              id: docSnap.id,
              ...data
            });
            
            // Initialize layout from saved positions
            if (data.items && data.items.length > 0) {
              const initialLayout = data.items.map((item, index) => ({
                i: item.id,
                x: item.position?.x ?? (index % 3) * 4,
                y: item.position?.y ?? Math.floor(index / 3) * 4,
                w: item.position?.w ?? 4,
                h: item.position?.h ?? 4,
                minW: 2,
                minH: 2
              }));
              setLayouts({ lg: initialLayout });
            }
          } else {
            alert("You don't have permission to view this dashboard");
            router.push('/dashboard');
          }
        } else {
          alert("Dashboard not found");
          router.push('/dashboard');
        }
      } catch (error) {
        console.error("Error loading dashboard:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboard();
  }, [id, user, router]);

  // Clean up chart instances when component unmounts
  useEffect(() => {
    return () => {
      Object.values(chartInstances.current).forEach(chart => {
        if (chart) {
          try {
            chart.destroy();
          } catch (e) {
            console.error("Error destroying chart:", e);
          }
        }
      });
    };
  }, []);

  // Function to safely parse and prepare chart config
  const prepareChartConfig = (origConfig) => {
    if (!origConfig) {
      console.error("No chart config provided");
      return null;
    }
    
    try {
      // Base config with safe defaults
      const newConfig = {
        type: typeof origConfig.type === 'string' ? origConfig.type : 'bar',
        data: {
          labels: [],
          datasets: []
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'top',
              labels: {
                boxWidth: 15,
                padding: 15,
                font: {
                  size: 11
                }
              }
            },
            title: {
              display: true,
              text: origConfig.options?.plugins?.title?.text || 'Chart',
              font: {
                size: 14,
                weight: 'bold' 
              }
            }
          }
        }
      };
      
      // Extract and clean labels
      if (origConfig.data && origConfig.data.labels) {
        if (Array.isArray(origConfig.data.labels)) {
          newConfig.data.labels = origConfig.data.labels.map(label => 
            label !== null && label !== undefined ? String(label) : ''
          );
        } else if (typeof origConfig.data.labels === 'object') {
          const labelsArray = [];
          Object.keys(origConfig.data.labels).forEach(key => {
            const label = origConfig.data.labels[key];
            if (label !== undefined && label !== null) {
              labelsArray.push(String(label));
            }
          });
          newConfig.data.labels = labelsArray;
        }
      }
      
      // Default colors for different chart types
      const defaultColors = [
        'rgba(255, 99, 132, 0.6)',
        'rgba(54, 162, 235, 0.6)',
        'rgba(255, 206, 86, 0.6)',
        'rgba(75, 192, 192, 0.6)',
        'rgba(153, 102, 255, 0.6)',
        'rgba(255, 159, 64, 0.6)',
        'rgba(201, 203, 207, 0.6)'
      ];
      
      // Extract and clean datasets
      if (origConfig.data && origConfig.data.datasets) {
        let datasetsArray = [];
        
        if (Array.isArray(origConfig.data.datasets)) {
          datasetsArray = origConfig.data.datasets;
        } else if (typeof origConfig.data.datasets === 'object') {
          Object.keys(origConfig.data.datasets).forEach(key => {
            if (origConfig.data.datasets[key]) {
              datasetsArray.push(origConfig.data.datasets[key]);
            }
          });
        }
        
        // Process each dataset based on chart type
        newConfig.data.datasets = datasetsArray
          .filter(ds => ds && typeof ds === 'object')
          .map((dataset, index) => {
            // Base dataset properties
            const cleanDataset = {
              label: typeof dataset.label === 'string' ? dataset.label : `Dataset ${index + 1}`,
              data: []
            };
            
            // Special handling for radar charts
            if (newConfig.type === 'radar') {
              cleanDataset.backgroundColor = dataset.backgroundColor || 'rgba(255, 99, 132, 0.2)';
              cleanDataset.borderColor = dataset.borderColor || 'rgba(255, 99, 132, 1)';
              cleanDataset.borderWidth = dataset.borderWidth || 1;
              cleanDataset.pointBackgroundColor = dataset.pointBackgroundColor || dataset.borderColor || 'rgba(255, 99, 132, 1)';
              cleanDataset.pointBorderColor = dataset.pointBorderColor || '#fff';
              cleanDataset.pointHoverBackgroundColor = dataset.pointHoverBackgroundColor || '#fff';
              cleanDataset.pointHoverBorderColor = dataset.pointHoverBorderColor || 'rgba(255, 99, 132, 1)';
            }
            // For pie/doughnut charts
            else if (newConfig.type === 'pie' || newConfig.type === 'doughnut') {
              cleanDataset.backgroundColor = defaultColors;
              cleanDataset.borderColor = defaultColors.map(color => 
                color.replace('0.6)', '1)')
              );
              cleanDataset.borderWidth = 1;
            } 
            // For other chart types
            else {
              cleanDataset.backgroundColor = dataset.backgroundColor || defaultColors[index % defaultColors.length];
              cleanDataset.borderColor = dataset.borderColor || 
                (typeof dataset.backgroundColor === 'string' ? 
                  dataset.backgroundColor.replace('0.6)', '1)') : 
                  defaultColors[index % defaultColors.length].replace('0.6)', '1)'));
              cleanDataset.borderWidth = dataset.borderWidth || 1;
            }
            
            // Clean data values - ensure they're all numbers
            if (Array.isArray(dataset.data)) {
              cleanDataset.data = dataset.data.map(val => {
                if (val === null || val === undefined) return 0;
                return typeof val === 'number' ? val : parseFloat(val) || 0;
              });
            } else if (typeof dataset.data === 'object' && dataset.data !== null) {
              const dataArray = [];
              Object.keys(dataset.data).forEach(key => {
                const val = dataset.data[key];
                if (val !== undefined && val !== null) {
                  dataArray.push(parseFloat(val) || 0);
                }
              });
              cleanDataset.data = dataArray;
            }
            
            return cleanDataset;
          });
      }
      
      // Special options for radar charts
      if (newConfig.type === 'radar') {
        newConfig.options.scales = {
          r: {
            angleLines: {
              display: true
            },
            suggestedMin: 0,
            ticks: {
              backdropColor: 'rgba(255, 255, 255, 0.75)',
              font: {
                size: 10
              }
            }
          }
        };
      }
      
      return newConfig;
    } catch (error) {
      console.error("Error preparing chart config:", error);
      // Return a safe fallback
      return {
        type: 'bar',
        data: {
          labels: ['No Data'],
          datasets: [{
            label: 'Unable to load data',
            data: [0],
            backgroundColor: 'rgba(200, 200, 200, 0.5)'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false
        }
      };
    }
  };

  // Render the charts after the dashboard data is loaded
  useEffect(() => {
    if (!dashboard || !dashboard.items || !mounted) return;
    
    // Give time for layout to settle
    const timer = setTimeout(async () => {
      // Process each chart
      for (const item of dashboard.items) {
        if (item.type !== 'chart' || !item.chartConfig) continue;
        
        const canvasRef = chartRefs.current[item.id];
        if (!canvasRef) {
          console.error("Canvas ref not found for chart:", item.id);
          continue;
        }
        
        // Destroy existing chart if there is one
        if (chartInstances.current[item.id]) {
          try {
            chartInstances.current[item.id].destroy();
          } catch (e) {
            console.error("Error destroying chart:", e);
          }
          delete chartInstances.current[item.id];
        }
        
        try {
          console.log("Rendering chart:", item.id, item.title);
          const ctx = canvasRef.getContext('2d');
          
          // Prepare the chart configuration
          const chartConfig = prepareChartConfig(item.chartConfig);
          if (!chartConfig) {
            console.error("Could not prepare chart config for:", item.id);
            continue;
          }
          
          // If source info exists, try to fetch the latest data
          if (item.sourceInfo && item.sourceInfo.spreadsheetId) {
            const latestData = await fetchLatestChartData(item.sourceInfo);
            
            if (latestData) {
              console.log("Fetched latest data for chart:", item.id, latestData);
              
              // Update the chart config with this latest data
              updateChartWithLatestData(chartConfig, latestData, item.chartConfig.type);
            }
          }
          
          // Create chart using the updated configuration
          chartInstances.current[item.id] = new Chart(ctx, chartConfig);
          console.log("Chart rendered successfully:", item.id);
        } catch (error) {
          console.error("Error creating chart:", error, item.chartConfig);
        }
      }
    }, 300);
    
    return () => clearTimeout(timer);
  }, [dashboard, mounted]);

  // Helper function to update chart config with latest data
  const updateChartWithLatestData = (chartConfig, latestData, chartType) => {
    if (!chartConfig || !latestData || !chartType) return;
    
    try {
      // Handle different chart types
      switch (chartType) {
        case 'bar':
        case 'line': 
          // For bar/line charts, use first column as labels, rest as datasets
          if (latestData.headers.length > 1) {
            // Update labels (first column)
            chartConfig.data.labels = latestData.data.map(row => String(row[0] || ''));
            
            // Update datasets (remaining columns)
            for (let i = 1; i < latestData.headers.length; i++) {
              const datasetIndex = i - 1;
              // Make sure we have a dataset for this column
              if (datasetIndex < chartConfig.data.datasets.length) {
                chartConfig.data.datasets[datasetIndex].label = latestData.headers[i];
                chartConfig.data.datasets[datasetIndex].data = latestData.data.map(row => 
                  typeof row[i] === 'number' ? row[i] : parseFloat(row[i]) || 0
                );
              } else {
                // Create a new dataset if needed
                chartConfig.data.datasets.push({
                  label: latestData.headers[i],
                  data: latestData.data.map(row => 
                    typeof row[i] === 'number' ? row[i] : parseFloat(row[i]) || 0
                  ),
                  backgroundColor: `rgba(${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, 0.6)`
                });
              }
            }
          }
          break;
          
        case 'pie':
        case 'doughnut':
          // For pie/doughnut charts, use first column as labels, second as data
          if (latestData.headers.length > 1) {
            chartConfig.data.labels = latestData.data.map(row => String(row[0] || ''));
            
            // Make sure we have at least one dataset
            if (chartConfig.data.datasets.length === 0) {
              chartConfig.data.datasets.push({
                data: [],
                backgroundColor: []
              });
            }
            
            // Update the dataset with the values from the second column
            chartConfig.data.datasets[0].data = latestData.data.map(row => 
              typeof row[1] === 'number' ? row[1] : parseFloat(row[1]) || 0
            );
            
            // Generate colors if needed
            if (!chartConfig.data.datasets[0].backgroundColor || 
                chartConfig.data.datasets[0].backgroundColor.length < chartConfig.data.labels.length) {
              chartConfig.data.datasets[0].backgroundColor = chartConfig.data.labels.map((_, i) => 
                `rgba(${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, 0.6)`
              );
            }
          }
          break;
          
        case 'radar':
          // For radar charts, use first column as labels, second as data
          if (latestData.headers.length > 1) {
            chartConfig.data.labels = latestData.data.map(row => String(row[0] || ''));
            
            // Make sure we have at least one dataset
            if (chartConfig.data.datasets.length === 0) {
              chartConfig.data.datasets.push({
                label: latestData.headers[1] || 'Dataset 1',
                data: [],
                backgroundColor: 'rgba(255, 99, 132, 0.2)',
                borderColor: 'rgba(255, 99, 132, 1)',
                borderWidth: 1
              });
            }
            
            // Update the dataset with the values from the second column
            chartConfig.data.datasets[0].data = latestData.data.map(row => 
              typeof row[1] === 'number' ? row[1] : parseFloat(row[1]) || 0
            );
          }
          break;
          
        default:
          console.log("Unsupported chart type for live updates:", chartType);
      }
    } catch (error) {
      console.error("Error updating chart with latest data:", error);
    }
  };

  // Handle layout changes
  const handleLayoutChange = (currentLayout, allLayouts) => {
    console.log("Layout changed:", currentLayout);
    setLayouts(allLayouts);
  };

  // Save the layout changes to Firestore
  const saveLayout = async () => {
    if (!user || !dashboard || !layouts.lg) return;
    
    setIsSaving(true);
    try {
      // Create a map of item positions
      const positionMap = {};
      layouts.lg.forEach(layoutItem => {
        positionMap[layoutItem.i] = {
          x: layoutItem.x || 0,
          y: layoutItem.y || 0,
          w: layoutItem.w || 4,
          h: layoutItem.h || 4
        };
      });
      
      // Update each item with its new position
      const updatedItems = dashboard.items.map(item => ({
        ...item,
        position: positionMap[item.id] || item.position || { x: 0, y: 0, w: 4, h: 4 }
      }));
      
      // Update the dashboard document
      const dashboardRef = doc(db, 'dashboards', dashboard.id);
      await updateDoc(dashboardRef, {
        items: updatedItems,
        lastModified: serverTimestamp()
      });
      
      // Update local state
      setDashboard({
        ...dashboard,
        items: updatedItems
      });
      
      alert('Dashboard layout saved successfully!');
    } catch (error) {
      console.error("Error saving layout:", error);
      alert('Failed to save dashboard layout');
    } finally {
      setIsSaving(false);
    }
  };

  // In pages/dashboard/[id].js - Update the fetchLatestChartData function
  const fetchLatestChartData = async (sourceInfo) => {
    if (!sourceInfo || !sourceInfo.spreadsheetId) {
      console.log("Missing source info or spreadsheet ID");
      return null;
    }
    
    try {
      console.log("Fetching data from spreadsheet:", sourceInfo.spreadsheetId);
      // Fetch the latest spreadsheet data
      const docRef = doc(db, 'spreadsheets', sourceInfo.spreadsheetId);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        console.error("Source spreadsheet not found");
        return null;
      }
      
      const spreadsheetData = docSnap.data();
      console.log("Spreadsheet data:", spreadsheetData);
      
      // Check if we have serialized data
      if (!spreadsheetData.serializedData || !spreadsheetData.serializedData.rows) {
        console.error("Spreadsheet doesn't contain serialized data");
        return null;
      }
      
      // Convert from serialized format to 2D array
      const serializedRows = spreadsheetData.serializedData.rows;
      
      // Create a map to hold row data
      const rowMap = new Map();
      serializedRows.forEach(row => {
        const rowIndex = parseInt(row.rowId);
        if (!rowMap.has(rowIndex)) {
          rowMap.set(rowIndex, []);
        }
        
        row.cells.forEach(cell => {
          const colIndex = parseInt(cell.colId);
          // Ensure array is big enough
          while (rowMap.get(rowIndex).length <= colIndex) {
            rowMap.get(rowIndex).push('');
          }
          rowMap.get(rowIndex)[colIndex] = cell.value;
        });
      });
      
      // Convert map to 2D array
      const rowIndices = Array.from(rowMap.keys()).sort((a, b) => a - b);
      const data = rowIndices.map(rowIndex => rowMap.get(rowIndex));
      
      console.log("Deserialized data:", data);
      
      // Extract the relevant data based on source info
      if (sourceInfo.range) {
        console.log("Using range to extract data:", sourceInfo.range);
        const { startRow, startCol, endRow, endCol } = sourceInfo.range;
        
        // Extract headers (from row 0 or startRow if it's 0)
        const headerRow = startRow === 0 ? startRow : 0;
        const headers = [];
        if (data[headerRow]) {
          for (let col = startCol; col <= endCol; col++) {
            headers.push(data[headerRow][col] || `Column ${col}`);
          }
        }
        
        // Extract data rows
        const extractedData = [];
        const dataStartRow = startRow === 0 ? 1 : startRow;
        for (let row = dataStartRow; row <= endRow; row++) {
          if (!data[row]) continue;
          
          const rowData = [];
          for (let col = startCol; col <= endCol; col++) {
            rowData.push(data[row][col] || '');
          }
          extractedData.push(rowData);
        }
        
        console.log("Extracted data using range:", { headers, data: extractedData });
        return {
          headers,
          data: extractedData
        };
      }
      
      // If we have columns but no range
      if (sourceInfo.columns && sourceInfo.columns.length > 0) {
        console.log("Using columns to extract data:", sourceInfo.columns);
        // Find the column indices
        const headers = data[0] || [];
        const columnIndices = sourceInfo.columns.map(colName => {
          const index = headers.findIndex(header => header === colName);
          return index !== -1 ? index : null;
        }).filter(index => index !== null);
        
        if (columnIndices.length === 0) {
          console.error("Column names not found in spreadsheet");
          return null;
        }
        
        // Extract the data for these columns
        const extractedData = data.slice(1).map(row => {
          if (!row) return columnIndices.map(() => '');
          return columnIndices.map(index => row[index] || '');
        });
        
        console.log("Extracted data using columns:", { 
          headers: columnIndices.map(index => headers[index]), 
          data: extractedData 
        });
        
        return {
          headers: columnIndices.map(index => headers[index]),
          data: extractedData
        };
      }
      
      // Otherwise return all data
      console.log("Returning all data");
      return {
        headers: data[0] || [],
        data: data.slice(1) || []
      };
    } catch (error) {
      console.error("Error fetching latest chart data:", error);
      return null;
    }
  };

  // In pages/dashboard/[id].js - Add this function
  const refreshChart = async (chartId) => {
    const item = dashboard.items.find(i => i.id === chartId);
    if (!item || !item.sourceInfo || !item.sourceInfo.spreadsheetId) {
      console.error("Cannot refresh chart: missing source info");
      return;
    }
    
    console.log("Refreshing chart with source info:", item.sourceInfo);
    
    try {
      // Fetch the latest data
      const latestData = await fetchLatestChartData(item.sourceInfo);
      
      if (!latestData) {
        console.error("Could not fetch latest data for chart:", chartId);
        alert("Could not fetch latest data. Please check the source spreadsheet.");
        return;
      }
      
      console.log("Fetched latest data for chart:", latestData);
      
      // Get the chart instance
      const chartInstance = chartInstances.current[chartId];
      if (!chartInstance) {
        console.error("Chart instance not found:", chartId);
        return;
      }
      
      // Update the chart with the new data
      const chartType = item.chartConfig.type;
      
      console.log("Updating chart of type:", chartType);
      
      // Clear existing datasets to avoid duplicate data
      chartInstance.data.datasets = [];
      
      // Update chart based on type
      if (['pie', 'doughnut', 'polarArea'].includes(chartType)) {
        // Update labels
        chartInstance.data.labels = latestData.data.map(row => String(row[0] || ''));
        
        // Create or update dataset
        const dataValues = latestData.data.map(row => 
          typeof row[1] === 'number' ? row[1] : parseFloat(row[1]) || 0
        );
        
        // Generate colors if needed
        const colors = chartInstance.data.labels.map((_, index) => {
          const hue = (index * 137.5) % 360;
          return `hsla(${hue}, 70%, 60%, 0.7)`;
        });
        
        chartInstance.data.datasets.push({
          data: dataValues,
          backgroundColor: colors,
          borderColor: colors.map(color => color.replace('0.7)', '1)')),
          borderWidth: 1
        });
      } else {
        // For bar, line, etc charts
        // Use first row as labels if we have headers
        if (latestData.headers && latestData.headers.length > 0) {
          chartInstance.data.labels = latestData.headers.slice(1);
        }
        
        // Create datasets from data rows
        latestData.data.forEach((row, index) => {
          const hue = (index * 137.5) % 360;
          const color = `hsla(${hue}, 70%, 60%, 0.7)`;
          
          chartInstance.data.datasets.push({
            label: row[0] || `Series ${index + 1}`,
            data: row.slice(1).map(val => 
              typeof val === 'number' ? val : parseFloat(val) || 0
            ),
            backgroundColor: color,
            borderColor: color.replace('0.7)', '1)'),
            borderWidth: 1
          });
        });
      }
      
      // Update the chart
      chartInstance.update();
      
      // Update the lastUpdated timestamp
      const updatedItems = dashboard.items.map(i => {
        if (i.id === chartId) {
          return {
            ...i,
            sourceInfo: {
              ...i.sourceInfo,
              lastUpdated: new Date().toISOString()
            }
          };
        }
        return i;
      });
      
      // Update local state
      setDashboard({
        ...dashboard,
        items: updatedItems
      });
      
      // Save this update to Firestore
      const dashboardRef = doc(db, 'dashboards', dashboard.id);
      await updateDoc(dashboardRef, {
        items: sanitizeForFirestore(updatedItems),
        lastModified: serverTimestamp()
      });
      
      console.log("Chart refreshed successfully:", chartId);
      alert("Chart refreshed with latest data");
    } catch (error) {
      console.error("Error refreshing chart:", error);
      alert("Failed to refresh chart with latest data");
    }
  };

  if (loading || isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className={styles.container}>
        <p>Dashboard not found.</p>
        <button 
          className={styles.backButton} 
          onClick={() => router.push('/dashboard')}
        >
          Back to Dashboards
        </button>
      </div>
    );
  }

  // Determine breakpoints and column counts based on window width
  const breakpoints = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 };
  const cols = { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 };

  return (
    <div className={styles.container}>
      <Head>
        <title>{dashboard.title || 'Dashboard'} - OneData</title>
      </Head>
      
      <header className={styles.header}>
        <h1>{dashboard.title || 'Untitled Dashboard'}</h1>
        <div className={styles.headerActions}>
          <button 
            className={styles.saveButton}
            onClick={saveLayout}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Layout'}
          </button>
          <button 
            className={styles.backButton}
            onClick={() => router.push('/dashboard')}
          >
            Back to Dashboards
          </button>
        </div>
      </header>
      
      <main className={styles.dashboardContent}>
        {dashboard.items && dashboard.items.length > 0 ? (
          <div className={styles.gridContainer}>
            {mounted && (
              <ResponsiveGridLayout
                className={styles.layout}
                layouts={layouts}
                breakpoints={breakpoints}
                cols={cols}
                rowHeight={60}
                onLayoutChange={handleLayoutChange}
                draggableHandle=".dragHandle"
                margin={[16, 16]}
                containerPadding={[16, 16]}
                isResizable={true}
                isDraggable={true}
                compactType={null}
                useCSSTransforms={true}
              >
                {dashboard.items.map(item => (
                  <div key={item.id} className={styles.dashboardItem}>
                    <div className={styles.itemHeader}>
                      <h3>{item.title || 'Untitled Chart'}</h3>
                      <div className={styles.headerActions}>
                        {item.sourceInfo && item.sourceInfo.spreadsheetId && (
                          <button 
                            onClick={() => refreshChart(item.id)}
                            className={styles.refreshButton}
                            title="Refresh with latest data"
                          >
                            <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                              <path d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/>
                              <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/>
                            </svg>
                          </button>
                        )}
                        <div className={styles.dragHandle} title="Drag to move">
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M2 6.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm4 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm8 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm-4 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm-8 4a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm4 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm8 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm-4 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z" />
                          </svg>
                        </div>
                      </div>
                    </div>
                    <div className={styles.itemContent}>
                      {item.type === 'chart' && (
                        <div className={styles.chartContainer}>
                          <canvas 
                            ref={el => chartRefs.current[item.id] = el}
                            width="400"
                            height="300"
                          />
                          {item.sourceInfo?.lastUpdated && (
                            <div className={styles.dataTimestamp}>
                              Last updated: {new Date(item.sourceInfo.lastUpdated).toLocaleString()}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </ResponsiveGridLayout>
            )}
          </div>
        ) : (
          <div className={styles.emptyDashboard}>
            <p>This dashboard is empty. Add items to it from your spreadsheets.</p>
            <button 
              className={styles.emptyStateButton}
              onClick={() => router.push('/')}
            >
              Go to Spreadsheets
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
