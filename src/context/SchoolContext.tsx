import React, { createContext, useContext, useState, useMemo } from 'react';
import escolasData from '../data/escolas.json';
import matriculasData from '../data/matriculas.json';
import turmasData from '../data/turmas.json';
import profissionaisData from '../data/profissionais.json';
import movimentacoesData from '../data/movimentacoes.json';

export interface EscolaItem {
  Código: string;
  Escola: string;
  'Identificação CENSO'?: string;
  'Gestor escolar'?: string;
  'Secretário(a)'?: string;
  'Coordenador(a)'?: string;
  Telefone?: string;
  'E-mail'?: string;
  Logradouro?: string;
  Número?: string;
  Bairro?: string;
  Cep?: string;
  'Localização/Zona da Escola (CENSO)'?: string;
  'Atos Autorizativos da Escola'?: string;
}

export interface MetricasEscola {
  totalMatriculas: number;
  totalAtivos: number;
  totalTransferidos: number;
  totalDesistentes: number;
  totalTurmas: number;
  totalProfissionais: number;
  totalMovimentacoes: number;
}

interface SchoolContextType {
  escolaAtiva: string;
  codigoEscolaAtiva: string;
  escolas: EscolaItem[];
  dadosEscolaAtiva: EscolaItem | undefined;
  setEscolaAtiva: (nome: string) => void;
  matriculasEscola: typeof matriculasData;
  turmasEscola: typeof turmasData;
  profissionaisEscola: typeof profissionaisData;
  movimentacoesEscola: typeof movimentacoesData;
  metricasEscola: MetricasEscola;
}

const STORAGE_KEY = 'guia_escolar_escola_ativa';
export const ESCOLA_PADRAO = 'EM MARIA GERALDA MIRANDA BRITO SALOMÃO';

const SchoolContext = createContext<SchoolContextType | undefined>(undefined);

export const SchoolProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [escolaAtiva, setEscolaAtivaState] = useState<string>(() => {
    try {
      const salva = localStorage.getItem(STORAGE_KEY);
      if (salva && (escolasData as EscolaItem[]).some((e) => e.Escola === salva)) {
        return salva;
      }
    } catch {
      // Ignora erro de localStorage
    }
    return ESCOLA_PADRAO;
  });

  const setEscolaAtiva = (nome: string) => {
    setEscolaAtivaState(nome);
    try {
      localStorage.setItem(STORAGE_KEY, nome);
    } catch {
      // Ignora erro de localStorage
    }
  };

  const escolas = useMemo(() => escolasData as EscolaItem[], []);

  const dadosEscolaAtiva = useMemo(() => {
    return escolas.find(
      (e) => e.Escola.trim().toUpperCase() === escolaAtiva.trim().toUpperCase()
    );
  }, [escolas, escolaAtiva]);

  const codigoEscolaAtiva = dadosEscolaAtiva?.Código || '22';

  // Matrículas da escola ativa
  const matriculasEscola = useMemo(() => {
    const nomeNorm = escolaAtiva.trim().toUpperCase();
    return (matriculasData as any[]).filter((m) => {
      const esc = (m['Escola'] || ESCOLA_PADRAO).trim().toUpperCase();
      return esc === nomeNorm;
    });
  }, [escolaAtiva]);

  // Turmas da escola ativa
  const turmasEscola = useMemo(() => {
    const nomeNorm = escolaAtiva.trim().toUpperCase();
    return (turmasData as any[]).filter((t) => {
      const esc = (t['Escola'] || ESCOLA_PADRAO).trim().toUpperCase();
      return esc === nomeNorm;
    });
  }, [escolaAtiva]);

  // Profissionais da escola ativa
  const profissionaisEscola = useMemo(() => {
    const nomeNorm = escolaAtiva.trim().toUpperCase();
    return (profissionaisData as any[]).filter((p) => {
      const esc = (p['Escola'] || ESCOLA_PADRAO).trim().toUpperCase();
      return esc === nomeNorm;
    });
  }, [escolaAtiva]);

  // Movimentações da escola ativa
  const movimentacoesEscola = useMemo(() => {
    const nomeNorm = escolaAtiva.trim().toUpperCase();
    return (movimentacoesData as any[]).filter((m) => {
      const esc = (m['Escola'] || ESCOLA_PADRAO).trim().toUpperCase();
      return esc === nomeNorm;
    });
  }, [escolaAtiva]);

  // Métricas com respeito cronológico aos alunos que saíram e voltaram
  const metricasEscola = useMemo<MetricasEscola>(() => {
    const totalMatriculas = matriculasEscola.length;

    // Agrupa por estudante para analisar ordem cronológica da última situação
    // Cada estudante terá seu último registro de movimentação/matrícula analisado
    const ultimasSituacoes = new Map<string, string>();

    // Ordena cópia local por data da matrícula
    const ordenados = [...matriculasEscola].sort((a, b) => {
      const dataA = a['Data da matrícula'] || '';
      const dataB = b['Data da matrícula'] || '';
      return dataA.localeCompare(dataB);
    });

    for (const m of ordenados) {
      const idEstudante = m['Código do estudante'] || m['Nome'] || m['Código'];
      const sit = (m['Situação'] || 'NORMAL').trim().toUpperCase();
      // O último registro no tempo define a situação atual do aluno
      ultimasSituacoes.set(String(idEstudante), sit);
    }

    let totalAtivos = 0;
    let totalTransferidos = 0;
    let totalDesistentes = 0;

    for (const situacao of ultimasSituacoes.values()) {
      if (situacao === 'TRANSFERIDO') {
        totalTransferidos++;
      } else if (situacao === 'DESISTENTE') {
        totalDesistentes++;
      } else {
        totalAtivos++;
      }
    }

    return {
      totalMatriculas,
      totalAtivos,
      totalTransferidos,
      totalDesistentes,
      totalTurmas: turmasEscola.length,
      totalProfissionais: profissionaisEscola.length,
      totalMovimentacoes: movimentacoesEscola.length,
    };
  }, [matriculasEscola, turmasEscola, profissionaisEscola, movimentacoesEscola]);

  return (
    <SchoolContext.Provider
      value={{
        escolaAtiva,
        codigoEscolaAtiva,
        escolas,
        dadosEscolaAtiva,
        setEscolaAtiva,
        matriculasEscola,
        turmasEscola,
        profissionaisEscola,
        movimentacoesEscola,
        metricasEscola,
      }}
    >
      {children}
    </SchoolContext.Provider>
  );
};

export function useSchool() {
  const context = useContext(SchoolContext);
  if (!context) {
    throw new Error('useSchool deve ser usado dentro de um SchoolProvider');
  }
  return context;
}
