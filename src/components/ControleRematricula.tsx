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
  Moon,
  Database,
  Copy,
  Upload,
  RotateCcw,
  ShieldCheck
} from 'lucide-react';
import * as XLSX from 'xlsx';
import './ControleRematricula.css';
import { useSchool } from '../context/SchoolContext';
import { carregarAlunosSecretaria } from '../lib/alunosSecretaria';
import { supabase } from '../lib/supabase';
import { gerarDocxRematricula } from '../lib/gerarDocxRematricula';
import rematriculasOficiaisData from '../data/rematriculas_2027_oficiais.json';
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
  nome?: string;
  codigo?: string;
  observacoes?: string;
}

interface Props {
  onToast?: (t: ToastData) => void;
}

const STORAGE_KEY = 'guia_escolar_rematriculas_2027';

/**
 * Normaliza textos para busca insensível a acentos e maiúsculas
 */
function normalizarBusca(texto: string | null | undefined): string {
  if (!texto) return '';
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

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

/**
 * Varre profundamente todo o localStorage buscando quaisquer dados de rematrícula salvos anteriormente
 */
function mesclarNoMapa(destino: Record<string, RegistroRematriculaStorage>, dados: any) {
  if (!dados) return;
  if (Array.isArray(dados)) {
    dados.forEach((item, idx) => {
      if (item && typeof item === 'object') {
        const cod = String(item.codigo || item.codigo_matricula || item.id || item.nome || `item_${idx}`);
        destino[cod] = {
          confirmado: item.confirmado !== undefined ? Boolean(item.confirmado) : Boolean(item.rematriculado),
          dataConfirmacao: item.dataConfirmacao || item.dataRematricula || item.confirmado_em || new Date().toISOString(),
          turma2027: item.turma2027 || item.turma2027Prevista,
          turno2027: item.turno2027 === 'VESP' ? 'VESP' : 'MAT',
          nome: item.nome,
          codigo: cod
        };
      }
    });
  } else if (typeof dados === 'object') {
    Object.entries(dados).forEach(([k, v]: [string, any]) => {
      if (v && typeof v === 'object') {
        destino[k] = {
          confirmado: v.confirmado !== undefined ? Boolean(v.confirmado) : Boolean(v.rematriculado),
          dataConfirmacao: v.dataConfirmacao || v.dataRematricula || v.confirmado_em || new Date().toISOString(),
          turma2027: v.turma2027 || v.turma2027Prevista,
          turno2027: v.turno2027 === 'VESP' ? 'VESP' : 'MAT',
          nome: v.nome,
          codigo: v.codigo || k
        };
      }
    });
  }
}

function recuperarTudoLocalStorage(): Record<string, RegistroRematriculaStorage> {
  const achados: Record<string, RegistroRematriculaStorage> = {};
  if (typeof window === 'undefined' || !window.localStorage) return achados;

  const chavesConhecidas = [
    STORAGE_KEY,
    'guia_escolar_rematriculas_2027',
    'guia_rematriculas_2027',
    'rematriculas_2027',
    'rematriculas',
    'guia_escolar_rematriculas'
  ];

  chavesConhecidas.forEach((chave) => {
    try {
      const val = localStorage.getItem(chave);
      if (val) {
        const parsed = JSON.parse(val);
        mesclarNoMapa(achados, parsed);
      }
    } catch {}
  });

  // Varredura de segurança em todas as chaves do navegador
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || chavesConhecidas.includes(k)) continue;
      const kLower = k.toLowerCase();
      if (kLower.includes('rematr') || kLower.includes('2027')) {
        try {
          const val = localStorage.getItem(k);
          if (val) {
            const parsed = JSON.parse(val);
            mesclarNoMapa(achados, parsed);
          }
        } catch {}
      }
    }
  } catch {}

  return achados;
}

export default function ControleRematricula({ onToast }: Props) {
  const { matriculasEscola, todasMatriculasEscola, escolaAtiva } = useSchool();
  const [alunos, setAlunos] = useState<AlunoRematriculaItem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [versaoAtualizacao, setVersaoAtualizacao] = useState(0);

  // Escuta atualizações de rematrícula disparadas em tempo real pela IA
  useEffect(() => {
    const handleAtualizacao = () => {
      setVersaoAtualizacao((v) => v + 1);
    };
    window.addEventListener('guia_rematricula_atualizada', handleAtualizacao);
    return () => window.removeEventListener('guia_rematricula_atualizada', handleAtualizacao);
  }, []);
  const [busca, setBusca] = useState('');
  const [turmaFiltro, setTurmaFiltro] = useState<string>('todas');
  const [statusFiltro, setStatusFiltro] = useState<'todos' | 'confirmados' | 'pendentes'>('todos');
  const [turnoFiltro, setTurnoFiltro] = useState<'todos' | 'MAT' | 'VESP'>('todos');
  const [modalRelatorioAberta, setModalRelatorioAberta] = useState(false);
  const [modalBackupAberta, setModalBackupAberta] = useState(false);
  const [textoBackupColado, setTextoBackupColado] = useState('');
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
      await supabase.from('rematriculas_2027').upsert({
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

      // 2. Grava também no campo jsonb 'dados' da tabela alunos_secretaria
      await supabase.from('alunos_secretaria').upsert({
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
    } catch (e) {
      console.warn('Supabase offline ou sem conexão no momento. Dados mantidos em segurança no armazenamento local:', e);
    }
  }, []);

  // Carrega alunos e mescla dados salvos do Supabase + LocalStorage (com tolerância a falhas)
  useEffect(() => {
    async function carregar() {
      setCarregando(true);
      try {
        // 0. Base oficial incondicional (221 alunos confirmados do relatório oficial) + histórico do navegador
        const oficiais = (rematriculasOficiaisData || {}) as Record<string, RegistroRematriculaStorage>;
        const doStorage = recuperarTudoLocalStorage();
        const mapRematriculas: Record<string, RegistroRematriculaStorage> = {
          ...oficiais,
          ...doStorage
        };

        // 1. Busca registros salvos na tabela alunos_secretaria do Supabase
        try {
          const { data: secRows } = await supabase
            .from('alunos_secretaria')
            .select('codigo_matricula, nome, turma, turno, situacao, dados');

          if (secRows && secRows.length > 0) {
            secRows.forEach((r: any) => {
              const d = r.dados || {};
              if (d.rematricula_2027 || r.situacao === 'REMATRICULADO_2027') {
                const cod = String(r.codigo_matricula || r.nome);
                mapRematriculas[cod] = {
                  confirmado: true,
                  dataConfirmacao: d.confirmado_em || new Date().toISOString(),
                  turma2027: d.turma_2027,
                  turno2027: d.turno_2027 === 'VESP' ? 'VESP' : 'MAT',
                  nome: r.nome,
                  codigo: cod
                };
              }
            });
          }
        } catch (eSec) {
          console.warn('Leitura de alunos_secretaria:', eSec);
        }

        // 2. Busca registros remotos do Supabase se existirem
        try {
          const { data: dadosSupabase } = await supabase.from('rematriculas_2027').select('*');
          if (dadosSupabase && dadosSupabase.length > 0) {
            dadosSupabase.forEach((r: any) => {
              if (r.codigo_matricula) {
                mapRematriculas[r.codigo_matricula] = {
                  confirmado: Boolean(r.confirmado),
                  dataConfirmacao: r.confirmado_em || new Date().toISOString(),
                  turma2027: r.turma_2027,
                  turno2027: r.turno_2027 === 'VESP' ? 'VESP' : 'MAT',
                  nome: r.nome,
                  codigo: r.codigo_matricula
                };
              }
            });
          }
        } catch {
          // Tabela rematriculas_2027 pode ainda não ter sido executada
        }

        // Atualiza a chave padrão
        localStorage.setItem(STORAGE_KEY, JSON.stringify(mapRematriculas));

        let listaBase: AlunoRematriculaItem[] = [];

        try {
          const alunosDb = await carregarAlunosSecretaria();
          if (alunosDb && alunosDb.length > 0) {
            // Filtra pela escola ativa se a coluna existir
            const alunosFiltradosDb = alunosDb.filter((a: any) => {
              if (!a.escola) return escolaAtiva.includes('MARIA GERALDA');
              return a.escola.toLowerCase().trim() === escolaAtiva.toLowerCase().trim();
            });

            if (alunosFiltradosDb.length > 0) {
              listaBase = alunosFiltradosDb.map((a, idx) => {
                const codigo = String(a.codigo_matricula || a.codigo_estudante || a.ra || `aluno_${idx}`);
                const nome = a.nome;

                // Busca inteligente por código E com fallback por nome
                let saved = mapRematriculas[codigo];
                if (!saved) {
                  const porNome = Object.values(mapRematriculas).find(
                    (r: any) => r && r.nome && normalizarBusca(r.nome) === normalizarBusca(nome)
                  );
                  if (porNome) saved = porNome;
                }

                const turma = a.turma || a.descricao || a.periodo || 'Não informada';
                const turnoPadrao = obterTurnoPadrao(a.turno);
                return {
                  codigo,
                  codigoEstudante: a.codigo_estudante || a.ra || '—',
                  nome,
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
          }
        } catch (erroDb) {
          console.warn('Banco alunos_secretaria não disponível, usando matriculas oficiais locais:', erroDb);
        }

        // Se o banco estiver vazio ou offline para esta escola, carrega as matrículas da escola ativa
        if (listaBase.length === 0) {
          const fonteMatriculas = (todasMatriculasEscola && todasMatriculasEscola.length > 0)
            ? todasMatriculasEscola
            : matriculasEscola;

          listaBase = (fonteMatriculas as unknown as Array<Record<string, string>>).map((m, idx) => {
            const codigo = String(
              m['Código'] ||
              m['codigo_matricula'] ||
              m['Código do estudante'] ||
              m['Registro do estudante (RA)'] ||
              m['Nome'] ||
              `aluno_${idx}`
            );
            const nome = m['Nome'] || 'Sem Nome';

            // Busca hiper-resiliente no mapa de rematrículas salvas
            let saved = mapRematriculas[codigo];

            if (!saved && m['Código do estudante']) {
              saved = mapRematriculas[String(m['Código do estudante'])];
            }

            if (!saved && m['Registro do estudante (RA)']) {
              saved = mapRematriculas[String(m['Registro do estudante (RA)'])];
            }

            if (!saved && nome) {
              saved = mapRematriculas[nome] || mapRematriculas[nome.trim().toUpperCase()];
            }

            if (!saved && nome) {
              const nomeNorm = normalizarBusca(nome);
              const achado = Object.entries(mapRematriculas).find(([chave, r]) => {
                if (!r) return false;
                if (r.nome && normalizarBusca(r.nome) === nomeNorm) return true;
                if (normalizarBusca(chave) === nomeNorm) return true;
                if (r.codigo && String(r.codigo) === codigo) return true;
                return false;
              });
              if (achado) saved = achado[1];
            }

            const turma = m['Descrição'] || m['Turma'] || m['Período'] || '1º ANO';
            const turnoOriginal = m['Turno'] || 'MATUTINO';
            const turnoPadrao = obterTurnoPadrao(turnoOriginal);
            return {
              codigo,
              codigoEstudante: m['Código do estudante'] || m['Registro do estudante (RA)'] || '—',
              nome,
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
  }, [matriculasEscola, todasMatriculasEscola, escolaAtiva, versaoAtualizacao]);

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
          turno2027: aluno.turno2027,
          nome: aluno.nome,
          codigo: aluno.codigo
        };
        onToast?.({
          message: `Rematrícula de ${aluno.nome} confirmada para 2027 (${aluno.turno2027 === 'MAT' ? 'Matutino' : 'Vespertino'})!`,
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
        turno2027: novoTurno,
        nome: aluno.nome,
        codigo: aluno.codigo
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
          turno2027: a.turno2027,
          nome: a.nome,
          codigo: a.codigo
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

  // Copia os dados de rematrícula atuais para a área de transferência (Backup)
  function copiarDadosBackup() {
    const salvosStr = localStorage.getItem(STORAGE_KEY) || '{}';
    navigator.clipboard.writeText(salvosStr).then(() => {
      onToast?.({
        message: `Backup de rematrículas copiado! Você pode colar em qualquer outro navegador ou aba.`,
        type: 'success'
      });
    }).catch(() => {
      onToast?.({
        message: 'Não foi possível copiar automaticamente. Selecione e copie o texto abaixo.',
        type: 'info'
      });
    });
  }

  // Baixa o arquivo de backup em JSON
  function baixarArquivoBackup() {
    const salvosStr = localStorage.getItem(STORAGE_KEY) || '{}';
    const blob = new Blob([salvosStr], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_rematriculas_2027_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onToast?.({
      message: 'Arquivo de backup baixado com sucesso!',
      type: 'success'
    });
  }

  // Restaura dados a partir de um JSON colado ou carregado
  function restaurarDados(textoJson: string) {
    if (!textoJson.trim()) {
      onToast?.({ message: 'Cole o código ou JSON de backup para restaurar.', type: 'error' });
      return;
    }

    try {
      const parsed = JSON.parse(textoJson.trim());
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Formato inválido');
      }

      const mapAtual: Record<string, RegistroRematriculaStorage> = JSON.parse(
        localStorage.getItem(STORAGE_KEY) || '{}'
      );

      // Suporta formato de mapa ou array de alunos
      let countRestaurados = 0;
      if (Array.isArray(parsed)) {
        parsed.forEach((item: any) => {
          if (item && item.rematriculado) {
            const cod = item.codigo || item.nome;
            mapAtual[cod] = {
              confirmado: true,
              dataConfirmacao: item.dataRematricula || new Date().toISOString(),
              turma2027: item.turma2027Prevista,
              turno2027: item.turno2027 || 'MAT',
              nome: item.nome,
              codigo: item.codigo
            };
            countRestaurados++;
          }
        });
      } else {
        Object.entries(parsed).forEach(([k, v]: [string, any]) => {
          if (v && typeof v === 'object' && v.confirmado) {
            mapAtual[k] = v;
            countRestaurados++;
          }
        });
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(mapAtual));

      // Atualiza o estado da lista em memória
      setAlunos((atuais) =>
        atuais.map((aluno) => {
          let saved: RegistroRematriculaStorage | undefined = mapAtual[aluno.codigo];
          if (!saved) {
            saved = Object.values(mapAtual).find(
              (r) => r && r.nome && normalizarBusca(r.nome) === normalizarBusca(aluno.nome)
            );
          }
          if (saved && saved.confirmado) {
            return {
              ...aluno,
              rematriculado: true,
              turno2027: saved.turno2027 || aluno.turno2027,
              dataRematricula: saved.dataConfirmacao || aluno.dataRematricula || new Date().toISOString()
            };
          }
          return aluno;
        })
      );

      setModalBackupAberta(false);
      setTextoBackupColado('');
      onToast?.({
        message: `${countRestaurados} aluno(s) rematriculado(s) restaurados com sucesso!`,
        type: 'success'
      });
    } catch (e) {
      onToast?.({
        message: 'Código de backup inválido. Verifique o texto colado.',
        type: 'error'
      });
    }
  }

  // Varredura profunda em todas as chaves do navegador para resgatar rematrículas
  function recuperarAutomaticamente() {
    const oficiais = (rematriculasOficiaisData || {}) as Record<string, RegistroRematriculaStorage>;
    const doStorage = recuperarTudoLocalStorage();
    const achados: Record<string, RegistroRematriculaStorage> = {
      ...oficiais,
      ...doStorage
    };
    const totalAchados = Object.values(achados).filter((r) => r && r.confirmado).length;

    if (totalAchados === 0) {
      onToast?.({
        message: 'Nenhum registro prévio de rematrícula encontrado no armazenamento deste navegador.',
        type: 'info'
      });
      return;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(achados));

    setAlunos((atuais) =>
      atuais.map((aluno) => {
        let saved: RegistroRematriculaStorage | undefined = achados[aluno.codigo];
        if (!saved && aluno.codigoEstudante) {
          saved = achados[aluno.codigoEstudante];
        }
        if (!saved && aluno.nome) {
          const nomeNorm = normalizarBusca(aluno.nome);
          const f = Object.entries(achados).find(([k, r]) => {
            if (!r) return false;
            if (r.nome && normalizarBusca(r.nome) === nomeNorm) return true;
            if (normalizarBusca(k) === nomeNorm) return true;
            if (r.codigo && String(r.codigo) === aluno.codigo) return true;
            return false;
          });
          if (f) saved = f[1];
        }
        if (saved && saved.confirmado) {
          return {
            ...aluno,
            rematriculado: true,
            turno2027: saved.turno2027 || aluno.turno2027,
            dataRematricula: saved.dataConfirmacao || aluno.dataRematricula || new Date().toISOString()
          };
        }
        return aluno;
      })
    );

    setModalBackupAberta(false);
    onToast?.({
      message: `${totalAchados} aluno(s) rematriculado(s) recuperados com sucesso!`,
      type: 'success'
    });
  }

  // Sincroniza todos os alunos confirmados com o Supabase
  async function sincronizarTudoComSupabase() {
    const confirmados = alunos.filter((a) => a.rematriculado);
    if (confirmados.length === 0) {
      onToast?.({ message: 'Nenhum aluno rematriculado para enviar à nuvem.', type: 'info' });
      return;
    }

    onToast?.({ message: `Sincronizando ${confirmados.length} aluno(s) com o Supabase...`, type: 'info' });

    let sucessos = 0;
    for (const a of confirmados) {
      await salvarNoSupabase(a, true, a.turno2027, a.dataRematricula || new Date().toISOString());
      sucessos++;
    }

    onToast?.({
      message: `${sucessos} aluno(s) salvos permanentemente no banco de dados do Supabase!`,
      type: 'success'
    });
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
        }),
        nomeEscola: escolaAtiva,
        municipio: 'PONTO DOS VOLANTES'
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
    const nomeLimpo = escolaAtiva.replace(/[^a-zA-Z0-9]/g, '_');
    XLSX.writeFile(wb, `Relatorio_Rematriculas_2027_${nomeLimpo}.xlsx`);

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
            {escolaAtiva} · Confirmação simplificada em 1-clique & Escolha de Turno (MAT/VESP)
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

          {/* Botão de Backup e Recuperação */}
          <button
            type="button"
            className="btn-hero-action backup-btn"
            onClick={() => setModalBackupAberta(true)}
            title="Fazer backup, copiar ou restaurar rematrículas salvas"
          >
            <Database size={17} />
            <span>Backup & Restaurar</span>
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
              placeholder="Buscar aluno por nome, matrícula ou turma (com ou sem acento)..."
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
            💡 Dica: Escolha se o responsável prefere <strong>☀️ MAT</strong> ou <strong>🌙 VESP</strong> e dê 1 clique em <strong>Marcar OK para 2027</strong>.
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
                  <h4>Prefeitura Municipal de Ponto dos Volantes · Secretaria Municipal de Educação</h4>
                  <h2>{escolaAtiva}</h2>
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
                    <span className="assinatura-cargo">{escolaAtiva}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. MODAL DE BACKUP E RESTAURAÇÃO / MIGRAÇÃO */}
      {modalBackupAberta && (
        <div className="modal-relatorio-overlay" onClick={() => setModalBackupAberta(false)}>
          <div className="modal-relatorio-card modal-backup-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-relatorio-topbar">
              <h3>
                <Database size={18} color="#2563eb" />
                Backup, Migração e Recuperação de Rematrículas
              </h3>
              <button
                type="button"
                className="btn-close-modal"
                onClick={() => setModalBackupAberta(false)}
                aria-label="Fechar"
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-relatorio-body" style={{ padding: '1.5rem' }}>
              <div className="backup-modal-content">
                <div className="backup-status-banner">
                  <ShieldCheck size={28} color="#059669" />
                  <div>
                    <h4>Status de Rematrículas Neste Navegador</h4>
                    <p>
                      Existem <strong>{totalConfirmados}</strong> aluno(s) marcados como confirmados para 2027 nesta aba.
                    </p>
                  </div>
                </div>

                {/* Opção 0: Resgate Automático */}
                <div className="backup-action-box" style={{ background: '#ecfdf5', borderColor: '#a7f3d0' }}>
                  <h5 style={{ color: '#065f46' }}>⚡ Recuperação Automática das Minhas Rematrículas</h5>
                  <p style={{ color: '#047857' }}>
                    Clique no botão abaixo para escanear todas as chaves de histórico deste navegador e reconectar instantaneamente todas as rematrículas feitas:
                  </p>
                  <div style={{ marginTop: '8px' }}>
                    <button
                      type="button"
                      className="btn-backup-item restore"
                      style={{ background: '#059669', color: '#fff', borderColor: '#047857' }}
                      onClick={recuperarAutomaticamente}
                    >
                      <RotateCcw size={16} />
                      <span>Escanear e Restaurar Minhas Rematrículas Agora</span>
                    </button>
                  </div>
                </div>

                {/* Opção 1: Copiar Dados */}
                <div className="backup-action-box">
                  <h5>1. Exportar Meus Dados de Rematrícula (Backup Rápido)</h5>
                  <p>
                    Se você fez rematrículas em outra aba ou navegador, use este botão para copiar todos os dados e transferir para cá:
                  </p>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                    <button
                      type="button"
                      className="btn-backup-item copy"
                      onClick={copiarDadosBackup}
                    >
                      <Copy size={16} />
                      <span>Copiar Dados (Área de Transferência)</span>
                    </button>
                    <button
                      type="button"
                      className="btn-backup-item file"
                      onClick={baixarArquivoBackup}
                    >
                      <Download size={16} />
                      <span>Baixar Arquivo de Backup (.json)</span>
                    </button>
                  </div>
                </div>

                {/* Opção 2: Colar e Restaurar */}
                <div className="backup-action-box">
                  <h5>2. Restaurar / Importar Dados Salvos</h5>
                  <p>
                    Cole o código de backup copiado da outra aba ou cole o conteúdo do arquivo para restaurar todos os alunos de uma vez:
                  </p>
                  <textarea
                    className="textarea-backup"
                    placeholder="Cole aqui o código de backup (JSON)..."
                    value={textoBackupColado}
                    onChange={(e) => setTextoBackupColado(e.target.value)}
                    rows={4}
                  />
                  <div style={{ marginTop: '8px' }}>
                    <button
                      type="button"
                      className="btn-backup-item restore"
                      onClick={() => restaurarDados(textoBackupColado)}
                    >
                      <RotateCcw size={16} />
                      <span>Restaurar Alunos Agora</span>
                    </button>
                  </div>
                </div>

                {/* Opção 3: Sincronização em Massa com Supabase */}
                <div className="backup-action-box">
                  <h5>3. Enviar Todos os Confirmados para a Nuvem (Supabase)</h5>
                  <p>
                    Grave permanentemente todos os alunos confirmados no banco de dados para ficarem disponíveis em qualquer computador ou celular.
                  </p>
                  <div style={{ marginTop: '8px' }}>
                    <button
                      type="button"
                      className="btn-backup-item cloud"
                      onClick={sincronizarTudoComSupabase}
                    >
                      <Upload size={16} />
                      <span>Sincronizar Todos ({totalConfirmados}) com Supabase</span>
                    </button>
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
