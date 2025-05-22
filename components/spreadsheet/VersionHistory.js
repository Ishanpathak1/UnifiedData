import React, { useState, useEffect } from 'react';
import { 
  getVersionHistory, 
  getVersion, 
  restoreVersion, 
  nameVersion 
} from '../../utils/spreadsheet/versionControl';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import styles from '../../styles/Spreadsheet.module.css';

/**
 * Component for displaying and managing spreadsheet version history
 */
const VersionHistory = ({ 
  spreadsheetId, 
  isOpen, 
  onClose, 
  onVersionRestore, 
  currentData 
}) => {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isNaming, setIsNaming] = useState(false);
  const [newVersionName, setNewVersionName] = useState('');
  const [versionDescription, setVersionDescription] = useState('');
  const [compareMode, setCompareMode] = useState(false);
  const { user } = useAuth();

  // Load version history when component mounts or spreadsheetId changes
  useEffect(() => {
    if (!isOpen || !spreadsheetId) return;
    
    const fetchVersions = async () => {
      setLoading(true);
      try {
        const versionHistory = await getVersionHistory(spreadsheetId);
        setVersions(versionHistory);
      } catch (error) {
        console.error('Error fetching version history:', error);
        toast.error('Failed to load version history');
      } finally {
        setLoading(false);
      }
    };

    fetchVersions();
  }, [spreadsheetId, isOpen]);

  // Handle selecting a version to view details
  const handleSelectVersion = (version) => {
    setSelectedVersion(version);
    setNewVersionName(version.versionName || '');
    setVersionDescription(version.description || '');
  };

  // Format date for display
  const formatDate = (date) => {
    if (!date) return 'Unknown date';
    
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'Invalid date';
    
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Enhanced version for viewing version data
  const handleViewVersion = async () => {
    if (!selectedVersion) return;
    
    try {
      toast.loading('Loading version data...');
      const versionData = await getVersion(spreadsheetId, selectedVersion.id);
      toast.dismiss();
      
      // Validate that we have proper data
      if (!versionData || !versionData.data) {
        toast.error('This version contains invalid or missing data');
        console.error('Invalid version data:', versionData);
        return;
      }
      
      // Log the version data structure to help with debugging
      console.log('Successfully loaded version data:', {
        id: versionData.id,
        name: versionData.versionName,
        createdAt: versionData.createdAt,
        dataStructure: typeof versionData.data,
        hasSheets: Boolean(versionData.sheets)
      });
      
      toast.success('Version data loaded successfully');
      setCompareMode(true);
      
      // In a future enhancement, we could:
      // 1. Show a preview of the version
      // 2. Allow side-by-side comparison with current version
      // 3. Show diff highlighting changes
    } catch (error) {
      toast.dismiss();
      console.error('Error fetching version data:', error);
      toast.error(`Failed to load version details: ${error.message}`);
    }
  };

  // Enhanced version restore function with better validation
  const handleRestoreVersion = async () => {
    if (!selectedVersion || !spreadsheetId || !user) return;
    
    // Confirm with the user
    if (!window.confirm(`Are you sure you want to restore to version "${selectedVersion.versionName}"? This will replace your current spreadsheet data.`)) {
      return;
    }
    
    setIsRestoring(true);
    try {
      toast.loading('Restoring version...');
      const restoredData = await restoreVersion(spreadsheetId, selectedVersion.id, user);
      toast.dismiss();
      
      // Validate restored data
      if (!restoredData) {
        toast.error('Failed to restore version: Invalid data returned');
        setIsRestoring(false);
        return;
      }
      
      console.log('Successfully restored version:', {
        id: selectedVersion.id,
        name: selectedVersion.versionName,
        dataType: typeof restoredData
      });
      
      if (typeof onVersionRestore === 'function') {
        onVersionRestore(restoredData);
      }
      
      toast.success(`Restored to version: ${selectedVersion.versionName}`);
      onClose();
    } catch (error) {
      toast.dismiss();
      console.error('Error restoring version:', error);
      toast.error(`Failed to restore version: ${error.message}`);
    } finally {
      setIsRestoring(false);
    }
  };

  // Handle naming a version
  const handleNameVersion = async (e) => {
    e.preventDefault();
    if (!selectedVersion || !newVersionName.trim()) return;
    
    setIsNaming(true);
    try {
      await nameVersion(
        spreadsheetId,
        selectedVersion.id,
        newVersionName.trim(),
        versionDescription
      );
      
      // Update the local state to reflect changes
      setVersions(versions.map(v => {
        if (v.id === selectedVersion.id) {
          return {
            ...v,
            versionName: newVersionName.trim(),
            description: versionDescription
          };
        }
        return v;
      }));
      
      setSelectedVersion({
        ...selectedVersion,
        versionName: newVersionName.trim(),
        description: versionDescription
      });
      
      toast.success('Version name updated');
    } catch (error) {
      console.error('Error naming version:', error);
      toast.error('Failed to update version name');
    } finally {
      setIsNaming(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.versionHistoryModal}>
        <div className={styles.modalHeader}>
          <h3>Version History</h3>
          <button onClick={onClose} className={styles.closeButton}>×</button>
        </div>
        
        <div className={styles.versionHistoryContent}>
          <div className={styles.versionsList}>
            <h4>Saved Versions</h4>
            
            {loading ? (
              <div className={styles.loadingState}>
                <div className={styles.loadingSpinner}></div>
                <p>Loading version history...</p>
              </div>
            ) : versions.length === 0 ? (
              <div className={styles.emptyVersionState}>
                <p>No saved versions found</p>
              </div>
            ) : (
              <div className={styles.versionsGrid}>
                {versions.map((version) => (
                  <div 
                    key={version.id}
                    className={`${styles.versionCard} ${selectedVersion?.id === version.id ? styles.selectedVersion : ''}`}
                    onClick={() => handleSelectVersion(version)}
                  >
                    <div className={styles.versionCardHeader}>
                      <h5>{version.versionName || 'Unnamed Version'}</h5>
                      <span className={styles.versionDate}>
                        {formatDate(version.createdAt)}
                      </span>
                    </div>
                    
                    {version.createdBy && (
                      <p className={styles.versionCreator}>
                        By: {version.createdBy.displayName || version.createdBy.email || 'Unknown User'}
                      </p>
                    )}
                    
                    {version.description && (
                      <p className={styles.versionDescription}>{version.description}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {selectedVersion && (
            <div className={styles.versionDetails}>
              <h4>Version Details</h4>
              
              <div className={styles.versionInfoDetails}>
                <div className={styles.versionInfoItem}>
                  <span className={styles.versionInfoLabel}>Version Name:</span>
                  <span className={styles.versionInfoValue}>{selectedVersion.versionName}</span>
                </div>
                
                <div className={styles.versionInfoItem}>
                  <span className={styles.versionInfoLabel}>Created:</span>
                  <span className={styles.versionInfoValue}>{formatDate(selectedVersion.createdAt)}</span>
                </div>
                
                {selectedVersion.createdBy && (
                  <div className={styles.versionInfoItem}>
                    <span className={styles.versionInfoLabel}>Created By:</span>
                    <span className={styles.versionInfoValue}>
                      {selectedVersion.createdBy.displayName || selectedVersion.createdBy.email || 'Unknown User'}
                    </span>
                  </div>
                )}
                
                {selectedVersion.description && (
                  <div className={styles.versionInfoItem}>
                    <span className={styles.versionInfoLabel}>Description:</span>
                    <span className={styles.versionInfoValue}>{selectedVersion.description}</span>
                  </div>
                )}
              </div>
              
              {/* Form to rename a version */}
              <form onSubmit={handleNameVersion} className={styles.versionNameForm}>
                <h5>Edit Version Details</h5>
                
                <div className={styles.formField}>
                  <label htmlFor="versionName">Version Name:</label>
                  <input
                    id="versionName"
                    type="text"
                    value={newVersionName}
                    onChange={(e) => setNewVersionName(e.target.value)}
                    className={styles.versionInput}
                    placeholder="Enter version name"
                  />
                </div>
                
                <div className={styles.formField}>
                  <label htmlFor="versionDescription">Description:</label>
                  <textarea
                    id="versionDescription"
                    value={versionDescription}
                    onChange={(e) => setVersionDescription(e.target.value)}
                    className={styles.versionTextarea}
                    placeholder="Enter version description"
                    rows={3}
                  />
                </div>
                
                <button
                  type="submit"
                  className={styles.versionButton}
                  disabled={isNaming || !newVersionName.trim()}
                >
                  {isNaming ? 'Updating...' : 'Update Version Details'}
                </button>
              </form>
              
              <div className={styles.versionActions}>
                <button
                  onClick={handleViewVersion}
                  className={styles.versionActionButton}
                >
                  View Version
                </button>
                
                <button
                  onClick={handleRestoreVersion}
                  className={`${styles.versionActionButton} ${styles.restoreButton}`}
                  disabled={isRestoring}
                >
                  {isRestoring ? 'Restoring...' : 'Restore This Version'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VersionHistory; 