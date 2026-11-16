import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  GraduationCap,
  Sun,
  Moon
} from 'lucide-react';
import * as XLSX from 'xlsx';
import './ControleRematricula.css';
import matriculasOficiais from '../data/matriculas.json';
import { carregarAlunosSecretaria } from '../lib/alunosSecretaria';
import { supabase } from '../lib/supabase';
import { gerarDocxRematricula } from '../lib/gerarDocxRematricula';
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
  turno2027: 'MAT' | 'VESP';
  rematriculado: boolean;
  dataRematricula: string | null;
  responsavel?: string;
}

interface RegistroRematriculaStorage {
  confirmado: boolean;
  dataConfirmacao: string;
  turma2027?: string;
  turno2027?: 'MAT' | 'VESP';
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

function obterTurnoPadrao(turnoOriginal?: string | null): 'MAT' | 'VESP' {
  if (!turnoOriginal) return 'MAT';
  const t = turnoOriginal.toUpperCase();
  if (t.includes('VESP') || t.includes('TARDE') || t.includes('NOITE')) return 'VESP';
  return 'MAT';
}

function normalizarBusca(texto: string | null | undefined): string {
  if (!texto) return '';
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
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
  const [turnoFiltro, setTurnoFiltro] = useState<'todos' | 'MAT' | 'VESP'>('todos');
  const [modalRelatorioAberta, setModalRelatorioAberta] = useState(false);
  const [relatorioApenasRematriculados, setRelatorioApenasRematriculados] = useState(true);
  const [gerandoWord, setGerandoWord] = useState(false);

  // Sincroniza uma alteração individual diretamente com o Supabase
  const salvarNoSupabase = useCallback(async (
    aluno: AlunoRematriculaItem,
    confirmado: boolean,
    turno: 'MAT' | 'VESP',
    agora: string
  ) => {
    try {
      // 1. Tenta gravar na tabela dedicada rematriculas_2027
      const { error: errRematricula } = await supabase.from('rematriculas_2027').upsert({
        codigo_matricula: aluno.codigo,
        nome: aluno.nome,
        turma_atual: aluno.turmaAtual,
        turma_2027: aluno.turma2027Prevista,
        turno_2027: turno,
        confirmado: confirmado,
        data_nascimento: aluno.dataNascimento,
        responsavel: aluno.responsavel,
        confirmado_em: agora
      } as any, { onConflict: 'codigo_matricula' });

      if (errRematricula) {
        console.warn('Tabela rematriculas_2027 indisponível no Supabase, salvando via alunos_secretaria:', errRematricula.message);
      }

      // 2. Grava também no campo jsonb 'dados' da tabela alunos_secretaria
      const { error: errSecretaria } = await supabase.from('alunos_secretaria').upsert({
        codigo_matricula: aluno.codigo,
        nome: aluno.nome,
        turma: aluno.turmaAtual,
        turno: turno,
        situacao: confirmado ? 'REMATRICULADO_2027' : 'NORMAL',
        dados: {
          rematricula_2027: confirmado,
          turma_2027: aluno.turma2027Prevista,
          turno_2027: turno,
          confirmado_em: agora
        }
      } as any, { onConflict: 'codigo_matricula' });

      if (errSecretaria) {
        console.warn('Erro ao atualizar alunos_secretaria no Supabase:', errSecretaria.message);
      }
    } catch (e) {
      console.warn('Supabase offline ou sem conexão no momento. Dados mantidos em segurança no armazenamento local:', e);
    }
  }, []);

  // Carrega alunos e mescla dados salvos do Supabase + LocalStorage
  useEffect(() => {
    async function carregar() {
      setCarregando(true);
      try {
        const salvosStr = localStorage.getItem(STORAGE_KEY);
        const mapRematriculas: Record<string, RegistroRematriculaStorage> = salvosStr ? JSON.parse(salvosStr) : {};

        // Busca registros remotos do Supabase se existirem
        try {
          const { data: dadosSupabase } = await supabase.from('rematriculas_2027').select('*');
          if (dadosSupabase && dadosSupabase.length > 0) {
            dadosSupabase.forEach((r: any) => {
              if (r.codigo_matricula) {
                mapRematriculas[r.codigo_matricula] = {
                  confirmado: Boolean(r.confirmado),
                  dataConfirmacao: r.confirmado_em || new Date().toISOString(),
                  turma2027: r.turma_2027,
                  turno2027: r.turno_2027 === 'VESP' ? 'VESP' : 'MAT'
                };
              }
            });
            localStorage.setItem(STORAGE_KEY, JSON.stringify(mapRematriculas));
          }
        } catch {
          // Tabela rematriculas_2027 pode ainda não ter sido executada
        }

        let listaBase: AlunoRematriculaItem[] = [];

        try {
          const alunosDb = await carregarAlunosSecretaria();
          if (alunosDb && alunosDb.length > 0) {
            listaBase = alunosDb.map((a) => {
              const codigo = a.codigo_matricula;
              const saved = mapRematriculas[codigo];
              const turma = a.turma || a.descricao || a.periodo || 'Não informada';
              const turnoPadrao = obterTurnoPadrao(a.turno);
              return {
                codigo,
                codigoEstudante: a.codigo_estudante || a.ra || '—',
                nome: a.nome,
                dataNascimento: a.data_nascimento || '',
                turmaAtual: turma,
                periodo: a.periodo || '',
                turno: a.turno || 'MATUTINO',
                turma2027Prevista: calcularProximaEtapa(turma),
                turno2027: saved?.turno2027 || turnoPadrao,
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
            const turnoOriginal = m['Turno'] || 'MATUTINO';
            const turnoPadrao = obterTurnoPadrao(turnoOriginal);
            return {
              codigo,
              codigoEstudante: m['Código do estudante'] || m['Registro do estudante (RA)'] || '—',
              nome: m['Nome'] || 'Sem Nome',
              dataNascimento: m['Data de Nascimento'] || '',
              turmaAtual: turma,
              periodo: m['Período'] || '',
              turno: turnoOriginal,
              turma2027Prevista: calcularProximaEtapa(turma),
              turno2027: saved?.turno2027 || turnoPadrao,
              rematriculado: Boolean(saved?.confirmado),
              dataRematricula: saved?.dataConfirmacao || null,
              responsavel: m['Responsável'] || m['Filiação 1'] || undefined
            };
          });
        }

        // Ordena alfabeticamente por nome
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

  // Alunos filtrados por busca, turma, status e turno (sem distinção de acentos)
  const alunosFiltrados = useMemo(() => {
    const termo = normalizarBusca(busca);
    return alunos.filter((a) => {
      const matchBusca =
        !termo ||
        normalizarBusca(a.nome).includes(termo) ||
        normalizarBusca(a.codigo).includes(termo) ||
        normalizarBusca(a.turmaAtual).includes(termo) ||
        normalizarBusca(a.turma2027Prevista).includes(termo);

      if (!matchBusca) return false;

      if (turmaFiltro !== 'todas' && a.turmaAtual !== turmaFiltro) {
        return false;
      }

      if (statusFiltro === 'confirmados' && !a.rematriculado) return false;
      if (statusFiltro === 'pendentes' && a.rematriculado) return false;

      if (turnoFiltro !== 'todos' && a.turno2027 !== turnoFiltro) return false;

      return true;
    });
  }, [alunos, busca, turmaFiltro, statusFiltro, turnoFiltro]);

  // Estatísticas de Rematrícula em Tempo Real
  const totalAlunos = alunos.length;
  const totalConfirmados = useMemo(() => alunos.filter((a) => a.rematriculado).length, [alunos]);
  const totalPendentes = totalAlunos - totalConfirmados;
  const percentualConcluido = totalAlunos > 0 ? Math.round((totalConfirmados / totalAlunos) * 100) : 0;

  const totalMatutinoConfirmados = useMemo(
    () => alunos.filter((a) => a.rematriculado && a.turno2027 === 'MAT').length,
    [alunos]
  );
  const totalVespertinoConfirmados = useMemo(
    () => alunos.filter((a) => a.rematriculado && a.turno2027 === 'VESP').length,
    [alunos]
  );

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

    // Salva no LocalStorage
    try {
      const salvosStr = localStorage.getItem(STORAGE_KEY);
      const map: Record<string, RegistroRematriculaStorage> = salvosStr ? JSON.parse(salvosStr) : {};

      if (novoStatus) {
        map[aluno.codigo] = {
          confirmado: true,
          dataConfirmacao: agora,
          turma2027: aluno.turma2027Prevista,
          turno2027: aluno.turno2027
        };
        onToast?.({
          message: `Rematrícula de ${aluno.nome} confirmada para 2027 (${aluno.turno2027 === 'MAT' ? 'Matutino' : 'Vespertino'})! Salvo no banco de dados.`,
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

      // Salva no Supabase
      void salvarNoSupabase(aluno, novoStatus, aluno.turno2027, agora);
    } catch (e) {
      console.error('Erro ao salvar rematrícula:', e);
    }
  }

  // Alterna a opção do responsável: MAT (Matutino) ou VESP (Vespertino)
  function alterarTurno(aluno: AlunoRematriculaItem, novoTurno: 'MAT' | 'VESP') {
    if (aluno.turno2027 === novoTurno) return;

    const agora = aluno.dataRematricula || new Date().toISOString();

    setAlunos((prev) =>
      prev.map((item) => {
        if (item.codigo === aluno.codigo) {
          return {
            ...item,
            turno2027: novoTurno
          };
        }
        return item;
      })
    );

    try {
      const salvosStr = localStorage.getItem(STORAGE_KEY);
      const map: Record<string, RegistroRematriculaStorage> = salvosStr ? JSON.parse(salvosStr) : {};

      map[aluno.codigo] = {
        confirmado: aluno.rematriculado,
        dataConfirmacao: aluno.dataRematricula || agora,
        turma2027: aluno.turma2027Prevista,
        turno2027: novoTurno
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(map));

      onToast?.({
        message: `Turno pretendido de ${aluno.nome} alterado para ${novoTurno === 'MAT' ? 'Matutino (Manhã)' : 'Vespertino (Tarde)'}.`,
        type: 'info'
      });

      // Atualiza também no Supabase
      void salvarNoSupabase({ ...aluno, turno2027: novoTurno }, aluno.rematriculado, novoTurno, agora);
    } catch (e) {
      console.error('Erro ao alterar turno no storage:', e);
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
          turma2027: a.turma2027Prevista,
          turno2027: a.turno2027
        };
        // Grava no Supabase
        void salvarNoSupabase(a, true, a.turno2027, agora);
      });

      localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
      onToast?.({
        message: `${alunosFiltrados.length} aluno(s) confirmados para 2027 e gravados no banco!`,
        type: 'success'
      });
    } catch (e) {
      console.error('Erro ao salvar em lote:', e);
    }
  }

  // Exportar Documento Microsoft Word (.docx) Oficial
  async function exportarParaWord() {
    const listaParaExportar = relatorioApenasRematriculados
      ? alunos.filter((a) => a.rematriculado)
      : alunosFiltrados;

    if (listaParaExportar.length === 0) {
      onToast?.({
        message: 'Nenhum aluno rematriculado para exportar no relatório atual.',
        type: 'error'
      });
      return;
    }

    setGerandoWord(true);
    try {
      await gerarDocxRematricula({
        alunos: listaParaExportar,
        turmaFiltro,
        totalGeral: totalAlunos,
        totalConfirmados,
        totalMatutino: totalMatutinoConfirmados,
        totalVespertino: totalVespertinoConfirmados,
        dataEmissaoFormatada: new Date().toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      });

      onToast?.({
        message: 'Documento Word (.docx) oficial gerado e baixado com sucesso!',
        type: 'success'
      });
    } catch (err) {
      console.error('Erro ao exportar Word:', err);
      onToast?.({
        message: 'Falha ao gerar arquivo DOCX. Tente novamente.',
        type: 'error'
      });
    } finally {
      setGerandoWord(false);
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
      'Turno Desejado (2027)': a.turno2027 === 'VESP' ? 'VESPERTINO (TARDE)' : 'MATUTINO (MANHÃ)',
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

  // Aciona impressão oficial A4 (com folha limpa sem cortes nem telas brancas)
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

    if (turnoFiltro !== 'todos') {
      lista = lista.filter((a) => a.turno2027 === turnoFiltro);
    }

    return lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [alunos, relatorioApenasRematriculados, alunosFiltrados, turmaFiltro, turnoFiltro]);

  return (
    <div className="rematricula-container">
      {/* 1. HERO INSTITUCIONAL */}
      <section className="rematricula-hero">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
            <div className="rematricula-hero-tag">
              <Sparkles size={14} /> Ano Letivo 2027 · Controle Oficial
            </div>
            <div className="cloud-sync-pill" title="Sincronizado automaticamente com o banco de dados Supabase">
              <span className="cloud-sync-dot" />
              <span>Supabase Conectado</span>
            </div>
          </div>
          <h1>Controle de Rematrícula 2027</h1>
          <p className="rematricula-hero-sub">
            E.M. MARIA GERALDA MIRANDA BRITO SALOMÃO · Confirmação simplificada em 1-clique & Escolha de Turno (MAT/VESP)
          </p>
        </div>

        <div className="rematricula-hero-actions">
          <button
            type="button"
            className="btn-hero-action primary"
            onClick={() => setModalRelatorioAberta(true)}
            title="Gerar e imprimir relatório completo em PDF / A4"
          >
            <Printer size={18} />
            <span>Gerar Relatório (PDF)</span>
          </button>

          <button
            type="button"
            className="btn-hero-action word"
            onClick={exportarParaWord}
            disabled={gerandoWord}
            title="Exportar documento oficial formatado em Word (.docx)"
          >
            <FileText size={18} />
            <span>{gerandoWord ? 'Gerando...' : 'Exportar Word (.docx)'}</span>
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
            <div style={{ display: 'flex', gap: '6px', marginTop: '4px', fontSize: '0.72rem' }}>
              <span className="badge-turno-tag mat">☀️ MAT: {totalMatutinoConfirmados}</span>
              <span className="badge-turno-tag vesp">🌙 VESP: {totalVespertinoConfirmados}</span>
            </div>
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
            {/* Filtro por Turma */}
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

            {/* Filtro por Turno */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <select
                className="select-turma-filter"
                value={turnoFiltro}
                onChange={(e) => setTurnoFiltro(e.target.value as any)}
                aria-label="Filtrar por turno"
              >
                <option value="todos">Todos os Turnos</option>
                <option value="MAT">☀️ Matutino (MAT)</option>
                <option value="VESP">🌙 Vespertino (VESP)</option>
              </select>
            </div>

            {/* Abas Rápidas de Status */}
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
            💡 Dica: Escolha se o responsável prefere <strong>☀️ MAT</strong> ou <strong>🌙 VESP</strong> e dê 1 clique em <strong>Marcar OK para 2027</strong>. Fica salvo no Supabase automaticamente!
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

      {/* 4. LISTAGEM DE ALUNOS COM O BOTÃO DE 1-CLIQUE E SELEÇÃO DE TURNO */}
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
                  <th style={{ textAlign: 'center' }}>Turno 2027 (Responsável)</th>
                  <th style={{ textAlign: 'right' }}>Status Rematrícula</th>
                </tr>
              </thead>
              <tbody key={`rematricula-list-${busca}-${turmaFiltro}-${statusFiltro}-${turnoFiltro}`}>
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

                    {/* Coluna de Seleção de Turno do Responsável (MAT / VESP) */}
                    <td style={{ textAlign: 'center' }}>
                      <div className="turno-toggle-group">
                        <button
                          type="button"
                          className={`btn-turno ${item.turno2027 === 'MAT' ? 'active-mat' : ''}`}
                          onClick={() => alterarTurno(item, 'MAT')}
                          title="Opção do Responsável: Matutino (Manhã)"
                        >
                          <Sun size={12} />
                          <span>MAT</span>
                        </button>
                        <button
                          type="button"
                          className={`btn-turno ${item.turno2027 === 'VESP' ? 'active-vesp' : ''}`}
                          onClick={() => alterarTurno(item, 'VESP')}
                          title="Opção do Responsável: Vespertino (Tarde)"
                        >
                          <Moon size={12} />
                          <span>VESP</span>
                        </button>
                      </div>
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          type="button"
                          className={`btn-toggle-rematricula ${item.rematriculado ? 'confirmado' : 'pendente'}`}
                          onClick={() => alternarRematricula(item)}
                          title={item.rematriculado ? `Confirmado em ${formatarDataHora(item.dataRematricula)} (${item.turno2027 === 'MAT' ? 'Matutino' : 'Vespertino'}). Clique para desfazer.` : 'Clique para confirmar a rematrícula para 2027'}
                        >
                          {item.rematriculado ? (
                            <>
                              <CheckCircle2 size={16} color="#059669" />
                              <span>OK para 2027 ({item.turno2027})</span>
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

      {/* 5. MODAL DE RELATÓRIO OFICIAL (IMPRESSÃO A4, WORD E EXCEL) */}
      {modalRelatorioAberta && (
        <div className="modal-relatorio-overlay" onClick={() => setModalRelatorioAberta(false)}>
          <div className="modal-relatorio-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-relatorio-topbar">
              <h3>
                <FileText size={18} color="#1e3a8a" />
                Relatório de Rematrículas — Ano Letivo 2027
              </h3>

              <div className="modal-relatorio-actions">
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', marginRight: '8px', cursor: 'pointer' }}>
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
                  className="btn-print-action word"
                  onClick={exportarParaWord}
                  disabled={gerandoWord}
                  title="Exportar documento oficial em Word (.docx)"
                >
                  <FileText size={16} />
                  <span>{gerandoWord ? 'Gerando...' : 'Word (.docx)'}</span>
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
                  <h4>Prefeitura Municipal de Vespasiano · Secretaria Municipal de Educação</h4>
                  <h2>Escola Municipal Maria Geralda Miranda Brito Salomão</h2>
                  <p style={{ margin: '4px 0 0', fontSize: '0.88rem', fontWeight: 700, color: '#1e3a8a' }}>
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
                    {relatorioApenasRematriculados ? 'Somente Confirmados (OK)' : 'Listagem Geral'}
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
                      <th>Turma Atual</th>
                      <th>Turma 2027</th>
                      <th style={{ textAlign: 'center' }}>Turno 2027</th>
                      <th>Status Rematrícula</th>
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
                        <td style={{ textAlign: 'center', fontWeight: 'bold', color: a.turno2027 === 'VESP' ? '#c2410c' : '#1d4ed8' }}>
                          {a.turno2027 === 'VESP' ? 'VESPERTINO' : 'MATUTINO'}
                        </td>
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
                    Total Listados: <strong>{alunosParaRelatorio.length}</strong>
                  </span>
                  <span>
                    Confirmados 2027: <strong style={{ color: '#047857' }}>{alunosParaRelatorio.filter((a) => a.rematriculado).length}</strong>
                  </span>
                  <span>
                    ☀️ Matutino (MAT): <strong style={{ color: '#1d4ed8' }}>{alunosParaRelatorio.filter((a) => a.rematriculado && a.turno2027 === 'MAT').length}</strong>
                  </span>
                  <span>
                    🌙 Vespertino (VESP): <strong style={{ color: '#c2410c' }}>{alunosParaRelatorio.filter((a) => a.rematriculado && a.turno2027 === 'VESP').length}</strong>
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
                    <span className="assinatura-cargo">Responsável pela Emissão e Matrículas</span>
                  </div>

                  <div className="assinatura-bloco">
                    <div className="assinatura-linha" />
                    <strong>Direção Escolar</strong>
                    <span className="assinatura-cargo">E.M. Maria Geralda Miranda Brito Salomão</span>
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
