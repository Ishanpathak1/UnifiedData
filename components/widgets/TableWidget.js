import { useState, useEffect } from 'react';
import styles from '../../styles/widgets/TableWidget.module.css';

export default function TableWidget({ id, config, onRefresh }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  
  const {
    columns = [],
    pageSize = 10,
    showPagination = true,
    sortable = true,
    filterable = true,
    dataSource = null
  } = config || {};

  // Fetch data
  useEffect(() => {
    fetchData();
  }, [dataSource]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Replace with actual data fetching logic
      // For now we'll use mock data
      const mockData = generateMockData(columns, 50);
      setData(mockData);
    } catch (err) {
      console.error('Error fetching table data:', err);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // Handle refresh
  const handleRefresh = () => {
    fetchData();
    if (onRefresh) onRefresh(id);
  };

  // Sorting logic
  const handleSort = (key) => {
    if (!sortable) return;
    
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    
    setSortConfig({ key, direction });
  };

  // Apply sorting, filtering, and pagination
  const getProcessedData = () => {
    let processedData = [...data];
    
    // Apply search/filter
    if (searchTerm && filterable) {
      processedData = processedData.filter(row => 
        Object.values(row).some(value => 
          String(value).toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }
    
    // Apply sorting
    if (sortConfig.key !== null) {
      processedData.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        
        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    
    return processedData;
  };

  // Pagination logic
  const paginatedData = () => {
    const processed = getProcessedData();
    if (!showPagination) return processed;
    
    const startIndex = (currentPage - 1) * pageSize;
    return processed.slice(startIndex, startIndex + pageSize);
  };

  const totalPages = Math.ceil(getProcessedData().length / pageSize);

  return (
    <div className={styles.tableWidget}>
      {filterable && (
        <div className={styles.tableControls}>
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
          <button 
            className={styles.refreshButton}
            onClick={handleRefresh}
          >
            ↻
          </button>
        </div>
      )}
      
      {loading ? (
        <div className={styles.loading}>Loading data...</div>
      ) : error ? (
        <div className={styles.error}>{error}</div>
      ) : data.length === 0 ? (
        <div className={styles.emptyState}>No data available</div>
      ) : (
        <>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  {columns.map(column => (
                    <th 
                      key={column.key || column.field}
                      className={`
                        ${styles.tableHeader}
                        ${sortable ? styles.sortable : ''}
                        ${sortConfig.key === (column.key || column.field) ? styles.sorted : ''}
                      `}
                      onClick={() => handleSort(column.key || column.field)}
                    >
                      {column.label || column.field}
                      {sortable && sortConfig.key === (column.key || column.field) && (
                        <span className={styles.sortIcon}>
                          {sortConfig.direction === 'asc' ? ' ↑' : ' ↓'}
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedData().map((row, rowIndex) => (
                  <tr key={rowIndex} className={styles.tableRow}>
                    {columns.map(column => (
                      <td 
                        key={`${rowIndex}-${column.key || column.field}`}
                        className={styles.tableCell}
                      >
                        {row[column.key || column.field]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {showPagination && totalPages > 1 && (
            <div className={styles.pagination}>
              <button
                className={styles.paginationButton}
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              >
                &lt;
              </button>
              
              <span className={styles.pageInfo}>
                Page {currentPage} of {totalPages}
              </span>
              
              <button
                className={styles.paginationButton}
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              >
                &gt;
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Helper function to generate mock data for testing
function generateMockData(columns, count = 20) {
  const mockData = [];
  
  for (let i = 0; i < count; i++) {
    const row = {};
    
    columns.forEach(column => {
      const field = column.key || column.field;
      const type = column.type || 'string';
      
      switch (type) {
        case 'number':
          row[field] = Math.floor(Math.random() * 1000);
          break;
        case 'date':
          const date = new Date();
          date.setDate(date.getDate() - Math.floor(Math.random() * 365));
          row[field] = date.toLocaleDateString();
          break;
        case 'boolean':
          row[field] = Math.random() > 0.5;
          break;
        default:
          row[field] = `${field} ${i + 1}`;
      }
    });
    
    mockData.push(row);
  }
  
  return mockData;
}
