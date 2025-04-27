import { useEffect, useRef } from 'react';
import styles from '../styles/ContextMenu.module.css';

const ContextMenu = ({ x, y, onClose, options }) => {
  const menuRef = useRef(null);
  
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        onClose();
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  return (
    <div 
      className={styles.contextMenu} 
      style={{ top: y, left: x }}
      ref={menuRef}
    >
      <ul>
        {options.map((option, index) => (
          <li 
            key={index}
            onClick={() => {
              option.action();
              onClose();
            }}
            className={option.danger ? styles.dangerOption : ''}
          >
            {option.icon && <span className={styles.icon}>{option.icon}</span>}
            {option.label}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ContextMenu;
