import { useEffect, useRef } from 'react';
import styles from '../styles/Modal.module.css';

const Modal = ({ isOpen, onClose, title, children, actions }) => {
  const modalRef = useRef(null);
  
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden'; // Prevent scrolling when modal is open
    }
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = ''; // Re-enable scrolling when modal is closed
    };
  }, [isOpen, onClose]);
  
  if (!isOpen) return null;
  
  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div 
        className={styles.modalContent} 
        onClick={(e) => e.stopPropagation()}
        ref={modalRef}
      >
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>{title}</h3>
          <button 
            className={styles.closeButton} 
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className={styles.modalBody}>
          {children}
        </div>
        {actions && (
          <div className={styles.modalFooter}>
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;
