import { useState } from 'react';
import { WIDGET_TYPES, WIDGET_DISPLAY_INFO, createNewWidget } from '../utils/widgetTypes';
import styles from '../styles/AddWidgetModal.module.css';

export default function AddWidgetModal({ onClose, onAddWidget }) {
  const [selectedType, setSelectedType] = useState(null);

  const handleAddWidget = (type) => {
    if (!type) return;
    
    const newWidget = createNewWidget(type);
    onAddWidget(newWidget);
    onClose();
  };

  const widgetTypes = Object.values(WIDGET_TYPES);

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h3>Add Widget</h3>
          <button 
            className={styles.closeButton}
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className={styles.modalContent}>
          <div className={styles.widgetTypeGrid}>
            {widgetTypes.map(type => (
              <div 
                key={type}
                className={`${styles.widgetTypeCard} ${selectedType === type ? styles.selected : ''}`}
                onClick={() => setSelectedType(type)}
                onDoubleClick={() => handleAddWidget(type)}
              >
                <div className={styles.widgetTypeIcon}>{WIDGET_DISPLAY_INFO[type].icon}</div>
                <h4>{WIDGET_DISPLAY_INFO[type].name}</h4>
                <p>{WIDGET_DISPLAY_INFO[type].description}</p>
              </div>
            ))}
          </div>
          
          <div className={styles.modalActions}>
            <button 
              className={styles.cancelButton}
              onClick={onClose}
            >
              Cancel
            </button>
            <button 
              className={styles.addButton}
              onClick={() => handleAddWidget(selectedType)}
              disabled={!selectedType}
            >
              Add Widget
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
