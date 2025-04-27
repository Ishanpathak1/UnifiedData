import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../utils/firebase';
import { collection, query, where, getDocs, orderBy, deleteDoc, doc } from 'firebase/firestore';
import styles from '../styles/Home.module.css';
import authStyles from '../styles/Auth.module.css';
import SignIn from '../components/auth/SignIn';
import Head from 'next/head';
import LandingPage from '../components/LandingPage';
import ContextMenu from '../components/ContextMenu';
import DeleteConfirmModal from '../components/DeleteConfirmModal';

function TypingText({ text, delay = 40 }) {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  
  useEffect(() => {
    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setDisplayedText(prevText => prevText + text[currentIndex]);
        setCurrentIndex(prevIndex => prevIndex + 1);
      }, delay);
      
      return () => clearTimeout(timeout);
    }
  }, [currentIndex, delay, text]);
  
  return <div>{displayedText}<span className={styles.cursor}>|</span></div>;
}

export default function Home() {
  const { user, loading } = useAuth();
  const [spreadsheets, setSpreadsheets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [contextMenu, setContextMenu] = useState(null);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, spreadsheet: null });
  const router = useRouter();

  // Function to fetch spreadsheets
  const fetchSpreadsheets = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const q = query(
        collection(db, 'spreadsheets'),
        where('ownerId', '==', user.uid),
        orderBy('lastModified', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const spreadsheetsData = [];
      
      querySnapshot.forEach((doc) => {
        spreadsheetsData.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      setSpreadsheets(spreadsheetsData);
    } catch (error) {
      console.error('Error fetching spreadsheets:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!loading) {
      fetchSpreadsheets();
    }
  }, [user, loading]);

  const createNewSpreadsheet = () => {
    router.push('/spreadsheet');
  };

  const openSpreadsheet = (id) => {
    router.push(`/spreadsheet?id=${id}`);
  };

  // Handle right-click on spreadsheet card
  const handleContextMenu = (e, spreadsheet) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      spreadsheet
    });
  };

  // Close context menu
  const closeContextMenu = () => {
    setContextMenu(null);
  };

  // Open delete confirmation modal
  const openDeleteModal = (spreadsheet) => {
    setDeleteModal({ isOpen: true, spreadsheet });
  };

  // Close delete confirmation modal
  const closeDeleteModal = () => {
    setDeleteModal({ isOpen: false, spreadsheet: null });
  };

  // Delete spreadsheet
  const deleteSpreadsheet = async () => {
    const spreadsheetId = deleteModal.spreadsheet?.id;
    if (!spreadsheetId) return;
    
    try {
      await deleteDoc(doc(db, 'spreadsheets', spreadsheetId));
      setSpreadsheets(prev => prev.filter(sheet => sheet.id !== spreadsheetId));
      console.log(`Spreadsheet ${spreadsheetId} deleted successfully`);
      closeDeleteModal();
    } catch (error) {
      console.error('Error deleting spreadsheet:', error);
      alert('Failed to delete spreadsheet. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.loadingContent}>
          <div className={styles.loadingLogo}>UnifiedData</div>
          <div className={styles.loadingSpinner}></div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <LandingPage />
    );
  }

  return (
    <div className={styles.container} onClick={closeContextMenu}>
      <Head>
        <title>UnifiedData - Your Spreadsheets</title>
      </Head>
      
      <header className={styles.header}>
        <h1 className={styles.logo}>UnifiedData</h1>
        <nav className={styles.nav}>
          <button 
            className={`${styles.navButton} ${styles.active}`}
            onClick={() => router.push('/')}
          >
            Spreadsheets
          </button>
          <button 
            className={styles.navButton}
            onClick={() => router.push('/dashboard')}
          >
            Dashboards
          </button>
        </nav>
        <div className={styles.headerRight}>
          <SignIn />
        </div>
      </header>
      
      <main className={styles.main}>
        <div className={styles.actionsBar}>
          <h2 className={styles.sectionTitle}>Your Spreadsheets</h2>
          <button
            className={styles.createButton}
            onClick={createNewSpreadsheet}
          >
            <svg className={styles.createIcon} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create New
          </button>
        </div>
        
        {isLoading ? (
          <div className={styles.loadingState}>
            <div className={styles.loadingSpinner}></div>
            <p>Loading your spreadsheets...</p>
          </div>
        ) : spreadsheets.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyStateIcon}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className={styles.emptyStateTitle}>No spreadsheets yet</h3>
            <p className={styles.emptyStateText}>Create your first spreadsheet to get started</p>
            <button 
              className={styles.emptyStateButton}
              onClick={createNewSpreadsheet}
            >
              Create Spreadsheet
            </button>
          </div>
        ) : (
          <div className={styles.spreadsheetsGrid}>
            {spreadsheets.map((sheet) => (
              <div 
                key={sheet.id} 
                className={styles.spreadsheetCard}
                onClick={() => openSpreadsheet(sheet.id)}
                onContextMenu={(e) => handleContextMenu(e, sheet)}
              >
                <div className={styles.cardPreview}>
                  <div className={styles.previewGrid}></div>
                </div>
                <div className={styles.cardInfo}>
                  <h3 className={styles.cardTitle}>{sheet.title}</h3>
                  <p className={styles.cardDate}>
                    {sheet.lastModified ? 
                      new Date(sheet.lastModified.toDate()).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit'
                      }) : 'Date unknown'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      
      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={closeContextMenu}
          options={[
            {
              label: 'Open',
              icon: '📄',
              action: () => openSpreadsheet(contextMenu.spreadsheet.id)
            },
            {
              label: 'Duplicate',
              icon: '📋',
              action: () => {
                // Implement duplicate functionality
                alert('Duplicate feature coming soon');
              }
            },
            {
              label: 'Delete',
              icon: '🗑️',
              danger: true,
              action: () => openDeleteModal(contextMenu.spreadsheet)
            }
          ]}
        />
      )}
      
      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={closeDeleteModal}
        onConfirm={deleteSpreadsheet}
        itemName={deleteModal.spreadsheet?.title || 'this spreadsheet'}
      />
    </div>
  );
}
