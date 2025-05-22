import React, { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../utils/firebase';
import styles from '../../styles/Spreadsheet.module.css';
import { toast } from 'react-hot-toast';

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

const SyncStatusIndicator = ({ spreadsheetId, updateDependentDashboards }) => {
  const [syncStatus, setSyncStatus] = useState('idle'); // 'idle', 'in_progress', 'completed', 'error'
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [syncError, setSyncError] = useState(null);
  
  // Listen for changes to the sync status
  useEffect(() => {
    if (!spreadsheetId || spreadsheetId === 'new') return;
    
    // Set up a listener for sync status changes
    const unsubscribe = onSnapshot(doc(db, 'spreadsheets', spreadsheetId), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        
        // Update sync status if it exists
        if (data.syncStatus) {
          setSyncStatus(data.syncStatus);
          
          // Handle completed syncs
          if (data.syncStatus === 'completed' && data.lastSyncedAt) {
            const syncTime = data.lastSyncedAt.toDate();
            setLastSyncTime(syncTime);
            localStorage.setItem('lastDashboardSync', syncTime.toISOString());
          }
          
          // Handle errors
          if (data.syncStatus === 'error' && data.syncError) {
            setSyncError(data.syncError);
          } else {
            setSyncError(null);
          }
        }
      }
    });
    
    // Clean up listener on unmount
    return () => unsubscribe();
  }, [spreadsheetId]);
  
  // Only show if we have an active sync or recent completion
  if (syncStatus === 'idle') {
    return null;
  }
  
  return (
    <div className={`${styles.syncStatusIndicator} ${styles[syncStatus]}`}>
      {syncStatus === 'in_progress' && (
        <>
          <div className={styles.syncSpinner}></div>
          <span>Synchronizing dashboards...</span>
        </>
      )}
      
      {syncStatus === 'completed' && (
        <>
          <svg className={styles.syncCompleteIcon} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M12.736 3.97a.733.733 0 0 1 1.047 0c.286.289.29.756.01 1.05L7.88 12.01a.733.733 0 0 1-1.065.02L3.217 8.384a.757.757 0 0 1 0-1.06.733.733 0 0 1 1.047 0l3.052 3.093 5.4-6.425a.247.247 0 0 1 .02-.022Z"/>
          </svg>
          <span>
            Dashboards updated {lastSyncTime ? formatTimeAgo(lastSyncTime) : ''}
          </span>
        </>
      )}
      
      {syncStatus === 'error' && (
        <>
          <svg className={styles.syncErrorIcon} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0-2A5 5 0 1 0 8 3a5 5 0 0 0 0 10z"/>
            <path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995z"/>
          </svg>
          <span>
            Sync failed: {syncError || 'Unknown error'}
          </span>
          <button 
            onClick={updateDependentDashboards}
            className={styles.retrySyncButton}
          >
            Retry
          </button>
        </>
      )}
    </div>
  );
};

export default SyncStatusIndicator; 