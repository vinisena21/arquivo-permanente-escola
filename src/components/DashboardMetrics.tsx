import React, { useCallback, useEffect, useState } from 'react';
import {
  Users,
  Folder,
  Clock,
  ArrowRightLeft,
  FolderTree,
  FileSpreadsheet,
  FileText,
  RefreshCw
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import './DashboardMetrics.css';

interface Metrics {
  totalAlunos: number;
  totalArquivados: number;
  totalPendentes: number;
  totalTransferidos: number;
  totalPastas: number;
  totalSecretaria: number;
  totalHistoricos: number;
}

const METRICS_INICIAL: Metrics = {
  totalAlunos: 0,
  totalArquivados: 0,
  totalPendentes: 0,
  totalTransferidos: 0,
  totalPastas: 0,
  totalSecretaria: 0,
  totalHistoricos: 0
};

export const DashboardMetrics: React.FC = () => {
  const [metrics, setMetrics] = useState<Metrics>(METRICS_INICIAL);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro('');
    try {
      const [
        totalRes,
        arquivadosRes,
        pendentesRes,
        transferidosRes,
        secretariaRes,
        historicosRes
      ] = await Promise.all([
        supabase.from('alunos').select('*', { count: 'exact', head: true }),
        supabase.from('alunos').select('*', { count: 'exact', head: true }).eq('status', 'Arquivado'),
        supabase.from('alunos').select('*', { count: 'exact', head: true }).eq('status', 'Pendente'),
        supabase.from('alunos').select('*', { count: 'exact', head: true }).eq('status', 'Transferido'),
        supabase.from('alunos_secretaria').select('*', { count: 'exact', head: true }),
        supabase.from('historicos_gerados').select('*', { count: 'exact', head: true })
      ]);

      // Conta pastas distintas em lotes (Supabase limita ~1000 por request)
      const pastasUnicas = new Set<string>();
      const lote = 1000;
      let inicio = 0;
      while (true) {
        const { data } = await supabase
          .from('alunos')
          .select('codigo_pasta')
          .range(inicio, inicio + lote - 1);
        const rows = data ?? [];
        for (const r of rows) {
          if (r.codigo_pasta) pastasUnicas.add(String(r.codigo_pasta));
        }
        if (rows.length < lote) break;
        inicio += lote;
      }

      setMetrics({
        totalAlunos: totalRes.count ?? 0,
        totalArquivados: arquivadosRes.count ?? 0,
        totalPendentes: pendentesRes.count ?? 0,
        totalTransferidos: transferidosRes.count ?? 0,
        totalPastas: pastasUnicas.size,
        totalSecretaria: secretariaRes.error ? 0 : (secretariaRes.count ?? 0),
        totalHistoricos: historicosRes.error ? 0 : (historicosRes.count ?? 0)
      });
    } catch (error) {
      console.error('Erro ao carregar métricas:', error);
      setErro('Não foi possível carregar algumas estatísticas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const cards = [
    {
      title: 'Total de Prontuários',
      value: metrics.totalAlunos,
      icon: Users,
      tone: 'azul'
    },
    {
      title: 'Arquivados',
      value: metrics.totalArquivados,
      icon: Folder,
      tone: 'verde'
    },
    {
      title: 'Pendentes',
      value: metrics.totalPendentes,
      icon: Clock,
      tone: 'ambar'
    },
    {
      title: 'Transferidos',
      value: metrics.totalTransferidos,
      icon: ArrowRightLeft,
      tone: 'violeta'
    },
    {
      title: 'Pastas no acervo',
      value: metrics.totalPastas,
      icon: FolderTree,
      tone: 'cinza'
    },
    {
      title: 'Alunos da secretaria',
      value: metrics.totalSecretaria,
      icon: FileSpreadsheet,
      tone: 'azul'
    },
    {
      title: 'Históricos gerados',
      value: metrics.totalHistoricos,
      icon: FileText,
      tone: 'verde'
    }
  ];

  return (
    <section className="dash">
      <header className="dash-header">
        <div>
          <h2>Painel do Arquivo Permanente</h2>
          <p>Visão geral do acervo e estatísticas atualizadas</p>
        </div>
        <button
          type="button"
          className="dash-refresh"
          onClick={() => void carregar()}
          disabled={loading}
          title="Atualizar métricas"
        >
          <RefreshCw size={16} className={loading ? 'dash-spin' : undefined} />
          Atualizar
        </button>
      </header>

      {erro && <p className="dash-erro">{erro}</p>}

      <div className="dash-grid">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <article key={card.title} className={`dash-card dash-card--${card.tone}`}>
              <div className="dash-card-body">
                <p className="dash-card-title">{card.title}</p>
                <p className="dash-card-value">{loading ? '…' : card.value.toLocaleString('pt-BR')}</p>
              </div>
              <div className="dash-card-icon">
                <Icon size={22} />
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};
