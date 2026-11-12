import React, { useState } from 'react';
import { FileCheck2, FileText, Award } from 'lucide-react';
import FichaIndividualAluno from './FichaIndividualAluno';
import AtaResultadoFinal from './AtaResultadoFinal';
import './AtasFichas.css';

interface AtasFichasViewProps {
  onToast?: (toast: { message: string; type: 'success' | 'error' }) => void;
}

export const AtasFichasView: React.FC<AtasFichasViewProps> = ({ onToast }) => {
  const [subAba, setSubAba] = useState<'ficha' | 'ata'>('ficha');

  return (
    <div className="atas-fichas-container">
      {/* Cabeçalho do Módulo */}
      <div className="atas-fichas-header no-print">
        <div className="atas-fichas-header-title">
          <FileCheck2 className="icon-header" size={28} />
          <div>
            <h2>Ficha Individual & Ata de Resultado Final (SIGP Educação)</h2>
            <p>E.M. MARIA GERALDA MIRANDA BRITO SALOMÃO &bull; Documentos Oficiais para o Arquivo Permanente</p>
          </div>
        </div>

        <div className="sub-nav-toggle">
          <button
            type="button"
            className={subAba === 'ficha' ? 'sub-nav-btn active' : 'sub-nav-btn'}
            onClick={() => setSubAba('ficha')}
          >
            <FileText size={16} /> Ficha Individual do Aluno
          </button>
          <button
            type="button"
            className={subAba === 'ata' ? 'sub-nav-btn active' : 'sub-nav-btn'}
            onClick={() => setSubAba('ata')}
          >
            <Award size={16} /> Ata de Resultado Final (Turma)
          </button>
        </div>
      </div>

      {/* Renderização da Sub-Aba Selecionada */}
      {subAba === 'ficha' && <FichaIndividualAluno onToast={onToast} />}
      {subAba === 'ata' && <AtaResultadoFinal onToast={onToast} />}
    </div>
  );
};

export default AtasFichasView;
