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

  // Adjust position if menu would go off screen
  const calculatePosition = () => {
    const menuWidth = 200; // Approximate width of the menu
    const menuHeight = options.length * 40; // Approximate height of the menu
    
    const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 0;
    const windowHeight = typeof window !== 'undefined' ? window.innerHeight : 0;
    
    let adjX = x;
    let adjY = y;
    
    if (x + menuWidth > windowWidth) {
      adjX = windowWidth - menuWidth - 10;
    }
    
    if (y + menuHeight > windowHeight) {
      adjY = windowHeight - menuHeight - 10;
    }
    
    return { left: adjX, top: adjY };
  };

  const position = calculatePosition();

  return (
    <div 
      className={styles.contextMenu} 
      style={{ left: position.left, top: position.top }}
      ref={menuRef}
    >
      <ul className={styles.menuList}>
        {options.map((option, index) => (
          <li 
            key={index} 
            className={`${styles.menuItem} ${option.danger ? styles.dangerItem : ''}`}
            onClick={() => {
              option.action();
              onClose();
            }}
          >
            {option.icon && <span className={styles.menuIcon}>{option.icon}</span>}
            {option.label}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ContextMenu;
