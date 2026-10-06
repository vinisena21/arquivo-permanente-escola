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

  /** Dados de histórico salvo para abrir no gerador e continuar editando */
  const [dadosHistoricoEdicao, setDadosHistoricoEdicao] = useState<
    Record<string, string> | null
  >(null);

  /** Aluno da secretaria escolhido para preencher o gerador de histórico */
  const [alunoSecretariaParaHistorico, setAlunoSecretariaParaHistorico] =
    useState<AlunoSecretariaRow | null>(null);

  /** Incrementado ao cadastrar aluno da secretaria em Gerenciar alunos → recarrega a lista */
  const [versaoListaSecretaria, setVersaoListaSecretaria] = useState(0);

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
    if (!sessao) {
      setAlunos([]);
      setCarregando(false);
      return;
    }

    async function carregarAlunos() {
      setCarregando(true);
      setErro('');

      const { data, error } = await supabase
        .from('alunos')
        .select('id, nome, data_nascimento, codigo_pasta, numero, status')
        .order('codigo_pasta', { ascending: true })
        .order('numero', { ascending: true });

      if (error) {
        console.error(error);
        setErro('Não foi possível carregar os alunos.');
        setCarregando(false);
        return;
      }

      const formatados: AlunoArquivo[] = (data as AlunoRow[]).map((aluno) => ({
        id: aluno.id,
        nome: aluno.nome,
        dataNascimento: formatarData(aluno.data_nascimento),
        codigoPasta: aluno.codigo_pasta,
        numero: aluno.numero,
        status: aluno.status
      }));

      setAlunos(formatados);
      setCarregando(false);
    }

    void carregarAlunos();
  }, [sessao]);

  function adicionarAlunoNaTela(aluno: AlunoCadastrado) {
    setAlunos((atuais) =>
      [...atuais, aluno].sort((a, b) => {
        const pasta = a.codigoPasta.localeCompare(b.codigoPasta, 'pt-BR', {
          numeric: true
        });
        if (pasta !== 0) return pasta;
        return a.numero - b.numero;
      })
    );
    setToast({
      message: `${aluno.nome} cadastrado na pasta ${aluno.codigoPasta}, nº ${aluno.numero}.`,
      type: 'success'
    });
  }

  function atualizarAlunoNaTela(alunoAtualizado: AlunoEditavel) {
    setAlunos((atuais) =>
      atuais.map((aluno) =>
        aluno.id === alunoAtualizado.id
          ? {
              ...aluno,
              nome: alunoAtualizado.nome,
              dataNascimento: formatarData(alunoAtualizado.dataNascimento),
              codigoPasta: alunoAtualizado.codigoPasta,
              numero: alunoAtualizado.numero,
              status: alunoAtualizado.status
            }
          : aluno
      )
    );
  }

  async function confirmarExclusao() {
    if (!alunoParaExcluir) return;
    setExcluindoId(alunoParaExcluir.id);
    const { error } = await supabase
      .from('alunos')
      .delete()
      .eq('id', alunoParaExcluir.id);

    if (error) {
      console.error(error);
      setToast({ message: 'Não foi possível excluir o aluno.', type: 'error' });
    } else {
      setAlunos((atuais) =>
        atuais.filter((aluno) => aluno.id !== alunoParaExcluir.id)
      );
      setToast({
        message: `${alunoParaExcluir.nome} foi excluído.`,
        type: 'success'
      });
    }
    setExcluindoId(null);
    setAlunoParaExcluir(null);
  }

  const alunosFiltrados = alunos.filter((aluno) => {
    const termo = busca.trim().toLocaleLowerCase('pt-BR');
    if (!termo) return true;
    return (
      aluno.nome.toLocaleLowerCase('pt-BR').includes(termo) ||
      aluno.codigoPasta.toLocaleLowerCase('pt-BR').includes(termo) ||
      String(aluno.numero).includes(termo)
    );
  });

  const totalPaginas = Math.max(
    1,
    Math.ceil(alunosFiltrados.length / itensPorPagina)
  );
  const paginaSegura = Math.min(paginaAtual, totalPaginas);
  const inicio = (paginaSegura - 1) * itensPorPagina;
  const alunosPagina = alunosFiltrados.slice(inicio, inicio + itensPorPagina);

  const pastasUnicas = Array.from(
    new Set(alunos.map((a) => a.codigoPasta))
  ).sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));

  const nosArvore: TreeNodeData[] = pastasUnicas.map((pasta) => ({
    id: pasta,
    label: pasta,
    children: alunos
      .filter((a) => a.codigoPasta === pasta)
      .map((a) => ({
        id: String(a.id),
        label: `${a.numero} — ${a.nome}`
      }))
  }));

  if (verificandoSessao) {
    return (
      <div className="app-loading">
        <p>Verificando sessão…</p>
      </div>
    );
  }

  if (!sessao) {
    return <Login onLogin={() => undefined} />;
  }

  return (
    <div className="app">
      {toast && (
        <Toast
          data={toast}
          onClose={() => setToast(null)}
        />
      )}

      {alunoParaExcluir && (
        <ConfirmModal
          titulo="Excluir aluno"
          mensagem={`Tem certeza que deseja excluir ${alunoParaExcluir.nome}?`}
          confirmarLabel="Excluir"
          cancelarLabel="Cancelar"
          onConfirm={() => void confirmarExclusao()}
          onCancel={() => setAlunoParaExcluir(null)}
          loading={excluindoId === alunoParaExcluir.id}
        />
      )}

      <header className="app-header">
        <div className="app-brand">
          <Archive size={28} />
          <div>
            <h1>Guia Escolar</h1>
            <p>Arquivo permanente e secretaria</p>
          </div>
        </div>
        <button
          type="button"
          className="btn-logout"
          onClick={() => void supabase.auth.signOut()}
        >
          <LogOut size={18} />
          Sair
        </button>
      </header>

      <nav className="app-nav">
        <button
          type="button"
          className={abaAtiva === 'consulta' ? 'active' : ''}
          onClick={() => setAbaAtiva('consulta')}
        >
          <Search size={18} />
          Consultar arquivos
        </button>
        <button
          type="button"
          className={abaAtiva === 'dashboard' ? 'active' : ''}
          onClick={() => setAbaAtiva('dashboard')}
        >
          <BarChart2 size={18} />
          Painel
        </button>
        <button
          type="button"
          className={abaAtiva === 'arvore' ? 'active' : ''}
          onClick={() => setAbaAtiva('arvore')}
        >
          <FolderTree size={18} />
          Pastas
        </button>
        <button
          type="button"
          className={abaAtiva === 'gerenciamento' ? 'active' : ''}
          onClick={() => setAbaAtiva('gerenciamento')}
        >
          <Settings size={18} />
          Gerenciar alunos
        </button>
        <button
          type="button"
          className={abaAtiva === 'alunos-secretaria' ? 'active' : ''}
          onClick={() => setAbaAtiva('alunos-secretaria')}
        >
          <FileSpreadsheet size={18} />
          Alunos secretaria
        </button>
        <button
          type="button"
          className={abaAtiva === 'historico' ? 'active' : ''}
          onClick={() => setAbaAtiva('historico')}
        >
          <FileText size={18} />
          Gerar histórico
        </button>
        <button
          type="button"
          className={abaAtiva === 'historicos-salvos' ? 'active' : ''}
          onClick={() => setAbaAtiva('historicos-salvos')}
        >
          <History size={18} />
          Históricos salvos
        </button>
        <button
          type="button"
          className={abaAtiva === 'conferir-historico' ? 'active' : ''}
          onClick={() => setAbaAtiva('conferir-historico')}
        >
          <FileCheck2 size={18} />
          Conferir histórico
        </button>
      </nav>

      <main className="app-main">
        {abaAtiva === 'consulta' && (
          <section className="consulta">
            <div className="consulta-header">
              <h2>
                <List size={22} /> Arquivo permanente
              </h2>
              <div className="busca-box">
                <Search size={18} />
                <input
                  type="search"
                  placeholder="Buscar por nome, pasta ou número…"
                  value={busca}
                  onChange={(e) => {
                    setBusca(e.target.value);
                    setPaginaAtual(1);
                  }}
                />
              </div>
            </div>

            {carregando && <p className="msg">Carregando alunos…</p>}
            {erro && <p className="msg erro">{erro}</p>}

            {!carregando && !erro && (
              <>
                <div className="tabela-wrap">
                  <table className="tabela-alunos">
                    <thead>
                      <tr>
                        <th>Pasta</th>
                        <th>Nº</th>
                        <th>Nome</th>
                        <th>Nascimento</th>
                        <th>Status</th>
                        <th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {alunosPagina.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="vazio">
                            Nenhum aluno encontrado.
                          </td>
                        </tr>
                      ) : (
                        alunosPagina.map((aluno) => (
                          <tr key={aluno.id}>
                            <td>
                              <Folder size={14} /> {aluno.codigoPasta}
                            </td>
                            <td>{aluno.numero}</td>
                            <td>
                              <User size={14} /> {aluno.nome}
                            </td>
                            <td>
                              <Calendar size={14} />{' '}
                              {aluno.dataNascimento || '—'}
                            </td>
                            <td>
                              <span className="status">{aluno.status}</span>
                            </td>
                            <td className="acoes">
                              <button
                                type="button"
                                title="Editar"
                                onClick={() =>
                                  setAlunoEditando({
                                    id: aluno.id,
                                    nome: aluno.nome,
                                    dataNascimento: aluno.dataNascimento
                                      ? aluno.dataNascimento
                                          .split('/')
                                          .reverse()
                                          .join('-')
                                      : '',
                                    codigoPasta: aluno.codigoPasta,
                                    numero: aluno.numero,
                                    status: aluno.status
                                  })
                                }
                              >
                                <Pencil size={16} />
                              </button>
                              <button
                                type="button"
                                title="Excluir"
                                onClick={() => setAlunoParaExcluir(aluno)}
                              >
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
                  <button
                    type="button"
                    disabled={paginaSegura <= 1}
                    onClick={() => setPaginaAtual((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <span>
                    Página {paginaSegura} de {totalPaginas}
                  </span>
                  <button
                    type="button"
                    disabled={paginaSegura >= totalPaginas}
                    onClick={() =>
                      setPaginaAtual((p) => Math.min(totalPaginas, p + 1))
                    }
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </>
            )}
          </section>
        )}

        {abaAtiva === 'dashboard' && (
          <DashboardMetrics alunos={alunos} />
        )}

        {abaAtiva === 'arvore' && <TreeView data={nosArvore} />}

        {abaAtiva === 'historico' && (
          <GeradorHistorico
            dadosIniciais={dadosHistoricoEdicao}
            alunoSecretaria={alunoSecretariaParaHistorico}
            onDadosConsumidos={() => {
              setDadosHistoricoEdicao(null);
              setAlunoSecretariaParaHistorico(null);
            }}
          />
        )}

        {abaAtiva === 'historicos-salvos' && (
          <HistoricosSalvos
            onEditar={(dados) => {
              setDadosHistoricoEdicao(dados);
              setAbaAtiva('historico');
            }}
            onToast={(msg, type) => {
              setToast({
                message: msg,
                type: type === 'error' ? 'error' : 'success'
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
                message:
                  'Aluno cadastrado na secretaria. A lista será atualizada automaticamente.',
                type: 'success'
              });
              setAbaAtiva('alunos-secretaria');
            }}
          />
        )}
      </main>

      <footer className="footer">
        <p>
          Guia Escolar &copy; {new Date().getFullYear()} — E.M. MARIA GERALDA
          MIRANDA BRITO SALOMÃO — Todos os direitos reservados.
        </p>
      </footer>

      {alunoEditando && (
        <EditarAlunoModal
          aluno={alunoEditando}
          aoFechar={() => setAlunoEditando(null)}
          aoSalvar={(atualizado) => {
            atualizarAlunoNaTela(atualizado);
            setAlunoEditando(null);
            setToast({
              message: 'Aluno atualizado com sucesso.',
              type: 'success'
            });
          }}
        />
      )}
    </div>
  );
}
