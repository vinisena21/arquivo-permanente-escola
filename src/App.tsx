import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  Archive,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Folder,
  FolderTree,
  BarChart2,
  Layers,
  List,
  LogOut,
  Pencil,
  Search,
  Settings,
  Trash2,
  User,
  FileText,
  History
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
import { supabase } from './lib/supabase';
import type { AlunoArquivo, AlunoRow } from './types/database';

type AbaAtiva = 'consulta' | 'dashboard' | 'arvore' | 'gerenciamento' | 'historico' | 'historicos-salvos';

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

  /** Dados de histórico salvo para abrir no gerador e continuar editando */
  const [dadosHistoricoEdicao, setDadosHistoricoEdicao] = useState<
    Record<string, string> | null
  >(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSessao(data.session);
      setVerificandoSessao(false);
    });

    const { data: autenticacao } = supabase.auth.onAuthStateChange(
      (_evento, novaSessao) => {
        setSessao(novaSessao);
        setVerificandoSessao(false);
      }
    );

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
            .select(`
              id,
              nome,
              data_nascimento,
              codigo_pasta,
              numero,
              status
            `)
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

    carregarAlunos();
  }, [sessao]);

  useEffect(() => {
    setPaginaAtual(1);
  }, [busca]);

  async function sairDoSistema() {
    await supabase.auth.signOut();
    setAbaAtiva('consulta');
    setBusca('');
    setAlunoEditando(null);
  }

  function atualizarAlunoNaTela(alunoAtualizado: AlunoEditavel) {
    setAlunos((alunosAtuais) =>
      alunosAtuais.map((aluno) =>
        aluno.id === alunoAtualizado.id ? alunoAtualizado : aluno
      )
    );
    setAlunoEditando(null);
    setToast({
      message: 'Cadastro de aluno atualizado com sucesso!',
      type: 'success'
    });
  }

  function adicionarAlunoNaTela(novoAluno: AlunoCadastrado) {
    setAlunos((alunosAtuais) => [...alunosAtuais, novoAluno]);
    setToast({
      message: `${novoAluno.nome} foi cadastrado com sucesso!`,
      type: 'success'
    });
  }

  async function confirmarExclusao() {
    if (!alunoParaExcluir) return;

    setExcluindoId(alunoParaExcluir.id);

    try {
      const { error } = await supabase
        .from('alunos')
        .delete()
        .eq('id', alunoParaExcluir.id);

      if (error) throw error;

      setAlunos((alunosAtuais) =>
        alunosAtuais.filter((item) => item.id !== alunoParaExcluir.id)
      );

      setToast({
        message: `${alunoParaExcluir.nome} foi excluído com sucesso.`,
        type: 'success'
      });
    } catch (erroEncontrado) {
      console.error(erroEncontrado);
      setToast({
        message: 'Não foi possível excluir o registro do aluno.',
        type: 'error'
      });
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
  const alunosPaginados = alunosFiltrados.slice(
    indiceInicial,
    indiceInicial + itensPorPagina
  );

  const pastasDisponiveis = Array.from(
    new Set(alunos.map((aluno) => aluno.codigoPasta))
  ).sort((pastaA, pastaB) =>
    pastaA.localeCompare(pastaB, 'pt-BR', { numeric: true })
  );

  const arvoreAcervo: TreeNodeData[] = pastasDisponiveis.map((codigoPasta) => ({
    id: codigoPasta,
    name: `Pasta ${codigoPasta}`,
    type: 'pasta',
    children: alunos
      .filter((aluno) => aluno.codigoPasta === codigoPasta)
      .map((aluno) => ({
        id: aluno.id,
        name: `Nº ${String(aluno.numero).padStart(2, '0')} - ${aluno.nome}`,
        type: 'documento'
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

            <button
              className="logout-button"
              type="button"
              onClick={sairDoSistema}
            >
              <LogOut size={18} />
              Sair
            </button>
          </div>

          <nav className="main-navigation">
            <button
              type="button"
              className={
                abaAtiva === 'consulta'
                  ? 'navigation-button active'
                  : 'navigation-button'
              }
              onClick={() => setAbaAtiva('consulta')}
            >
              <List size={19} />
              Consultar arquivos
            </button>

            <button
              type="button"
              className={
                abaAtiva === 'dashboard'
                  ? 'navigation-button active'
                  : 'navigation-button'
              }
              onClick={() => setAbaAtiva('dashboard')}
            >
              <BarChart2 size={19} />
              Painel Geral
            </button>

            <button
              type="button"
              className={
                abaAtiva === 'arvore'
                  ? 'navigation-button active'
                  : 'navigation-button'
              }
              onClick={() => setAbaAtiva('arvore')}
            >
              <FolderTree size={19} />
              Visão em Árvore
            </button>

            <button
              type="button"
              className={
                abaAtiva === 'historico'
                  ? 'navigation-button active'
                  : 'navigation-button'
              }
              onClick={() => setAbaAtiva('historico')}
            >
              <FileText size={19} />
              Gerador de Históricos
            </button>

            <button
              type="button"
              className={
                abaAtiva === 'historicos-salvos'
                  ? 'navigation-button active'
                  : 'navigation-button'
              }
              onClick={() => setAbaAtiva('historicos-salvos')}
            >
              <History size={19} />
              Históricos salvos
            </button>

            <button
              type="button"
              className={
                abaAtiva === 'gerenciamento'
                  ? 'navigation-button active'
                  : 'navigation-button'
              }
              onClick={() => setAbaAtiva('gerenciamento')}
            >
              <Settings size={19} />
              Gerenciar alunos
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
                  <p className="stat-number">
                    {carregando ? '...' : alunos.length}
                  </p>
                </div>
              </div>

              <div className="stat-card">
                <div className="icon-wrapper">
                  <Search size={24} color="#2563eb" />
                </div>

                <div>
                  <h3>Resultados Encontrados</h3>
                  <p className="stat-number">
                    {carregando ? '...' : alunosFiltrados.length}
                  </p>
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
                  onChange={(evento) => setBusca(evento.target.value)}
                />

                {busca && (
                  <button
                    className="clear-btn"
                    onClick={() => setBusca('')}
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
                            <User size={16} />
                            Nome do Aluno
                          </th>

                          <th>
                            <Calendar size={16} />
                            Data Nasc.
                          </th>

                          <th>
                            <Layers size={16} />
                            Pasta
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

                            <td>
                              {item.dataNascimento || 'Não informada'}
                            </td>

                            <td>
                              <span className="badge-pasta">
                                {item.codigoPasta}
                              </span>
                            </td>

                            <td>
                              <strong>
                                {String(item.numero).padStart(2, '0')}
                              </strong>
                            </td>

                            <td>
                              <span className="badge-status">
                                {item.status}
                              </span>
                            </td>

                            <td>
                              <div className="acoes-aluno">
                                <button
                                  type="button"
                                  className="acao-editar"
                                  onClick={() => setAlunoEditando(item)}
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

                  <div className="flex items-center justify-between mt-4 p-3 bg-white rounded-lg border border-gray-200">
                    <span className="text-sm text-gray-600">
                      Mostrando {indiceInicial + 1} até{' '}
                      {Math.min(
                        indiceInicial + itensPorPagina,
                        alunosFiltrados.length
                      )}{' '}
                      de {alunosFiltrados.length} registros
                    </span>

                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() =>
                          setPaginaAtual((prev) => Math.max(prev - 1, 1))
                        }
                        disabled={paginaAtual === 1}
                        className="p-2 rounded border border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100"
                      >
                        <ChevronLeft size={18} />
                      </button>

                      <span className="text-sm font-medium px-3 text-gray-700">
                        Página {paginaAtual} de {totalPaginas}
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          setPaginaAtual((prev) =>
                            Math.min(prev + 1, totalPaginas)
                          )
                        }
                        disabled={paginaAtual === totalPaginas}
                        className="p-2 rounded border border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100"
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
                    Nenhum registro encontrado para "
                    <strong>{busca}</strong>".
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
                  setBusca(node.name.split(' - ')[1] || node.name);
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
          />
        )}

        {abaAtiva === 'historicos-salvos' && (
          <HistoricosSalvos
            onContinuarEditando={(dados) => {
              setDadosHistoricoEdicao(dados);
              setAbaAtiva('historico');
              setToast({
                message:
                  'Histórico carregado no gerador. Continue editando e gere novamente quando quiser.',
                type: 'success',
              });
            }}
          />
        )}

        {abaAtiva === 'gerenciamento' && (
          <GerenciarAlunos
            alunos={alunos}
            onAlunoCadastrado={adicionarAlunoNaTela}
          />
        )}
      </main>

      <footer className="footer">
        <p>
          Guia Escolar &copy; {new Date().getFullYear()} — E.M. MARIA GERALDA MIRANDA BRITO SALOMÃO — Todos os direitos reservados.
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
        onConfirm={confirmarExclusao}
        onCancel={() => setAlunoParaExcluir(null)}
      />

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
