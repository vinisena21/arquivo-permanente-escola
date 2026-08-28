import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

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
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={headerStyle}>
          <div style={titleContainerStyle}>
            <AlertTriangle color="#dc2626" size={24} />
            <h3 style={{ margin: 0, fontSize: '18px', color: '#111827' }}>{title}</h3>
          </div>
          <button type="button" onClick={onCancel} style={closeBtnStyle}>
            <X size={20} />
          </button>
        </div>
        
        <p style={messageStyle}>{message}</p>
        
        <div style={actionsStyle}>
          <button type="button" onClick={onCancel} disabled={loading} style={cancelBtnStyle}>
            {cancelText}
          </button>
          <button type="button" onClick={onConfirm} disabled={loading} style={confirmBtnStyle(loading)}>
            {loading ? 'Processando...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

// Estilos Nativos
const overlayStyle: React.CSSProperties = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
  backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', 
  alignItems: 'center', justifyContent: 'center', zIndex: 1000 
};
const modalStyle: React.CSSProperties = {
  backgroundColor: '#fff', padding: '24px', borderRadius: '8px', 
  maxWidth: '400px', width: '90%', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' 
};
const headerStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' 
};
const titleContainerStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '8px' 
};
const closeBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' 
};
const messageStyle: React.CSSProperties = {
  fontSize: '14px', color: '#4b5563', marginBottom: '24px', whiteSpace: 'pre-line', lineHeight: '1.5' 
};
const actionsStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'flex-end', gap: '12px' 
};
const cancelBtnStyle: React.CSSProperties = {
  padding: '8px 16px', border: '1px solid #d1d5db', background: '#fff', 
  borderRadius: '6px', cursor: 'pointer', color: '#374151', fontWeight: 500
};
const confirmBtnStyle = (loading: boolean): React.CSSProperties => ({
  padding: '8px 16px', border: 'none', background: '#dc2626', color: '#fff', 
  borderRadius: '6px', cursor: loading ? 'not-allowed' : 'pointer', 
  opacity: loading ? 0.6 : 1, fontWeight: 500
});