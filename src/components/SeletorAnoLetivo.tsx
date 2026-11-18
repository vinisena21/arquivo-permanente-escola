import React from 'react';
import { Calendar } from 'lucide-react';
import { useAnoLetivo } from '../context/AnoLetivoContext';

export const SeletorAnoLetivo: React.FC = () => {
  const { anoLetivo, anosDisponiveis, setAnoLetivo } = useAnoLetivo();

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '5px 12px',
        borderRadius: '8px',
        background: 'rgba(30, 58, 138, 0.08)',
        border: '1px solid rgba(30, 58, 138, 0.2)',
        fontSize: '0.85rem',
        fontWeight: 600,
        color: '#1e3a8a',
        cursor: 'pointer',
      }}
      title="Seletor de Ano Letivo ativo para todo o sistema"
    >
      <Calendar size={15} style={{ color: '#1e3a8a', flexShrink: 0 }} />
      <span style={{ fontSize: '0.78rem', opacity: 0.85 }}>Ano:</span>
      <select
        value={anoLetivo}
        onChange={(e) => setAnoLetivo(Number(e.target.value))}
        style={{
          border: 'none',
          background: 'transparent',
          fontWeight: 700,
          color: '#1e3a8a',
          cursor: 'pointer',
          fontSize: '0.85rem',
          outline: 'none',
          padding: 0,
        }}
      >
        {anosDisponiveis.map((ano) => (
          <option key={ano} value={ano}>
            {ano}
          </option>
        ))}
      </select>
    </div>
  );
};

export default SeletorAnoLetivo;
