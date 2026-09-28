import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Database,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  LoaderCircle,
  RefreshCw,
  Search,
  Upload,
  Users,
  X,
} from 'lucide-react';
import {
  compararComExistentes,
  isoParaDataBR,
  lerListagemMatricula,
  ordenarColunas,
  type ItemComparacao,
  type ResultadoLeitura,
  type ResumoComparacao,
  type TipoAlteracao,
} from '../lib/importacaoSecretaria';
import { EXTENSOES_ACEITAS, baixarPlanilha, lerArquivoComoMatriz } from '../lib/planilha';
import {
  carregarAlunosSecretaria,
  ehErroTabelaAusente,
  salvarAlunosSecretaria,
} from '../lib/alunosSecretaria';
import type { AlunoSecretariaRow } from '../types/database';
import type { ToastData } from './Toast';
import './ImportarAlunos.css';

interface ImportarAlunosProps {
  onToast?: (toast: ToastData) => void;
  /** Abre o aluno no Gerador de Histórico */
  onUsarNoHistorico?: (aluno: AlunoSecretariaRow) => void;
}

const ITENS_POR_PAGINA = 20;
const ITENS_PREVIA = 100;

const ROTULOS_TIPO: Record<TipoAlteracao, string> = {
  novo: 'Novos',
  situacao: 'Situação alterada',
  outros: 'Outros dados alterados',
  igual: 'Sem alteração',
};

const ROTULOS_CAMPOS: Record<string, string> = {
  codigo_estudante: 'Código do estudante',
  ra: 'RA',
  nome: 'Nome',
  data_nascimento: 'Data de Nascimento',
  periodo: 'Período',
  turma: 'Turma',
  descricao: 'Descrição',
  turno: 'Turno',
  situacao: 'Situação',
  data_matricula: 'Data da matrícula',
  data_movimentacao: 'Data da movimentação',
  nacionalidade: 'Nacionalidade',
  naturalidade: 'Naturalidade',
  uf_naturalidade: 'UF da naturalidade',
  sexo: 'Sexo',
  identidade: 'Identidade',
  filiacao_1: 'Filiação 1',
  filiacao_2: 'Filiação 2',
  escola: 'Escola',
};

function dadosDoRegistro(aluno: AlunoSecretariaRow): Record<string, string | null> {
  const valor = aluno.dados;
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return {};
  const resultado: Record<string, string | null> = {};
  for (const [chave, item] of Object.entries(valor)) {
    resultado[chave] = item === null || item === undefined ? null : String(item);
  }
  return resultado;
}

function classeSituacao(situacao: string | null): string {
  switch ((situacao ?? '').toUpperCase()) {
    case 'NORMAL':
      return 'ia-badge ia-badge--normal';
    case 'TRANSFERIDO':
      return 'ia-badge ia-badge--transferido';
    case 'DESISTENTE':
      return 'ia-badge ia-badge--desistente';
    case '':
      return 'ia-badge ia-badge--vazio';
    default:
      return 'ia-badge ia-badge--outro';
  }
}

function BadgeSituacao({ situacao }: { situacao: string | null }) {
  return <span className={classeSituacao(situacao)}>{situacao || '—'}</span>;
}

const MENSAGEM_SQL_PENDENTE =
  'A tabela "alunos_secretaria" ainda não existe no Supabase. Execute o SQL "supabase/alunos_secretaria.sql" no SQL Editor do Supabase antes de importar.';

function AvisoSqlPendente() {
  return (
    <div className="ia-alerta ia-alerta--aviso ia-alerta--card" role="alert">
      <Database size={22} className="ia-alerta__icone" />
      <div>
        <strong className="ia-alerta__titulo">Falta um passo no Supabase antes de usar esta aba</strong>
        <p>
          A tabela <code>alunos_secretaria</code> ainda não foi criada. Faça isso uma única vez:
        </p>
        <ol>
          <li>Abra o painel do Supabase e entre no projeto do Guia Escolar.</li>
          <li>
            Vá em <strong>SQL Editor</strong> → <strong>New query</strong>.
          </li>
          <li>
            Cole todo o conteúdo do arquivo <code>supabase/alunos_secretaria.sql</code> (está no
            repositório) e clique em <strong>Run</strong>.
          </li>
          <li>Volte aqui e clique em <strong>Atualizar</strong>.</li>
        </ol>
      </div>
    </div>
  );
}

export default function ImportarAlunos({ onToast, onUsarNoHistorico }: ImportarAlunosProps) {
  const [alunos, setAlunos] = useState<AlunoSecretariaRow[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState('');
  const [tabelaAusente, setTabelaAusente] = useState(false);

  // Importação
  const inputArquivo = useRef<HTMLInputElement>(null);
  const [lendoArquivo, setLendoArquivo] = useState(false);
  const [nomeArquivo, setNomeArquivo] = useState('');
  const [leitura, setLeitura] = useState<ResultadoLeitura | null>(null);
  const [comparacao, setComparacao] = useState<ResumoComparacao | null>(null);
  const [filtroPrevia, setFiltroPrevia] = useState<TipoAlteracao | 'alterados'>('alterados');
  const [limitePrevia, setLimitePrevia] = useState(ITENS_PREVIA);
  const [salvando, setSalvando] = useState(false);
  const [progresso, setProgresso] = useState({ gravados: 0, total: 0 });
  const [erroImportacao, setErroImportacao] = useState('');

  // Lista
  const [busca, setBusca] = useState('');
  const [filtroPeriodo, setFiltroPeriodo] = useState('');
  const [filtroTurma, setFiltroTurma] = useState('');
  const [filtroSituacao, setFiltroSituacao] = useState('');
  const [pagina, setPagina] = useState(1);
  const [detalhe, setDetalhe] = useState<AlunoSecretariaRow | null>(null);
  const [ocultarVazios, setOcultarVazios] = useState(true);
  const [exportando, setExportando] = useState(false);

  const buscarAlunos = useCallback(
    () =>
      carregarAlunosSecretaria()
        .then((lista) => {
          setAlunos(lista);
          setErroCarregamento('');
          setTabelaAusente(false);
        })
        .catch((erro) => {
          console.error(erro);
          const ausente = ehErroTabelaAusente(erro);
          setTabelaAusente(ausente);
          setErroCarregamento(
            ausente
              ? MENSAGEM_SQL_PENDENTE
              : 'Não foi possível carregar os alunos da secretaria. Verifique sua conexão e tente novamente.'
          );
        })
        .finally(() => setCarregando(false)),
    []
  );

  useEffect(() => {
    buscarAlunos();
  }, [buscarAlunos]);

  const carregar = () => {
    setCarregando(true);
    return buscarAlunos();
  };

  /* ---------------------------- Importação ---------------------------- */

  function cancelarImportacao() {
    setLeitura(null);
    setComparacao(null);
    setNomeArquivo('');
    setErroImportacao('');
    if (inputArquivo.current) inputArquivo.current.value = '';
  }

  async function aoSelecionarArquivo(evento: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0];
    if (!arquivo) return;

    setLendoArquivo(true);
    setErroImportacao('');
    setLeitura(null);
    setComparacao(null);
    setNomeArquivo(arquivo.name);

    try {
      const matriz = await lerArquivoComoMatriz(arquivo);
      const resultado = lerListagemMatricula(matriz);
      if (resultado.registros.length === 0) {
        throw new Error('Nenhum aluno encontrado no arquivo.');
      }
      setLeitura(resultado);
      setComparacao(compararComExistentes(resultado.registros, alunos));
      setFiltroPrevia('alterados');
      setLimitePrevia(ITENS_PREVIA);
    } catch (erro) {
      console.error(erro);
      setErroImportacao(
        erro instanceof Error ? erro.message : 'Não foi possível ler o arquivo.'
      );
    } finally {
      setLendoArquivo(false);
    }
  }

  const itensParaGravar = useMemo(
    () => (comparacao ? comparacao.itens.filter((i) => i.tipo !== 'igual') : []),
    [comparacao]
  );

  async function confirmarImportacao() {
    if (itensParaGravar.length === 0) return;
    setSalvando(true);
    setErroImportacao('');
    setProgresso({ gravados: 0, total: itensParaGravar.length });

    try {
      await salvarAlunosSecretaria(
        itensParaGravar.map((i) => i.novo),
        (gravados, total) => setProgresso({ gravados, total })
      );
      onToast?.({
        message: `${itensParaGravar.length} matrícula(s) importada(s) com sucesso!`,
        type: 'success',
      });
      cancelarImportacao();
      await carregar();
    } catch (erro) {
      console.error(erro);
      if (ehErroTabelaAusente(erro)) {
        setTabelaAusente(true);
        setErroImportacao(`Nada foi gravado. ${MENSAGEM_SQL_PENDENTE}`);
      } else {
        setErroImportacao(
          'Erro ao gravar no banco de dados. Parte dos registros pode ter sido gravada; importe o arquivo novamente para concluir.'
        );
      }
      onToast?.({ message: 'Falha ao importar os alunos.', type: 'error' });
    } finally {
      setSalvando(false);
    }
  }

  const itensPrevia = useMemo(() => {
    if (!comparacao) return [];
    if (filtroPrevia === 'alterados') {
      return comparacao.itens.filter((i) => i.tipo !== 'igual');
    }
    return comparacao.itens.filter((i) => i.tipo === filtroPrevia);
  }, [comparacao, filtroPrevia]);

  /* ------------------------------- Lista ------------------------------ */

  const periodos = useMemo(
    () =>
      Array.from(new Set(alunos.map((a) => a.periodo).filter(Boolean) as string[])).sort(
        (a, b) => a.localeCompare(b, 'pt-BR', { numeric: true })
      ),
    [alunos]
  );

  const turmas = useMemo(
    () =>
      Array.from(
        new Set(
          alunos
            .filter((a) => !filtroPeriodo || a.periodo === filtroPeriodo)
            .map((a) => a.turma)
            .filter(Boolean) as string[]
        )
      ).sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true })),
    [alunos, filtroPeriodo]
  );

  const situacoes = useMemo(
    () => Array.from(new Set(alunos.map((a) => a.situacao).filter(Boolean) as string[])).sort(),
    [alunos]
  );

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase('pt-BR');
    return alunos.filter((a) => {
      if (filtroPeriodo && a.periodo !== filtroPeriodo) return false;
      if (filtroTurma && a.turma !== filtroTurma) return false;
      if (filtroSituacao && a.situacao !== filtroSituacao) return false;
      if (!termo) return true;
      return (
        a.nome.toLocaleLowerCase('pt-BR').includes(termo) ||
        a.codigo_matricula.includes(termo) ||
        (a.codigo_estudante ?? '').includes(termo)
      );
    });
  }, [alunos, busca, filtroPeriodo, filtroTurma, filtroSituacao]);

  const totalPaginas = Math.ceil(filtrados.length / ITENS_POR_PAGINA) || 1;
  const paginaSegura = Math.min(pagina, totalPaginas);
  const inicio = (paginaSegura - 1) * ITENS_POR_PAGINA;
  const paginados = filtrados.slice(inicio, inicio + ITENS_POR_PAGINA);

  async function exportar(formato: 'xlsx' | 'csv') {
    if (filtrados.length === 0) return;
    setExportando(true);
    try {
      const linhas = filtrados.map(dadosDoRegistro);
      const colunas = ordenarColunas(linhas.flatMap((l) => Object.keys(l)));
      const data = new Date().toISOString().slice(0, 10);
      await baixarPlanilha(linhas, colunas, `alunos_secretaria_${data}`, formato);
    } catch (erro) {
      console.error(erro);
      onToast?.({ message: 'Não foi possível exportar a lista.', type: 'error' });
    } finally {
      setExportando(false);
    }
  }

  const ultimaImportacao = useMemo(() => {
    const datas = alunos.map((a) => a.updated_at).filter(Boolean).sort();
    const ultima = datas[datas.length - 1];
    return ultima ? new Date(ultima).toLocaleString('pt-BR') : null;
  }, [alunos]);

  const dadosDetalhe = detalhe ? dadosDoRegistro(detalhe) : {};
  const colunasDetalhe = ordenarColunas(Object.keys(dadosDetalhe)).filter(
    (c) => !ocultarVazios || dadosDetalhe[c]
  );

  /* ------------------------------ Render ------------------------------ */

  const cartoesResumo: [TipoAlteracao, number][] = comparacao
    ? [
        ['novo', comparacao.novos],
        ['situacao', comparacao.situacaoAlterada],
        ['outros', comparacao.outrosAlterados],
        ['igual', comparacao.semAlteracao],
      ]
    : [];

  return (
    <div className="ia-container">
      {tabelaAusente && <AvisoSqlPendente />}

      {/* Importação */}
      <section className="table-section ia-secao">
        <div className="ia-cabecalho">
          <div className="ia-titulo">
            <h2>
              <FileSpreadsheet size={20} />
              Importar listagem de matrícula da Secretaria
            </h2>
            <p>
              Selecione o arquivo exportado do sistema municipal (Listagem de Matrícula em .xls,
              .xlsx ou .csv). O arquivo é lido no seu navegador e, antes de gravar, você verá o que
              mudou em relação aos dados já importados.
            </p>
          </div>
        </div>

        <label
          className={`ia-upload${lendoArquivo || salvando ? ' ia-upload--desativado' : ''}`}
        >
          <input
            ref={inputArquivo}
            type="file"
            accept={EXTENSOES_ACEITAS}
            onChange={aoSelecionarArquivo}
            disabled={lendoArquivo || salvando}
            className="ia-upload__input"
          />
          <span className="ia-upload__icone">
            {lendoArquivo ? <LoaderCircle size={26} className="ia-girar" /> : <Upload size={26} />}
          </span>
          <span className="ia-upload__texto">
            <strong>{lendoArquivo ? 'Lendo arquivo...' : 'Selecionar arquivo da Secretaria'}</strong>
            <small>{nomeArquivo || 'Clique aqui para escolher (.xls, .xlsx ou .csv)'}</small>
          </span>
          <span className="ia-botao ia-botao--primario ia-upload__botao">
            <Upload size={16} />
            Escolher arquivo
          </span>
        </label>

        {erroImportacao && (
          <div className="ia-alerta ia-alerta--erro" role="alert">
            <AlertTriangle size={18} className="ia-alerta__icone" />
            <span>{erroImportacao}</span>
          </div>
        )}

        {leitura && comparacao && (
          <div className="ia-previa">
            <p className="ia-previa__info">
              <strong>{nomeArquivo}</strong> — {leitura.registros.length} matrícula(s) de{' '}
              {new Set(leitura.registros.map((r) => r.codigo_estudante)).size} estudante(s),{' '}
              {leitura.cabecalhos.length} colunas
              {leitura.escola ? ` — ${leitura.escola}` : ''}
              {leitura.linhasIgnoradas > 0 &&
                ` — ${leitura.linhasIgnoradas} linha(s) sem código/nome ignorada(s)`}
              {leitura.matriculasDuplicadas.length > 0 &&
                ` — ${leitura.matriculasDuplicadas.length} matrícula(s) repetida(s) no arquivo (mantida a última)`}
            </p>

            <div className="ia-resumo">
              {cartoesResumo.map(([tipo, total]) => (
                <button
                  key={tipo}
                  type="button"
                  onClick={() => {
                    setFiltroPrevia(tipo);
                    setLimitePrevia(ITENS_PREVIA);
                  }}
                  className={`ia-resumo__cartao ia-resumo__cartao--${tipo}${
                    filtroPrevia === tipo ? ' ia-resumo__cartao--ativo' : ''
                  }`}
                  aria-pressed={filtroPrevia === tipo}
                >
                  <span className="ia-resumo__rotulo">{ROTULOS_TIPO[tipo]}</span>
                  <span className="ia-resumo__numero">{total}</span>
                </button>
              ))}
            </div>

            {comparacao.ausentesNoArquivo > 0 && (
              <div className="ia-alerta ia-alerta--info">
                <AlertTriangle size={18} className="ia-alerta__icone" />
                <span>
                  {comparacao.ausentesNoArquivo} matrícula(s) já gravada(s) não aparece(m) neste
                  arquivo. Elas serão mantidas no banco (nada é excluído na importação).
                </span>
              </div>
            )}

            <div className="ia-barra">
              <span className="ia-barra__titulo">
                {filtroPrevia === 'alterados' ? 'Novos e alterados' : ROTULOS_TIPO[filtroPrevia]} (
                {itensPrevia.length})
              </span>
              {filtroPrevia !== 'alterados' && (
                <button
                  type="button"
                  onClick={() => setFiltroPrevia('alterados')}
                  className="ia-link"
                >
                  Mostrar todos os novos e alterados
                </button>
              )}
            </div>

            {itensPrevia.length > 0 ? (
              <div className="table-responsive ia-tabela-rolagem">
                <table className="custom-table ia-tabela">
                  <thead>
                    <tr>
                      <th>Aluno</th>
                      <th>Matrícula</th>
                      <th>Período / Turma</th>
                      <th>Situação</th>
                      <th>Alterações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itensPrevia.slice(0, limitePrevia).map((item: ItemComparacao) => (
                      <tr key={item.novo.codigo_matricula}>
                        <td className="font-bold">{item.novo.nome}</td>
                        <td className="ia-nowrap">{item.novo.codigo_matricula}</td>
                        <td className="ia-nowrap">
                          {item.novo.periodo || '—'} / {item.novo.turma || '—'}
                        </td>
                        <td className="ia-nowrap">
                          {item.tipo === 'situacao' ? (
                            <span className="ia-mudanca">
                              <BadgeSituacao situacao={item.situacaoAnterior} />
                              <ArrowRight size={14} />
                              <BadgeSituacao situacao={item.novo.situacao} />
                            </span>
                          ) : (
                            <BadgeSituacao situacao={item.novo.situacao} />
                          )}
                        </td>
                        <td className="ia-alteracoes">
                          {item.tipo === 'novo' && <span className="ia-tag ia-tag--novo">Nova matrícula</span>}
                          {item.tipo === 'igual' && '—'}
                          {(item.tipo === 'situacao' || item.tipo === 'outros') &&
                            Array.from(new Set(item.camposAlterados.map((c) => ROTULOS_CAMPOS[c] ?? c))).join(', ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {itensPrevia.length > limitePrevia && (
                  <div className="ia-mais">
                    <button
                      type="button"
                      onClick={() => setLimitePrevia((l) => l + ITENS_PREVIA)}
                      className="ia-link"
                    >
                      Mostrar mais ({itensPrevia.length - limitePrevia} restantes)
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="empty-state ia-vazio-previa">Nenhum registro nesta categoria.</div>
            )}

            <div className="ia-acoes-finais">
              {salvando && (
                <span className="ia-progresso">
                  <LoaderCircle size={16} className="ia-girar" />
                  Gravando {progresso.gravados} de {progresso.total}...
                </span>
              )}
              <button
                type="button"
                onClick={cancelarImportacao}
                disabled={salvando}
                className="ia-botao ia-botao--secundario"
              >
                <X size={16} />
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarImportacao}
                disabled={salvando || itensParaGravar.length === 0}
                className="ia-botao ia-botao--sucesso"
              >
                {salvando ? <LoaderCircle size={16} className="ia-girar" /> : <CheckCircle2 size={16} />}
                {itensParaGravar.length === 0
                  ? 'Nada para atualizar'
                  : `Confirmar importação (${itensParaGravar.length})`}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Lista de alunos importados */}
      <section className="table-section ia-secao">
        <div className="ia-cabecalho">
          <div className="ia-titulo">
            <h2>
              <Users size={20} />
              Alunos da Secretaria
            </h2>
            <p>
              {alunos.length} matrícula(s) importada(s)
              {ultimaImportacao ? ` — última atualização em ${ultimaImportacao}` : ''}
            </p>
          </div>
          <div className="ia-grupo-botoes">
            <button
              type="button"
              onClick={() => exportar('xlsx')}
              disabled={exportando || filtrados.length === 0}
              className="ia-botao ia-botao--verde"
              title="Exporta a lista filtrada com todas as colunas"
            >
              <Download size={16} />
              Exportar XLSX
            </button>
            <button
              type="button"
              onClick={() => exportar('csv')}
              disabled={exportando || filtrados.length === 0}
              className="ia-botao ia-botao--verde"
              title="Exporta a lista filtrada com todas as colunas"
            >
              <FileText size={16} />
              Exportar CSV
            </button>
            <button type="button" onClick={carregar} className="ia-botao ia-botao--contorno">
              <RefreshCw size={16} />
              Atualizar
            </button>
          </div>
        </div>

        <div className="ia-filtros">
          <div className="search-bar ia-busca">
            <Search className="search-icon" size={18} />
            <input
              type="text"
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                setPagina(1);
              }}
              placeholder="Buscar por nome ou código..."
              aria-label="Buscar aluno"
            />
          </div>
          <select
            value={filtroPeriodo}
            onChange={(e) => {
              setFiltroPeriodo(e.target.value);
              setFiltroTurma('');
              setPagina(1);
            }}
            className="ia-select"
            aria-label="Filtrar por período"
          >
            <option value="">Todos os períodos</option>
            {periodos.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <select
            value={filtroTurma}
            onChange={(e) => {
              setFiltroTurma(e.target.value);
              setPagina(1);
            }}
            className="ia-select"
            aria-label="Filtrar por turma"
          >
            <option value="">Todas as turmas</option>
            {turmas.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select
            value={filtroSituacao}
            onChange={(e) => {
              setFiltroSituacao(e.target.value);
              setPagina(1);
            }}
            className="ia-select"
            aria-label="Filtrar por situação"
          >
            <option value="">Todas as situações</option>
            {situacoes.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {erroCarregamento && !tabelaAusente && (
          <div className="ia-alerta ia-alerta--erro" role="alert">
            <AlertTriangle size={18} className="ia-alerta__icone" />
            <span>{erroCarregamento}</span>
          </div>
        )}

        {carregando && (
          <div className="empty-state ia-carregando">
            <LoaderCircle className="ia-girar" size={22} />
            Carregando alunos...
          </div>
        )}

        {!carregando && !erroCarregamento && filtrados.length === 0 && (
          <div className="empty-state">
            <Users size={40} className="ia-vazio-icone" />
            <p>
              <strong>
                {alunos.length === 0 ? 'Nenhum aluno importado ainda' : 'Nenhum aluno encontrado'}
              </strong>
            </p>
            {alunos.length === 0 && (
              <p>Use "Selecionar arquivo da Secretaria" acima para importar a listagem.</p>
            )}
          </div>
        )}

        {!carregando && filtrados.length > 0 && (
          <>
            <div className="table-responsive">
              <table className="custom-table ia-tabela">
                <thead>
                  <tr>
                    <th>Aluno</th>
                    <th>Nascimento</th>
                    <th>Período</th>
                    <th>Turma</th>
                    <th>Turno</th>
                    <th>Situação</th>
                    <th>Matrícula</th>
                    <th className="ia-col-acoes">Ações</th>
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
                      <td>
                        <BadgeSituacao situacao={aluno.situacao} />
                      </td>
                      <td>{aluno.codigo_matricula}</td>
                      <td className="ia-col-acoes">
                        <button
                          type="button"
                          onClick={() => setDetalhe(aluno)}
                          className="acao-editar"
                          title="Ver todos os dados"
                        >
                          <Eye size={17} />
                          <span>Detalhes</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="ia-paginacao">
              <span>
                Mostrando {inicio + 1} até {Math.min(inicio + ITENS_POR_PAGINA, filtrados.length)} de{' '}
                {filtrados.length} registro(s)
              </span>
              <div className="ia-grupo-botoes">
                <button
                  type="button"
                  onClick={() => setPagina(Math.max(paginaSegura - 1, 1))}
                  disabled={paginaSegura === 1}
                  className="ia-botao ia-botao--secundario ia-botao--pequeno"
                >
                  Anterior
                </button>
                <span className="ia-paginacao__pagina">
                  Página {paginaSegura} de {totalPaginas}
                </span>
                <button
                  type="button"
                  onClick={() => setPagina(Math.min(paginaSegura + 1, totalPaginas))}
                  disabled={paginaSegura === totalPaginas}
                  className="ia-botao ia-botao--secundario ia-botao--pequeno"
                >
                  Próxima
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Detalhes do aluno */}
      {detalhe && (
        <div className="ia-modal-fundo" onClick={() => setDetalhe(null)}>
          <div
            className="ia-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`Dados completos de ${detalhe.nome}`}
          >
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
              <button
                type="button"
                onClick={() => setDetalhe(null)}
                className="ia-modal__fechar"
                aria-label="Fechar"
              >
                <X size={20} />
              </button>
            </div>

            <div className="ia-modal__barra">
              <label className="ia-checkbox">
                <input
                  type="checkbox"
                  checked={ocultarVazios}
                  onChange={(e) => setOcultarVazios(e.target.checked)}
                />
                Ocultar campos vazios
              </label>
              {onUsarNoHistorico && (
                <button
                  type="button"
                  onClick={() => {
                    onUsarNoHistorico(detalhe);
                    setDetalhe(null);
                  }}
                  className="ia-botao ia-botao--contorno ia-botao--pequeno"
                >
                  <FileText size={15} />
                  Usar no Gerador de Históricos
                </button>
              )}
            </div>

            <dl className="ia-modal__campos">
              {colunasDetalhe.map((coluna) => (
                <div key={coluna} className="ia-campo">
                  <dt>{coluna}</dt>
                  <dd>{dadosDetalhe[coluna] || '—'}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}
