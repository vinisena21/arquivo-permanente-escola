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

export default function ImportarAlunos({ onToast, onUsarNoHistorico }: Props) {
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
      if (!matriz || matriz.length === 0) {
        throw new Error('O arquivo está vazio ou não pôde ser lido.');
      }
      const resultado = lerListagemMatricula(matriz);
      if (resultado.registros.length === 0) {
        throw new Error('Nenhum aluno encontrado no arquivo. Verifique se é a Listagem de Matrícula exportada do sistema.');
      }
      setLeitura(resultado);
      setComparacao(compararComExistentes(resultado.registros, alunos));
    } catch (erro) {
      console.error(erro);
      const msg =
        erro instanceof Error && erro.message
          ? erro.message
          : 'Não foi possível ler o arquivo. Use .xls, .xlsx ou .csv da Listagem de Matrícula.';
      setErroImportacao(msg);
      setLeitura(null);
      setComparacao(null);
    } finally {
      setLendoArquivo(false);
      // Permite selecionar o mesmo arquivo novamente
      if (inputArquivo.current) inputArquivo.current.value = '';
    }
  }

  const itensParaGravar = useMemo(
    () => (comparacao ? comparacao.itens.filter((i) => i.tipo !== 'igual') : []),
    [comparacao]
  );

  async function confirmarImportacao() {
    if (itensParaGravar.length === 0) return;
    setSalvando(true); setErroImportacao(''); setProgresso({ gravados: 0, total: itensParaGravar.length });
    try {
      await salvarAlunosSecretaria(itensParaGravar.map((i) => i.novo), (g, t) => setProgresso({ gravados: g, total: t }));
      onToast?.({ message: `${itensParaGravar.length} matrícula(s) importada(s) com sucesso!`, type: 'success' });
      cancelarImportacao();
      await carregar();
    } catch (erro) {
      console.error(erro);
      if (ehErroTabelaAusente(erro)) { setTabelaAusente(true); setErroImportacao(`Nada foi gravado. ${MSG_SQL}`); }
      else setErroImportacao('Erro ao gravar no banco de dados.');
      onToast?.({ message: 'Falha ao importar os alunos.', type: 'error' });
    } finally { setSalvando(false); }
  }

  const periodos = useMemo(() => Array.from(new Set(alunos.map((a) => a.periodo).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true })), [alunos]);
  const turmas = useMemo(() => Array.from(new Set(alunos.filter((a) => !filtroPeriodo || a.periodo === filtroPeriodo).map((a) => a.turma).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true })), [alunos, filtroPeriodo]);
  const situacoes = useMemo(() => Array.from(new Set(alunos.map((a) => a.situacao).filter(Boolean) as string[])).sort(), [alunos]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase('pt-BR');
    return alunos.filter((a) => {
      if (filtroPeriodo && a.periodo !== filtroPeriodo) return false;
      if (filtroTurma && a.turma !== filtroTurma) return false;
      if (filtroSituacao && a.situacao !== filtroSituacao) return false;
      if (!termo) return true;
      return a.nome.toLocaleLowerCase('pt-BR').includes(termo) || a.codigo_matricula.includes(termo) || (a.codigo_estudante ?? '').includes(termo);
    });
  }, [alunos, busca, filtroPeriodo, filtroTurma, filtroSituacao]);

  const totalPaginas = Math.ceil(filtrados.length / PER_PAGE) || 1;
  const paginaSegura = Math.min(pagina, totalPaginas);
  const inicio = (paginaSegura - 1) * PER_PAGE;
  const paginados = filtrados.slice(inicio, inicio + PER_PAGE);

  async function exportar(formato: 'xlsx' | 'csv') {
    if (filtrados.length === 0) return;
    setExportando(true);
    try {
      const linhas = filtrados.map(dadosDoRegistro);
      const colunas = ordenarColunas(linhas.flatMap((l) => Object.keys(l)));
      await baixarPlanilha(linhas, colunas, `alunos_secretaria_${new Date().toISOString().slice(0, 10)}`, formato);
    } catch (erro) {
      console.error(erro);
      onToast?.({ message: 'Não foi possível exportar a lista.', type: 'error' });
    } finally { setExportando(false); }
  }

  function aoSalvarEdicao(a: AlunoSecretariaRow) {
    setAlunos((lista) => lista.map((x) => (x.id === a.id ? a : x)));
    setAlunoEditando(null);
    if (detalhe?.id === a.id) setDetalhe(a);
    onToast?.({ message: `Dados de ${a.nome} atualizados com sucesso!`, type: 'success' });
  }

  async function confirmarExclusao() {
    if (!alunoParaExcluir) return;
    setExcluindo(true);
    try {
      await excluirAlunoSecretaria(alunoParaExcluir.id);
      setAlunos((lista) => lista.filter((a) => a.id !== alunoParaExcluir.id));
      if (detalhe?.id === alunoParaExcluir.id) setDetalhe(null);
      onToast?.({ message: `${alunoParaExcluir.nome} foi excluído com sucesso.`, type: 'success' });
    } catch (erro) {
      console.error(erro);
      onToast?.({ message: 'Não foi possível excluir o registro.', type: 'error' });
    } finally {
      setExcluindo(false);
      setAlunoParaExcluir(null);
    }
  }

  const dadosDetalhe = detalhe ? dadosDoRegistro(detalhe) : {};
  const colunasDetalhe = ordenarColunas(Object.keys(dadosDetalhe)).filter((c) => !ocultarVazios || dadosDetalhe[c]);
  const alterados = itensParaGravar.length;

  return (
    <div className="ia-container">
      {tabelaAusente && (
        <div className="ia-alerta ia-alerta--aviso ia-alerta--card" role="alert">
          <Database size={22} className="ia-alerta__icone" />
          <div>
            <strong className="ia-alerta__titulo">Falta criar a tabela no Supabase</strong>
            <p>{MSG_SQL}</p>
          </div>
        </div>
      )}

      <section className="table-section ia-secao">
        <div className="ia-cabecalho">
          <div className="ia-titulo">
            <h2><FileSpreadsheet size={20} /> Importar listagem de matrícula da Secretaria</h2>
            <p>Selecione o arquivo exportado do sistema municipal (.xls, .xlsx ou .csv).</p>
          </div>
        </div>
        <label htmlFor="ia-arquivo-secretaria" className={`ia-upload${lendoArquivo || salvando ? ' ia-upload--desativado' : ''}`}>
          <input id="ia-arquivo-secretaria" ref={inputArquivo} type="file" accept={EXTENSOES_ACEITAS} onChange={aoSelecionarArquivo} disabled={lendoArquivo || salvando} className="ia-upload__input" />
          <span className="ia-upload__icone">{lendoArquivo ? <LoaderCircle size={26} className="ia-girar" /> : <Upload size={26} />}</span>
          <span className="ia-upload__texto">
            <strong>{lendoArquivo ? 'Lendo arquivo...' : 'Selecionar arquivo da Secretaria'}</strong>
            <small>{nomeArquivo || 'Clique para escolher (.xls, .xlsx ou .csv)'}</small>
          </span>
          <span className="ia-botao ia-botao--primario ia-upload__botao"><Upload size={16} /> Escolher arquivo</span>
        </label>
        {erroImportacao && (
          <div className="ia-alerta ia-alerta--erro" role="alert">
            <AlertTriangle size={18} className="ia-alerta__icone" /><span>{erroImportacao}</span>
          </div>
        )}
        {leitura && comparacao && (
          <div className="ia-previa">
            <p className="ia-previa__info">
              <strong>{nomeArquivo}</strong> — {leitura.registros.length} matrícula(s) — {alterados} para gravar
              (novos: {comparacao.novos}, situação: {comparacao.situacaoAlterada}, outros: {comparacao.outrosAlterados})
            </p>
            <div className="ia-acoes-finais">
              {salvando && <span className="ia-progresso"><LoaderCircle size={16} className="ia-girar" /> Gravando {progresso.gravados}/{progresso.total}...</span>}
              <button type="button" onClick={cancelarImportacao} disabled={salvando} className="ia-botao ia-botao--secundario"><X size={16} /> Cancelar</button>
              <button type="button" onClick={confirmarImportacao} disabled={salvando || alterados === 0} className="ia-botao ia-botao--sucesso">
                {salvando ? <LoaderCircle size={16} className="ia-girar" /> : <CheckCircle2 size={16} />}
                {alterados === 0 ? 'Nada para atualizar' : `Confirmar importação (${alterados})`}
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="table-section ia-secao">
        <div className="ia-cabecalho">
          <div className="ia-titulo">
            <h2><Users size={20} /> Alunos da Secretaria</h2>
            <p>{alunos.length} matrícula(s) importada(s)</p>
          </div>
          <div className="ia-grupo-botoes">
            <button type="button" onClick={() => exportar('xlsx')} disabled={exportando || filtrados.length === 0} className="ia-botao ia-botao--verde"><Download size={16} /> XLSX</button>
            <button type="button" onClick={() => exportar('csv')} disabled={exportando || filtrados.length === 0} className="ia-botao ia-botao--verde"><FileText size={16} /> CSV</button>
            <button type="button" onClick={carregar} className="ia-botao ia-botao--contorno"><RefreshCw size={16} /> Atualizar</button>
          </div>
        </div>
        <div className="ia-filtros">
          <div className="search-bar ia-busca">
            <Search className="search-icon" size={18} />
            <input type="text" placeholder="Buscar por nome, matrícula ou código..." value={busca} onChange={(e) => { setBusca(e.target.value); setPagina(1); }} />
          </div>
          <select className="ia-select" value={filtroPeriodo} onChange={(e) => { setFiltroPeriodo(e.target.value); setFiltroTurma(''); setPagina(1); }}>
            <option value="">Todos os períodos</option>
            {periodos.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select className="ia-select" value={filtroTurma} onChange={(e) => { setFiltroTurma(e.target.value); setPagina(1); }}>
            <option value="">Todas as turmas</option>
            {turmas.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select className="ia-select" value={filtroSituacao} onChange={(e) => { setFiltroSituacao(e.target.value); setPagina(1); }}>
            <option value="">Todas as situações</option>
            {situacoes.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        {erroCarregamento && !tabelaAusente && (
          <div className="ia-alerta ia-alerta--erro" role="alert"><AlertTriangle size={18} className="ia-alerta__icone" /><span>{erroCarregamento}</span></div>
        )}
        {carregando && <div className="empty-state ia-carregando"><LoaderCircle className="ia-girar" size={22} /> Carregando alunos...</div>}
        {!carregando && !erroCarregamento && filtrados.length === 0 && (
          <div className="empty-state">
            <Users size={40} className="ia-vazio-icone" />
            <p><strong>{alunos.length === 0 ? 'Nenhum aluno importado ainda' : 'Nenhum aluno encontrado'}</strong></p>
          </div>
        )}
        {!carregando && filtrados.length > 0 && (
          <>
            <div className="table-responsive">
              <table className="custom-table ia-tabela">
                <thead>
                  <tr>
                    <th>Aluno</th><th>Nascimento</th><th>Período</th><th>Turma</th>
                    <th>Turno</th><th>Situação</th><th>Matrícula</th><th className="ia-col-acoes">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {paginados.map((aluno) => (
                    <tr key={aluno.id}>
                      <td className="font-bold">{aluno.nome}</td>
                      <td className="ia-nowrap">{isoParaDataBR(aluno.data_nascimento) || '—'}</td>
                      <td className="ia-nowrap">{aluno.periodo || '—'}</td>
                      <td>{aluno.turma || '—'}</td>
                      <td>{aluno.turno || '—'}</td>
                      <td><BadgeSituacao situacao={aluno.situacao} /></td>
                      <td>{aluno.codigo_matricula}</td>
                      <td className="ia-col-acoes">
                        <div className="acoes-aluno">
                          <button type="button" onClick={() => setDetalhe(aluno)} className="acao-editar" title="Detalhes"><Eye size={17} /><span>Detalhes</span></button>
                          <button type="button" onClick={() => setAlunoEditando(aluno)} className="acao-editar" title="Editar"><Pencil size={17} /><span>Editar</span></button>
                          <button type="button" onClick={() => setAlunoParaExcluir(aluno)} className="acao-excluir" title="Excluir"><Trash2 size={17} /><span>Excluir</span></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="ia-paginacao">
              <span>Mostrando {inicio + 1}–{Math.min(inicio + PER_PAGE, filtrados.length)} de {filtrados.length}</span>
              <div className="ia-grupo-botoes">
                <button type="button" onClick={() => setPagina(Math.max(paginaSegura - 1, 1))} disabled={paginaSegura === 1} className="ia-botao ia-botao--secundario ia-botao--pequeno">Anterior</button>
                <span className="ia-paginacao__pagina">Página {paginaSegura} de {totalPaginas}</span>
                <button type="button" onClick={() => setPagina(Math.min(paginaSegura + 1, totalPaginas))} disabled={paginaSegura === totalPaginas} className="ia-botao ia-botao--secundario ia-botao--pequeno">Próxima</button>
              </div>
            </div>
          </>
        )}
      </section>

      {detalhe && (
        <div className="ia-modal-fundo" onClick={() => setDetalhe(null)}>
          <div className="ia-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="ia-modal__cabecalho">
              <div>
                <h3>{detalhe.nome}</h3>
                <p className="ia-modal__sub">
                  <span>Matrícula {detalhe.codigo_matricula}</span>
                  {detalhe.periodo && <span>• {detalhe.periodo}</span>}
                  {detalhe.turma && <span>• Turma {detalhe.turma}</span>}
                  <BadgeSituacao situacao={detalhe.situacao} />
                </p>
              </div>
              <button type="button" onClick={() => setDetalhe(null)} className="ia-modal__fechar" aria-label="Fechar"><X size={20} /></button>
            </div>
            <div className="ia-modal__barra">
              <label className="ia-checkbox">
                <input type="checkbox" checked={ocultarVazios} onChange={(e) => setOcultarVazios(e.target.checked)} /> Ocultar campos vazios
              </label>
              <div className="ia-grupo-botoes">
                <button type="button" onClick={() => { setAlunoEditando(detalhe); setDetalhe(null); }} className="ia-botao ia-botao--contorno ia-botao--pequeno"><Pencil size={15} /> Editar</button>
                {onUsarNoHistorico && (
                  <button type="button" onClick={() => { onUsarNoHistorico(detalhe); setDetalhe(null); }} className="ia-botao ia-botao--contorno ia-botao--pequeno"><FileText size={15} /> Usar no Gerador</button>
                )}
              </div>
            </div>
            <dl className="ia-modal__campos">
              {colunasDetalhe.map((col) => (
                <div key={col} className="ia-campo"><dt>{col}</dt><dd>{dadosDetalhe[col] || '—'}</dd></div>
              ))}
            </dl>
          </div>
        </div>
      )}

      {alunoEditando && (
        <EditarAlunoSecretariaModal aluno={alunoEditando} aoFechar={() => setAlunoEditando(null)} aoSalvar={aoSalvarEdicao} />
      )}

      <ConfirmModal
        isOpen={Boolean(alunoParaExcluir)}
        title="Excluir matrícula"
        message={alunoParaExcluir ? `Tem certeza que deseja excluir a matrícula de ${alunoParaExcluir.nome} (código ${alunoParaExcluir.codigo_matricula})?\n\nEsta ação não pode ser desfeita.` : ''}
        confirmText="Excluir"
        cancelText="Cancelar"
        loading={excluindo}
        onConfirm={confirmarExclusao}
        onCancel={() => setAlunoParaExcluir(null)}
      />
    </div>
  );
}
