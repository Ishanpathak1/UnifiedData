import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../utils/firebase';
import { collection, query, where, orderBy, getDocs, deleteDoc, doc } from 'firebase/firestore';
import styles from '../../styles/Dashboard.module.css';
import Head from 'next/head';
import ContextMenu from '../../components/ContextMenu';
import DeleteConfirmModal from '../../components/DeleteConfirmModal';

export default function Dashboards() {
  const [dashboards, setDashboards] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user, loading } = useAuth();
  const router = useRouter();
  
  // Add state for context menu and delete modal
  const [contextMenu, setContextMenu] = useState(null);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, dashboard: null });

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setIsLoading(false);
      return;
    }

    const fetchDashboards = async () => {
      try {
        const q = query(
          collection(db, 'dashboards'),
          where('ownerId', '==', user.uid),
          orderBy('lastModified', 'desc')
        );
        
        const querySnapshot = await getDocs(q);
        const dashboardsData = [];
        
        querySnapshot.forEach((doc) => {
          dashboardsData.push({
            id: doc.id,
            ...doc.data()
          });
        });
        
        setDashboards(dashboardsData);
      } catch (error) {
        console.error('Error fetching dashboards:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboards();
  }, [user, loading]);

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Date unknown';
    try {
      // Handle Firestore Timestamp objects
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      }).format(date);
    } catch (error) {
      return 'Date unknown';
    }
  };
  
  // Handle right-click on dashboard card
  const handleContextMenu = (e, dashboard) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      dashboard
    });
  };

  // Close context menu
  const closeContextMenu = () => {
    setContextMenu(null);
  };

  // Open delete confirmation modal
  const openDeleteModal = (dashboard) => {
    setDeleteModal({ isOpen: true, dashboard });
  };

  // Close delete confirmation modal
  const closeDeleteModal = () => {
    setDeleteModal({ isOpen: false, dashboard: null });
  };

  // Delete dashboard
  const deleteDashboard = async () => {
    const dashboardId = deleteModal.dashboard?.id;
    if (!dashboardId) return;
    
    try {
      await deleteDoc(doc(db, 'dashboards', dashboardId));
      setDashboards(prev => prev.filter(dash => dash.id !== dashboardId));
      console.log(`Dashboard ${dashboardId} deleted successfully`);
      closeDeleteModal();
    } catch (error) {
      console.error('Error deleting dashboard:', error);
      alert('Failed to delete dashboard. Please try again.');
    }
  };

  const createNewDashboard = () => {
    router.push('/dashboard/new');
  };

  if (loading || isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <p>Loading dashboards...</p>
      </div>
    );
  }

  return (
    <div className={styles.container} onClick={closeContextMenu}>
      <Head>
        <title>Dashboards | UnifiedData</title>
      </Head>
      
      <header className={styles.header}>
        <h1 className={styles.logo}>UnifiedData</h1>
        <nav className={styles.nav}>
          <button 
            className={styles.navButton}
            onClick={() => router.push('/')}
          >
            Spreadsheets
          </button>
          <button 
            className={`${styles.navButton} ${styles.active}`}
            onClick={() => router.push('/dashboard')}
          >
            Dashboards
          </button>
        </nav>
      </header>
      
      <main className={styles.main}>
        <div className={styles.actionsBar}>
          <h2 className={styles.pageTitle}>Your Dashboards</h2>
          
        </div>
        
        {dashboards.length === 0 ? (
          <div className={styles.emptyState}>
            <h3>No dashboards yet</h3>
            <p>Create a dashboard to visualize your spreadsheet data.</p>
            <button 
              className={styles.emptyStateButton}
              onClick={createNewDashboard}
            >
              Create Your First Dashboard
            </button>
          </div>
        ) : (
          <div className={styles.dashboardGrid}>
            {dashboards.map(dashboard => (
              <div 
                key={dashboard.id} 
                className={styles.dashboardCard}
                onClick={() => router.push(`/dashboard/${dashboard.id}`)}
                onContextMenu={(e) => handleContextMenu(e, dashboard)}
              >
                <div className={styles.dashboardPreview}>
                  {dashboard.items && dashboard.items.length > 0 ? (
                    <div className={styles.previewContent}>
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                  ) : (
                    <div className={styles.emptyPreview}>
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm0 8a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zm12 0a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                      </svg>
                    </div>
                  )}
                  <div className={styles.itemCount}>
                    {dashboard.items?.length || 0} {dashboard.items?.length === 1 ? 'item' : 'items'}
                  </div>
                </div>
                <div className={styles.dashboardInfo}>
                  <h3>{dashboard.title || 'Untitled Dashboard'}</h3>
                  <p>Last modified: {formatDate(dashboard.lastModified)}</p>
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
              icon: '📊',
              action: () => router.push(`/dashboard/${contextMenu.dashboard.id}`)
            },
            {
              label: 'Edit',
              icon: '✏️',
              action: () => router.push(`/dashboard/edit/${contextMenu.dashboard.id}`)
            },
            {
              label: 'Delete',
              icon: '🗑️',
              danger: true,
              action: () => openDeleteModal(contextMenu.dashboard)
            }
          ]}
        />
      )}
      
      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={closeDeleteModal}
        onConfirm={deleteDashboard}
        itemName={deleteModal.dashboard?.title || 'this dashboard'}
      />
    </div>
  );
}