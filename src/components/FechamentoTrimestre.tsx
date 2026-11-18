import React, { useState, useEffect, useCallback } from 'react';
import { Lock, Unlock, AlertTriangle, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useSchool } from '../context/SchoolContext';
import { useAnoLetivo } from '../context/AnoLetivoContext';
import type { ToastData } from './Toast';

interface FechamentoInfo {
  trimestre: number;
  fechado: boolean;
  fechadoEm: string | null;
  fechadoPor: string | null;
}

interface Props {
  onToast?: (t: ToastData) => void;
}

const STORAGE_PREFIX = 'guia_fechamento_trimestre_';

export const FechamentoTrimestre: React.FC<Props> = ({ onToast }) => {
  const { escolaAtiva } = useSchool();
  const { anoLetivo, setFechamentos } = useAnoLetivo();
  const [fechamentosLocais, setFechamentosLocais] = useState<FechamentoInfo[]>([
    { trimestre: 1, fechado: false, fechadoEm: null, fechadoPor: null },
    { trimestre: 2, fechado: false, fechadoEm: null, fechadoPor: null },
    { trimestre: 3, fechado: false, fechadoEm: null, fechadoPor: null },
  ]);
  const [carregando, setCarregando] = useState(false);

  const carregarFechamentos = useCallback(async () => {
    setCarregando(true);
    try {
      // 1. Tenta carregar do Supabase
      const { data, error } = await supabase
        .from('fechamento_periodos' as any)
        .select('*')
        .eq('escola', escolaAtiva)
        .eq('ano_letivo', anoLetivo);

      if (!error && data && data.length > 0) {
        const mapeados: FechamentoInfo[] = [1, 2, 3].map((trim) => {
          const item = (data as any[]).find((d) => d.trimestre === trim);
          return {
            trimestre: trim,
            fechado: Boolean(item?.fechado),
            fechadoEm: item?.fechado_em || null,
            fechadoPor: item?.fechado_por || null,
          };
        });
        setFechamentosLocais(mapeados);
        setFechamentos(
          mapeados.map((m) => ({
            trimestre: m.trimestre,
            fechado: m.fechado,
            fechadoEm: m.fechadoEm,
          }))
        );
        return;
      }
    } catch {
      // Fallback para localStorage
    }

    // 2. Fallback de localStorage caso tabela ainda não tenha sido migrada
    try {
      const storageKey = `${STORAGE_PREFIX}${escolaAtiva}_${anoLetivo}`;
      const salvo = localStorage.getItem(storageKey);
      if (salvo) {
        const parseado = JSON.parse(salvo);
        setFechamentosLocais(parseado);
        setFechamentos(
          parseado.map((m: any) => ({
            trimestre: m.trimestre,
            fechado: m.fechado,
            fechadoEm: m.fechadoEm,
          }))
        );
        return;
      }
    } catch {
      // ignora
    }

    const padrao: FechamentoInfo[] = [1, 2, 3].map((t) => ({
      trimestre: t,
      fechado: false,
      fechadoEm: null,
      fechadoPor: null,
    }));
    setFechamentosLocais(padrao);
    setFechamentos(
      padrao.map((p) => ({
        trimestre: p.trimestre,
        fechado: p.fechado,
        fechadoEm: null,
      }))
    );
    setCarregando(false);
  }, [escolaAtiva, anoLetivo, setFechamentos]);

  useEffect(() => {
    void carregarFechamentos();
  }, [carregarFechamentos]);

  async function alternarFechamento(trimestre: number, fechar: boolean) {
    const agora = new Date().toISOString();
    const novosFechamentos = fechamentosLocais.map((f) =>
      f.trimestre === trimestre
        ? {
            ...f,
            fechado: fechar,
            fechadoEm: fechar ? agora : null,
            fechadoPor: fechar ? 'Secretaria' : null,
          }
        : f
    );

    setFechamentosLocais(novosFechamentos);
    setFechamentos(
      novosFechamentos.map((n) => ({
        trimestre: n.trimestre,
        fechado: n.fechado,
        fechadoEm: n.fechadoEm,
      }))
    );

    // Salva no localStorage como garantia imediata
    try {
      const storageKey = `${STORAGE_PREFIX}${escolaAtiva}_${anoLetivo}`;
      localStorage.setItem(storageKey, JSON.stringify(novosFechamentos));
    } catch {
      // ignora
    }

    // Tenta sincronizar com Supabase
    try {
      await supabase.from('fechamento_periodos' as any).upsert(
        {
          escola: escolaAtiva,
          ano_letivo: anoLetivo,
          trimestre,
          turma: null,
          fechado: fechar,
          fechado_em: fechar ? agora : null,
          fechado_por: fechar ? 'Secretaria' : null,
        },
        { onConflict: 'escola,ano_letivo,trimestre' }
      );
    } catch {
      // Mantém persistido localmente
    }

    onToast?.({
      message: `${trimestre}º Trimestre de ${anoLetivo} ${fechar ? 'TRANCADO com sucesso (edições bloqueadas)' : 'REABERTO para lançamento'}!`,
      type: 'success',
    });
  }

  const rotulosTrimestre = [
    '1º Trimestre (30 pts)',
    '2º Trimestre (30 pts)',
    '3º Trimestre (40 pts)',
  ];

  return (
    <div
      style={{
        background: '#ffffff',
        borderRadius: '12px',
        padding: '20px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        marginBottom: '20px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px',
          flexWrap: 'wrap',
          gap: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldCheck size={22} style={{ color: '#1e3a8a' }} />
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#1e293b' }}>
              Controle de Fechamento de Bimestres / Trimestres
            </h3>
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b' }}>
              Trancamento pedagógico oficial &bull; {escolaAtiva} &bull; Ano {anoLetivo}
            </p>
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '14px',
        }}
      >
        {fechamentosLocais.map((f, i) => (
          <div
            key={f.trimestre}
            style={{
              padding: '16px',
              borderRadius: '10px',
              border: `2px solid ${f.fechado ? '#ef4444' : '#10b981'}`,
              background: f.fechado ? '#fef2f2' : '#f0fdf4',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b', marginBottom: '8px' }}>
                {rotulosTrimestre[i]}
              </div>

              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '4px 12px',
                  borderRadius: '20px',
                  background: f.fechado ? '#ef4444' : '#10b981',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  marginBottom: '10px',
                }}
              >
                {f.fechado ? <Lock size={12} /> : <Unlock size={12} />}
                {f.fechado ? 'TRANCADO' : 'ABERTO PARA LANÇAMENTO'}
              </div>

              {f.fechado && f.fechadoEm && (
                <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '10px' }}>
                  Trancado em: {new Date(f.fechadoEm).toLocaleDateString('pt-BR')}
                </div>
              )}
            </div>

            <button
              type="button"
              disabled={carregando}
              onClick={() => alternarFechamento(f.trimestre, !f.fechado)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.8rem',
                background: f.fechado ? '#10b981' : '#ef4444',
                color: '#ffffff',
                marginTop: '8px',
                transition: 'opacity 0.2s',
              }}
            >
              {f.fechado ? (
                <>
                  <Unlock size={14} /> Reabrir Trimestre
                </>
              ) : (
                <>
                  <Lock size={14} /> Trancar Trimestre
                </>
              )}
            </button>
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: '14px',
          padding: '10px 14px',
          background: '#fffbeb',
          border: '1px solid #fef3c7',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '0.78rem',
          color: '#92400e',
        }}
      >
        <AlertTriangle size={16} style={{ flexShrink: 0 }} />
        <span>
          <strong>Proteção de Registro:</strong> Quando um trimestre é marcado como <strong>TRANCADO</strong>, 
          as notas e frequências ficam congeladas no Diário de Classe e no Boletim Escolar para evitar edições retroativas.
        </span>
      </div>
    </div>
  );
};

export default FechamentoTrimestre;
