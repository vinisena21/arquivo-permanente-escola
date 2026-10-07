import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  Archive,
  ChevronLeft,
  ChevronRight,
  Folder,
  FolderTree,
  BarChart2,
  Layers,
  LogOut,
  Pencil,
  Search,
  Settings,
  Trash2,
  User,
  FileText,
  FileSpreadsheet,
  History,
  FileCheck2
} from 'lucide-react';
import './App.css';
import EditarAlunoModal, {
  type AlunoEditavel
} from './components/EditarAlunoModal';
import GerenciarAlunos, {
  type AlunoCadastrado
} from './components/GerenciarAlunos';
import Login from './components/Login';
import { DashboardMetrics } from './components/DashboardMetrics';
import { TreeView, type TreeNodeData } from './components/TreeView';
import { ConfirmModal } from './components/ConfirmModal';
import { Toast, type ToastData } from './components/Toast';
import GeradorHistorico from './components/GeradorHistorico';
import HistoricosSalvos from './components/HistoricosSalvos';
import ImportarAlunos from './components/ImportarAlunos';
import ConferirHistorico from './components/ConferirHistorico';
import { supabase } from './lib/supabase';
import type {
  AlunoArquivo,
  AlunoRow,
  AlunoSecretariaRow
} from './types/database';

type AbaAtiva =
  | 'consulta'
  | 'dashboard'
  | 'arvore'
  | 'gerenciamento'
  | 'historico'
  | 'historicos-salvos'
  | 'alunos-secretaria'
  | 'conferir-historico';

function formatarData(data: string | null): string {
  if (!data) return '';
  const partes = data.split('-');
  if (partes.length !== 3) return data;
  const [ano, mes, dia] = partes;
  return `${dia}/${mes}/${ano}`;
}

export default function App() {
  const [sessao, setSessao] = useState<Session | null>(null);
  const [verificandoSessao, setVerificandoSessao] = useState(true);
  const [abaAtiva, setAbaAtiva] = useState<AbaAtiva>('consulta');
  const [busca, setBusca] = useState('');
  const [alunos, setAlunos] = useState<AlunoArquivo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [alunoEditando, setAlunoEditando] = useState<AlunoEditavel | null>(null);
  const [excluindoId, setExcluindoId] = useState<number | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);
  const [alunoParaExcluir, setAlunoParaExcluir] = useState<AlunoArquivo | null>(null);
  const [paginaAtual, setPaginaAtual] = useState(1);
  const itensPorPagina = 20;
  const [dadosHistoricoEdicao, setDadosHistoricoEdicao] = useState<Record<string, string> | null>(null);
  const [alunoSecretariaParaHistorico, setAlunoSecretariaParaHistorico] = useState<AlunoSecretariaRow | null>(null);
  const [versaoListaSecretaria, setVersaoListaSecretaria] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSessao(data.session);
      setVerificandoSessao(false);
    });
    const { data: autenticacao } = supabase.auth.onAuthStateChange((_evento, novaSessao) => {
      setSessao(novaSessao);
      setVerificandoSessao(false);
    });
    return () => { autenticacao.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!sessao) return;
    async function carregarAlunos() {
      setCarregando(true);
      setErro('');
      try {
        const todosOsAlunos: AlunoRow[] = [];
        const tamanhoLote = 1000;
        let inicio = 0;
        while (true) {
          const fim = inicio + tamanhoLote - 1;
          const { data, error } = await supabase
            .from('alunos')
            .select('id, nome, data_nascimento, codigo_pasta, numero, status')
            .order('id', { ascending: true })
            .range(inicio, fim);
          if (error) throw error;
          const lote = data ?? [];
          todosOsAlunos.push(...lote);
          if (lote.length < tamanhoLote) break;
          inicio += tamanhoLote;
        }
        setAlunos(todosOsAlunos.map((aluno) => ({
          id: aluno.id,
          nome: aluno.nome,
          dataNascimento: formatarData(aluno.data_nascimento),
          codigoPasta: aluno.codigo_pasta,
          numero: aluno.numero,
          status: aluno.status
        })));
      } catch (erroEncontrado) {
        console.error(erroEncontrado);
        setErro('Não foi possível carregar os alunos do banco de dados.');
      } finally {
        setCarregando(false);
      }
    }
    carregarAlunos();
  }, [sessao]);

  function alterarBusca(valor: string) {
    setBusca(valor);
    setPaginaAtual(1);
  }

  async function sairDoSistema() {
    await supabase.auth.signOut();
    setSessao(null);
  }

  function adicionarAlunoNaTela(aluno: AlunoCadastrado) {
    setAlunos((alunosAtuais) => [...alunosAtuais, aluno].sort((a, b) => a.id - b.id));
    setToast({ message: `${aluno.nome} cadastrado no arquivo permanente.`, type: 'success' });
  }

  function atualizarAlunoNaTela(alunoAtualizado: AlunoEditavel) {
    setAlunos((alunosAtuais) =>
      alunosAtuais.map((item) =>
        item.id === alunoAtualizado.id
          ? {
              ...item,
              nome: alunoAtualizado.nome,
              dataNascimento: alunoAtualizado.dataNascimento,
              codigoPasta: alunoAtualizado.codigoPasta,
              numero: alunoAtualizado.numero,
              status: alunoAtualizado.status
            }
          : item
      )
    );
    setToast({ message: 'Aluno atualizado com sucesso.', type: 'success' });
  }

  async function confirmarExclusao() {
    if (!alunoParaExcluir) return;
    setExcluindoId(alunoParaExcluir.id);
    try {
      const { error } = await supabase.from('alunos').delete().eq('id', alunoParaExcluir.id);
      if (error) throw error;
      setAlunos((alunosAtuais) => alunosAtuais.filter((item) => item.id !== alunoParaExcluir.id));
      setToast({ message: `${alunoParaExcluir.nome} foi excluído com sucesso.`, type: 'success' });
    } catch (erroEncontrado) {
      console.error(erroEncontrado);
      setToast({ message: 'Não foi possível excluir o registro do aluno.', type: 'error' });
    } finally {
      setExcluindoId(null);
      setAlunoParaExcluir(null);
    }
  }

  const textoBusca = busca.toLocaleLowerCase('pt-BR').trim();
  const alunosFiltrados = alunos.filter(
    (item) =>
      item.nome.toLocaleLowerCase('pt-BR').includes(textoBusca) ||
      item.codigoPasta.toLocaleLowerCase('pt-BR').includes(textoBusca) ||
      String(item.numero).includes(textoBusca)
  );
  const totalPaginas = Math.ceil(alunosFiltrados.length / itensPorPagina) || 1;
  const indiceInicial = (paginaAtual - 1) * itensPorPagina;
  const alunosPaginados = alunosFiltrados.slice(indiceInicial, indiceInicial + itensPorPagina);
  const pastasDisponiveis = Array.from(new Set(alunos.map((aluno) => aluno.codigoPasta))).sort((a, b) =>
    a.localeCompare(b, 'pt-BR', { numeric: true })
  );
  const arvoreAcervo: TreeNodeData[] = pastasDisponiveis.map((codigoPasta) => ({
    id: codigoPasta,
    name: `Pasta ${codigoPasta}`,
    type: 'pasta' as const,
    children: alunos
      .filter((aluno) => aluno.codigoPasta === codigoPasta)
      .map((aluno) => ({
        id: aluno.id,
        name: `Nº ${String(aluno.numero).padStart(2, '0')} - ${aluno.nome}`,
        type: 'documento' as const
      }))
  }));

  if (verificandoSessao) {
    return (<main className="login-page"><p>Verificando acesso...</p></main>);
  }
  if (!sessao) {
    return <Login />;
  }

  return (
    <div className="app-container">
      <header className="header">
        <div className="header-content">
          <div className="header-main-row">
            <div className="logo-area">
              <Archive className="logo-icon" size={36} />
              <div>
                <h1>Guia Escolar</h1>
                <p>E.M. MARIA GERALDA MIRANDA BRITO SALOMÃO</p>
              </div>
            </div>
            <div className="user-area">
              <div className="user-info">
                <User size={18} />
                <span>{sessao.user.email}</span>
              </div>
              <button type="button" className="logout-button" onClick={() => void sairDoSistema()}>
                <LogOut size={18} /> Sair
              </button>
            </div>
          </div>
          <nav className="main-nav" aria-label="Navegação principal">
            <button type="button" className={abaAtiva === 'consulta' ? 'nav-item active' : 'nav-item'} onClick={() => setAbaAtiva('consulta')}>
              <Search size={18} /> Consultar arquivos
            </button>
            <button type="button" className={abaAtiva === 'dashboard' ? 'nav-item active' : 'nav-item'} onClick={() => setAbaAtiva('dashboard')}>
              <BarChart2 size={18} /> Dashboard
            </button>
            <button type="button" className={abaAtiva === 'arvore' ? 'nav-item active' : 'nav-item'} onClick={() => setAbaAtiva('arvore')}>
              <FolderTree size={18} /> Árvore do acervo
            </button>
            <button type="button" className={abaAtiva === 'gerenciamento' ? 'nav-item active' : 'nav-item'} onClick={() => setAbaAtiva('gerenciamento')}>
              <Settings size={18} /> Gerenciar alunos
            </button>
            <button type="button" className={abaAtiva === 'historico' ? 'nav-item active' : 'nav-item'} onClick={() => setAbaAtiva('historico')}>
              <FileText size={18} /> Gerar histórico
            </button>
            <button type="button" className={abaAtiva === 'historicos-salvos' ? 'nav-item active' : 'nav-item'} onClick={() => setAbaAtiva('historicos-salvos')}>
              <History size={18} /> Históricos salvos
            </button>
            <button type="button" className={abaAtiva === 'conferir-historico' ? 'nav-item active' : 'nav-item'} onClick={() => setAbaAtiva('conferir-historico')}>
              <FileCheck2 size={18} /> Conferir histórico
            </button>
            <button type="button" className={abaAtiva === 'alunos-secretaria' ? 'nav-item active' : 'nav-item'} onClick={() => setAbaAtiva('alunos-secretaria')}>
              <FileSpreadsheet size={18} /> Alunos da secretaria
            </button>
          </nav>
        </div>
      </header>

      <main className="main-content">
        {abaAtiva === 'consulta' && (
          <section className="consulta-section">
            <div className="consulta-header">
              <div>
                <h2><Folder size={24} /> Arquivo permanente</h2>
                <p>Busque por nome, pasta ou número do arquivo.</p>
              </div>
              <div className="search-box">
                <Search size={18} />
                <input type="search" value={busca} onChange={(e) => alterarBusca(e.target.value)} placeholder="Buscar aluno..." aria-label="Buscar aluno" />
              </div>
            </div>
            {carregando && <p className="status-msg">Carregando alunos...</p>}
            {erro && <p className="status-msg error">{erro}</p>}
            {!carregando && !erro && (
              <>
                <div className="table-wrap">
                  <table className="alunos-table">
                    <thead>
                      <tr>
                        <th>Nome</th><th>Nascimento</th><th>Pasta</th><th>Nº</th><th>Status</th><th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {alunosPaginados.length === 0 ? (
                        <tr><td colSpan={6}>Nenhum aluno encontrado.</td></tr>
                      ) : (
                        alunosPaginados.map((aluno) => (
                          <tr key={aluno.id}>
                            <td>{aluno.nome}</td>
                            <td>{aluno.dataNascimento || '—'}</td>
                            <td><span className="pasta-badge"><Layers size={16} /> {aluno.codigoPasta}</span></td>
                            <td>{String(aluno.numero).padStart(2, '0')}</td>
                            <td>{aluno.status}</td>
                            <td className="acoes">
                              <button type="button" className="icon-btn" title="Editar" aria-label={`Editar ${aluno.nome}`} onClick={() => setAlunoEditando({
                                id: aluno.id, nome: aluno.nome, dataNascimento: aluno.dataNascimento,
                                codigoPasta: aluno.codigoPasta, numero: aluno.numero, status: aluno.status
                              })}>
                                <Pencil size={16} />
                              </button>
                              <button type="button" className="icon-btn danger" title="Excluir" aria-label={`Excluir ${aluno.nome}`} disabled={excluindoId === aluno.id} onClick={() => setAlunoParaExcluir(aluno)}>
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="paginacao">
                  <button type="button" disabled={paginaAtual <= 1} onClick={() => setPaginaAtual((p) => Math.max(1, p - 1))}><ChevronLeft size={18} /></button>
                  <span>Página {paginaAtual} de {totalPaginas} · {alunosFiltrados.length} registro(s)</span>
                  <button type="button" disabled={paginaAtual >= totalPaginas} onClick={() => setPaginaAtual((p) => Math.min(totalPaginas, p + 1))}><ChevronRight size={18} /></button>
                </div>
              </>
            )}
          </section>
        )}

        {abaAtiva === 'dashboard' && <DashboardMetrics />}

        {abaAtiva === 'arvore' && (
          <section className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <FolderTree size={20} className="text-blue-600" /> Estrutura Física do Acervo (Visão em Árvore)
            </h2>
            <TreeView data={arvoreAcervo} />
          </section>
        )}

        {abaAtiva === 'historico' && (
          <GeradorHistorico
            alunos={alunos}
            dadosParaCarregar={dadosHistoricoEdicao}
            onDadosCarregados={() => setDadosHistoricoEdicao(null)}
            alunoSecretariaParaCarregar={alunoSecretariaParaHistorico}
            onAlunoSecretariaCarregado={() => setAlunoSecretariaParaHistorico(null)}
          />
        )}

        {abaAtiva === 'historicos-salvos' && (
          <HistoricosSalvos
            onContinuarEditando={(dados) => {
              setDadosHistoricoEdicao(dados);
              setAbaAtiva('historico');
              setToast({ message: 'Histórico carregado no gerador. Continue editando e gere novamente quando quiser.', type: 'success' });
            }}
          />
        )}

        {abaAtiva === 'conferir-historico' && (
          <ConferirHistorico
            obterToken={async () => {
              const { data } = await supabase.auth.getSession();
              return data.session?.access_token ?? null;
            }}
          />
        )}

        {abaAtiva === 'alunos-secretaria' && (
          <ImportarAlunos
            onToast={setToast}
            refreshKey={versaoListaSecretaria}
            onUsarNoHistorico={(aluno) => {
              setAlunoSecretariaParaHistorico(aluno);
              setAbaAtiva('historico');
            }}
          />
        )}

        {abaAtiva === 'gerenciamento' && (
          <GerenciarAlunos
            alunos={alunos}
            onAlunoCadastrado={adicionarAlunoNaTela}
            onAlunoSecretariaCadastrado={() => {
              setVersaoListaSecretaria((v) => v + 1);
              setToast({ message: 'Aluno cadastrado na secretaria. A lista foi atualizada.', type: 'success' });
            }}
          />
        )}
      </main>

      <footer className="footer">
        <p>Guia Escolar &copy; {new Date().getFullYear()} — E.M. MARIA GERALDA MIRANDA BRITO SALOMÃO — Todos os direitos reservados.</p>
      </footer>

      {alunoEditando && (
        <EditarAlunoModal
          aluno={alunoEditando}
          pastas={pastasDisponiveis}
          aoFechar={() => setAlunoEditando(null)}
          aoSalvar={atualizarAlunoNaTela}
        />
      )}

      <ConfirmModal
        isOpen={Boolean(alunoParaExcluir)}
        title="Excluir Aluno"
        message={alunoParaExcluir
          ? `Tem certeza que deseja excluir o aluno:\n\n• ${alunoParaExcluir.nome}\n• Pasta: ${alunoParaExcluir.codigoPasta}\n• Número: ${String(alunoParaExcluir.numero).padStart(2, '0')}\n\nEssa ação não poderá ser desfeita.`
          : ''}
        confirmText="Excluir"
        loading={Boolean(excluindoId)}
        onConfirm={confirmarExclusao}
        onCancel={() => setAlunoParaExcluir(null)}
      />

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
