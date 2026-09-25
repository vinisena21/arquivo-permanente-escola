import React, { useEffect, useState } from 'react';
import { Users, Folder, Clock, ArrowRightLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Metrics {
  totalAlunos: number;
  totalArquivados: number;
  totalPendentes: number;
  totalTransferidos: number;
}

export const DashboardMetrics: React.FC = () => {
  const [metrics, setMetrics] = useState<Metrics>({
    totalAlunos: 0,
    totalArquivados: 0,
    totalPendentes: 0,
    totalTransferidos: 0,
  });
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function fetchMetrics() {
      try {
        setLoading(true);

        const { count: total } = await supabase
          .from('alunos')
          .select('*', { count: 'exact', head: true });

        const { count: arquivados } = await supabase
          .from('alunos')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'Arquivado');

        const { count: pendentes } = await supabase
          .from('alunos')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'Pendente');

        const { count: transferidos } = await supabase
          .from('alunos')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'Transferido');

        setMetrics({
          totalAlunos: total || 0,
          totalArquivados: arquivados || 0,
          totalPendentes: pendentes || 0,
          totalTransferidos: transferidos || 0,
        });
      } catch (error) {
        console.error('Erro ao carregar métricas:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchMetrics();
  }, []);

  const cards = [
    {
      title: 'Total de Prontuários',
      value: metrics.totalAlunos,
      icon: Users,
      color: 'bg-blue-600',
    },
    {
      title: 'Arquivados',
      value: metrics.totalArquivados,
      icon: Folder,
      color: 'bg-emerald-600',
    },
    {
      title: 'Pendentes',
      value: metrics.totalPendentes,
      icon: Clock,
      color: 'bg-amber-500',
    },
    {
      title: 'Transferidos',
      value: metrics.totalTransferidos,
      icon: ArrowRightLeft,
      color: 'bg-violet-600',
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Painel do Arquivo Permanente</h1>
        <p className="text-gray-500 text-sm">Visão geral do acervo e estatísticas</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, index) => {
          const IconComponent = card.icon;
          return (
            <div
              key={index}
              className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex items-center justify-between"
            >
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {card.title}
                </p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {loading ? '...' : card.value}
                </p>
              </div>
              <div className={`p-3 rounded-lg ${card.color} text-white`}>
                <IconComponent className="w-6 h-6" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
