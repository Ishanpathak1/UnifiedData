import React from 'react';
import { useRouter } from 'next/router';
import styles from '../styles/ImportWarningModal.module.css';

const ImportWarningModal = ({ onClose, onCreateNew, onReplace, dependentDashboards }) => {
  const router = useRouter();
  
  const handleCreateNew = () => {
    // First create the new spreadsheet
    onCreateNew();
    // Then redirect to the home page
    router.push('/');
  };
  
  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <h2>Warning: Update Dependencies</h2>
        <p>
          This spreadsheet is used in {dependentDashboards.length} dashboard{dependentDashboards.length !== 1 ? 's' : ''}. 
          Replacing the data may affect the visualizations.
        </p>
        
        <div className={styles.dashboardsList}>
          <h3>Affected Dashboards:</h3>
          <ul>
            {dependentDashboards.map(dashboard => (
              <li key={dashboard.id}>
                {dashboard.title} ({dashboard.itemCount} item{dashboard.itemCount !== 1 ? 's' : ''})
              </li>
            ))}
          </ul>
        </div>
        
        <div className={styles.options}>
          <button className={styles.createButton} onClick={handleCreateNew}>
            Create New Spreadsheet
          </button>
          <button className={styles.replaceButton} onClick={onReplace}>
            Replace Data Anyway
          </button>
          <button className={styles.cancelButton} onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportWarningModal;