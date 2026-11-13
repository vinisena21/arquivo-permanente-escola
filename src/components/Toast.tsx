import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import './Toast.css';

export interface ToastData {
  message: string;
  type: 'success' | 'error' | 'info';
  title?: string;
}

interface ToastProps {
  toast: ToastData | null;
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ toast, onClose }) => {
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (!toast) {
      setClosing(false);
      return;
    }

    setClosing(false);

    // Inicia fechamento suave antes de desmontar
    const closeTimer = setTimeout(() => {
      setClosing(true);
    }, 3700);

    const dismissTimer = setTimeout(() => {
      onClose();
    }, 4000);

    return () => {
      clearTimeout(closeTimer);
      clearTimeout(dismissTimer);
    };
  }, [toast, onClose]);

  if (!toast) return null;

  const tipo = toast.type || 'info';

  const defaultTitle = {
    success: 'Sucesso!',
    error: 'Atenção / Erro',
    info: 'Informação do Sistema'
  }[tipo];

  return (
    <div className="toast-portal-wrapper" aria-live="polite">
      <div className={`modern-toast-card ${tipo} ${closing ? 'toast-closing' : ''}`}>
        <div className="toast-icon-wrapper">
          {tipo === 'success' && <CheckCircle2 size={20} />}
          {tipo === 'error' && <AlertCircle size={20} />}
          {tipo === 'info' && <Info size={20} />}
        </div>

        <div className="toast-content-wrapper">
          <h4 className="toast-title">{toast.title || defaultTitle}</h4>
          <p className="toast-message">{toast.message}</p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="toast-close-btn"
          aria-label="Fechar notificação"
        >
          <X size={16} />
        </button>

        <div className="toast-progress-bar" />
      </div>
    </div>
  );
};

export default Toast;
