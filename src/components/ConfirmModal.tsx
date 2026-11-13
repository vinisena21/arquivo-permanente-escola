import React from 'react';
import { AlertTriangle, X, Loader2 } from 'lucide-react';
import './ConfirmModal.css';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  loading = false,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="confirm-modal-overlay" onClick={onCancel} role="dialog" aria-modal="true">
      <div className="confirm-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-modal-header">
          <div className="confirm-modal-title-group">
            <div className="confirm-modal-icon-badge">
              <AlertTriangle size={22} />
            </div>
            <h3 className="confirm-modal-title">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="confirm-modal-close-btn"
            disabled={loading}
            aria-label="Fechar modal"
          >
            <X size={18} />
          </button>
        </div>

        <div className="confirm-modal-body">
          <p className="confirm-modal-message">{message}</p>
        </div>

        <div className="confirm-modal-footer">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="btn-confirm-cancel"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="btn-confirm-action"
          >
            {loading && <Loader2 size={16} className="spinner-icon" />}
            <span>{loading ? 'Processando...' : confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
