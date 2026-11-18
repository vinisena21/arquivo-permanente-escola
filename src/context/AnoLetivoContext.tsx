import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';

export interface FechamentoPeriodo {
  trimestre: number;
  fechado: boolean;
  fechadoEm: string | null;
}

interface AnoLetivoContextType {
  anoLetivo: number;
  anosDisponiveis: number[];
  setAnoLetivo: (ano: number) => void;
  fechamentos: FechamentoPeriodo[];
  setFechamentos: React.Dispatch<React.SetStateAction<FechamentoPeriodo[]>>;
  isTrimFechado: (trim: number) => boolean;
  labelAno: string;
}

const STORAGE_KEY = 'guia_escolar_ano_letivo';
export const ANOS_DISPONIVEIS = [2024, 2025, 2026, 2027];
export const ANO_PADRAO = 2026;

const AnoLetivoContext = createContext<AnoLetivoContextType | undefined>(undefined);

export const AnoLetivoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [anoLetivo, setAnoLetivoState] = useState<number>(() => {
    try {
      const salvo = localStorage.getItem(STORAGE_KEY);
      if (salvo) {
        const num = parseInt(salvo, 10);
        if (ANOS_DISPONIVEIS.includes(num)) return num;
      }
    } catch {
      // Ignora erro de localStorage
    }
    return ANO_PADRAO;
  });

  const [fechamentos, setFechamentos] = useState<FechamentoPeriodo[]>([
    { trimestre: 1, fechado: false, fechadoEm: null },
    { trimestre: 2, fechado: false, fechadoEm: null },
    { trimestre: 3, fechado: false, fechadoEm: null },
  ]);

  const setAnoLetivo = useCallback((ano: number) => {
    setAnoLetivoState(ano);
    try {
      localStorage.setItem(STORAGE_KEY, String(ano));
    } catch {
      // Ignora erro de localStorage
    }
  }, []);

  const isTrimFechado = useCallback(
    (trim: number) => fechamentos.find((f) => f.trimestre === trim)?.fechado ?? false,
    [fechamentos]
  );

  const labelAno = useMemo(() => `Ano Letivo ${anoLetivo}`, [anoLetivo]);
  const anosDisponiveis = useMemo(() => ANOS_DISPONIVEIS, []);

  return (
    <AnoLetivoContext.Provider
      value={{
        anoLetivo,
        anosDisponiveis,
        setAnoLetivo,
        fechamentos,
        setFechamentos,
        isTrimFechado,
        labelAno,
      }}
    >
      {children}
    </AnoLetivoContext.Provider>
  );
};

export function useAnoLetivo() {
  const ctx = useContext(AnoLetivoContext);
  if (!ctx) {
    throw new Error('useAnoLetivo deve ser usado dentro de um AnoLetivoProvider');
  }
  return ctx;
}
