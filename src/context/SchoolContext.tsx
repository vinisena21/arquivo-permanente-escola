import React, { createContext, useContext, useState, useMemo } from 'react';
import escolasData from '../data/escolas.json';
import matriculasData from '../data/matriculas.json';
import turmasData from '../data/turmas.json';
import profissionaisData from '../data/profissionais.json';
import movimentacoesData from '../data/movimentacoes.json';
import { useAnoLetivo } from './AnoLetivoContext';

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
  anoLetivo: number;
}

const STORAGE_KEY = 'guia_escolar_escola_ativa';
export const ESCOLA_PADRAO = 'EM MARIA GERALDA MIRANDA BRITO SALOMÃO';

function extrairAno(dataStr?: string | null): number | null {
  if (!dataStr) return null;
  const str = String(dataStr).trim();
  const br = str.match(/(\d{2})[/.-](\d{2})[/.-](\d{4})/);
  if (br) return parseInt(br[3], 10);
  const iso = str.match(/^(\d{4})[/.-]/);
  if (iso) return parseInt(iso[1], 10);
  return null;
}

const SchoolContext = createContext<SchoolContextType | undefined>(undefined);

export const SchoolProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { anoLetivo } = useAnoLetivo();

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

  // Matrículas da escola ativa filtradas com isolamento temporal por Ano Letivo
  const matriculasEscola = useMemo(() => {
    const nomeNorm = escolaAtiva.trim().toUpperCase();
    return (matriculasData as any[]).filter((m) => {
      const esc = (m['Escola'] || ESCOLA_PADRAO).trim().toUpperCase();
      if (esc !== nomeNorm) return false;

      // Filtro de isolamento temporal por ano letivo
      const dataMatr = m['Data da matrícula'] || m['Data da movimentação'] || '';
      const anoReg = extrairAno(dataMatr);

      if (anoLetivo === 2026) {
        // Ano base do arquivo/dump: aceita registros de 2026 ou sem ano explícito
        return !anoReg || anoReg === 2026;
      } else {
        // Anos anteriores ou futuros: apenas registros cujo ano corresponda exatamente
        return anoReg === anoLetivo;
      }
    });
  }, [escolaAtiva, anoLetivo]);

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

  // Movimentações da escola ativa com isolamento por ano letivo
  const movimentacoesEscola = useMemo(() => {
    const nomeNorm = escolaAtiva.trim().toUpperCase();
    return (movimentacoesData as any[]).filter((m) => {
      const esc = (m['Escola'] || ESCOLA_PADRAO).trim().toUpperCase();
      if (esc !== nomeNorm) return false;

      const dataMov = m['Data da Movimentação'] || '';
      const anoMov = extrairAno(dataMov);
      if (anoLetivo === 2026) {
        return !anoMov || anoMov === 2026;
      } else {
        return anoMov === anoLetivo;
      }
    });
  }, [escolaAtiva, anoLetivo]);

  // Métricas com respeito cronológico aos alunos que saíram e voltaram
  const metricasEscola = useMemo<MetricasEscola>(() => {
    const totalMatriculas = matriculasEscola.length;

    const ultimasSituacoes = new Map<string, string>();

    const ordenados = [...matriculasEscola].sort((a, b) => {
      const dataA = a['Data da matrícula'] || '';
      const dataB = b['Data da matrícula'] || '';
      return dataA.localeCompare(dataB);
    });

    for (const m of ordenados) {
      const idEstudante = m['Código do estudante'] || m['Nome'] || m['Código'];
      const sit = (m['Situação'] || 'NORMAL').trim().toUpperCase();
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
        anoLetivo,
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
