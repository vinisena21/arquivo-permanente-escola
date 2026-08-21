import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  Archive,
  Calendar,
  Folder,
  Layers,
  List,
  LogOut,
  Pencil,
  Search,
  Settings,
  Trash2,
  User
} from 'lucide-react';
import './App.css';
import EditarAlunoModal, {
  type AlunoEditavel
} from './components/EditarAlunoModal';
import GerenciarAlunos from './components/GerenciarAlunos';
import Login from './components/Login';
import { supabase } from './lib/supabase';

interface AlunoArquivo {
  id: number;
  nome: string;
  dataNascimento: string;
  codigoPasta: string;
  numero: number;
  status: string;
}

interface AlunoBanco {
  id: number;
  nome: string;
  data_nascimento: string | null;
  codigo_pasta: string;
  numero: number;
  status: string;
}

type AbaAtiva = 'consulta' | 'gerenciamento';

function formatarData(data: string | null): string {
  if (!data) {
    return '';
  }

  const partes = data.split('-');

  if (partes.length !== 3) {
    return data;
  }

  const [ano, mes, dia] = partes;

  return `${dia}/${mes}/${ano}`;
}

export default function App() {
  const [sessao, setSessao] =
    useState<Session | null>(null);

  const [verificandoSessao, setVerificandoSessao] =
    useState(true);

  const [abaAtiva, setAbaAtiva] =
    useState<AbaAtiva>('consulta');

  const [busca, setBusca] = useState('');

  const [alunos, setAlunos] =
    useState<AlunoArquivo[]>([]);

  const [carregando, setCarregando] =
    useState(true);

  const [erro, setErro] = useState('');

  const [alunoEditando, setAlunoEditando] =
    useState<AlunoEditavel | null>(null);

  const [excluindoId, setExcluindoId] =
    useState<number | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSessao(data.session);
      setVerificandoSessao(false);
    });

    const { data: autenticacao } =
      supabase.auth.onAuthStateChange(
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
      return;
    }

    async function carregarAlunos() {
      setCarregando(true);
      setErro('');

      try {
        const todosOsAlunos: AlunoBanco[] = [];
        const tamanhoLote = 1000;
        let inicio = 0;

        while (true) {
          const fim =
            inicio + tamanhoLote - 1;

          const { data, error } =
            await supabase
              .from('alunos')
              .select(
                `
                  id,
                  nome,
                  data_nascimento,
                  codigo_pasta,
                  numero,
                  status
                `
              )
              .order('id', {
                ascending: true
              })
              .range(inicio, fim);

          if (error) {
            throw error;
          }

          const lote =
            (data ?? []) as AlunoBanco[];

          todosOsAlunos.push(...lote);

          if (lote.length < tamanhoLote) {
            break;
          }

          inicio += tamanhoLote;
        }

        setAlunos(
          todosOsAlunos.map((aluno) => ({
            id: aluno.id,
            nome: aluno.nome,
            dataNascimento: formatarData(
              aluno.data_nascimento
            ),
            codigoPasta:
              aluno.codigo_pasta,
            numero: aluno.numero,
            status: aluno.status
          }))
        );
      } catch (erroEncontrado) {
        console.error(erroEncontrado);

        setErro(
          'Não foi possível carregar os alunos do banco de dados.'
        );
      } finally {
        setCarregando(false);
      }
    }

    carregarAlunos();
  }, [sessao]);

  async function sairDoSistema() {
    await supabase.auth.signOut();

    setAbaAtiva('consulta');
    setBusca('');
    setAlunoEditando(null);
  }

  function atualizarAlunoNaTela(
    alunoAtualizado: AlunoEditavel
  ) {
    setAlunos((alunosAtuais) =>
      alunosAtuais.map((aluno) =>
        aluno.id === alunoAtualizado.id
          ? alunoAtualizado
          : aluno
      )
    );

    setAlunoEditando(null);
  }

  async function excluirAluno(
    aluno: AlunoArquivo
  ) {
    const confirmou = window.confirm(
      `Tem certeza que deseja excluir o aluno:\n\n${aluno.nome}\n\nPasta: ${aluno.codigoPasta}\nNúmero: ${String(
        aluno.numero
      ).padStart(2, '0')}\n\nEssa ação não poderá ser desfeita.`
    );

    if (!confirmou) {
      return;
    }

    setExcluindoId(aluno.id);

    try {
      const { error } = await supabase
        .from('alunos')
        .delete()
        .eq('id', aluno.id);

      if (error) {
        throw error;
      }

      setAlunos((alunosAtuais) =>
        alunosAtuais.filter(
          (item) => item.id !== aluno.id
        )
      );

      window.alert(
        `${aluno.nome} foi excluído com sucesso.`
      );
    } catch (erroEncontrado) {
      console.error(erroEncontrado);

      window.alert(
        'Não foi possível excluir o aluno.'
      );
    } finally {
      setExcluindoId(null);
    }
  }

  const textoBusca = busca
    .toLocaleLowerCase('pt-BR')
    .trim();

  const alunosFiltrados = alunos.filter(
    (item) =>
      item.nome
        .toLocaleLowerCase('pt-BR')
        .includes(textoBusca) ||
      item.codigoPasta
        .toLocaleLowerCase('pt-BR')
        .includes(textoBusca) ||
      String(item.numero).includes(
        textoBusca
      )
  );

  const pastasDisponiveis = Array.from(
    new Set(
      alunos.map(
        (aluno) => aluno.codigoPasta
      )
    )
  ).sort((pastaA, pastaB) =>
    pastaA.localeCompare(
      pastaB,
      'pt-BR',
      {
        numeric: true
      }
    )
  );

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
              <Archive
                className="logo-icon"
                size={36}
              />

              <div>
                <h1>
                  Site Arquivos Permanentes
                </h1>

                <p>
                  Sistema de Consulta e Gestão
                  de Arquivos
                </p>
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
              onClick={() =>
                setAbaAtiva('consulta')
              }
            >
              <List size={19} />
              Consultar arquivos
            </button>

            <button
              type="button"
              className={
                abaAtiva === 'gerenciamento'
                  ? 'navigation-button active'
                  : 'navigation-button'
              }
              onClick={() =>
                setAbaAtiva('gerenciamento')
              }
            >
              <Settings size={19} />
              Gerenciar alunos
            </button>
          </nav>
        </div>
      </header>

      <main className="main-content">
        {abaAtiva === 'consulta' ? (
          <>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="icon-wrapper">
                  <Folder
                    size={24}
                    color="#2563eb"
                  />
                </div>

                <div>
                  <h3>Total Registrados</h3>

                  <p className="stat-number">
                    {carregando
                      ? '...'
                      : alunos.length}
                  </p>
                </div>
              </div>

              <div className="stat-card">
                <div className="icon-wrapper">
                  <Search
                    size={24}
                    color="#2563eb"
                  />
                </div>

                <div>
                  <h3>
                    Resultados Encontrados
                  </h3>

                  <p className="stat-number">
                    {carregando
                      ? '...'
                      : alunosFiltrados.length}
                  </p>
                </div>
              </div>
            </div>

            <section className="search-section">
              <div className="search-bar">
                <Search
                  className="search-icon"
                  size={20}
                />

                <input
                  type="text"
                  placeholder="Buscar por nome do aluno, pasta ou número..."
                  value={busca}
                  onChange={(evento) =>
                    setBusca(
                      evento.target.value
                    )
                  }
                />

                {busca && (
                  <button
                    className="clear-btn"
                    onClick={() =>
                      setBusca('')
                    }
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
                  <p>
                    Carregando registros
                    protegidos...
                  </p>
                </div>
              )}

              {!erro &&
                !carregando &&
                alunosFiltrados.length >
                  0 && (
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
                        {alunosFiltrados.map(
                          (item) => (
                            <tr key={item.id}>
                              <td className="font-bold">
                                {item.nome}
                              </td>

                              <td>
                                {item.dataNascimento ||
                                  'Não informada'}
                              </td>

                              <td>
                                <span className="badge-pasta">
                                  {
                                    item.codigoPasta
                                  }
                                </span>
                              </td>

                              <td>
                                <strong>
                                  {String(
                                    item.numero
                                  ).padStart(
                                    2,
                                    '0'
                                  )}
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
                                    onClick={() =>
                                      setAlunoEditando(
                                        item
                                      )
                                    }
                                    title="Editar aluno"
                                  >
                                    <Pencil
                                      size={17}
                                    />

                                    <span>
                                      Editar
                                    </span>
                                  </button>

                                  <button
                                    type="button"
                                    className="acao-excluir"
                                    onClick={() =>
                                      excluirAluno(
                                        item
                                      )
                                    }
                                    disabled={
                                      excluindoId ===
                                      item.id
                                    }
                                    title="Excluir aluno"
                                  >
                                    <Trash2
                                      size={17}
                                    />

                                    <span>
                                      {excluindoId ===
                                      item.id
                                        ? 'Excluindo'
                                        : 'Excluir'}
                                    </span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

              {!erro &&
                !carregando &&
                alunosFiltrados.length ===
                  0 && (
                  <div className="empty-state">
                    <p>
                      Nenhum registro
                      encontrado para "
                      <strong>
                        {busca}
                      </strong>
                      ".
                    </p>
                  </div>
                )}
            </section>
          </>
        ) : (
          <GerenciarAlunos
            alunos={alunos}
          />
        )}
      </main>

      <footer className="footer">
        <p>
          Site Arquivos Permanentes
          &copy;{' '}
          {new Date().getFullYear()} -
          Todos os direitos reservados.
        </p>
      </footer>

      {alunoEditando && (
        <EditarAlunoModal
          aluno={alunoEditando}
          pastas={pastasDisponiveis}
          aoFechar={() =>
            setAlunoEditando(null)
          }
          aoSalvar={
            atualizarAlunoNaTela
          }
        />
      )}
    </div>
  );
}