import Modal from './Modal';
import styles from '../styles/DeleteConfirmModal.module.css';

const DeleteConfirmModal = ({ isOpen, onClose, onConfirm, itemName }) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Confirm Delete"
      actions={
        <div className={styles.actionButtons}>
          <button
            className={styles.cancelButton}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className={styles.deleteButton}
            onClick={onConfirm}
          >
            Delete
          </button>
        </div>
      }
    >
      <div className={styles.content}>
        <div className={styles.warningIcon}>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <p>Are you sure you want to delete <strong>{itemName}</strong>?</p>
        <p className={styles.warningText}>This action cannot be undone.</p>
      </div>
    </Modal>
  );
};

export default DeleteConfirmModal;
