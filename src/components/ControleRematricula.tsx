import React, { useState, useEffect, useMemo } from 'react';
import {
  UserCheck,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  Printer,
  Download,
  Check,
  Undo2,
  Calendar,
  Layers,
  Sparkles,
  FileText,
  Users,
  X,
  GraduationCap
} from 'lucide-react';
import * as XLSX from 'xlsx';
import './ControleRematricula.css';
import matriculasOficiais from '../data/matriculas.json';
import { carregarAlunosSecretaria } from '../lib/alunosSecretaria';
import type { ToastData } from './Toast';

export interface AlunoRematriculaItem {
  codigo: string;
  codigoEstudante: string;
  nome: string;
  dataNascimento: string;
  turmaAtual: string;
  periodo: string;
  turno: string;
  turma2027Prevista: string;
  rematriculado: boolean;
  dataRematricula: string | null;
  responsavel?: string;
}

interface RegistroRematriculaStorage {
  confirmado: boolean;
  dataConfirmacao: string;
  turma2027?: string;
  observacoes?: string;
}

interface Props {
  onToast?: (t: ToastData) => void;
}

const STORAGE_KEY = 'guia_escolar_rematriculas_2027';

/**
 * Calcula a progressão pedagógica da turma de 2026 para 2027 na E.M. Maria Geralda
 */
export function calcularProximaEtapa(periodoOuTurma: string | null | undefined): string {
  if (!periodoOuTurma) return 'Ano Seguinte (2027)';
  const t = periodoOuTurma.toUpperCase().trim();

  // 1º Ano -> 2º Ano
  if (t.includes('1º') || t.includes('1°') || t.startsWith('1')) return '2º ANO (2027)';
  // 2º Ano -> 3º Ano
  if (t.includes('2º') || t.includes('2°') || t.startsWith('2')) return '3º ANO (2027)';
  // 3º Ano -> 4º Ano
  if (t.includes('3º') || t.includes('3°') || t.startsWith('3')) return '4º ANO (2027)';
  // 4º Ano -> 5º Ano
  if (t.includes('4º') || t.includes('4°') || t.startsWith('4')) return '5º ANO (2027)';
  // 5º Ano -> 6º Ano
  if (t.includes('5º') || t.includes('5°') || t.startsWith('5')) return '6º ANO (2027)';
  // 6º Ano (ex: 601, 602, 6º) -> 7º Ano
  if (t.includes('6º') || t.includes('6°') || t.startsWith('60') || t.startsWith('6')) return '7º ANO (2027)';
  // 7º Ano (ex: 701, 702) -> 8º Ano
  if (t.includes('7º') || t.includes('7°') || t.startsWith('70') || t.startsWith('7')) return '8º ANO (2027)';
  // 8º Ano (ex: 801, 802) -> 9º Ano
  if (t.includes('8º') || t.includes('8°') || t.startsWith('80') || t.startsWith('8')) return '9º ANO (2027)';
  // 9º Ano (ex: 902, 903) -> Ensino Médio / Concluinte
  if (t.includes('9º') || t.includes('9°') || t.startsWith('90') || t.startsWith('9')) return 'Ensino Médio (2027)';
  // Pré ou Infantil
  if (t.includes('PRÉ') || t.includes('INFANTIL')) return '1º ANO (2027)';

  return 'Ano Seguinte (2027)';
}

function formatarDataHora(dataISO: string | null): string {
  if (!dataISO) return '—';
  try {
    const d = new Date(dataISO);
    if (isNaN(d.getTime())) return dataISO;
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dataISO;
  }
}

export default function ControleRematricula({ onToast }: Props) {
  const [alunos, setAlunos] = useState<AlunoRematriculaItem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [turmaFiltro, setTurmaFiltro] = useState<string>('todas');
  const [statusFiltro, setStatusFiltro] = useState<'todos' | 'confirmados' | 'pendentes'>('todos');
  const [modalRelatorioAberta, setModalRelatorioAberta] = useState(false);
  const [relatorioApenasRematriculados, setRelatorioApenasRematriculados] = useState(true);

  // Carrega alunos (tentando Supabase primeiro, com fallback para o JSON oficial)
  useEffect(() => {
    async function carregar() {
      setCarregando(true);
      try {
        // Recupera rematrículas salvas no localStorage
        const salvosStr = localStorage.getItem(STORAGE_KEY);
        const mapRematriculas: Record<string, RegistroRematriculaStorage> = salvosStr ? JSON.parse(salvosStr) : {};

        let listaBase: AlunoRematriculaItem[] = [];

        try {
          const alunosDb = await carregarAlunosSecretaria();
          if (alunosDb && alunosDb.length > 0) {
            listaBase = alunosDb.map((a) => {
              const codigo = a.codigo_matricula;
              const saved = mapRematriculas[codigo];
              const turma = a.turma || a.descricao || a.periodo || 'Não informada';
              return {
                codigo,
                codigoEstudante: a.codigo_estudante || a.ra || '—',
                nome: a.nome,
                dataNascimento: a.data_nascimento || '',
                turmaAtual: turma,
                periodo: a.periodo || '',
                turno: a.turno || 'MATUTINO',
                turma2027Prevista: calcularProximaEtapa(turma),
                rematriculado: Boolean(saved?.confirmado),
                dataRematricula: saved?.dataConfirmacao || null,
                responsavel: a.filiacao_1 || a.filiacao_2 || undefined
              };
            });
          }
        } catch (erroDb) {
          console.warn('Banco alunos_secretaria não disponível, usando matriculas oficiais locais:', erroDb);
        }

        // Se o banco estiver vazio ou offline, carrega o matriculas.json (585 alunos reais)
        if (listaBase.length === 0) {
          listaBase = (matriculasOficiais as Array<Record<string, string>>).map((m) => {
            const codigo = m['Código'] || m['codigo_matricula'] || String(Math.random());
            const saved = mapRematriculas[codigo];
            const turma = m['Descrição'] || m['Turma'] || m['Período'] || '1º ANO';
            return {
              codigo,
              codigoEstudante: m['Código do estudante'] || m['Registro do estudante (RA)'] || '—',
              nome: m['Nome'] || 'Sem Nome',
              dataNascimento: m['Data de Nascimento'] || '',
              turmaAtual: turma,
              periodo: m['Período'] || '',
              turno: m['Turno'] || 'MATUTINO',
              turma2027Prevista: calcularProximaEtapa(turma),
              rematriculado: Boolean(saved?.confirmado),
              dataRematricula: saved?.dataConfirmacao || null,
              responsavel: m['Responsável'] || m['Filiação 1'] || undefined
            };
          });
        }

        // Ordena por nome
        listaBase.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
        setAlunos(listaBase);
      } catch (err) {
        console.error('Erro ao carregar dados de rematrícula:', err);
      } finally {
        setCarregando(false);
      }
    }

    void carregar();
  }, []);

  // Lista única de turmas para o filtro
  const turmasDisponiveis = useMemo(() => {
    const set = new Set<string>();
    alunos.forEach((a) => {
      if (a.turmaAtual) set.add(a.turmaAtual);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
  }, [alunos]);

  // Alunos filtrados por busca, turma e status
  const alunosFiltrados = useMemo(() => {
    const termo = busca.toLowerCase().trim();
    return alunos.filter((a) => {
      const matchBusca =
        !termo ||
        a.nome.toLowerCase().includes(termo) ||
        a.codigo.toLowerCase().includes(termo) ||
        a.turmaAtual.toLowerCase().includes(termo) ||
        a.turma2027Prevista.toLowerCase().includes(termo);

      if (!matchBusca) return false;

      if (turmaFiltro !== 'todas' && a.turmaAtual !== turmaFiltro) {
        return false;
      }

      if (statusFiltro === 'confirmados' && !a.rematriculado) return false;
      if (statusFiltro === 'pendentes' && a.rematriculado) return false;

      return true;
    });
  }, [alunos, busca, turmaFiltro, statusFiltro]);

  // Estatísticas de Rematrícula
  const totalAlunos = alunos.length;
  const totalConfirmados = useMemo(() => alunos.filter((a) => a.rematriculado).length, [alunos]);
  const totalPendentes = totalAlunos - totalConfirmados;
  const percentualConcluido = totalAlunos > 0 ? Math.round((totalConfirmados / totalAlunos) * 100) : 0;

  // 1-Clique para Alternar Rematrícula (OK 2027)
  function alternarRematricula(aluno: AlunoRematriculaItem) {
    const novoStatus = !aluno.rematriculado;
    const agora = new Date().toISOString();

    setAlunos((prev) =>
      prev.map((item) => {
        if (item.codigo === aluno.codigo) {
          return {
            ...item,
            rematriculado: novoStatus,
            dataRematricula: novoStatus ? agora : null
          };
        }
        return item;
      })
    );

    // Salva no localStorage
    try {
      const salvosStr = localStorage.getItem(STORAGE_KEY);
      const map: Record<string, RegistroRematriculaStorage> = salvosStr ? JSON.parse(salvosStr) : {};

      if (novoStatus) {
        map[aluno.codigo] = {
          confirmado: true,
          dataConfirmacao: agora,
          turma2027: aluno.turma2027Prevista
        };
        onToast?.({
          message: `Rematrícula de ${aluno.nome} confirmada para 2027!`,
          type: 'success'
        });
      } else {
        delete map[aluno.codigo];
        onToast?.({
          message: `Rematrícula de ${aluno.nome} foi desmarcada.`,
          type: 'info'
        });
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch (e) {
      console.error('Erro ao salvar rematrícula no localStorage:', e);
    }
  }

  // Ação em Lote: Marcar todos os visíveis como OK 2027
  function marcarTodosVisiveis() {
    if (alunosFiltrados.length === 0) return;
    const agora = new Date().toISOString();
    const codigosVisiveis = new Set(alunosFiltrados.map((a) => a.codigo));

    setAlunos((prev) =>
      prev.map((item) => {
        if (codigosVisiveis.has(item.codigo)) {
          return {
            ...item,
            rematriculado: true,
            dataRematricula: item.dataRematricula || agora
          };
        }
        return item;
      })
    );

    try {
      const salvosStr = localStorage.getItem(STORAGE_KEY);
      const map: Record<string, RegistroRematriculaStorage> = salvosStr ? JSON.parse(salvosStr) : {};

      alunosFiltrados.forEach((a) => {
        map[a.codigo] = {
          confirmado: true,
          dataConfirmacao: map[a.codigo]?.dataConfirmacao || agora,
          turma2027: a.turma2027Prevista
        };
      });

      localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
      onToast?.({
        message: `${alunosFiltrados.length} aluno(s) confirmados para 2027 com sucesso!`,
        type: 'success'
      });
    } catch (e) {
      console.error('Erro ao salvar em lote:', e);
    }
  }

  // Exportar Excel Oficial (.xlsx)
  function exportarParaExcel() {
    const listaParaExportar = relatorioApenasRematriculados
      ? alunos.filter((a) => a.rematriculado)
      : alunosFiltrados;

    if (listaParaExportar.length === 0) {
      onToast?.({
        message: 'Nenhum aluno rematriculado para exportar na seleção atual.',
        type: 'error'
      });
      return;
    }

    const linhas = listaParaExportar.map((a, idx) => ({
      'Nº': idx + 1,
      'Código / Matrícula': a.codigo,
      'Nome do Aluno': a.nome,
      'Data de Nascimento': a.dataNascimento || 'Não informada',
      'Turma Atual (2026)': a.turmaAtual,
      'Turma Prevista (2027)': a.turma2027Prevista,
      'Turno': a.turno,
      'Status': a.rematriculado ? 'REMATRICULADO 2027' : 'PENDENTE',
      'Data / Hora Confirmação': formatarDataHora(a.dataRematricula),
      'Responsável': a.responsavel || ''
    }));

    const ws = XLSX.utils.json_to_sheet(linhas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rematriculas_2027');
    XLSX.writeFile(wb, `Relatorio_Rematriculas_2027_EM_Maria_Geralda.xlsx`);

    onToast?.({
      message: 'Planilha de rematrículas exportada com sucesso!',
      type: 'success'
    });
  }

  // Aciona impressão oficial A4
  function imprimirRelatorio() {
    window.print();
  }

  // Alunos que aparecerão no Relatório
  const alunosParaRelatorio = useMemo(() => {
    let lista = relatorioApenasRematriculados
      ? alunos.filter((a) => a.rematriculado)
      : alunosFiltrados;

    if (turmaFiltro !== 'todas') {
      lista = lista.filter((a) => a.turmaAtual === turmaFiltro);
    }

    return lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [alunos, relatorioApenasRematriculados, alunosFiltrados, turmaFiltro]);

  return (
    <div className="rematricula-container">
      {/* 1. HERO INSTITUCIONAL */}
      <section className="rematricula-hero">
        <div>
          <div className="rematricula-hero-tag">
            <Sparkles size={14} /> Ano Letivo 2027 · Controle Oficial
          </div>
          <h1>Controle de Rematrícula 2027</h1>
          <p className="rematricula-hero-sub">
            E.M. MARIA GERALDA MIRANDA BRITO SALOMÃO · Confirmação simplificada em 1-clique
          </p>
        </div>

        <div className="rematricula-hero-actions">
          <button
            type="button"
            className="btn-hero-action primary"
            onClick={() => setModalRelatorioAberta(true)}
            title="Gerar e imprimir relatório completo em PDF"
          >
            <Printer size={18} />
            <span>Gerar Relatório (PDF)</span>
          </button>

          <button
            type="button"
            className="btn-hero-action secondary"
            onClick={exportarParaExcel}
            title="Exportar listagem em planilha Excel (.xlsx)"
          >
            <Download size={18} />
            <span>Exportar Excel</span>
          </button>
        </div>
      </section>

      {/* 2. BARRA DE MÉTRICAS (BIG DATA / PROGRESSO) */}
      <section className="rematricula-metrics-grid">
        <div className="rematricula-metric-card">
          <div className="metric-icon-box total">
            <Users size={24} />
          </div>
          <div className="metric-info">
            <h3>Total de Alunos (2026)</h3>
            <div className="metric-num">{carregando ? '...' : totalAlunos}</div>
            <div className="metric-sub">Matriculados no sistema</div>
          </div>
        </div>

        <div className="rematricula-metric-card">
          <div className="metric-icon-box success">
            <CheckCircle2 size={24} />
          </div>
          <div className="metric-info">
            <h3>Rematriculados 2027 (OK)</h3>
            <div className="metric-num" style={{ color: '#059669' }}>
              {carregando ? '...' : totalConfirmados}
            </div>
            <div className="metric-sub">Confirmados para 2027</div>
          </div>
        </div>

        <div className="rematricula-metric-card">
          <div className="metric-icon-box pending">
            <Clock size={24} />
          </div>
          <div className="metric-info">
            <h3>Pendentes de Rematrícula</h3>
            <div className="metric-num" style={{ color: '#d97706' }}>
              {carregando ? '...' : totalPendentes}
            </div>
            <div className="metric-sub">Aguardando confirmação</div>
          </div>
        </div>

        <div className="rematricula-metric-card">
          <div className="metric-icon-box progress">
            <GraduationCap size={24} />
          </div>
          <div className="metric-info" style={{ flex: 1 }}>
            <h3>Progresso de Rematrícula</h3>
            <div className="metric-num" style={{ color: '#7c3aed' }}>
              {carregando ? '...' : `${percentualConcluido}%`}
            </div>
            <div className="rematricula-progress-bar-wrap">
              <div
                className="rematricula-progress-fill"
                style={{ width: `${percentualConcluido}%` }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* 3. BARRA DE FILTROS E BUSCA */}
      <section className="rematricula-controls-card">
        <div className="controls-row-top">
          <div className="search-input-box">
            <Search size={18} color="#64748b" />
            <input
              type="text"
              placeholder="Buscar aluno por nome, matrícula ou turma..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              aria-label="Buscar aluno na rematrícula"
            />
            {busca && (
              <button
                type="button"
                onClick={() => setBusca('')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
              >
                <X size={16} />
              </button>
            )}
          </div>

          <div className="controls-filters-wrap">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Filter size={16} color="#64748b" />
              <select
                className="select-turma-filter"
                value={turmaFiltro}
                onChange={(e) => setTurmaFiltro(e.target.value)}
                aria-label="Filtrar por turma"
              >
                <option value="todas">Todas as Turmas ({totalAlunos})</option>
                {turmasDisponiveis.map((t) => (
                  <option key={t} value={t}>
                    {t} ({alunos.filter((a) => a.turmaAtual === t).length})
                  </option>
                ))}
              </select>
            </div>

            <div className="status-pills-group">
              <button
                type="button"
                className={`status-pill-btn ${statusFiltro === 'todos' ? 'active' : ''}`}
                onClick={() => setStatusFiltro('todos')}
              >
                Todos ({alunos.length})
              </button>
              <button
                type="button"
                className={`status-pill-btn ${statusFiltro === 'confirmados' ? 'active' : ''}`}
                onClick={() => setStatusFiltro('confirmados')}
              >
                ✅ OK 2027 ({totalConfirmados})
              </button>
              <button
                type="button"
                className={`status-pill-btn ${statusFiltro === 'pendentes' ? 'active' : ''}`}
                onClick={() => setStatusFiltro('pendentes')}
              >
                ⏳ Pendentes ({totalPendentes})
              </button>
            </div>
          </div>
        </div>

        {/* Linha de Ações Rápidas */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid #f1f5f9', flexWrap: 'wrap', gap: '8px' }}>
          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
            Dica: Clique no botão da direita para confirmar a rematrícula instantaneamente.
          </span>

          {alunosFiltrados.length > 0 && alunosFiltrados.some((a) => !a.rematriculado) && (
            <button
              type="button"
              onClick={marcarTodosVisiveis}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                background: '#eff6ff',
                color: '#1d4ed8',
                border: '1px solid #bfdbfe',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
              title="Marcar todos os alunos listados na tela como Rematriculados para 2027"
            >
              <Check size={14} />
              <span>Marcar todos os visíveis ({alunosFiltrados.filter((a) => !a.rematriculado).length}) como OK 2027</span>
            </button>
          )}
        </div>
      </section>

      {/* 4. LISTAGEM DE ALUNOS COM O BOTÃO DE 1-CLIQUE */}
      <section className="rematricula-list-panel">
        <div className="list-panel-header">
          <h2>Relação de Alunos para Rematrícula 2027</h2>
          <span className="list-counter-badge">
            {alunosFiltrados.length} aluno(s) listado(s)
          </span>
        </div>

        {carregando ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
            <p>Carregando registros escolares...</p>
          </div>
        ) : alunosFiltrados.length === 0 ? (
          <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: '#64748b' }}>
            <UserCheck size={48} color="#94a3b8" style={{ marginBottom: '12px' }} />
            <h3 style={{ margin: '0 0 6px', color: '#1e293b' }}>Nenhum aluno encontrado</h3>
            <p style={{ margin: 0, fontSize: '0.9rem' }}>
              Verifique os filtros de busca ou selecione outra turma.
            </p>
          </div>
        ) : (
          <div className="rematricula-table-wrap">
            <table className="rematricula-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>Nº</th>
                  <th>Aluno</th>
                  <th>Turma Atual (2026)</th>
                  <th>Turma Prevista (2027)</th>
                  <th>Turno</th>
                  <th style={{ textAlign: 'right' }}>Status Rematrícula</th>
                </tr>
              </thead>
              <tbody key={`rematricula-list-${busca}-${turmaFiltro}-${statusFiltro}`}>
                {alunosFiltrados.map((item, idx) => (
                  <tr
                    key={item.codigo}
                    className={`stagger-item ${item.rematriculado ? 'is-confirmed' : ''}`}
                    style={{ '--stagger-idx': idx } as React.CSSProperties}
                  >
                    <td style={{ color: '#94a3b8', fontWeight: 600, fontSize: '0.8rem' }}>
                      {idx + 1}
                    </td>

                    <td>
                      <div className="aluno-cell">
                        <div className={`aluno-avatar ${item.rematriculado ? 'confirmed' : ''}`}>
                          {item.rematriculado ? <Check size={18} /> : item.nome.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="aluno-nome">{item.nome}</div>
                          <div className="aluno-meta">
                            <span>Matrícula: #{item.codigo}</span>
                            {item.dataNascimento && (
                              <>
                                <span>•</span>
                                <span><Calendar size={11} style={{ display: 'inline', verticalAlign: 'middle' }} /> {item.dataNascimento}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td>
                      <span className="badge-turma-atual">
                        <Layers size={12} /> {item.turmaAtual}
                      </span>
                    </td>

                    <td>
                      <span className="badge-turma-prevista">
                        <GraduationCap size={12} /> {item.turma2027Prevista}
                      </span>
                    </td>

                    <td>
                      <span style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 500 }}>
                        {item.turno}
                      </span>
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          type="button"
                          className={`btn-toggle-rematricula ${item.rematriculado ? 'confirmado' : 'pendente'}`}
                          onClick={() => alternarRematricula(item)}
                          title={item.rematriculado ? `Confirmado em ${formatarDataHora(item.dataRematricula)}. Clique para desfazer.` : 'Clique para confirmar a rematrícula para 2027'}
                        >
                          {item.rematriculado ? (
                            <>
                              <CheckCircle2 size={16} color="#059669" />
                              <span>OK para 2027</span>
                            </>
                          ) : (
                            <>
                              <Clock size={16} />
                              <span>Marcar OK para 2027</span>
                            </>
                          )}
                        </button>

                        {item.rematriculado && (
                          <button
                            type="button"
                            className="btn-desfazer-mini"
                            onClick={() => alternarRematricula(item)}
                            title="Desfazer rematrícula deste aluno"
                          >
                            <Undo2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 5. MODAL DE RELATÓRIO OFICIAL (IMPRESSÃO A4 E EXCEL) */}
      {modalRelatorioAberta && (
        <div className="modal-relatorio-overlay" onClick={() => setModalRelatorioAberta(false)}>
          <div className="modal-relatorio-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-relatorio-topbar">
              <h3>
                <FileText size={18} color="#1e3a8a" />
                Relatório de Rematrículas — Ano Letivo 2027
              </h3>

              <div className="modal-relatorio-actions">
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', marginRight: '10px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={relatorioApenasRematriculados}
                    onChange={(e) => setRelatorioApenasRematriculados(e.target.checked)}
                  />
                  <span>Apenas Rematriculados ({totalConfirmados})</span>
                </label>

                <button
                  type="button"
                  className="btn-print-action print"
                  onClick={imprimirRelatorio}
                  title="Imprimir relatório em folha A4 ou salvar como PDF"
                >
                  <Printer size={16} />
                  <span>Imprimir (A4/PDF)</span>
                </button>

                <button
                  type="button"
                  className="btn-print-action excel"
                  onClick={exportarParaExcel}
                  title="Exportar para Excel (.xlsx)"
                >
                  <Download size={16} />
                  <span>Excel</span>
                </button>

                <button
                  type="button"
                  className="btn-close-modal"
                  onClick={() => setModalRelatorioAberta(false)}
                  aria-label="Fechar"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="modal-relatorio-body">
              <div className="documento-oficial-wrap">
                {/* Cabeçalho Institucional Oficial */}
                <div className="documento-header-institucional">
                  <h4>Estado de Minas Gerais · Prefeitura Municipal</h4>
                  <h3>Secretaria Municipal de Educação</h3>
                  <h2>E.M. Maria Geralda Miranda Brito Salomão</h2>
                  <p style={{ margin: '4px 0 0', fontSize: '0.85rem', fontWeight: 600 }}>
                    RELATÓRIO OFICIAL DE CONTROLE DE REMATRÍCULA — ANO LETIVO 2027
                  </p>
                </div>

                {/* Metadados da Emissão */}
                <div className="documento-meta-row">
                  <div>
                    <strong>Data de Emissão:</strong> {new Date().toLocaleDateString('pt-BR')} às{' '}
                    {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div>
                    <strong>Filtro:</strong> {turmaFiltro === 'todas' ? 'Todas as Turmas' : `Turma: ${turmaFiltro}`} ·{' '}
                    {relatorioApenasRematriculados ? 'Somente Rematriculados (OK)' : 'Listagem Geral'}
                  </div>
                  <div>
                    <strong>Total Listados:</strong> {alunosParaRelatorio.length} aluno(s)
                  </div>
                </div>

                {/* Tabela Oficial Formatada para Impressão */}
                <table className="documento-tabela-relatorio">
                  <thead>
                    <tr>
                      <th style={{ width: '32px' }}>Nº</th>
                      <th>Código</th>
                      <th>Nome Completo do Aluno</th>
                      <th>Data Nasc.</th>
                      <th>Turma 2026</th>
                      <th>Turma 2027</th>
                      <th>Turno</th>
                      <th>Data Confirmação</th>
                      <th style={{ width: '130px' }}>Assinatura Resp.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alunosParaRelatorio.map((a, index) => (
                      <tr key={a.codigo}>
                        <td>{index + 1}</td>
                        <td style={{ fontWeight: 'bold' }}>{a.codigo}</td>
                        <td style={{ fontWeight: 'bold' }}>{a.nome}</td>
                        <td>{a.dataNascimento || '—'}</td>
                        <td>{a.turmaAtual}</td>
                        <td><strong>{a.turma2027Prevista}</strong></td>
                        <td>{a.turno}</td>
                        <td>
                          {a.rematriculado ? (
                            <span style={{ color: '#047857', fontWeight: 'bold' }}>
                              OK · {formatarDataHora(a.dataRematricula)}
                            </span>
                          ) : (
                            <span style={{ color: '#b45309' }}>Pendente</span>
                          )}
                        </td>
                        <td></td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Resumo Estatístico */}
                <div className="documento-resumo-box">
                  <span>
                    Total de Alunos Listados: <strong>{alunosParaRelatorio.length}</strong>
                  </span>
                  <span>
                    Confirmados para 2027: <strong style={{ color: '#047857' }}>{alunosParaRelatorio.filter((a) => a.rematriculado).length}</strong>
                  </span>
                  <span>
                    Pendentes: <strong style={{ color: '#b45309' }}>{alunosParaRelatorio.filter((a) => !a.rematriculado).length}</strong>
                  </span>
                </div>

                {/* Linhas de Assinatura */}
                <div className="documento-assinaturas-row">
                  <div className="assinatura-bloco">
                    <div className="assinatura-linha" />
                    <strong>Secretaria Escolar</strong>
                    <span className="assinatura-cargo">Responsável pela Emissão</span>
                  </div>

                  <div className="assinatura-bloco">
                    <div className="assinatura-linha" />
                    <strong>Direção Escolar</strong>
                    <span className="assinatura-cargo">E.M. Maria Geralda M. B. Salomão</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
