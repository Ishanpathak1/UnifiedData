import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../utils/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import styles from '../styles/Home.module.css';
import authStyles from '../styles/Auth.module.css';
import SignIn from '../components/auth/SignIn';
import Head from 'next/head';

export default function Home() {
  const { user, loading } = useAuth();
  const [spreadsheets, setSpreadsheets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Fetch user's spreadsheets when user is authenticated
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

  if (loading) {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.loadingContent}>
          <div className={styles.loadingLogo}>OneData</div>
          <div className={styles.loadingSpinner}></div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={authStyles.welcomeContainer}>
        <Head>
          <title>OneData - Your Data, Unified</title>
          <meta name="description" content="OneData is a comprehensive data analysis, visualization, and management platform. Sign in to get started." />
        </Head>
        <div className={authStyles.welcomeCard}>
          <div className={authStyles.logoContainer}>
            <div className={authStyles.logo}>OneData</div>
          </div>
          <h1 className={authStyles.welcomeTitle}>Welcome to OneData</h1>
          <p className={authStyles.welcomeSubtitle}>
            Your all-in-one platform for data analysis, visualization, and collaborative insights.
          </p>
          
          <div className={authStyles.signInCta}>
            <SignIn />
            <p className={authStyles.signInHint}>
              Sign in to create spreadsheets, build dashboards, and analyze your data.
            </p>
          </div>
          
          <div className={authStyles.features}>
            <div className={authStyles.featureItem}>
              <span className={authStyles.featureIcon}>✓</span>
              <span>Advanced Analysis</span>
            </div>
            <div className={authStyles.featureItem}>
              <span className={authStyles.featureIcon}>✓</span>
              <span>Interactive Dashboards</span>
            </div>
            <div className={authStyles.featureItem}>
              <span className={authStyles.featureIcon}>✓</span>
              <span>Cloud Storage</span>
            </div>
            <div className={authStyles.featureItem}>
              <span className={authStyles.featureIcon}>✓</span>
              <span>Collaboration Tools</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Head>
        <title>OneData - Your Spreadsheets</title>
      </Head>
      
      <header className={styles.header}>
        <h1 className={styles.logo}>OneData</h1>
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
    </div>
  );
}
