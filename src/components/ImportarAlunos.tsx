import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, Database, Download, Eye, FileSpreadsheet,
  FileText, LoaderCircle, Pencil, RefreshCw, Search, Trash2, Upload, Users, X,
} from 'lucide-react';
import {
  compararComExistentes, isoParaDataBR, lerListagemMatricula, ordenarColunas,
  type ResultadoLeitura, type ResumoComparacao,
} from '../lib/importacaoSecretaria';
import { EXTENSOES_ACEITAS, baixarPlanilha, lerArquivoComoMatriz } from '../lib/planilha';
import {
  carregarAlunosSecretaria, ehErroTabelaAusente, excluirAlunoSecretaria, salvarAlunosSecretaria,
} from '../lib/alunosSecretaria';
import type { AlunoSecretariaRow } from '../types/database';
import type { ToastData } from './Toast';
import { ConfirmModal } from './ConfirmModal';
import EditarAlunoSecretariaModal from './EditarAlunoSecretariaModal';
import './ImportarAlunos.css';

interface Props {
  onToast?: (t: ToastData) => void;
  onUsarNoHistorico?: (a: AlunoSecretariaRow) => void;
  /** Quando muda, recarrega a lista do banco (ex.: após cadastro em Gerenciar alunos). */
  refreshKey?: number;
}

const PER_PAGE = 20;

function dadosDoRegistro(aluno: AlunoSecretariaRow): Record<string, string | null> {
  const v = aluno.dados;
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
  const r: Record<string, string | null> = {};
  for (const [k, item] of Object.entries(v)) r[k] = item == null ? null : String(item);
  return r;
}

function BadgeSituacao({ situacao }: { situacao: string | null }) {
  const s = (situacao ?? '').toUpperCase();
  const cls =
    s === 'NORMAL' ? 'ia-badge ia-badge--normal' :
    s === 'TRANSFERIDO' ? 'ia-badge ia-badge--transferido' :
    s === 'DESISTENTE' ? 'ia-badge ia-badge--desistente' :
    !s ? 'ia-badge ia-badge--vazio' : 'ia-badge ia-badge--outro';
  return <span className={cls}>{situacao || '—'}</span>;
}

const MSG_SQL = 'A tabela "alunos_secretaria" ainda não existe no Supabase. Execute o SQL supabase/alunos_secretaria.sql no SQL Editor.';

export default function ImportarAlunos({ onToast, onUsarNoHistorico, refreshKey = 0 }: Props) {
  const [alunos, setAlunos] = useState<AlunoSecretariaRow[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState('');
  const [tabelaAusente, setTabelaAusente] = useState(false);
  const inputArquivo = useRef<HTMLInputElement>(null);
  const [lendoArquivo, setLendoArquivo] = useState(false);
  const [nomeArquivo, setNomeArquivo] = useState('');
  const [leitura, setLeitura] = useState<ResultadoLeitura | null>(null);
  const [comparacao, setComparacao] = useState<ResumoComparacao | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [progresso, setProgresso] = useState({ gravados: 0, total: 0 });
  const [erroImportacao, setErroImportacao] = useState('');
  const [busca, setBusca] = useState('');
  const [filtroPeriodo, setFiltroPeriodo] = useState('');
  const [filtroTurma, setFiltroTurma] = useState('');
  const [filtroSituacao, setFiltroSituacao] = useState('');
  const [pagina, setPagina] = useState(1);
  const [detalhe, setDetalhe] = useState<AlunoSecretariaRow | null>(null);
  const [ocultarVazios, setOcultarVazios] = useState(true);
  const [exportando, setExportando] = useState(false);
  const [alunoEditando, setAlunoEditando] = useState<AlunoSecretariaRow | null>(null);
  const [alunoParaExcluir, setAlunoParaExcluir] = useState<AlunoSecretariaRow | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  const buscarAlunos = useCallback(() =>
    carregarAlunosSecretaria()
      .then((lista) => { setAlunos(lista); setErroCarregamento(''); setTabelaAusente(false); })
      .catch((erro) => {
        console.error(erro);
        const ausente = ehErroTabelaAusente(erro);
        setTabelaAusente(ausente);
        setErroCarregamento(ausente ? MSG_SQL : 'Não foi possível carregar os alunos da secretaria.');
      })
      .finally(() => setCarregando(false)),
  []);

  useEffect(() => { buscarAlunos(); }, [buscarAlunos]);

  useEffect(() => {
    if (refreshKey > 0) {
      setCarregando(true);
      void buscarAlunos();
    }
  }, [refreshKey, buscarAlunos]);

  const carregar = () => { setCarregando(true); return buscarAlunos(); };

  function cancelarImportacao() {
    setLeitura(null); setComparacao(null); setNomeArquivo(''); setErroImportacao('');
    if (inputArquivo.current) inputArquivo.current.value = '';
  }

  async function aoSelecionarArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setLendoArquivo(true);
    setErroImportacao('');
    setLeitura(null);
    setComparacao(null);
    setNomeArquivo(arquivo.name);
    try {
      const matriz = await lerArquivoComoMatriz(arquivo);
      const resultado = lerListagemMatricula(matriz);
      setLeitura(resultado);
      const resumo = compararComExistentes(resultado.registros, alunos);
      setComparacao(resumo);
    } catch (erro) {
      console.error(erro);
      setErroImportacao(erro instanceof Error ? erro.message : 'Não foi possível ler o arquivo.');
    } finally {
      setLendoArquivo(false);
      if (inputArquivo.current) inputArquivo.current.value = '';
    }
  }

  async function confirmarImportacao() {
    if (!leitura) return;
    setSalvando(true);
    setErroImportacao('');
    setProgresso({ gravados: 0, total: leitura.registros.length });
    try {
      await salvarAlunosSecretaria(leitura.registros, (gravados, total) => setProgresso({ gravados, total }));
      onToast?.({ message: `${leitura.registros.length} registro(s) gravados na secretaria.`, type: 'success' });
      cancelarImportacao();
      setCarregando(true);
      await buscarAlunos();
    } catch (erro) {
      console.error(erro);
      setErroImportacao(erro instanceof Error ? erro.message : 'Falha ao gravar no banco.');
    } finally {
      setSalvando(false);
    }
  }

  async function exportar(formato: 'xlsx' | 'csv') {
    setExportando(true);
    try {
      const colunas = ordenarColunas(alunos.flatMap((a) => Object.keys(dadosDoRegistro(a))));
      const linhas = alunos.map((a) => {
        const d = dadosDoRegistro(a);
        return colunas.map((c) => d[c] ?? '');
      });
      await baixarPlanilha([[...colunas], ...linhas], `alunos-secretaria.${formato === 'xlsx' ? 'xlsx' : 'csv'}`, formato);
    } catch (erro) {
      console.error(erro);
      onToast?.({ message: 'Não foi possível exportar.', type: 'error' });
    } finally {
      setExportando(false);
    }
  }

  function aoSalvarEdicao(a: AlunoSecretariaRow) {
    setAlunos((lista) => lista.map((x) => (x.id === a.id ? a : x)));
    setAlunoEditando(null);
    onToast?.({ message: 'Aluno atualizado.', type: 'success' });
  }

  async function confirmarExclusao() {
    if (!alunoParaExcluir) return;
    setExcluindo(true);
    try {
      await excluirAlunoSecretaria(alunoParaExcluir.id);
      setAlunos((lista) => lista.filter((a) => a.id !== alunoParaExcluir.id));
      onToast?.({ message: `${alunoParaExcluir.nome} excluído.`, type: 'success' });
      setAlunoParaExcluir(null);
    } catch (erro) {
      console.error(erro);
      onToast?.({ message: 'Não foi possível excluir.', type: 'error' });
    } finally {
      setExcluindo(false);
    }
  }

  const periodos = useMemo(() => [...new Set(alunos.map((a) => a.periodo).filter(Boolean) as string[])].sort(), [alunos]);
  const turmas = useMemo(() => [...new Set(alunos.map((a) => a.turma).filter(Boolean) as string[])].sort(), [alunos]);
  const situacoes = useMemo(() => [...new Set(alunos.map((a) => a.situacao).filter(Boolean) as string[])].sort(), [alunos]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLocaleLowerCase('pt-BR');
    return alunos.filter((a) => {
      if (filtroPeriodo && a.periodo !== filtroPeriodo) return false;
      if (filtroTurma && a.turma !== filtroTurma) return false;
      if (filtroSituacao && a.situacao !== filtroSituacao) return false;
      if (!q) return true;
      const blob = `${a.nome} ${a.codigo_matricula} ${a.codigo_estudante ?? ''} ${a.turma ?? ''}`.toLocaleLowerCase('pt-BR');
      return blob.includes(q);
    });
  }, [alunos, busca, filtroPeriodo, filtroTurma, filtroSituacao]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / PER_PAGE));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const paginaItens = filtrados.slice((paginaAtual - 1) * PER_PAGE, paginaAtual * PER_PAGE);

  return (
    <section className="ia-container">
      <header className="ia-header">
        <div>
          <h2><Users size={24} /> Alunos da secretaria</h2>
          <p>Importação da listagem municipal e consulta por matrícula.</p>
        </div>
        <div className="ia-header-actions">
          <button type="button" className="ia-btn" onClick={() => void carregar()} disabled={carregando}>
            <RefreshCw size={16} className={carregando ? 'ia-spin' : undefined} /> Atualizar
          </button>
          <button type="button" className="ia-btn" disabled={exportando || alunos.length === 0} onClick={() => void exportar('xlsx')}>
            <Download size={16} /> Excel
          </button>
          <button type="button" className="ia-btn ia-btn-primary" onClick={() => inputArquivo.current?.click()} disabled={lendoArquivo || salvando}>
            <Upload size={16} /> {lendoArquivo ? 'Lendo…' : 'Importar planilha'}
          </button>
          <input ref={inputArquivo} type="file" accept={EXTENSOES_ACEITAS} hidden onChange={(e) => void aoSelecionarArquivo(e)} />
        </div>
      </header>

      {tabelaAusente && (
        <p className="ia-alert ia-alert-error" role="alert">
          <AlertTriangle size={18} /> {MSG_SQL}
        </p>
      )}
      {erroCarregamento && !tabelaAusente && (
        <p className="ia-alert ia-alert-error" role="alert">{erroCarregamento}</p>
      )}

      {leitura && comparacao && (
        <div className="ia-import-card">
          <h3><FileSpreadsheet size={18} /> Prévia: {nomeArquivo}</h3>
          <p>{leitura.registros.length} registro(s) · {comparacao.novos} novo(s) · {comparacao.atualizacoes} atualização(ões)</p>
          {erroImportacao && <p className="ia-alert ia-alert-error">{erroImportacao}</p>}
          <div className="ia-import-actions">
            <button type="button" className="ia-btn" onClick={cancelarImportacao} disabled={salvando}>Cancelar</button>
            <button type="button" className="ia-btn ia-btn-primary" onClick={() => void confirmarImportacao()} disabled={salvando}>
              {salvando ? <><LoaderCircle className="ia-spin" size={16} /> Gravando {progresso.gravados}/{progresso.total}</> : <><Database size={16} /> Confirmar importação</>}
            </button>
          </div>
        </div>
      )}

      <div className="ia-filters">
        <label className="ia-search">
          <Search size={16} />
          <input value={busca} onChange={(e) => { setBusca(e.target.value); setPagina(1); }} placeholder="Nome, matrícula ou turma" />
        </label>
        <select value={filtroPeriodo} onChange={(e) => { setFiltroPeriodo(e.target.value); setPagina(1); }}>
          <option value="">Período</option>
          {periodos.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={filtroTurma} onChange={(e) => { setFiltroTurma(e.target.value); setPagina(1); }}>
          <option value="">Turma</option>
          {turmas.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filtroSituacao} onChange={(e) => { setFiltroSituacao(e.target.value); setPagina(1); }}>
          <option value="">Situação</option>
          {situacoes.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {carregando ? (
        <p className="ia-status"><LoaderCircle className="ia-spin" size={18} /> Carregando…</p>
      ) : (
        <>
          <div className="ia-table-wrap">
            <table className="ia-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Matrícula</th>
                  <th>Turma</th>
                  <th>Situação</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {paginaItens.length === 0 ? (
                  <tr><td colSpan={5}>Nenhum aluno encontrado.</td></tr>
                ) : paginaItens.map((a) => (
                  <tr key={a.id}>
                    <td>{a.nome}</td>
                    <td>{a.codigo_matricula}</td>
                    <td>{a.turma || '—'}</td>
                    <td><BadgeSituacao situacao={a.situacao} /></td>
                    <td className="ia-acoes">
                      <button type="button" title="Detalhes" onClick={() => setDetalhe(a)}><Eye size={16} /></button>
                      <button type="button" title="Editar" onClick={() => setAlunoEditando(a)}><Pencil size={16} /></button>
                      <button type="button" title="Usar no histórico" onClick={() => onUsarNoHistorico?.(a)}><FileText size={16} /></button>
                      <button type="button" title="Excluir" onClick={() => setAlunoParaExcluir(a)}><Trash2 size={16} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="ia-paginacao">
            <button type="button" disabled={paginaAtual <= 1} onClick={() => setPagina((p) => p - 1)}>Anterior</button>
            <span>Página {paginaAtual} de {totalPaginas} · {filtrados.length} registro(s)</span>
            <button type="button" disabled={paginaAtual >= totalPaginas} onClick={() => setPagina((p) => p + 1)}>Próxima</button>
          </div>
        </>
      )}

      {detalhe && (
        <div className="ia-modal-fundo" onClick={() => setDetalhe(null)} role="presentation">
          <div className="ia-modal" role="dialog" onClick={(e) => e.stopPropagation()}>
            <header>
              <h3>{detalhe.nome}</h3>
              <button type="button" onClick={() => setDetalhe(null)} aria-label="Fechar"><X size={20} /></button>
            </header>
            <dl>
              {Object.entries(dadosDoRegistro(detalhe)).filter(([, v]) => !ocultarVazios || (v && v.trim())).map(([k, v]) => (
                <div key={k}><dt>{k}</dt><dd>{v || '—'}</dd></div>
              ))}
            </dl>
            <label className="ia-check">
              <input type="checkbox" checked={ocultarVazios} onChange={(e) => setOcultarVazios(e.target.checked)} /> Ocultar campos vazios
            </label>
          </div>
        </div>
      )}

      {alunoEditando && (
        <EditarAlunoSecretariaModal
          aluno={alunoEditando}
          aoFechar={() => setAlunoEditando(null)}
          aoSalvar={aoSalvarEdicao}
        />
      )}

      <ConfirmModal
        isOpen={Boolean(alunoParaExcluir)}
        title="Excluir aluno da secretaria"
        message={alunoParaExcluir ? `Excluir ${alunoParaExcluir.nome} (matrícula ${alunoParaExcluir.codigo_matricula})?` : ''}
        confirmText="Excluir"
        loading={excluindo}
        onConfirm={() => void confirmarExclusao()}
        onCancel={() => setAlunoParaExcluir(null)}
      />
    </section>
  );
}
