// components/LandingPage.js
import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import styles from '../styles/LandingPage.module.css';
import { useAuth } from '../contexts/AuthContext';
import SignIn from '../components/auth/SignIn';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../utils/firebase';

export default function LandingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState(0);
  const sectionsRef = useRef([]);
  const [activeDemoTab, setActiveDemoTab] = useState('dashboard');
  
  // Define feature sections
  const features = [
    {
      id: 'ai-analysis',
      title: 'AI-Powered Analysis',
      description: 'Get instant insights from your data using advanced AI algorithms',
      icon: '🤖',
      demo: {
        type: 'chat',
        question: "What are the key trends in this sales data?",
        answer: "The data shows a strong upward trend in Q2 sales, with a 45.7% growth compared to Q1. The profit margin has also improved significantly."
      }
    },
    {
      id: 'data-cleaning',
      title: 'Smart Data Cleaning',
      description: 'Automatically fill missing values and clean your data with AI assistance',
      icon: '🧹',
      demo: {
        type: 'cleaning',
        before: [
          ['Name', 'Age', 'Location'],
          ['John Doe', '', 'New York, NY'],
          ['Jane Smith', '25', ''],
          ['Bob Johnson', '35', 'Chicago, IL']
        ],
        after: [
          ['Name', 'Age', 'Location'],
          ['John Doe', '30', 'New York, NY'],
          ['Jane Smith', '25', 'Los Angeles, CA'],
          ['Bob Johnson', '35', 'Chicago, IL']
        ]
      }
    },
    {
      id: 'dashboards',
      title: 'Interactive Dashboards',
      description: 'Create beautiful, interactive dashboards with drag-and-drop ease',
      icon: '📊',
      demo: {
        type: 'dashboard',
        metrics: [
          { label: 'Total Sales', value: '$65,400', change: '+12.5%' },
          { label: 'Active Users', value: '1,234', change: '+8.2%' },
          { label: 'Conversion Rate', value: '3.2%', change: '+0.5%' }
        ],
        chart: {
          type: 'bar',
          data: [
            { label: 'Q1', value: 10500 },
            { label: 'Q2', value: 15300 },
            { label: 'Q3', value: 18400 },
            { label: 'Q4', value: 21200 }
          ]
        }
      }
    },
    {
      id: 'ai-reports',
      title: 'AI Report Generation',
      description: 'Generate comprehensive reports with AI-powered insights',
      icon: '📝',
      demo: {
        type: 'report',
        sections: [
          {
            title: 'Executive Summary',
            content: 'The data shows strong growth in Q2, with significant improvements in both sales and profit margins.'
          },
          {
            title: 'Key Findings',
            content: '1. Sales increased by 45.7% in Q2\n2. Profit margins improved by 8.2%\n3. Customer acquisition cost decreased by 12%'
          }
        ]
      }
    }
  ];

  // Setup intersection observer for sections
  useEffect(() => {
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
    
    sectionsRef.current.forEach(section => {
      if (section) observer.observe(section);
    });
    
    return () => observer.disconnect();
  }, []);

  const handleSectionChange = (index) => {
    if (index !== activeSection) {
      setActiveSection(index);
    }
  };

  const navigateToSection = (index) => {
    if (sectionsRef.current[index]) {
      sectionsRef.current[index].scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleGetStarted = () => {
    if (user) {
      router.push('/spreadsheet');
    } else {
      router.push('/auth/signup');
    }
  };

  // Google sign-in logic (same as SignIn.js)
  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Error signing in with Google", error);
    }
  };

  return (
    <div className={styles.landingPage}>
      <Head>
        <title>UnifiedData | AI-Powered Data Analysis Platform</title>
        <meta name="description" content="Transform your data workflow with AI-powered analysis, visualization, and insights." />
      </Head>
      
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>📊</span>
          <span className={styles.logoText}>UnifiedData</span>
        </div>
        
        <div className={styles.headerRight}>
          <SignIn />
        </div>
      </header>
      
      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>
            Transform Your Data with <span className={styles.accent}>AI Power</span>
          </h1>
          <p className={styles.heroSubtitle}>
            Analyze, visualize, and get insights from your data using advanced AI technology
          </p>
          <div className={styles.heroButtons}>
            <button 
              className={styles.primaryButton}
              onClick={signInWithGoogle}
            >
              Get Started
            </button>
            <button 
              className={styles.secondaryButton}
              onClick={() => navigateToSection(1)}
            >
              Explore Features
            </button>
          </div>
        </div>
        <div className={styles.heroImage}>
          <div className={styles.demoPreview}>
            <div className={styles.previewHeader}>
              <div className={styles.previewTabs}>
                <span
                  className={activeDemoTab === 'dashboard' ? styles.activeTab : ''}
                  onClick={() => setActiveDemoTab('dashboard')}
                  style={{ cursor: 'pointer' }}
                >
                  Dashboard
                </span>
                <span
                  className={activeDemoTab === 'analysis' ? styles.activeTab : ''}
                  onClick={() => setActiveDemoTab('analysis')}
                  style={{ cursor: 'pointer' }}
                >
                  Analysis
                </span>
                <span
                  className={activeDemoTab === 'reports' ? styles.activeTab : ''}
                  onClick={() => setActiveDemoTab('reports')}
                  style={{ cursor: 'pointer' }}
                >
                  Reports
                </span>
              </div>
            </div>
            <div className={styles.previewContent}>
              {activeDemoTab === 'dashboard' && (
                <div className={styles.metricsGrid}>
                  <div className={styles.metricCard}>
                    <div className={styles.metricValue}>$65,400</div>
                    <div className={styles.metricLabel}>Total Sales</div>
                    <div className={styles.metricChange}>+12.5%</div>
                  </div>
                  <div className={styles.metricCard}>
                    <div className={styles.metricValue}>1,234</div>
                    <div className={styles.metricLabel}>Active Users</div>
                    <div className={styles.metricChange}>+8.2%</div>
                  </div>
                </div>
              )}
              {activeDemoTab === 'analysis' && (
                <div className={styles.demoChat}>
                  <div className={styles.chatQuestion}>
                    <span className={styles.userIcon}>👤</span>
                    <span>What are the key trends in this sales data?</span>
                  </div>
                  <div className={styles.chatAnswer}>
                    <span className={styles.aiIcon}>🤖</span>
                    <span>The data shows a strong upward trend in Q2 sales, with a 45.7% growth compared to Q1. The profit margin has also improved significantly.</span>
                  </div>
                </div>
              )}
              {activeDemoTab === 'reports' && (
                <div className={styles.demoReport}>
                  <div className={styles.reportSection}>
                    <div className={styles.reportTitle}>Executive Summary</div>
                    <div className={styles.reportContent}>The data shows strong growth in Q2, with significant improvements in both sales and profit margins.</div>
                  </div>
                  <div className={styles.reportSection}>
                    <div className={styles.reportTitle}>Key Findings</div>
                    <ul className={styles.reportList}>
                      <li>Sales increased by 45.7% in Q2</li>
                      <li>Profit margins improved by 8.2%</li>
                      <li>Customer acquisition cost decreased by 12%</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
      
      {/* Features Section */}
      <section className={styles.features}>
        <h2 className={styles.sectionTitle}>Powerful Features</h2>
        <p className={styles.sectionSubtitle}>Everything you need to work with your data</p>
        
        <div className={styles.featuresGrid}>
          {features.map((feature, index) => (
            <div 
              key={feature.id}
              className={styles.featureCard}
              data-index={index}
              ref={el => sectionsRef.current[index] = el}
            >
              <div className={styles.featureIcon}>{feature.icon}</div>
              <h3 className={styles.featureTitle}>{feature.title}</h3>
              <p className={styles.featureDescription}>{feature.description}</p>
              
              {/* AI-Powered Analysis Demo */}
              {feature.demo.type === 'chat' && (
                <div className={styles.demoChat}>
                  <div className={styles.chatQuestion}>
                    <span className={styles.userIcon}>👤</span>
                    <span>{feature.demo.question}</span>
                  </div>
                  <div className={styles.chatAnswer}>
                    <span className={styles.aiIcon}>🤖</span>
                    <span>{feature.demo.answer}</span>
                  </div>
                </div>
              )}

              {/* Smart Data Cleaning Demo */}
              {feature.demo.type === 'cleaning' && (
                <div className={styles.demoCleaning}>
                  <div className={styles.cleaningTables}>
                    <div>
                      <div className={styles.cleaningLabel}>Before</div>
                      <table className={styles.cleaningTable}>
                        <thead>
                          <tr>
                            {feature.demo.before[0].map((cell, j) => (
                              <th key={j}>{cell}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {feature.demo.before.slice(1).map((row, i) => (
                            <tr key={i}>
                              {row.map((cell, j) => (
                                <td key={j}>{cell}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div>
                      <div className={styles.cleaningLabel}>After</div>
                      <table className={styles.cleaningTable}>
                        <thead>
                          <tr>
                            {feature.demo.after[0].map((cell, j) => (
                              <th key={j}>{cell}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {feature.demo.after.slice(1).map((row, i) => (
                            <tr key={i}>
                              {row.map((cell, j) => (
                                <td key={j}>{cell}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Interactive Dashboards Demo */}
              {feature.demo.type === 'dashboard' && (
                <div className={styles.demoDashboard}>
                  <div className={styles.metricsRow}>
                    {feature.demo.metrics.map((metric, i) => (
                      <div key={i} className={styles.metricItem}>
                        <div className={styles.metricValue}>{metric.value}</div>
                        <div className={styles.metricLabel}>{metric.label}</div>
                        <div className={styles.metricChange}>{metric.change}</div>
                      </div>
                    ))}
                  </div>
                  <div className={styles.chartContainer}>
                    {feature.demo.chart.data.map((item, i) => (
                      <div 
                        key={i}
                        className={styles.chartBar}
                        style={{ height: `${(item.value / 21200) * 100}%` }}
                      >
                        <span className={styles.barLabel}>{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Report Generation Demo */}
              {feature.demo.type === 'report' && (
                <div className={styles.demoReport}>
                  <div className={styles.reportSection}>
                    <div className={styles.reportTitle}>{feature.demo.sections[0].title}</div>
                    <div className={styles.reportContent}>{feature.demo.sections[0].content}</div>
                  </div>
                  <div className={styles.reportSection}>
                    <div className={styles.reportTitle}>{feature.demo.sections[1].title}</div>
                    <ul className={styles.reportList}>
                      {feature.demo.sections[1].content.split('\n').map((item, i) => (
                        <li key={i}>{item.replace(/^\d+\.\s*/, '')}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
      
      {/* CTA Section */}
      <section className={styles.cta}>
        <div className={styles.ctaContent}>
          <h2 className={styles.ctaTitle}>Ready to Transform Your Data?</h2>
          <p className={styles.ctaSubtitle}>
            Join thousands of data professionals using UnifiedData to make better decisions
          </p>
          <div className={styles.ctaButtons}>
            <button 
              className={styles.primaryButton}
              onClick={signInWithGoogle}
            >
              Check now
            </button>
          </div>
        </div>
      </section>
      
      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerBottom}>
          <p>© {new Date().getFullYear()} UnifiedData. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
