import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

export interface ToastData {
  message: string;
  type: 'success' | 'error';
}

interface ToastProps {
  toast: ToastData | null;
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ toast, onClose }) => {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      onClose();
    }, 4000);
    return () => clearTimeout(timer);
  }, [toast, onClose]);

  if (!toast) return null;

  const isSuccess = toast.type === 'success';

  return (
    <div style={toastContainerStyle}>
      {isSuccess ? <CheckCircle2 color="#059669" size={20} /> : <AlertCircle color="#dc2626" size={20} />}
      <p style={{ margin: 0, fontSize: '14px', color: '#1f2937', fontWeight: 500 }}>
        {toast.message}
      </p>
      <button type="button" onClick={onClose} style={toastCloseBtnStyle}>
        <X size={16} />
      </button>
    </div>
  );
};

// Estilos Nativos
const toastContainerStyle: React.CSSProperties = {
  position: 'fixed', bottom: '24px', right: '24px', backgroundColor: '#fff', 
  border: '1px solid #e5e7eb', padding: '12px 16px', borderRadius: '8px', 
  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', display: 'flex', 
  alignItems: 'center', gap: '12px', zIndex: 1050
};
const toastCloseBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', 
  display: 'flex', alignItems: 'center', padding: 0 
};