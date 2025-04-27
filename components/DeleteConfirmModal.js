import Modal from './Modal';
import styles from '../styles/Modal.module.css';

const DeleteConfirmModal = ({ isOpen, onClose, onConfirm, itemName }) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Delete Spreadsheet"
      actions={
        <>
          <button className={styles.cancelButton} onClick={onClose}>
            Cancel
          </button>
          <button className={styles.deleteButton} onClick={onConfirm}>
            Delete
          </button>
        </>
      }
    >
      <div className={styles.deleteWarningIcon}>
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
          <line x1="12" y1="9" x2="12" y2="13"></line>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
      </div>
      <h4 className={styles.deleteTitle}>Delete "{itemName || 'this spreadsheet'}"?</h4>
      <p className={styles.deleteMessage}>
        This action cannot be undone. The spreadsheet and all its data will be permanently deleted.
      </p>
    </Modal>
  );
};

export default DeleteConfirmModal;
