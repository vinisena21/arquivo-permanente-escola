import { useState, useMemo, useEffect } from 'react';
import {
  ShieldAlert,
  Search,
  Download,
  RefreshCw,
  AlertTriangle,
  FolderX,
  CheckCircle2,
  Trash2,
  Eye,
  X,
  FileSpreadsheet,
  ArrowRightLeft,
  Filter,
  Sparkles,
  User,
  Info
} from 'lucide-react';
import * as XLSX from 'xlsx';
import './DetectorDuplicidades.css';
import {
  detectarDuplicidades,
  type ConflitoDuplicidade
} from '../lib/detectorDuplicidades';
import type { AlunoArquivo } from '../types/database';
import matriculasOficiais from '../data/matriculas.json';
import type { ToastData } from './Toast';

interface Props {
  alunosArquivo: AlunoArquivo[];
  onExcluirAlunoArquivo?: (id: number) => Promise<void>;
  onToast?: (t: ToastData) => void;
}

export default function DetectorDuplicidades({
  alunosArquivo,
  onExcluirAlunoArquivo,
  onToast
}: Props) {
  const [busca, setBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [filtroSeveridade, setFiltroSeveridade] = useState<string>('todos');
  const [conflitos, setConflitos] = useState<ConflitoDuplicidade[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [ignorados, setIgnorados] = useState<Set<string>>(new Set());
  const [detalheModal, setDetalheModal] = useState<ConflitoDuplicidade | null>(null);

  function executarVarredura() {
    setCarregando(true);
    setTimeout(() => {
      try {
        const resultado = detectarDuplicidades(alunosArquivo, matriculasOficiais);
        setConflitos(resultado);
        onToast?.({
          message: `Varredura concluída: ${resultado.length} casos de duplicidade/conflito identificados.`,
          type: 'success'
        });
      } catch (err: any) {
        console.error(err);
        onToast?.({
          message: 'Erro ao executar varredura de duplicidades.',
          type: 'error'
        });
      } finally {
        setCarregando(false);
      }
    }, 400);
  }

  useEffect(() => {
    executarVarredura();
  }, [alunosArquivo]);

  const conflitosFiltrados = useMemo(() => {
    const q = busca.toLowerCase().trim();
    return conflitos.filter((c) => {
      if (ignorados.has(c.id)) return false;

      const matchBusca =
        !q ||
        c.alunoA.nome.toLowerCase().includes(q) ||
        c.alunoB.nome.toLowerCase().includes(q) ||
        (c.alunoA.codigoMatricula || '').includes(q) ||
        (c.alunoB.codigoMatricula || '').includes(q) ||
        (c.alunoA.codigoPasta || '').toLowerCase().includes(q);

      const matchTipo = filtroTipo === 'todos' || c.tipo === filtroTipo;
      const matchSev = filtroSeveridade === 'todos' || c.severidade === filtroSeveridade;

      return matchBusca && matchTipo && matchSev;
    });
  }, [conflitos, busca, filtroTipo, filtroSeveridade, ignorados]);

  // Contadores para os KPIs
  const totalCriticos = useMemo(
    () => conflitos.filter((c) => !ignorados.has(c.id) && c.severidade === 'critico').length,
    [conflitos, ignorados]
  );
  const totalPastas = useMemo(
    () => conflitos.filter((c) => !ignorados.has(c.id) && c.tipo === 'conflito_pasta_numero').length,
    [conflitos, ignorados]
  );
  const totalSimilaridade = useMemo(
    () => conflitos.filter((c) => !ignorados.has(c.id) && c.tipo === 'similaridade_alta').length,
    [conflitos, ignorados]
  );
  const totalSecretaria = useMemo(
    () => conflitos.filter((c) => !ignorados.has(c.id) && c.tipo === 'secretaria_multipla').length,
    [conflitos, ignorados]
  );

  function ignorarConflito(id: string) {
    setIgnorados((ant) => new Set([...ant, id]));
    onToast?.({
      message: 'Registro marcado como válido / falso positivo e ocultado da lista.',
      type: 'success'
    });
  }

  function exportarRelatorioExcel() {
    const linhas = conflitosFiltrados.map((c, i) => ({
      Item: i + 1,
      Tipo: c.tipo,
      Severidade: c.severidade.toUpperCase(),
      Similaridade: `${c.porcentagem}%`,
      Motivo: c.motivo,
      'Aluno A - Nome': c.alunoA.nome,
      'Aluno A - Matrícula/Pasta': c.alunoA.codigoMatricula || `${c.alunoA.codigoPasta} (Nº ${c.alunoA.numero})`,
      'Aluno A - Turma/Situação': c.alunoA.turma || c.alunoA.situacao || '',
      'Aluno A - Data Nasc': c.alunoA.dataNascimento || '',
      'Aluno B - Nome': c.alunoB.nome,
      'Aluno B - Matrícula/Pasta': c.alunoB.codigoMatricula || `${c.alunoB.codigoPasta} (Nº ${c.alunoB.numero})`,
      'Aluno B - Turma/Situação': c.alunoB.turma || c.alunoB.situacao || '',
      'Aluno B - Data Nasc': c.alunoB.dataNascimento || ''
    }));

    const ws = XLSX.utils.json_to_sheet(linhas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Duplicidades');
    XLSX.writeFile(wb, `Auditoria_Duplicidades_Guia_Escolar_${new Date().getFullYear()}.xlsx`);

    onToast?.({
      message: 'Relatório de duplicidades exportado com sucesso!',
      type: 'success'
    });
  }

  async function excluirAlunoArquivo(id?: number | string) {
    if (!id || typeof id !== 'number' || !onExcluirAlunoArquivo) {
      onToast?.({
        message: 'Para excluir este registro, acesse a aba Gerenciar Alunos.',
        type: 'error'
      });
      return;
    }
    if (window.confirm('Tem certeza que deseja excluir permanentemente este registro duplicado do arquivo?')) {
      try {
        await onExcluirAlunoArquivo(id);
        executarVarredura();
      } catch (e: any) {
        console.error(e);
      }
    }
  }

  return (
    <div className="detector-container">
      {/* Hero Institucional */}
      <div className="detector-hero">
        <div className="detector-hero-info">
          <div className="detector-tag">
            <Sparkles size={16} /> Auditoria Inteligente & Higienização de Dados
          </div>
          <h2>Detector de Alunos & Dados Duplicados</h2>
          <p>
            E.M. MARIA GERALDA MIRANDA BRITO SALOMÃO &bull; Ponto dos Volantes - MG
          </p>
        </div>
        <div className="detector-hero-actions">
          <button
            type="button"
            className="btn-varredura"
            onClick={executarVarredura}
            disabled={carregando}
            title="Executar cruzamento inteligente dos dados agora"
          >
            <RefreshCw size={17} className={carregando ? 'spin' : ''} />
            <span>{carregando ? 'Analisando...' : 'Executar Varredura'}</span>
          </button>
          <button
            type="button"
            className="btn-export-excel"
            onClick={exportarRelatorioExcel}
            disabled={conflitosFiltrados.length === 0}
            title="Exportar planilha Excel de duplicidades"
          >
            <Download size={17} />
            <span>Relatório Excel</span>
          </button>
        </div>
      </div>

      {/* Grid de KPIs do Detector */}
      <div className="detector-kpis-grid">
        <div className="kpi-dup-card card-total">
          <div className="kpi-dup-icon">
            <ShieldAlert size={24} />
          </div>
          <div className="kpi-dup-content">
            <span className="kpi-dup-label">Total de Conflitos</span>
            <strong className="kpi-dup-valor">{conflitosFiltrados.length}</strong>
            <span className="kpi-dup-sub">identificados no acervo</span>
          </div>
        </div>

        <div className="kpi-dup-card card-critico">
          <div className="kpi-dup-icon">
            <AlertTriangle size={24} />
          </div>
          <div className="kpi-dup-content">
            <span className="kpi-dup-label">Duplicatas Exatas</span>
            <strong className="kpi-dup-valor">{totalCriticos}</strong>
            <span className="kpi-dup-sub">mesmo nome e data</span>
          </div>
        </div>

        <div className="kpi-dup-card card-pastas">
          <div className="kpi-dup-icon">
            <FolderX size={24} />
          </div>
          <div className="kpi-dup-content">
            <span className="kpi-dup-label">Conflito de Pasta Físico</span>
            <strong className="kpi-dup-valor">{totalPastas}</strong>
            <span className="kpi-dup-sub">mesmo número de arquivo</span>
          </div>
        </div>

        <div className="kpi-dup-card card-similar">
          <div className="kpi-dup-icon">
            <Sparkles size={24} />
          </div>
          <div className="kpi-dup-content">
            <span className="kpi-dup-label">Grafia Semelhante (IA)</span>
            <strong className="kpi-dup-valor">{totalSimilaridade}</strong>
            <span className="kpi-dup-sub">semelhança fonética &gt; 85%</span>
          </div>
        </div>

        <div className="kpi-dup-card card-secretaria">
          <div className="kpi-dup-icon">
            <FileSpreadsheet size={24} />
          </div>
          <div className="kpi-dup-content">
            <span className="kpi-dup-label">Multi-Matrículas 2026</span>
            <strong className="kpi-dup-valor">{totalSecretaria}</strong>
            <span className="kpi-dup-sub">alunos com 2+ matrículas</span>
          </div>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="detector-filter-bar">
        <div className="detector-search">
          <Search size={18} className="search-icon-dup" />
          <input
            type="text"
            placeholder="Buscar por nome do aluno, matrícula ou pasta..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          {busca && (
            <button
              type="button"
              className="clear-btn-dup"
              onClick={() => setBusca('')}
            >
              ✕
            </button>
          )}
        </div>

        <div className="detector-filters-group">
          <div className="filter-pill-select">
            <Filter size={15} />
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              className="dup-select"
            >
              <option value="todos">Todos os Tipos de Conflito</option>
              <option value="exato_nome_data">Duplicatas Exatas (Nome + Data)</option>
              <option value="conflito_pasta_numero">Conflito de Pasta e Número</option>
              <option value="secretaria_multipla">Multi-Matrícula na Secretaria</option>
              <option value="similaridade_alta">Nomes com Grafia Semelhante (Fuzzy)</option>
            </select>
          </div>

          <div className="filter-pill-select">
            <select
              value={filtroSeveridade}
              onChange={(e) => setFiltroSeveridade(e.target.value)}
              className="dup-select"
            >
              <option value="todos">Todas as Severidades</option>
              <option value="critico">Somente Críticos</option>
              <option value="alerta">Somente Alertas</option>
              <option value="atencao">Somente Atenção</option>
            </select>
          </div>
        </div>
      </div>

      {/* Listagem de Conflitos Detectados */}
      <div className="detector-list-section">
        {conflitosFiltrados.length === 0 ? (
          <div className="empty-state-dup">
            <CheckCircle2 size={48} className="text-emerald-500" />
            <h3>Nenhum conflito ou duplicidade encontrado</h3>
            <p>
              {busca || filtroTipo !== 'todos'
                ? 'Nenhum resultado corresponde aos filtros aplicados.'
                : 'Parabéns! Sua base de dados está higienizada e sem duplicidades ativas.'}
            </p>
          </div>
        ) : (
          conflitosFiltrados.map((c) => (
            <div key={c.id} className={`conflito-card sev-${c.severidade}`}>
              {/* Header do Card */}
              <div className="conflito-card-header">
                <div className="conflito-header-left">
                  <span className={`badge-sev ${c.severidade}`}>
                    {c.severidade === 'critico' && 'Crítico'}
                    {c.severidade === 'alerta' && 'Alerta'}
                    {c.severidade === 'atencao' && 'Atenção'}
                  </span>
                  <h4>{c.titulo}</h4>
                </div>
                <div className="conflito-header-right">
                  <div className="similaridade-badge" title="Grau de similaridade entre os registros">
                    <span>Similaridade: <strong>{c.porcentagem}%</strong></span>
                    <div className="sim-track">
                      <div className="sim-fill" style={{ width: `${c.porcentagem}%` }}></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Descrição do Motivo */}
              <p className="conflito-motivo">{c.motivo}</p>

              {/* Comparativo Lado a Lado dos Registros */}
              <div className="conflito-grid-comparativo">
                {/* Lado A */}
                <div className="registro-coluna col-a">
                  <div className="registro-col-badge">
                    <User size={14} /> Registro A
                  </div>
                  <div className="registro-dados">
                    <strong className="reg-nome">{c.alunoA.nome}</strong>
                    <div className="reg-info-row">
                      <span className="reg-label">Identificação:</span>
                      <span className="reg-val">
                        {c.alunoA.codigoMatricula ? `Matrícula ${c.alunoA.codigoMatricula}` : `Pasta ${c.alunoA.codigoPasta} (Nº ${c.alunoA.numero})`}
                      </span>
                    </div>
                    {c.alunoA.dataNascimento && (
                      <div className="reg-info-row">
                        <span className="reg-label">Nascimento:</span>
                        <span className="reg-val">{c.alunoA.dataNascimento}</span>
                      </div>
                    )}
                    {c.alunoA.turma && (
                      <div className="reg-info-row">
                        <span className="reg-label">Turma:</span>
                        <span className="reg-val">{c.alunoA.turma} ({c.alunoA.turno})</span>
                      </div>
                    )}
                    {c.alunoA.situacao && (
                      <div className="reg-info-row">
                        <span className="reg-label">Situação:</span>
                        <span className={`status-pill ${c.alunoA.situacao.toLowerCase()}`}>{c.alunoA.situacao}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Divisor Visual */}
                <div className="registro-vs">
                  <ArrowRightLeft size={18} />
                </div>

                {/* Lado B */}
                <div className="registro-coluna col-b">
                  <div className="registro-col-badge">
                    <User size={14} /> Registro B
                  </div>
                  <div className="registro-dados">
                    <strong className="reg-nome">{c.alunoB.nome}</strong>
                    <div className="reg-info-row">
                      <span className="reg-label">Identificação:</span>
                      <span className="reg-val">
                        {c.alunoB.codigoMatricula ? `Matrícula ${c.alunoB.codigoMatricula}` : `Pasta ${c.alunoB.codigoPasta} (Nº ${c.alunoB.numero})`}
                      </span>
                    </div>
                    {c.alunoB.dataNascimento && (
                      <div className="reg-info-row">
                        <span className="reg-label">Nascimento:</span>
                        <span className="reg-val">{c.alunoB.dataNascimento}</span>
                      </div>
                    )}
                    {c.alunoB.turma && (
                      <div className="reg-info-row">
                        <span className="reg-label">Turma:</span>
                        <span className="reg-val">{c.alunoB.turma} ({c.alunoB.turno})</span>
                      </div>
                    )}
                    {c.alunoB.situacao && (
                      <div className="reg-info-row">
                        <span className="reg-label">Situação:</span>
                        <span className={`status-pill ${c.alunoB.situacao.toLowerCase()}`}>{c.alunoB.situacao}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Tags de Campos Coincidentes */}
              <div className="conflito-footer">
                <div className="tags-campos">
                  <span className="tags-title">Dados Idênticos:</span>
                  {c.camposIguais.map((campo) => (
                    <span key={campo} className="tag-igual">
                      ✓ {campo}
                    </span>
                  ))}
                  {c.camposDiferentes.length > 0 && (
                    <>
                      <span className="tags-title-dif">Divergências:</span>
                      {c.camposDiferentes.map((campo) => (
                        <span key={campo} className="tag-dif">
                          ≠ {campo}
                        </span>
                      ))}
                    </>
                  )}
                </div>

                <div className="conflito-acoes">
                  <button
                    type="button"
                    className="btn-acao-dup btn-detalhes"
                    onClick={() => setDetalheModal(c)}
                    title="Ver ficha completa comparativa"
                  >
                    <Eye size={14} /> Comparar Detalhes
                  </button>

                  <button
                    type="button"
                    className="btn-acao-dup btn-ignorar"
                    onClick={() => ignorarConflito(c.id)}
                    title="Marcar como falso positivo e ocultar da auditoria"
                  >
                    <CheckCircle2 size={14} /> Manter / Válido
                  </button>

                  {typeof c.alunoB.id === 'number' && onExcluirAlunoArquivo && (
                    <button
                      type="button"
                      className="btn-acao-dup btn-excluir"
                      onClick={() => void excluirAlunoArquivo(c.alunoB.id)}
                      title="Excluir o Registro B duplicado do banco"
                    >
                      <Trash2 size={14} /> Excluir B
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal de Comparativo Detalhado */}
      {detalheModal && (
        <div className="modal-overlay" onClick={() => setDetalheModal(null)}>
          <div className="modal-content-dup" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-dup">
              <div className="modal-header-title">
                <ShieldAlert size={22} />
                <div>
                  <h3>Comparativo Detalhado de Registros</h3>
                  <span>{detalheModal.titulo} &bull; Similaridade de {detalheModal.porcentagem}%</span>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setDetalheModal(null)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body-dup">
              <div className="modal-motivo-box">
                <Info size={18} />
                <span>{detalheModal.motivo}</span>
              </div>

              <div className="tabela-comparativa-wrap">
                <table className="tabela-comparativa">
                  <thead>
                    <tr>
                      <th style={{ width: '25%' }}>Campo</th>
                      <th style={{ width: '37.5%' }}>Registro A</th>
                      <th style={{ width: '37.5%' }}>Registro B</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="font-semibold">Nome Completo</td>
                      <td className={detalheModal.alunoA.nome === detalheModal.alunoB.nome ? 'cell-match' : 'cell-diff'}>
                        {detalheModal.alunoA.nome}
                      </td>
                      <td className={detalheModal.alunoA.nome === detalheModal.alunoB.nome ? 'cell-match' : 'cell-diff'}>
                        {detalheModal.alunoB.nome}
                      </td>
                    </tr>
                    <tr>
                      <td className="font-semibold">Data de Nascimento</td>
                      <td className={detalheModal.alunoA.dataNascimento === detalheModal.alunoB.dataNascimento ? 'cell-match' : 'cell-diff'}>
                        {detalheModal.alunoA.dataNascimento || 'Não informada'}
                      </td>
                      <td className={detalheModal.alunoA.dataNascimento === detalheModal.alunoB.dataNascimento ? 'cell-match' : 'cell-diff'}>
                        {detalheModal.alunoB.dataNascimento || 'Não informada'}
                      </td>
                    </tr>
                    <tr>
                      <td className="font-semibold">Matrícula / Identificador</td>
                      <td className="cell-diff">{detalheModal.alunoA.codigoMatricula || `Pasta ${detalheModal.alunoA.codigoPasta} (Nº ${detalheModal.alunoA.numero})`}</td>
                      <td className="cell-diff">{detalheModal.alunoB.codigoMatricula || `Pasta ${detalheModal.alunoB.codigoPasta} (Nº ${detalheModal.alunoB.numero})`}</td>
                    </tr>
                    <tr>
                      <td className="font-semibold">Turma / Período</td>
                      <td>{detalheModal.alunoA.turma || '—'}</td>
                      <td>{detalheModal.alunoB.turma || '—'}</td>
                    </tr>
                    <tr>
                      <td className="font-semibold">Situação Escolar</td>
                      <td>{detalheModal.alunoA.situacao || '—'}</td>
                      <td>{detalheModal.alunoB.situacao || '—'}</td>
                    </tr>
                    {detalheModal.alunoA.filiacao && (
                      <tr>
                        <td className="font-semibold">Filiação (Mãe / Pai)</td>
                        <td>{detalheModal.alunoA.filiacao}</td>
                        <td>{detalheModal.alunoB.filiacao || '—'}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="modal-footer-dup">
              <button
                type="button"
                className="btn-fechar-modal"
                onClick={() => setDetalheModal(null)}
              >
                Fechar Visualização
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
