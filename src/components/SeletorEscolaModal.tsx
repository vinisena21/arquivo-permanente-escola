import React, { useState, useMemo } from 'react';
import {
  Building2,
  Search,
  CheckCircle2,
  X,
  MapPin
} from 'lucide-react';
import { useSchool, type EscolaItem } from '../context/SchoolContext';
import './SeletorEscolaModal.css';

interface SeletorEscolaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelecionar?: (escola: EscolaItem) => void;
}

export const SeletorEscolaModal: React.FC<SeletorEscolaModalProps> = ({
  isOpen,
  onClose,
  onSelecionar,
}) => {
  const { escolaAtiva, setEscolaAtiva, escolas } = useSchool();
  const [busca, setBusca] = useState('');
  const [filtroZona, setFiltroZona] = useState<'todas' | 'urbana' | 'rural'>('todas');

  const escolasFiltradas = useMemo(() => {
    const termo = busca.toLowerCase().trim();
    return escolas.filter((e) => {
      const nomeMatch = !termo || e.Escola.toLowerCase().includes(termo) || (e['Identificação CENSO'] || '').includes(termo);
      const zona = (e['Localização/Zona da Escola (CENSO)'] || '').toLowerCase();
      const zonaMatch =
        filtroZona === 'todas' ||
        (filtroZona === 'urbana' && zona.includes('urbana')) ||
        (filtroZona === 'rural' && zona.includes('rural'));
      return nomeMatch && zonaMatch;
    });
  }, [escolas, busca, filtroZona]);

  if (!isOpen) return null;

  return (
    <div className="seletor-modal-overlay" onClick={onClose}>
      <div
        className="seletor-modal-container"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="seletor-modal-header">
          <div className="seletor-modal-title-row">
            <div className="seletor-modal-icon">
              <Building2 size={24} />
            </div>
            <div>
              <h2>Selecionar Unidade Escolar</h2>
              <p>Rede Municipal de Ensino de Ponto dos Volantes — MG</p>
            </div>
          </div>
          <button
            type="button"
            className="seletor-modal-close"
            onClick={onClose}
            title="Fechar seletor"
          >
            <X size={20} />
          </button>
        </div>

        <div className="seletor-modal-filters">
          <div className="seletor-search-box">
            <Search size={18} />
            <input
              type="text"
              placeholder="Buscar por nome da escola ou código INEP..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              autoFocus
            />
            {busca && (
              <button
                type="button"
                className="seletor-search-clear"
                onClick={() => setBusca('')}
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="seletor-tabs-zona">
            <button
              type="button"
              className={`seletor-tab ${filtroZona === 'todas' ? 'active' : ''}`}
              onClick={() => setFiltroZona('todas')}
            >
              Todas ({escolas.length})
            </button>
            <button
              type="button"
              className={`seletor-tab ${filtroZona === 'urbana' ? 'active' : ''}`}
              onClick={() => setFiltroZona('urbana')}
            >
              Zona Urbana
            </button>
            <button
              type="button"
              className={`seletor-tab ${filtroZona === 'rural' ? 'active' : ''}`}
              onClick={() => setFiltroZona('rural')}
            >
              Zona Rural
            </button>
          </div>
        </div>

        <div className="seletor-modal-list">
          {escolasFiltradas.length === 0 ? (
            <div className="seletor-vazio">
              <Building2 size={36} />
              <p>Nenhuma escola encontrada com esse termo de busca.</p>
            </div>
          ) : (
            escolasFiltradas.map((e) => {
              const isAtiva =
                e.Escola.trim().toUpperCase() === escolaAtiva.trim().toUpperCase();
              return (
                <div
                  key={e.Código}
                  className={`seletor-item-card ${isAtiva ? 'item-ativo' : ''}`}
                  onClick={() => {
                    setEscolaAtiva(e.Escola);
                    onSelecionar?.(e);
                    onClose();
                  }}
                >
                  <div className="seletor-item-left">
                    <div className="seletor-item-indicator">
                      {isAtiva ? (
                        <CheckCircle2 size={20} className="text-emerald-600" />
                      ) : (
                        <span className="seletor-item-num">#{e.Código}</span>
                      )}
                    </div>
                    <div className="seletor-item-details">
                      <h4>{e.Escola}</h4>
                      <div className="seletor-item-tags">
                        <span className="tag-inep">
                          INEP: {e['Identificação CENSO'] || '—'}
                        </span>
                        <span className="tag-zona">
                          <MapPin size={12} />
                          {e['Localização/Zona da Escola (CENSO)'] || 'Zona Rural'}
                        </span>
                        {e['Gestor escolar'] && (
                          <span className="tag-gestor">
                            Gestor: {e['Gestor escolar'].split('\n')[0]}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="seletor-item-right">
                    {isAtiva ? (
                      <span className="badge-em-uso">EM USO</span>
                    ) : (
                      <button type="button" className="btn-selecionar-escola">
                        Selecionar
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="seletor-modal-footer">
          <p>
            Ao selecionar uma escola, todo o sistema (matrículas, turmas, notas e
            profissionais) passa a exibir os dados referentes a ela.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SeletorEscolaModal;
