import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../utils/firebase';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import styles from '../../styles/Dashboard.module.css';
import Head from 'next/head';

export default function Dashboards() {
  const [dashboards, setDashboards] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user, loading } = useAuth();
  const router = useRouter();

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

  if (loading || (isLoading && user)) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <p>Loading dashboards...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={styles.container}>
        <header className={styles.header}>
          <h1>Dashboards</h1>
          <button
            className={styles.backButton}
            onClick={() => router.push('/')}
          >
            Back to Home
          </button>
        </header>
        <div className={styles.authRequired}>
          <div className={styles.authIcon}>🔒</div>
          <h2>Sign in Required</h2>
          <p>Please sign in to view your dashboards</p>
          <button
            className={styles.primaryButton}
            onClick={() => router.push('/')}
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Head>
        <title>Dashboards - OneData</title>
      </Head>
      
      <header className={styles.header}>
        <h1>Your Dashboards</h1>
        <button 
          className={styles.backButton}
          onClick={() => router.push('/')}
        >
          Back to Home
        </button>
      </header>
      
      <main className={styles.dashboardListContent}>
        {dashboards.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyStateIcon}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="48" height="48">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2>No dashboards yet</h2>
            <p>Create your first dashboard by adding a chart from a spreadsheet</p>
            <button 
              className={styles.primaryButton}
              onClick={() => router.push('/')}
            >
              Go to Spreadsheets
            </button>
          </div>
        ) : (
          <div className={styles.dashboardGrid}>
            {dashboards.map(dashboard => (
              <div 
                key={dashboard.id} 
                className={styles.dashboardCard}
                onClick={() => router.push(`/dashboard/${dashboard.id}`)}
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
    </div>
  );
}