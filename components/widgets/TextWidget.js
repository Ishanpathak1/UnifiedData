import { useState, useEffect } from 'react';
import styles from '../../styles/widgets/TextWidget.module.css';

export default function TextWidget({ id, config, onEdit }) {
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(config?.content || 'Add your text here...');
  const [formatting, setFormatting] = useState(config?.formatting || {
    align: 'left',
    fontSize: 'medium'
  });

  // Save content when editing is done
  const handleSave = () => {
    setIsEditing(false);
    if (onEdit) {
      onEdit(id, {
        ...config,
        content,
        formatting
      });
    }
  };

  // Apply formatting to content container
  const contentStyle = {
    textAlign: formatting.align,
    fontSize: getFontSize(formatting.fontSize)
  };

  return (
    <div className={styles.textWidget}>
      {isEditing ? (
        <div className={styles.editor}>
          <div className={styles.toolbar}>
            <div className={styles.alignmentControls}>
              <button 
                className={`${styles.toolbarButton} ${formatting.align === 'left' ? styles.active : ''}`}
                onClick={() => setFormatting({...formatting, align: 'left'})}
              >
                ⇠
              </button>
              <button 
                className={`${styles.toolbarButton} ${formatting.align === 'center' ? styles.active : ''}`}
                onClick={() => setFormatting({...formatting, align: 'center'})}
              >
                ⇡
              </button>
              <button 
                className={`${styles.toolbarButton} ${formatting.align === 'right' ? styles.active : ''}`}
                onClick={() => setFormatting({...formatting, align: 'right'})}
              >
                ⇢
              </button>
            </div>
            <div className={styles.fontSizeControls}>
              <button 
                className={`${styles.toolbarButton} ${formatting.fontSize === 'small' ? styles.active : ''}`}
                onClick={() => setFormatting({...formatting, fontSize: 'small'})}
              >
                A-
              </button>
              <button 
                className={`${styles.toolbarButton} ${formatting.fontSize === 'medium' ? styles.active : ''}`}
                onClick={() => setFormatting({...formatting, fontSize: 'medium'})}
              >
                A
              </button>
              <button 
                className={`${styles.toolbarButton} ${formatting.fontSize === 'large' ? styles.active : ''}`}
                onClick={() => setFormatting({...formatting, fontSize: 'large'})}
              >
                A+
              </button>
            </div>
            <button 
              className={styles.saveButton}
              onClick={handleSave}
            >
              Save
            </button>
          </div>
          <textarea
            className={styles.textEditor}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            style={contentStyle}
          />
        </div>
      ) : (
        <div 
          className={styles.textContent}
          style={contentStyle}
          onClick={() => setIsEditing(true)}
        >
          {/* Render content with line breaks preserved */}
          {content.split('\n').map((line, i) => (
            <p key={i}>{line || <br />}</p>
          ))}
        </div>
      )}
    </div>
  );
}

// Helper function to convert size name to CSS value
function getFontSize(size) {
  switch (size) {
    case 'small': return '0.85rem';
    case 'large': return '1.25rem';
    case 'medium':
    default: return '1rem';
  }
}
