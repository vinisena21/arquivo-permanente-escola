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
    return () => {
      autenticacao.subscription.unsubscribe();
    };
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
        setAlunos(
          todosOsAlunos.map((aluno) => ({
            id: aluno.id,
            nome: aluno.nome,
            dataNascimento: formatarData(aluno.data_nascimento),
            codigoPasta: aluno.codigo_pasta,
            numero: aluno.numero,
            status: aluno.status
          }))
        );
      } catch (erroEncontrado) {
        console.error(erroEncontrado);
        setErro('Não foi possível carregar os alunos do banco de dados.');
      } finally {
        setCarregando(false);
      }
    }
    void carregarAlunos();
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
    return (
      <main className="login-page">
        <p>Verificando acesso...</p>
      </main>
    );
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

          <nav className="main-navigation" aria-label="Navegação principal">
            <button
              type="button"
              className={abaAtiva === 'consulta' ? 'navigation-button active' : 'navigation-button'}
              onClick={() => setAbaAtiva('consulta')}
            >
              <Search size={18} /> Consultar arquivos
            </button>
            <button
              type="button"
              className={abaAtiva === 'dashboard' ? 'navigation-button active' : 'navigation-button'}
              onClick={() => setAbaAtiva('dashboard')}
            >
              <BarChart2 size={18} /> Dashboard
            </button>
            <button
              type="button"
              className={abaAtiva === 'arvore' ? 'navigation-button active' : 'navigation-button'}
              onClick={() => setAbaAtiva('arvore')}
            >
              <FolderTree size={18} /> Árvore do acervo
            </button>
            <button
              type="button"
              className={abaAtiva === 'gerenciamento' ? 'navigation-button active' : 'navigation-button'}
              onClick={() => setAbaAtiva('gerenciamento')}
            >
              <Settings size={18} /> Gerenciar alunos
            </button>
            <button
              type="button"
              className={abaAtiva === 'historico' ? 'navigation-button active' : 'navigation-button'}
              onClick={() => setAbaAtiva('historico')}
            >
              <FileText size={18} /> Gerar histórico
            </button>
            <button
              type="button"
              className={abaAtiva === 'historicos-salvos' ? 'navigation-button active' : 'navigation-button'}
              onClick={() => setAbaAtiva('historicos-salvos')}
            >
              <History size={18} /> Históricos salvos
            </button>
            <button
              type="button"
              className={abaAtiva === 'conferir-historico' ? 'navigation-button active' : 'navigation-button'}
              onClick={() => setAbaAtiva('conferir-historico')}
            >
              <FileCheck2 size={18} /> Conferir histórico
            </button>
            <button
              type="button"
              className={abaAtiva === 'alunos-secretaria' ? 'navigation-button active' : 'navigation-button'}
              onClick={() => setAbaAtiva('alunos-secretaria')}
            >
              <FileSpreadsheet size={18} /> Alunos da secretaria
            </button>
          </nav>
        </div>
      </header>

      <main className="main-content">
        {abaAtiva === 'consulta' && (
          <>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="icon-wrapper">
                  <Folder size={24} color="#2563eb" />
                </div>
                <div>
                  <h3>Total Registrados</h3>
                  <p className="stat-number">{carregando ? '...' : alunos.length}</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="icon-wrapper">
                  <Search size={24} color="#2563eb" />
                </div>
                <div>
                  <h3>Resultados Encontrados</h3>
                  <p className="stat-number">{carregando ? '...' : alunosFiltrados.length}</p>
                </div>
              </div>
            </div>

            <section className="search-section">
              <div className="search-bar">
                <Search className="search-icon" size={20} />
                <input
                  type="text"
                  placeholder="Buscar por nome do aluno, pasta ou número..."
                  value={busca}
                  onChange={(evento) => alterarBusca(evento.target.value)}
                  aria-label="Buscar aluno"
                />
                {busca && (
                  <button
                    type="button"
                    className="clear-btn"
                    onClick={() => alterarBusca('')}
                    aria-label="Limpar pesquisa"
                  >
                    ✕
                  </button>
                )}
              </div>
            </section>

            <section className="table-section">
              <h2>Listagem de Arquivos</h2>

              {erro && (
                <div className="empty-state">
                  <p>{erro}</p>
                </div>
              )}

              {!erro && carregando && (
                <div className="empty-state">
                  <p>Carregando registros protegidos...</p>
                </div>
              )}

              {!erro && !carregando && alunosFiltrados.length > 0 && (
                <>
                  <div className="table-responsive">
                    <table className="custom-table">
                      <thead>
                        <tr>
                          <th>
                            <User size={16} /> Nome do Aluno
                          </th>
                          <th>Data Nasc.</th>
                          <th>
                            <Layers size={16} /> Pasta
                          </th>
                          <th>Nº Arquivo</th>
                          <th>Status</th>
                          <th>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {alunosPaginados.map((item) => (
                          <tr key={item.id}>
                            <td className="font-bold">{item.nome}</td>
                            <td>{item.dataNascimento || 'Não informada'}</td>
                            <td>
                              <span className="badge-pasta">{item.codigoPasta}</span>
                            </td>
                            <td>
                              <strong>{String(item.numero).padStart(2, '0')}</strong>
                            </td>
                            <td>
                              <span className="badge-status">{item.status}</span>
                            </td>
                            <td>
                              <div className="acoes-aluno">
                                <button
                                  type="button"
                                  className="acao-editar"
                                  onClick={() =>
                                    setAlunoEditando({
                                      id: item.id,
                                      nome: item.nome,
                                      dataNascimento: item.dataNascimento,
                                      codigoPasta: item.codigoPasta,
                                      numero: item.numero,
                                      status: item.status
                                    })
                                  }
                                  title="Editar aluno"
                                >
                                  <Pencil size={17} />
                                  <span>Editar</span>
                                </button>
                                <button
                                  type="button"
                                  className="acao-excluir"
                                  onClick={() => setAlunoParaExcluir(item)}
                                  disabled={excluindoId === item.id}
                                  title="Excluir aluno"
                                >
                                  <Trash2 size={17} />
                                  <span>Excluir</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginTop: '1rem',
                      padding: '0.75rem',
                      background: '#fff',
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb'
                    }}
                  >
                    <span style={{ color: '#6b7280', fontSize: '0.9rem' }}>
                      Página {paginaAtual} de {totalPaginas} · {alunosFiltrados.length} registro(s)
                    </span>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={() => setPaginaAtual((prev) => Math.max(prev - 1, 1))}
                        disabled={paginaAtual <= 1}
                        style={{
                          padding: '0.5rem',
                          borderRadius: '6px',
                          border: '1px solid #d1d5db',
                          background: '#fff',
                          cursor: paginaAtual <= 1 ? 'not-allowed' : 'pointer',
                          opacity: paginaAtual <= 1 ? 0.4 : 1
                        }}
                      >
                        <ChevronLeft size={18} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaginaAtual((prev) => Math.min(prev + 1, totalPaginas))}
                        disabled={paginaAtual >= totalPaginas}
                        style={{
                          padding: '0.5rem',
                          borderRadius: '6px',
                          border: '1px solid #d1d5db',
                          background: '#fff',
                          cursor: paginaAtual >= totalPaginas ? 'not-allowed' : 'pointer',
                          opacity: paginaAtual >= totalPaginas ? 0.4 : 1
                        }}
                      >
                        <ChevronRight size={18} />
                      </button>
                    </div>
                  </div>
                </>
              )}

              {!erro && !carregando && alunosFiltrados.length === 0 && (
                <div className="empty-state">
                  <p>
                    Nenhum registro encontrado
                    {busca ? (
                      <>
                        {' '}
                        para "<strong>{busca}</strong>"
                      </>
                    ) : null}
                    .
                  </p>
                </div>
              )}
            </section>
          </>
        )}

        {abaAtiva === 'dashboard' && <DashboardMetrics />}

        {abaAtiva === 'arvore' && (
          <section className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <FolderTree size={20} className="text-blue-600" />
              Estrutura Física do Acervo (Visão em Árvore)
            </h2>
            <TreeView
              data={arvoreAcervo}
              onSelectNode={(node) => {
                if (node.type === 'documento') {
                  alterarBusca(String(node.name).split(' - ')[1] || String(node.name));
                  setAbaAtiva('consulta');
                }
              }}
            />
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
              setToast({
                message: 'Histórico carregado no gerador. Continue editando e gere novamente quando quiser.',
                type: 'success'
              });
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
              setToast({
                message: 'Aluno cadastrado na secretaria. A lista foi atualizada.',
                type: 'success'
              });
            }}
          />
        )}
      </main>

      <footer className="footer">
        <p>
          Guia Escolar &copy; {new Date().getFullYear()} — E.M. MARIA GERALDA MIRANDA BRITO SALOMÃO
          — Todos os direitos reservados.
        </p>
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
        message={
          alunoParaExcluir
            ? `Tem certeza que deseja excluir o aluno:\n\n• ${alunoParaExcluir.nome}\n• Pasta: ${alunoParaExcluir.codigoPasta}\n• Número: ${String(alunoParaExcluir.numero).padStart(2, '0')}\n\nEssa ação não poderá ser desfeita.`
            : ''
        }
        confirmText="Excluir"
        loading={Boolean(excluindoId)}
        onConfirm={() => void confirmarExclusao()}
        onCancel={() => setAlunoParaExcluir(null)}
      />

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
