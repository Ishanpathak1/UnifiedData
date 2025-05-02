import { useEffect, useState, useRef } from 'react';
import styles from '../styles/ReportViewer.module.css';
import { Chart as ChartJS } from 'chart.js/auto';
import { Line, Bar, Pie, Scatter } from 'react-chartjs-2';
import { usePDF } from 'react-to-pdf';

const StatisticalMetricsCard = ({ title, stats }) => (
  <div className={styles.metricsCard}>
    <h3>{title}</h3>
    <div className={styles.metricsGrid}>
      {Object.entries(stats).map(([metric, value]) => (
        <div key={metric} className={styles.metricItem}>
          <span className={styles.metricLabel}>{metric}:</span>
          <span className={styles.metricValue}>
            {typeof value === 'number' ? value.toLocaleString(undefined, {
              minimumFractionDigits: 0,
              maximumFractionDigits: 2
            }) : value}
          </span>
        </div>
      ))}
    </div>
  </div>
);

const DataQualityCard = ({ column }) => (
  <div className={styles.qualityCard}>
    <div className={styles.qualityHeader}>
      <h3>{column.name}</h3>
      <span className={`${styles.qualityType} ${styles[column.type]}`}>
        {column.type}
      </span>
    </div>
    <div className={styles.qualityStats}>
      {column.stats && (
        <>
          <div className={styles.statRow}>
            <span>Total Records:</span>
            <span>{column.stats.total}</span>
          </div>
          <div className={styles.statRow}>
            <span>Missing Values:</span>
            <span className={column.stats.missing > 0 ? styles.warning : ''}>
              {column.stats.missing}
            </span>
          </div>
          <div className={styles.statRow}>
            <span>Unique Values:</span>
            <span>{column.stats.unique}</span>
          </div>
          {column.type === 'numeric' && (
            <>
              <div className={styles.statRow}>
                <span>Range:</span>
                <span>{column.stats.min} - {column.stats.max}</span>
              </div>
              <div className={styles.statRow}>
                <span>Mean:</span>
                <span>{column.stats.mean?.toFixed(2)}</span>
              </div>
            </>
          )}
        </>
      )}
    </div>
    {column.issues && column.issues.length > 0 && (
      <div className={styles.issues}>
        {column.issues.map((issue, index) => (
          <div key={index} className={`${styles.issue} ${styles[issue.severity]}`}>
            {issue.description}
          </div>
        ))}
      </div>
    )}
  </div>
);

const ProgressIndicator = ({ progress, stage, message }) => (
  <div className={styles.progressContainer}>
    <div className={styles.progressBar}>
      <div 
        className={styles.progressFill} 
        style={{ width: `${progress}%` }}
      ></div>
    </div>
    <div className={styles.progressStatus}>
      <span className={styles.stage}>{stage}</span>
      <span className={styles.message}>{message}</span>
    </div>
  </div>
);

const formatValue = (value) => {
  if (typeof value === 'number') {
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });
  }
  return value;
};

const formatMarkdown = (text) => {
  if (!text) return null;

  // Split the text into sections based on markdown headers and lists
  const sections = text.split(/(?=### |## |# |\d+\. |\n- )/);
  
  return sections.map((section, index) => {
    // Handle headers
    if (section.startsWith('### ')) {
      return (
        <h4 key={index} className={styles.markdownH3}>
          {section.replace('### ', '')}
        </h4>
      );
    }
    if (section.startsWith('## ')) {
      return (
        <h3 key={index} className={styles.markdownH2}>
          {section.replace('## ', '')}
        </h3>
      );
    }
    if (section.startsWith('# ')) {
      return (
        <h2 key={index} className={styles.markdownH1}>
          {section.replace('# ', '')}
        </h2>
      );
    }

    // Handle numbered lists
    if (section.match(/^\d+\. /)) {
      const items = section.split('\n').map((item, i) => {
        if (item.trim() === '') return null;
        
        // Handle nested bullet points
        if (item.startsWith('  - ')) {
          return (
            <div key={i} className={styles.nestedListItem}>
              <span className={styles.bullet}>•</span>
              <span dangerouslySetInnerHTML={{ __html: item.replace(/^  - /, '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
            </div>
          );
        }

        const match = item.match(/^(\d+)\.\s*(.*)/);
        if (!match) return null;
        const [_, number, content] = match;
        
        return (
          <div key={i} className={styles.markdownListItem}>
            <span className={styles.number}>{number}.</span>
            <span dangerouslySetInnerHTML={{ __html: content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
          </div>
        );
      }).filter(Boolean);

      return <div key={index} className={styles.markdownList}>{items}</div>;
    }

    // Handle bullet lists
    if (section.startsWith('\n- ')) {
      const items = section.split('\n').map((item, i) => {
        if (item.trim() === '') return null;
        
        // Handle nested bullet points
        if (item.startsWith('  - ')) {
          return (
            <div key={i} className={styles.nestedListItem}>
              <span className={styles.bullet}>•</span>
              <span dangerouslySetInnerHTML={{ __html: item.replace(/^  - /, '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
            </div>
          );
        }

        const content = item.replace(/^- /, '');
        return (
          <div key={i} className={styles.markdownListItem}>
            <span className={styles.bullet}>•</span>
            <span dangerouslySetInnerHTML={{ __html: content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
          </div>
        );
      }).filter(Boolean);

      return <div key={index} className={styles.markdownList}>{items}</div>;
    }

    // Handle regular paragraphs with bold text
    const paragraphs = section.split('\n\n').map((paragraph, i) => (
      <p key={i} className={styles.markdownParagraph}>
        <span dangerouslySetInnerHTML={{ __html: paragraph.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
      </p>
    ));

    return <div key={index} className={styles.markdownSection}>{paragraphs}</div>;
  });
};

const formatError = (error) => {
  if (!error) return null;
  
  return (
    <div className={styles.errorMessage}>
      <span className={styles.errorIcon}>⚠️</span>
      <span>{error}</span>
    </div>
  );
};

const formatInsight = (insight) => {
  // If the insight is a markdown-formatted text
  if (typeof insight === 'string' && (insight.includes('###') || insight.includes('**') || insight.includes('\n-'))) {
    return (
      <div className={styles.markdownInsight}>
        {formatMarkdown(insight)}
      </div>
    );
  }

  // For simple insights with emoji
  const [emoji, ...textParts] = insight.split(' ');
  const text = textParts.join(' ');
  
  return (
    <div className={styles.insightItem}>
      <span className={styles.insightEmoji}>{emoji}</span>
      <span className={styles.insightText}>{text}</span>
    </div>
  );
};

const formatStats = (stats) => {
  return (
    <div className={styles.statsGrid}>
      {Object.entries(stats).map(([key, value]) => (
        <div key={key} className={styles.statItem}>
          <span className={styles.statLabel}>{key.replace(/_/g, ' ')}:</span>
          <span className={styles.statValue}>{formatValue(value)}</span>
        </div>
      ))}
    </div>
  );
};

const formatCorrelation = (correlation) => {
  return (
    <div className={styles.correlationContainer}>
      <h3 className={styles.correlationTitle}>Correlation Analysis</h3>
      <div className={styles.correlationGrid}>
        {Object.entries(correlation).map(([key, value]) => (
          <div key={key} className={styles.correlationItem}>
            <span className={styles.correlationLabel}>{key}:</span>
            <span className={styles.correlationValue}>{formatValue(value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const formatColumn = (column) => {
  return (
    <div key={column.index} className={styles.columnCard}>
      <div className={styles.columnHeader}>
        <h3 className={styles.columnName}>{column.name}</h3>
        <span className={`${styles.columnType} ${styles[column.type]}`}>
          {column.type}
        </span>
      </div>
      
      <div className={styles.columnStats}>
        <div className={styles.statRow}>
          <span>Total Records:</span>
          <span>{column.stats.total}</span>
        </div>
        <div className={styles.statRow}>
          <span>Missing Values:</span>
          <span className={column.stats.missing > 0 ? styles.warning : ''}>
            {column.stats.missing}
          </span>
        </div>
        <div className={styles.statRow}>
          <span>Unique Values:</span>
          <span>{column.stats.unique}</span>
        </div>
        {column.type === 'numeric' && (
          <>
            <div className={styles.statRow}>
              <span>Range:</span>
              <span>{formatValue(column.stats.min)} - {formatValue(column.stats.max)}</span>
            </div>
            <div className={styles.statRow}>
              <span>Mean:</span>
              <span>{formatValue(column.stats.mean)}</span>
            </div>
            <div className={styles.statRow}>
              <span>Median:</span>
              <span>{formatValue(column.stats.median)}</span>
            </div>
          </>
        )}
      </div>

      {column.issues && column.issues.length > 0 && (
        <div className={styles.issues}>
          {column.issues.map((issue, index) => (
            <div key={index} className={`${styles.issue} ${styles[issue.severity]}`}>
              {issue.description}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const formatSuggestion = (suggestion) => {
  return (
    <div key={suggestion.column_index} className={styles.suggestionCard}>
      <div className={styles.suggestionHeader}>
        <h3 className={styles.columnName}>{suggestion.column_name}</h3>
        <span className={`${styles.severity} ${styles[suggestion.severity]}`}>
          {suggestion.severity}
        </span>
      </div>
      <div className={styles.suggestionContent}>
        <div className={styles.action}>
          <span className={styles.actionLabel}>Action:</span>
          <span className={styles.actionDescription}>{suggestion.action.description}</span>
        </div>
        {suggestion.action.value !== undefined && (
          <div className={styles.actionValue}>
            <span className={styles.valueLabel}>Value:</span>
            <span className={styles.value}>{formatValue(suggestion.action.value)}</span>
          </div>
        )}
      </div>
    </div>
  );
};

const formatSummary = (summary) => {
  return (
    <div className={styles.summaryCard}>
      <h3 className={styles.summaryTitle}>Data Quality Summary</h3>
      <div className={styles.summaryGrid}>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Total Columns:</span>
          <span className={styles.summaryValue}>{summary.totalColumns}</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Columns with Issues:</span>
          <span className={styles.warning}>{summary.columnsWithIssues}</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Clean Columns:</span>
          <span className={styles.success}>{summary.cleanColumns}</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Total Issues:</span>
          <span className={styles.warning}>{summary.totalIssues}</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Critical Issues:</span>
          <span className={styles.critical}>{summary.criticalIssues}</span>
        </div>
      </div>
    </div>
  );
};

const formatContent = (content) => {
  if (!content) return null;

  return Object.entries(content).map(([key, value]) => {
    if (key === 'error') {
      return formatError(value);
    }

    if (typeof value === 'object' && value !== null) {
      if (key === 'columns') {
        return (
          <div key={key} className={styles.columnsSection}>
            <h3 className={styles.sectionTitle}>Columns Analysis</h3>
            <div className={styles.columnsGrid}>
              {value.map(formatColumn)}
            </div>
          </div>
        );
      }

      if (key === 'suggestions') {
        return (
          <div key={key} className={styles.suggestionsSection}>
            <h3 className={styles.sectionTitle}>Data Quality Suggestions</h3>
            <div className={styles.suggestionsGrid}>
              {value.map(formatSuggestion)}
            </div>
          </div>
        );
      }

      if (key === 'summary') {
        return formatSummary(value);
      }

      if (key === 'basic_stats') {
        return (
          <div key={key} className={styles.statsSection}>
            <h3 className={styles.sectionTitle}>Basic Statistics</h3>
            {Object.entries(value).map(([metric, stats]) => (
              <div key={metric} className={styles.metricCard}>
                <h4 className={styles.metricTitle}>{metric}</h4>
                {formatStats(stats)}
              </div>
            ))}
          </div>
        );
      }

      if (key === 'correlation') {
        return formatCorrelation(value);
      }

      return (
        <div key={key} className={styles.contentSection}>
          <h3 className={styles.sectionTitle}>{key.replace(/_/g, ' ')}</h3>
          <div className={styles.contentValue}>
            {JSON.stringify(value, null, 2)}
          </div>
        </div>
      );
    }

    return (
      <div key={key} className={styles.contentItem}>
        <span className={styles.contentLabel}>{key.replace(/_/g, ' ')}:</span>
        <span className={styles.contentValue}>{formatValue(value)}</span>
      </div>
    );
  });
};

const ReportViewer = ({ report }) => {
  const [currentPage, setCurrentPage] = useState(0);
  const [activeTab, setActiveTab] = useState('statistics');
  const [analysisProgress, setAnalysisProgress] = useState(null);
  const reportRef = useRef();
  const { toPDF, targetRef } = usePDF({
    filename: `${report?.title || 'report'}.pdf`,
    page: { format: 'a4', orientation: 'portrait' },
    method: 'save'
  });

  // Move state updates to useEffect
  useEffect(() => {
    if (report?.sections) {
      const statisticalSection = report.sections.find(section => section.title === "Statistical Analysis");
      if (statisticalSection?.progress_updates) {
        const latestUpdate = statisticalSection.progress_updates[statisticalSection.progress_updates.length - 1];
        setAnalysisProgress(latestUpdate);
      }
    }
  }, [report]);

  if (!report) {
    return (
      <div className={styles.empty}>
        No report data available
      </div>
    );
  }

  // Helper function to safely check nested objects
  const getNestedValue = (obj, path) => {
    return path.reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : null), obj);
  };

  const statisticalData = getNestedValue(report, ['sections', 0, 'content', 'basic_stats']);
  const statisticalInsights = getNestedValue(report, ['sections', 0, 'insights']) || [];
  const dataQualityColumns = getNestedValue(report, ['sections', 1, 'content', 'columns']) || [];
  const dataQualitySummary = getNestedValue(report, ['sections', 1, 'content', 'summary']) || {};

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const renderVisualization = (visualization) => {
    const chartConfig = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom'
        },
        title: {
          display: true,
          text: visualization.title || ''
        }
      }
    };

    switch (visualization.type) {
      case 'line':
        return <Line data={visualization.data} options={chartConfig} />;
      case 'bar':
        return <Bar data={visualization.data} options={chartConfig} />;
      case 'pie':
        return <Pie data={visualization.data} options={chartConfig} />;
      case 'scatter':
        return <Scatter data={visualization.data} options={chartConfig} />;
      default:
        return null;
    }
  };

  const renderSection = (section) => {
    return (
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>{section.title}</h2>
        
        {/* Show progress indicator if analysis is in progress */}
        {section.title === "Statistical Analysis" && analysisProgress && (
          <ProgressIndicator
            progress={analysisProgress.progress}
            stage={analysisProgress.stage}
            message={analysisProgress.message}
          />
        )}
        
        {/* Content */}
        {section.content && Object.keys(section.content).length > 0 && (
          <div className={styles.content}>
            {formatContent(section.content)}
          </div>
        )}

        {/* Visualizations */}
        {section.visualizations && section.visualizations.length > 0 && (
          <div className={styles.visualizations}>
            {section.visualizations.map((viz, index) => (
              <div key={index} className={styles.visualization}>
                {renderVisualization(viz)}
              </div>
            ))}
          </div>
        )}

        {/* Insights */}
        {section.insights && section.insights.length > 0 && (
          <div className={styles.insightsContainer}>
            <h3 className={styles.insightsTitle}>Key Insights</h3>
            <div className={styles.insightsList}>
              {section.insights.map((insight, index) => (
                <div key={index}>
                  {formatInsight(insight)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const handleExportPDF = () => {
    toPDF();
  };

  return (
    <div className={styles.reportContainer}>
      <div className={styles.reportHeader}>
        <h1>{report.title}</h1>
        <p className={styles.description}>{report.description}</p>
        <div className={styles.metadata}>
          <span>Report ID: {report.report_id}</span>
          <span>Generated: {formatDate(report.created_at)}</span>
        </div>
        <div className={styles.exportOptions}>
          <button 
            className={styles.exportButton}
            onClick={handleExportPDF}
          >
            Export as PDF
          </button>
        </div>
      </div>

      <div ref={targetRef} className={styles.pdfContent}>
        <div className={styles.tabContainer}>
          <button
            className={`${styles.tab} ${activeTab === 'statistics' ? styles.active : ''}`}
            onClick={() => setActiveTab('statistics')}
          >
            Statistical Analysis
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'quality' ? styles.active : ''}`}
            onClick={() => setActiveTab('quality')}
          >
            Data Quality Analysis
          </button>
        </div>

        <div className={styles.contentContainer}>
          {activeTab === 'statistics' && (
            <div className={styles.statisticsSection}>
              <h2>Statistical Analysis</h2>
              {statisticalData ? (
                <div className={styles.metricsContainer}>
                  {Object.entries(statisticalData).map(([key, stats]) => (
                    <StatisticalMetricsCard key={key} title={key} stats={stats} />
                  ))}
                </div>
              ) : (
                <div className={styles.empty}>No statistical data available</div>
              )}
              
              {statisticalInsights.length > 0 && (
                <div className={styles.keyInsights}>
                  <h2>Key Insights</h2>
                  <ul>
                    {statisticalInsights.map((insight, index) => (
                      <li key={index}>{insight}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {activeTab === 'quality' && (
            <div className={styles.qualitySection}>
              <h2>Data Quality Analysis</h2>
              {Object.keys(dataQualitySummary).length > 0 && (
                <div className={styles.qualitySummary}>
                  <h3>Overview</h3>
                  <div className={styles.summaryStats}>
                    <div className={styles.summaryItem}>
                      <span>Total Columns:</span>
                      <span>{dataQualitySummary.totalColumns}</span>
                    </div>
                    <div className={styles.summaryItem}>
                      <span>Columns with Issues:</span>
                      <span className={styles.warning}>
                        {dataQualitySummary.columnsWithIssues}
                      </span>
                    </div>
                    <div className={styles.summaryItem}>
                      <span>Critical Issues:</span>
                      <span className={styles.critical}>
                        {dataQualitySummary.criticalIssues}
                      </span>
                    </div>
                  </div>
                </div>
              )}
              
              {dataQualityColumns.length > 0 ? (
                <div className={styles.columnsGrid}>
                  {dataQualityColumns.map((column, index) => (
                    <DataQualityCard key={index} column={column} />
                  ))}
                </div>
              ) : (
                <div className={styles.empty}>No data quality information available</div>
              )}
            </div>
          )}
        </div>

        {/* Table of Contents */}
        <div className={styles.tableOfContents}>
          <h2>Table of Contents</h2>
          <ol>
            {report.sections.map((section, index) => (
              <li key={index}>
                <a href={`#section-${index}`} onClick={() => setCurrentPage(index)}>
                  {section.title}
                </a>
              </li>
            ))}
          </ol>
        </div>

        {/* Report Sections */}
        <div className={styles.reportContent}>
          {report.sections.map((section, index) => (
            <div key={index} id={`section-${index}`}>
              {renderSection(section)}
            </div>
          ))}
        </div>

        {/* Report Summary */}
        <div className={styles.reportSummary}>
          <h2>Report Summary</h2>
          <div className={styles.summaryContent}>
            {report.summary.key_findings && (
              <div className={styles.keyFindings}>
                <h3>Key Findings</h3>
                <ul>
                  {report.summary.key_findings.map((finding, index) => (
                    <li key={index}>{finding}</li>
                  ))}
                </ul>
              </div>
            )}
            {report.summary.metrics && Object.keys(report.summary.metrics).length > 0 && (
              <div className={styles.metrics}>
                <h3>Metrics Overview</h3>
                <pre className={styles.jsonContent}>
                  {JSON.stringify(report.summary.metrics, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportViewer;
