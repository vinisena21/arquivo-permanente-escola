import React, { useEffect, useState } from 'react';
import { Users, Folder, FileText, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Metrics {
  totalAlunos: number;
  totalAtivos: number;
  totalInativos: number;
}

export const DashboardMetrics: React.FC = () => {
  const [metrics, setMetrics] = useState<Metrics>({
    totalAlunos: 0,
    totalAtivos: 0,
    totalInativos: 0,
  });
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function fetchMetrics() {
      try {
        setLoading(true);

        // Busca o total geral na tabela 'alunos'
        const { count: total } = await supabase
          .from('alunos')
          .select('*', { count: 'exact', head: true });

        // Busca registros ativos
        const { count: ativos } = await supabase
          .from('alunos')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'ativo');

        // Busca registros inativos/arquivados
        const { count: inativos } = await supabase
          .from('alunos')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'inativo');

        setMetrics({
          totalAlunos: total || 0,
          totalAtivos: ativos || 0,
          totalInativos: inativos || 0,
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
      title: 'Cadastros Ativos',
      value: metrics.totalAtivos,
      icon: CheckCircle,
      color: 'bg-emerald-600',
    },
    {
      title: 'Prontuários Arquivados',
      value: metrics.totalInativos,
      icon: Folder,
      color: 'bg-amber-600',
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Painel do Arquivo Permanente</h1>
        <p className="text-gray-500 text-sm">Visão geral do acervo e estatísticas</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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