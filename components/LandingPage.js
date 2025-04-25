// components/LandingPage.js
import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import styles from '../styles/LandingPage.module.css';
import { useAuth } from '../contexts/AuthContext';
import SignIn from '../components/auth/SignIn';

export default function LandingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState(0);
  const cursorRef = useRef(null);
  const sectionsRef = useRef([]);
  
  // Initialize spreadsheet data with proper empty structure
  const [spreadsheetData, setSpreadsheetData] = useState([
    ['', '', '', '', ''],
    ['', '', '', '', ''],
    ['', '', '', '', ''],
    ['', '', '', '', ''],
    ['', '', '', '', '']
  ]);
  
  // Define sections
  const sections = [
    { id: 'hero', title: 'AI-Powered Spreadsheets', subtitle: 'Transform data into insights with intelligent analysis' },
    { id: 'create', title: 'Create with ease', subtitle: 'Start your spreadsheet journey in seconds' },
    { id: 'data', title: 'Work with your data', subtitle: 'Flexible organization and powerful manipulation' },
    { id: 'ai', title: 'Ask AI questions', subtitle: 'Get insights from your data using natural language' },
    { id: 'visualize', title: 'Beautiful visualizations', subtitle: 'Turn numbers into compelling stories' },
    { id: 'dashboard', title: 'Powerful dashboards', subtitle: 'Monitor performance at a glance' },
    { id: 'cta', title: 'Ready to get started?', subtitle: 'Join thousands of data-driven professionals' },
  ];

  // Setup intersection observer for sections
  useEffect(() => {
    // Initialize the cursor
    if (cursorRef.current) {
      cursorRef.current.style.opacity = '1';
      positionCursor(0.5, 0.5);
    }
    
    // Create observer for scroll-based section activation
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const sectionIndex = parseInt(entry.target.dataset.index);
            handleSectionChange(sectionIndex);
          }
        });
      },
      { threshold: 0.5 }
    );
    
    // Observe all sections
    sectionsRef.current.forEach(section => {
      if (section) observer.observe(section);
    });
    
    return () => observer.disconnect();
  }, []);

  // Handle section change
  const handleSectionChange = (index) => {
    if (index !== activeSection) {
      setActiveSection(index);
      
      // Animate cursor to appropriate position
      const xPositions = [0.5, 0.3, 0.5, 0.7, 0.6, 0.5, 0.5];
      const yPositions = [0.5, 0.6, 0.5, 0.5, 0.6, 0.5, 0.7];
      
      animateCursor(xPositions[index], yPositions[index]);
      
      // Trigger spreadsheet animation when reaching the data section
      if (index === 2) {
        setTimeout(fillSpreadsheetData, 500);
      }
    }
  };

  // Position cursor without animation
  const positionCursor = (xRatio, yRatio) => {
    if (!cursorRef.current) return;
    
    const x = window.innerWidth * xRatio;
    const y = window.innerHeight * yRatio;
    
    cursorRef.current.style.transition = 'none';
    cursorRef.current.style.left = `${x}px`;
    cursorRef.current.style.top = `${y}px`;
  };

  // Animate cursor to position
  const animateCursor = (xRatio, yRatio) => {
    if (!cursorRef.current) return;
    
    const x = window.innerWidth * xRatio;
    const y = window.innerHeight * yRatio;
    
    cursorRef.current.style.transition = 'left 0.8s cubic-bezier(0.22, 1, 0.36, 1), top 0.8s cubic-bezier(0.22, 1, 0.36, 1)';
    cursorRef.current.style.left = `${x}px`;
    cursorRef.current.style.top = `${y}px`;
    
    // Show click effect after cursor arrives
    setTimeout(() => {
      cursorRef.current.classList.add(styles.clicking);
      setTimeout(() => {
        cursorRef.current.classList.remove(styles.clicking);
      }, 300);
    }, 800);
  };

  // Fill spreadsheet with data safely
  const fillSpreadsheetData = () => {
    const demoData = [
      ['Quarter', 'Sales', 'Expenses', 'Profit', 'Growth'],
      ['Q1', '10,500', '5,200', '5,300', '3.2%'],
      ['Q2', '15,300', '6,100', '9,200', '12.5%'],
      ['Q3', '18,400', '7,300', '11,100', '8.7%'],
      ['Q4', '21,200', '8,500', '12,700', '10.2%']
    ];
    
    // Initialize row and column counters
    let row = 0;
    let col = 0;
    
    // Safely fill the data cell by cell
    const interval = setInterval(() => {
      // Check if we're still within the bounds of the demo data
      if (row < demoData.length) {
        setSpreadsheetData(prev => {
          // Create a deep copy of the current data
          const newData = JSON.parse(JSON.stringify(prev));
          
          // Only try to access valid indices
          if (row < demoData.length && col < demoData[0].length && 
              row < newData.length && col < newData[0].length) {
            newData[row][col] = demoData[row][col] || '';
          }
          
          return newData;
        });
        
        // Move to next cell
        col++;
        if (col >= demoData[0].length) {
          col = 0;
          row++;
        }
      } else {
        // All cells filled, clear interval
        clearInterval(interval);
      }
    }, 150);
  };

  // Navigate to a section
  const navigateToSection = (index) => {
    if (sectionsRef.current[index]) {
      sectionsRef.current[index].scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Skip to CTA section
  const skipToEnd = () => {
    navigateToSection(sections.length - 1);
  };

  // Handle spreadsheet create button click
  const handleCreateClick = () => {
    if (user) {
      router.push('/spreadsheet');
    } else {
      // Scroll to the CTA section if user is not logged in
      navigateToSection(sections.length - 1);
    }
  };

  // Handle dashboard button click
  const handleDashboardClick = () => {
    if (user) {
      router.push('/dashboard');
    } else {
      // Scroll to the CTA section if user is not logged in
      navigateToSection(sections.length - 1);
    }
  };

  return (
    <div className={styles.landingPage}>
      <Head>
        <title>UnifiedData | Intelligent Spreadsheets</title>
        <meta name="description" content="AI-powered spreadsheet application with intelligent data analysis, visualization, and insights." />
      </Head>
      
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>📊</span>
          <span className={styles.logoText}>UnifiedData</span>
        </div>
        
        <div className={styles.headerRight}>
          <SignIn />
          <button className={styles.skipButton} onClick={skipToEnd}>
            Skip Demo
          </button>
        </div>
      </header>
      
      {/* Animated cursor */}
      <div className={styles.cursor} ref={cursorRef}></div>
      
      {/* Navigation dots */}
      <nav className={styles.navDots}>
        {sections.map((_, index) => (
          <button
            key={index}
            className={`${styles.navDot} ${activeSection === index ? styles.active : ''}`}
            onClick={() => navigateToSection(index)}
            aria-label={`Go to section ${index + 1}`}
          />
        ))}
      </nav>
      
      {/* Main content */}
      <main className={styles.main}>
        {/* Hero Section */}
        <section 
          className={styles.section} 
          data-index="0" 
          ref={el => sectionsRef.current[0] = el}
        >
          <div className={styles.sectionContent}>
            <h1 className={styles.heroTitle}>
              <span className={styles.accent}>AI-Powered</span> Spreadsheets
            </h1>
            <p className={styles.heroSubtitle}>
              Transform your data workflow with intelligent analysis and insights
            </p>
            <div className={styles.scrollPrompt}>
              <span>Scroll to explore</span>
              <div className={styles.scrollArrow}></div>
            </div>
          </div>
        </section>
        
        {/* Create Section */}
        <section 
          className={styles.section} 
          data-index="1" 
          ref={el => sectionsRef.current[1] = el}
        >
          <div className={styles.sectionContent}>
            <h2 className={styles.sectionTitle}>{sections[1].title}</h2>
            <p className={styles.sectionSubtitle}>{sections[1].subtitle}</p>
            <div 
              className={styles.createButton}
              onClick={handleCreateClick}
              style={{ cursor: 'pointer' }}
            >
              <span>+ New Spreadsheet</span>
            </div>
          </div>
        </section>
        
        {/* Data Section */}
        <section 
          className={styles.section} 
          data-index="2" 
          ref={el => sectionsRef.current[2] = el}
        >
          <div className={styles.sectionContent}>
            <h2 className={styles.sectionTitle}>{sections[2].title}</h2>
            <p className={styles.sectionSubtitle}>{sections[2].subtitle}</p>
            <div className={styles.spreadsheet}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th></th>
                    <th>A</th>
                    <th>B</th>
                    <th>C</th>
                    <th>D</th>
                    <th>E</th>
                  </tr>
                </thead>
                <tbody>
                  {spreadsheetData.map((row, rowIdx) => (
                    <tr key={rowIdx}>
                      <th>{rowIdx + 1}</th>
                      {row.map((cell, cellIdx) => (
                        <td 
                          key={`${rowIdx}-${cellIdx}`}
                          className={cell ? styles.filledCell : ''}
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
        
        {/* AI Section */}
        <section 
          className={styles.section} 
          data-index="3" 
          ref={el => sectionsRef.current[3] = el}
        >
          <div className={styles.sectionContent}>
            <h2 className={styles.sectionTitle}>{sections[3].title}</h2>
            <p className={styles.sectionSubtitle}>{sections[3].subtitle}</p>
            <div className={styles.aiChat}>
              <div className={styles.question}>
                What insights can I find in this quarterly data?
              </div>
              <div className={styles.answer}>
                <span className={styles.typing}>
                  Your Q2 sales show a 45.7% growth compared to Q1. This is significantly higher than industry average. I recommend focusing marketing efforts on Q2 performing products.
                </span>
              </div>
            </div>
          </div>
        </section>
        
        {/* Visualize Section */}
        <section 
          className={styles.section} 
          data-index="4" 
          ref={el => sectionsRef.current[4] = el}
        >
          <div className={styles.sectionContent}>
            <h2 className={styles.sectionTitle}>{sections[4].title}</h2>
            <p className={styles.sectionSubtitle}>{sections[4].subtitle}</p>
            <div className={styles.chart}>
              <div className={styles.chartHeader}>
                <h3>Quarterly Sales Performance</h3>
              </div>
              <div className={styles.chartBody}>
                <div className={styles.bars}>
                  <div className={styles.bar} style={{"--bar-height": "25%"}} data-label="Q1" data-value="$10,500"></div>
                  <div className={styles.bar} style={{"--bar-height": "45%"}} data-label="Q2" data-value="$15,300"></div>
                  <div className={styles.bar} style={{"--bar-height": "65%"}} data-label="Q3" data-value="$18,400"></div>
                  <div className={styles.bar} style={{"--bar-height": "85%"}} data-label="Q4" data-value="$21,200"></div>
                </div>
              </div>
            </div>
          </div>
        </section>
        
        {/* Dashboard Section */}
        <section 
          className={styles.section} 
          data-index="5" 
          ref={el => sectionsRef.current[5] = el}
        >
          <div className={styles.sectionContent}>
            <h2 className={styles.sectionTitle}>{sections[5].title}</h2>
            <p className={styles.sectionSubtitle}>{sections[5].subtitle}</p>
            <div className={styles.dashboard}>
              <div className={styles.dashboardHeader}>
                <h3>Financial Performance</h3>
              </div>
              <div className={styles.dashboardBody}>
                <div className={styles.miniChart}></div>
                <div className={styles.metrics}>
                  <div className={styles.metric}>
                    <div className={styles.metricValue}>$65,400</div>
                    <div className={styles.metricLabel}>Total Sales</div>
                  </div>
                  <div className={styles.metric}>
                    <div className={styles.metricValue}>$27,100</div>
                    <div className={styles.metricLabel}>Total Expenses</div>
                  </div>
                  <div className={styles.metric}>
                    <div className={styles.metricValue}>$38,300</div>
                    <div className={styles.metricLabel}>Total Profit</div>
                  </div>
                </div>
              </div>
            </div>
            <button 
              className={styles.primaryButton}
              onClick={handleDashboardClick}
              style={{ marginTop: '2rem' }}
            >
              View Dashboards
            </button>
          </div>
        </section>
        
        {/* CTA Section */}
        <section 
          className={styles.section} 
          data-index="6" 
          ref={el => sectionsRef.current[6] = el}
        >
          <div className={styles.sectionContent}>
            <h2 className={styles.sectionTitle}>{sections[6].title}</h2>
            <p className={styles.sectionSubtitle}>{sections[6].subtitle}</p>
            
            {user ? (
              <div className={styles.ctaButtons}>
                <button 
                  className={styles.primaryButton}
                  onClick={() => router.push('/spreadsheet')}
                >
                  Create Spreadsheet
                </button>
                <button 
                  className={styles.secondaryButton}
                  onClick={() => router.push('/dashboard')}
                >
                  View Dashboards
                </button>
              </div>
            ) : (
              <div className={styles.signInContainer}>
                <p className={styles.signInMessage}>Sign in to get started with UnifiedData</p>
                <SignIn />
              </div>
            )}
          </div>
        </section>
      </main>
      
      {/* Footer */}
      <footer className={styles.footer}>
        <p>© {new Date().getFullYear()} UnifiedData. All rights reserved.</p>
      </footer>
    </div>
  );
}
