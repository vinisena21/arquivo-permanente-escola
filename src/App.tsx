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
  FileCheck2,
  Calendar,
  Award,
  BookOpen,
  ArrowRightLeft
} from 'lucide-react';
import './App.css';
import EditarAlunoModal, {
  type AlunoEditavel
} from './components/EditarAlunoModal';
import GerenciarAlunos, {
  type AlunoCadastrado
} from './components/GerenciarAlunos';
import Login from './components/Login';

import PainelGestao from './components/PainelGestao';
import DeclaracoesModal from './components/DeclaracoesModal';
import AssistenteEscolarIA from './components/AssistenteEscolarIA';
import { ChevronDown, GraduationCap, ShieldAlert, Sparkles } from 'lucide-react';
import { TreeView, type TreeNodeData } from './components/TreeView';
import { ConfirmModal } from './components/ConfirmModal';
import { Toast, type ToastData } from './components/Toast';
import GeradorHistorico from './components/GeradorHistorico';
import HistoricosSalvos from './components/HistoricosSalvos';
import ImportarAlunos from './components/ImportarAlunos';
import ProfissionaisEscolares from './components/ProfissionaisEscolares';
import DetectorDuplicidades from './components/DetectorDuplicidades';
import ConferirHistorico from './components/ConferirHistorico';
import HorarioTurma from './components/HorarioTurma';
import BoletimEscolar from './components/BoletimEscolar';
import DiarioClasse from './components/DiarioClasse';
import AtasFichasView from './components/AtasFichasView';
import RemanejamentoAlunos from './components/RemanejamentoAlunos';
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
  | 'profissionais'
  | 'duplicidades'
  | 'conferir-historico'
  | 'horarios'
  | 'boletim'
  | 'diario'
  | 'atas-fichas'
  | 'remanejamento';

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
  const [menuDropdownAberto, setMenuDropdownAberto] = useState<'cadastros' | 'arquivo' | 'sigp' | null>(null);
  const [modalDeclaracoesAberta, setModalDeclaracoesAberta] = useState(false);
  const [assistenteIaAberto, setAssistenteIaAberto] = useState(false);

  useEffect(() => {
    function fecharMenus(e: MouseEvent) {
      if (!(e.target as HTMLElement).closest('.nav-dropdown')) {
        setMenuDropdownAberto(null);
      }
    }
    document.addEventListener('click', fecharMenus);
    return () => document.removeEventListener('click', fecharMenus);
  }, []);

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
            {/* 1. Painel de Gestão (Início) */}
            <button
              type="button"
              className={abaAtiva === 'dashboard' ? 'navigation-button active' : 'navigation-button'}
              onClick={() => {
                setAbaAtiva('dashboard');
                setMenuDropdownAberto(null);
              }}
            >
              <BarChart2 size={18} /> Início (Gestão)
            </button>

            {/* 2. Consulta Rápida */}
            <button
              type="button"
              className={abaAtiva === 'consulta' ? 'navigation-button active' : 'navigation-button'}
              onClick={() => {
                setAbaAtiva('consulta');
                setMenuDropdownAberto(null);
              }}
            >
              <Search size={18} /> Consultar arquivos
            </button>

            {/* 3. Dropdown Cadastros */}
            <div className="nav-dropdown">
              <button
                type="button"
                className={`nav-dropdown-btn ${['gerenciamento', 'alunos-secretaria', 'profissionais', 'duplicidades', 'arvore'].includes(abaAtiva) ? 'active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuDropdownAberto(menuDropdownAberto === 'cadastros' ? null : 'cadastros');
                }}
              >
                <Settings size={18} /> Cadastros <ChevronDown size={14} />
              </button>

              {menuDropdownAberto === 'cadastros' && (
                <div className="nav-dropdown-menu">
                  <button
                    type="button"
                    className={`nav-dropdown-item ${abaAtiva === 'gerenciamento' ? 'active' : ''}`}
                    onClick={() => {
                      setAbaAtiva('gerenciamento');
                      setMenuDropdownAberto(null);
                    }}
                  >
                    <Settings size={16} />
                    <div>
                      <span>Gerenciar Alunos</span>
                      <span className="nav-dropdown-item-desc">Cadastrar novo prontuário</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    className={`nav-dropdown-item ${abaAtiva === 'alunos-secretaria' ? 'active' : ''}`}
                    onClick={() => {
                      setAbaAtiva('alunos-secretaria');
                      setMenuDropdownAberto(null);
                    }}
                  >
                    <FileSpreadsheet size={16} />
                    <div>
                      <span>Alunos da Secretaria</span>
                      <span className="nav-dropdown-item-desc">Importar listagens SIMEC</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    className={`nav-dropdown-item ${abaAtiva === 'profissionais' ? 'active' : ''}`}
                    onClick={() => {
                      setAbaAtiva('profissionais');
                      setMenuDropdownAberto(null);
                    }}
                  >
                    <GraduationCap size={16} />
                    <div>
                      <span>Profissionais Escolares</span>
                      <span className="nav-dropdown-item-desc">86 professores e equipe docente</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    className={`nav-dropdown-item ${abaAtiva === 'duplicidades' ? 'active' : ''}`}
                    onClick={() => {
                      setAbaAtiva('duplicidades');
                      setMenuDropdownAberto(null);
                    }}
                  >
                    <ShieldAlert size={16} />
                    <div>
                      <span>Detector de Duplicados</span>
                      <span className="nav-dropdown-item-desc">Auditoria e higienização de dados</span>
                    </div>
                  </button>

                  <div className="nav-dropdown-divider"></div>

                  <button
                    type="button"
                    className={`nav-dropdown-item ${abaAtiva === 'arvore' ? 'active' : ''}`}
                    onClick={() => {
                      setAbaAtiva('arvore');
                      setMenuDropdownAberto(null);
                    }}
                  >
                    <FolderTree size={16} />
                    <div>
                      <span>Árvore do Acervo</span>
                      <span className="nav-dropdown-item-desc">Estrutura física de pastas</span>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* 4. Dropdown Pedagógico (SIGP) */}
            <div className="nav-dropdown">
              <button
                type="button"
                className={`nav-dropdown-btn ${['horarios', 'boletim', 'diario', 'atas-fichas', 'remanejamento'].includes(abaAtiva) ? 'active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuDropdownAberto(menuDropdownAberto === 'sigp' ? null : 'sigp');
                }}
              >
                <GraduationCap size={18} /> Pedagógico (SIGP) <ChevronDown size={14} />
              </button>

              {menuDropdownAberto === 'sigp' && (
                <div className="nav-dropdown-menu">
                  <button
                    type="button"
                    className={`nav-dropdown-item ${abaAtiva === 'horarios' ? 'active' : ''}`}
                    onClick={() => {
                      setAbaAtiva('horarios');
                      setMenuDropdownAberto(null);
                    }}
                  >
                    <Calendar size={16} />
                    <div>
                      <span>Quadro de Horários</span>
                      <span className="nav-dropdown-item-desc">Grade semanal das 30 turmas</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    className={`nav-dropdown-item ${abaAtiva === 'boletim' ? 'active' : ''}`}
                    onClick={() => {
                      setAbaAtiva('boletim');
                      setMenuDropdownAberto(null);
                    }}
                  >
                    <Award size={16} />
                    <div>
                      <span>Boletim & Notas</span>
                      <span className="nav-dropdown-item-desc">Lançamento trimestral e boletins</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    className={`nav-dropdown-item ${abaAtiva === 'diario' ? 'active' : ''}`}
                    onClick={() => {
                      setAbaAtiva('diario');
                      setMenuDropdownAberto(null);
                    }}
                  >
                    <BookOpen size={16} />
                    <div>
                      <span>Diário & Frequência</span>
                      <span className="nav-dropdown-item-desc">Chamada diária e plano de aulas</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    className={`nav-dropdown-item ${abaAtiva === 'atas-fichas' ? 'active' : ''}`}
                    onClick={() => {
                      setAbaAtiva('atas-fichas');
                      setMenuDropdownAberto(null);
                    }}
                  >
                    <FileCheck2 size={16} />
                    <div>
                      <span>Ficha Individual & Ata Final</span>
                      <span className="nav-dropdown-item-desc">Encerramento anual e arquivo</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    className={`nav-dropdown-item ${abaAtiva === 'remanejamento' ? 'active' : ''}`}
                    onClick={() => {
                      setAbaAtiva('remanejamento');
                      setMenuDropdownAberto(null);
                    }}
                  >
                    <ArrowRightLeft size={16} />
                    <div>
                      <span>Remanejamento & Transferências</span>
                      <span className="nav-dropdown-item-desc">Movimentação escolar oficial</span>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* 5. Dropdown Arquivo & Históricos */}
            <div className="nav-dropdown">
              <button
                type="button"
                className={`nav-dropdown-btn ${['historico', 'historicos-salvos', 'conferir-historico'].includes(abaAtiva) ? 'active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuDropdownAberto(menuDropdownAberto === 'arquivo' ? null : 'arquivo');
                }}
              >
                <Archive size={18} /> Arquivo & Históricos <ChevronDown size={14} />
              </button>

              {menuDropdownAberto === 'arquivo' && (
                <div className="nav-dropdown-menu">
                  <button
                    type="button"
                    className={`nav-dropdown-item ${abaAtiva === 'historico' ? 'active' : ''}`}
                    onClick={() => {
                      setAbaAtiva('historico');
                      setMenuDropdownAberto(null);
                    }}
                  >
                    <FileText size={16} />
                    <div>
                      <span>Gerar Histórico</span>
                      <span className="nav-dropdown-item-desc">Preencher e emitir histórico</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    className={`nav-dropdown-item ${abaAtiva === 'historicos-salvos' ? 'active' : ''}`}
                    onClick={() => {
                      setAbaAtiva('historicos-salvos');
                      setMenuDropdownAberto(null);
                    }}
                  >
                    <History size={16} />
                    <div>
                      <span>Históricos Salvos</span>
                      <span className="nav-dropdown-item-desc">Consultar documentos emitidos</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    className={`nav-dropdown-item ${abaAtiva === 'conferir-historico' ? 'active' : ''}`}
                    onClick={() => {
                      setAbaAtiva('conferir-historico');
                      setMenuDropdownAberto(null);
                    }}
                  >
                    <FileCheck2 size={16} />
                    <div>
                      <span>Conferir com IA</span>
                      <span className="nav-dropdown-item-desc">Verificação e auditoria</span>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* 5. Emissor de Declarações */}
            <button
              type="button"
              className="navigation-button"
              onClick={() => {
                setModalDeclaracoesAberta(true);
                setMenuDropdownAberto(null);
              }}
              title="Emitir Declaração de Matrícula, Escolaridade ou Comparecimento"
            >
              <GraduationCap size={18} /> Declarações
            </button>

            {/* 6. Assistente IA Integrado */}
            <button
              type="button"
              className="navigation-button nav-btn-ia"
              onClick={() => {
                setAssistenteIaAberto(true);
                setMenuDropdownAberto(null);
              }}
              title="Abrir Assistente Inteligente Guia IA (Sem gastar tokens)"
            >
              <Sparkles size={18} color="#93c5fd" /> Assistente IA
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

        {abaAtiva === 'dashboard' && <PainelGestao />}

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

        {abaAtiva === 'profissionais' && (
          <ProfissionaisEscolares onToast={setToast} />
        )}

        {abaAtiva === 'duplicidades' && (
          <DetectorDuplicidades
            alunosArquivo={alunos}
            onExcluirAlunoArquivo={async (id) => {
              const { error } = await supabase.from('alunos').delete().eq('id', id);
              if (error) throw error;
              setAlunos((atuais) => atuais.filter((a) => a.id !== id));
              setToast({ message: 'Registro duplicado excluído com sucesso.', type: 'success' });
            }}
            onToast={setToast}
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

        {abaAtiva === 'horarios' && <HorarioTurma onToast={setToast} />}

        {abaAtiva === 'boletim' && <BoletimEscolar onToast={setToast} />}

        {abaAtiva === 'diario' && <DiarioClasse onToast={setToast} />}

        {abaAtiva === 'atas-fichas' && <AtasFichasView onToast={setToast} />}

        {abaAtiva === 'remanejamento' && <RemanejamentoAlunos onToast={setToast} />}
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

      <DeclaracoesModal
        isOpen={modalDeclaracoesAberta}
        onClose={() => setModalDeclaracoesAberta(false)}
        alunos={alunos}
      />

      <AssistenteEscolarIA
        abertoExterno={assistenteIaAberto}
        onFecharExterno={() => setAssistenteIaAberto(false)}
        onAbrirDeclaracao={() => setModalDeclaracoesAberta(true)}
      />

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}



