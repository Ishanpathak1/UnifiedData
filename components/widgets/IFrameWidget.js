import { useState, useEffect } from 'react';
import styles from '../../styles/widgets/IFrameWidget.module.css';

export default function IFrameWidget({ id, config }) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const {
    url = '',
    aspectRatio = '16:9',
    scrollable = true,
    allowFullscreen = true
  } = config || {};

  // Calculate padding based on aspect ratio
  const getPaddingBottom = () => {
    if (!aspectRatio || !aspectRatio.includes(':')) return '56.25%'; // Default 16:9
    
    const [width, height] = aspectRatio.split(':').map(Number);
    if (!width || !height) return '56.25%';
    
    return `${(height / width) * 100}%`;
  };

  // Handle iframe load events
  const handleLoad = () => {
    setIsLoading(false);
  };

  const handleError = () => {
    setIsLoading(false);
    setError('Failed to load content');
  };

  // Check if URL is valid
  const isValidUrl = () => {
    try {
      new URL(url);
      return true;
    } catch (e) {
      return false;
    }
  };

  return (
    <div className={styles.iframeWidget}>
      <div 
        className={styles.iframeContainer}
        style={{ paddingBottom: getPaddingBottom() }}
      >
        {!url ? (
          <div className={styles.noUrl}>
            No URL specified. Edit this widget to add content.
          </div>
        ) : !isValidUrl() ? (
          <div className={styles.invalidUrl}>
            Invalid URL format: {url}
          </div>
        ) : (
          <>
            {isLoading && (
              <div className={styles.loading}>
                <div className={styles.spinner}></div>
                <span>Loading content...</span>
              </div>
            )}
            
            {error && (
              <div className={styles.error}>
                {error}
              </div>
            )}
            
            <iframe
              src={url}
              className={styles.iframe}
              onLoad={handleLoad}
              onError={handleError}
              frameBorder="0"
              scrolling={scrollable ? 'yes' : 'no'}
              allowFullScreen={allowFullscreen}
              loading="lazy"
              title={`iframe-${id}`}
            />
          </>
        )}
      </div>
    </div>
  );
}
