import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
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
  salvarAlunosSecretaria,
} from '../lib/alunosSecretaria';
import type { AlunoSecretariaRow } from '../types/database';
import type { ToastData } from './Toast';

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

function corSituacao(situacao: string | null): string {
  switch ((situacao ?? '').toUpperCase()) {
    case 'NORMAL':
      return 'bg-green-50 text-green-700 border-green-200';
    case 'TRANSFERIDO':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'DESISTENTE':
      return 'bg-red-50 text-red-700 border-red-200';
    default:
      return 'bg-blue-50 text-blue-700 border-blue-200';
  }
}

function BadgeSituacao({ situacao }: { situacao: string | null }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 text-xs font-bold border rounded-md ${corSituacao(situacao)}`}
    >
      {situacao || '—'}
    </span>
  );
}

export default function ImportarAlunos({ onToast, onUsarNoHistorico }: ImportarAlunosProps) {
  const [alunos, setAlunos] = useState<AlunoSecretariaRow[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState('');

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
        })
        .catch((erro) => {
          console.error(erro);
          setErroCarregamento(
            'Não foi possível carregar os alunos da secretaria. Verifique se o SQL "supabase/alunos_secretaria.sql" já foi executado no Supabase.'
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
      setErroImportacao(
        'Erro ao gravar no banco de dados. Parte dos registros pode ter sido gravada; importe o arquivo novamente para concluir.'
      );
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

  return (
    <div className="flex flex-col gap-6">
      {/* Importação */}
      <section className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <FileSpreadsheet size={20} className="text-blue-600" />
              Importar listagem de matrícula da Secretaria
            </h2>
            <p className="text-sm text-gray-500 mt-1 max-w-2xl">
              Selecione o arquivo exportado do sistema municipal (Listagem de Matrícula em
              .xls, .xlsx ou .csv). O arquivo é lido no seu navegador; antes de gravar, você
              verá o que mudou em relação aos dados já importados.
            </p>
          </div>

          <label
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white rounded-lg cursor-pointer ${
              lendoArquivo || salvando ? 'bg-blue-300 pointer-events-none' : 'bg-blue-700 hover:bg-blue-800'
            }`}
          >
            {lendoArquivo ? <LoaderCircle size={18} className="animate-spin" /> : <Upload size={18} />}
            {lendoArquivo ? 'Lendo arquivo...' : 'Selecionar arquivo'}
            <input
              ref={inputArquivo}
              type="file"
              accept={EXTENSOES_ACEITAS}
              onChange={aoSelecionarArquivo}
              disabled={lendoArquivo || salvando}
              className="hidden"
            />
          </label>
        </div>

        {erroImportacao && (
          <div className="mb-4 flex items-start gap-2 text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
            <span>{erroImportacao}</span>
          </div>
        )}

        {leitura && comparacao && (
          <div className="border-t border-gray-100 pt-4">
            <p className="text-sm text-gray-600 mb-3">
              <strong>{nomeArquivo}</strong> — {leitura.registros.length} matrícula(s) de{' '}
              {new Set(leitura.registros.map((r) => r.codigo_estudante)).size} estudante(s),{' '}
              {leitura.cabecalhos.length} colunas
              {leitura.escola ? ` — ${leitura.escola}` : ''}
              {leitura.linhasIgnoradas > 0 &&
                ` — ${leitura.linhasIgnoradas} linha(s) sem código/nome ignorada(s)`}
              {leitura.matriculasDuplicadas.length > 0 &&
                ` — ${leitura.matriculasDuplicadas.length} matrícula(s) repetida(s) no arquivo (mantida a última)`}
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {(
                [
                  ['novo', comparacao.novos, 'text-blue-700 bg-blue-50 border-blue-200'],
                  ['situacao', comparacao.situacaoAlterada, 'text-amber-700 bg-amber-50 border-amber-200'],
                  ['outros', comparacao.outrosAlterados, 'text-indigo-700 bg-indigo-50 border-indigo-200'],
                  ['igual', comparacao.semAlteracao, 'text-gray-600 bg-gray-50 border-gray-200'],
                ] as [TipoAlteracao, number, string][]
              ).map(([tipo, total, cor]) => (
                <button
                  key={tipo}
                  type="button"
                  onClick={() => {
                    setFiltroPrevia(tipo);
                    setLimitePrevia(ITENS_PREVIA);
                  }}
                  className={`text-left p-3 rounded-lg border ${cor} ${
                    filtroPrevia === tipo ? 'ring-2 ring-offset-1 ring-blue-400' : ''
                  }`}
                >
                  <span className="block text-xs font-bold uppercase tracking-wide">
                    {ROTULOS_TIPO[tipo]}
                  </span>
                  <span className="block text-2xl font-black">{total}</span>
                </button>
              ))}
            </div>

            {comparacao.ausentesNoArquivo > 0 && (
              <p className="mb-4 text-xs text-gray-500">
                {comparacao.ausentesNoArquivo} matrícula(s) já gravada(s) não aparece(m) neste
                arquivo. Elas serão mantidas no banco (nada é excluído na importação).
              </p>
            )}

            <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
              <span className="text-sm font-semibold text-gray-700">
                {filtroPrevia === 'alterados'
                  ? 'Novos e alterados'
                  : ROTULOS_TIPO[filtroPrevia]}{' '}
                ({itensPrevia.length})
              </span>
              {filtroPrevia !== 'alterados' && (
                <button
                  type="button"
                  onClick={() => setFiltroPrevia('alterados')}
                  className="text-xs font-semibold text-blue-700 hover:underline"
                >
                  Mostrar todos os novos e alterados
                </button>
              )}
            </div>

            {itensPrevia.length > 0 ? (
              <div className="overflow-x-auto max-h-[420px] overflow-y-auto border border-gray-100 rounded-lg">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-gray-200 text-gray-500 uppercase text-xs tracking-wide">
                      <th className="py-2 px-3">Aluno</th>
                      <th className="py-2 px-3">Matrícula</th>
                      <th className="py-2 px-3">Período / Turma</th>
                      <th className="py-2 px-3">Situação</th>
                      <th className="py-2 px-3">Alterações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itensPrevia.slice(0, limitePrevia).map((item: ItemComparacao) => (
                      <tr key={item.novo.codigo_matricula} className="border-b border-gray-100">
                        <td className="py-2 px-3 font-semibold text-gray-900">{item.novo.nome}</td>
                        <td className="py-2 px-3 text-gray-600">{item.novo.codigo_matricula}</td>
                        <td className="py-2 px-3 text-gray-600 whitespace-nowrap">
                          {item.novo.periodo || '—'} / {item.novo.turma || '—'}
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap">
                          {item.tipo === 'situacao' ? (
                            <span className="inline-flex items-center gap-1">
                              <BadgeSituacao situacao={item.situacaoAnterior} />
                              <ArrowRight size={14} className="text-gray-400" />
                              <BadgeSituacao situacao={item.novo.situacao} />
                            </span>
                          ) : (
                            <BadgeSituacao situacao={item.novo.situacao} />
                          )}
                        </td>
                        <td className="py-2 px-3 text-xs text-gray-500 max-w-[320px]">
                          {item.tipo === 'novo' && 'Nova matrícula'}
                          {item.tipo === 'igual' && '—'}
                          {(item.tipo === 'situacao' || item.tipo === 'outros') &&
                            item.camposAlterados.map((c) => ROTULOS_CAMPOS[c] ?? c).join(', ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {itensPrevia.length > limitePrevia && (
                  <div className="p-3 text-center">
                    <button
                      type="button"
                      onClick={() => setLimitePrevia((l) => l + ITENS_PREVIA)}
                      className="text-sm font-semibold text-blue-700 hover:underline"
                    >
                      Mostrar mais ({itensPrevia.length - limitePrevia} restantes)
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500 py-4 text-center border border-gray-100 rounded-lg">
                Nenhum registro nesta categoria.
              </p>
            )}

            <div className="flex flex-wrap items-center justify-end gap-3 mt-4">
              {salvando && (
                <span className="text-sm text-gray-600">
                  Gravando {progresso.gravados} de {progresso.total}...
                </span>
              )}
              <button
                type="button"
                onClick={cancelarImportacao}
                disabled={salvando}
                className="px-4 py-2 text-sm font-semibold text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarImportacao}
                disabled={salvando || itensParaGravar.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-green-700 rounded-lg hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {salvando ? (
                  <LoaderCircle size={16} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={16} />
                )}
                {itensParaGravar.length === 0
                  ? 'Nada para atualizar'
                  : `Confirmar importação (${itensParaGravar.length})`}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Lista de alunos importados */}
      <section className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <Users size={20} className="text-blue-600" />
              Alunos da Secretaria
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {alunos.length} matrícula(s) importada(s)
              {ultimaImportacao ? ` — última atualização em ${ultimaImportacao}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => exportar('xlsx')}
              disabled={exportando || filtrados.length === 0}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-green-700 border border-green-200 rounded-lg hover:bg-green-50 disabled:opacity-50"
              title="Exporta a lista filtrada com todas as colunas"
            >
              <Download size={16} />
              Exportar XLSX
            </button>
            <button
              type="button"
              onClick={() => exportar('csv')}
              disabled={exportando || filtrados.length === 0}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-green-700 border border-green-200 rounded-lg hover:bg-green-50 disabled:opacity-50"
              title="Exporta a lista filtrada com todas as colunas"
            >
              <FileText size={16} />
              Exportar CSV
            </button>
            <button
              type="button"
              onClick={carregar}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-50"
            >
              <RefreshCw size={16} />
              Atualizar
            </button>
          </div>
        </div>

        <div className="grid gap-3 mb-4 md:grid-cols-[2fr_1fr_1fr_1fr]">
          <div className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg bg-gray-50">
            <Search size={18} className="text-gray-400" />
            <input
              type="text"
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                setPagina(1);
              }}
              placeholder="Buscar por nome ou código..."
              className="w-full bg-transparent outline-none text-sm text-gray-800"
            />
          </div>
          <select
            value={filtroPeriodo}
            onChange={(e) => {
              setFiltroPeriodo(e.target.value);
              setFiltroTurma('');
              setPagina(1);
            }}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50"
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
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50"
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
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50"
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

        {erroCarregamento && (
          <p className="mb-4 text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            {erroCarregamento}
          </p>
        )}

        {carregando && (
          <div className="flex items-center justify-center gap-2 py-12 text-gray-500">
            <LoaderCircle className="animate-spin" size={22} />
            Carregando alunos...
          </div>
        )}

        {!carregando && !erroCarregamento && filtrados.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Users size={40} className="mx-auto mb-3 text-gray-300" />
            <p className="font-medium">
              {alunos.length === 0 ? 'Nenhum aluno importado ainda' : 'Nenhum aluno encontrado'}
            </p>
            {alunos.length === 0 && (
              <p className="text-sm mt-1">
                Use o botão "Selecionar arquivo" acima para importar a listagem da Secretaria.
              </p>
            )}
          </div>
        )}

        {!carregando && filtrados.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-500 uppercase text-xs tracking-wide">
                    <th className="py-3 pr-3">Aluno</th>
                    <th className="py-3 pr-3">Nascimento</th>
                    <th className="py-3 pr-3">Período</th>
                    <th className="py-3 pr-3">Turma</th>
                    <th className="py-3 pr-3">Turno</th>
                    <th className="py-3 pr-3">Situação</th>
                    <th className="py-3 pr-3">Matrícula</th>
                    <th className="py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {paginados.map((aluno) => (
                    <tr key={aluno.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 pr-3 font-semibold text-gray-900">{aluno.nome}</td>
                      <td className="py-3 pr-3 text-gray-600 whitespace-nowrap">
                        {isoParaDataBR(aluno.data_nascimento) || '—'}
                      </td>
                      <td className="py-3 pr-3 text-gray-600 whitespace-nowrap">{aluno.periodo || '—'}</td>
                      <td className="py-3 pr-3 text-gray-600">{aluno.turma || '—'}</td>
                      <td className="py-3 pr-3 text-gray-600">{aluno.turno || '—'}</td>
                      <td className="py-3 pr-3">
                        <BadgeSituacao situacao={aluno.situacao} />
                      </td>
                      <td className="py-3 pr-3 text-gray-600">{aluno.codigo_matricula}</td>
                      <td className="py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setDetalhe(aluno)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-50"
                          >
                            <Eye size={14} />
                            Detalhes
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between mt-4 flex-wrap gap-2">
              <span className="text-xs text-gray-500">
                Mostrando {inicio + 1} até {Math.min(inicio + ITENS_POR_PAGINA, filtrados.length)} de{' '}
                {filtrados.length} registro(s)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPagina(Math.max(paginaSegura - 1, 1))}
                  disabled={paginaSegura === 1}
                  className="px-3 py-1.5 text-sm rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100"
                >
                  Anterior
                </button>
                <span className="text-sm text-gray-700">
                  Página {paginaSegura} de {totalPaginas}
                </span>
                <button
                  type="button"
                  onClick={() => setPagina(Math.min(paginaSegura + 1, totalPaginas))}
                  disabled={paginaSegura === totalPaginas}
                  className="px-3 py-1.5 text-sm rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100"
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
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 p-4"
          onClick={() => setDetalhe(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`Dados completos de ${detalhe.nome}`}
          >
            <div className="flex items-start justify-between gap-4 p-5 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{detalhe.nome}</h3>
                <p className="text-sm text-gray-500 mt-1 flex flex-wrap items-center gap-2">
                  Matrícula {detalhe.codigo_matricula}
                  {detalhe.periodo && <span>• {detalhe.periodo}</span>}
                  {detalhe.turma && <span>• Turma {detalhe.turma}</span>}
                  <BadgeSituacao situacao={detalhe.situacao} />
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetalhe(null)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Fechar"
              >
                <X size={20} />
              </button>
            </div>

            <div className="px-5 pt-3 flex items-center justify-between gap-3 flex-wrap">
              <label className="inline-flex items-center gap-2 text-sm text-gray-600">
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
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-50"
                >
                  <FileText size={14} />
                  Usar no Gerador de Históricos
                </button>
              )}
            </div>

            <dl className="p-5 overflow-y-auto grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {colunasDetalhe.map((coluna) => (
                <div key={coluna} className="border-b border-gray-50 pb-2">
                  <dt className="text-xs font-bold uppercase tracking-wide text-gray-500">{coluna}</dt>
                  <dd className="text-sm text-gray-900 break-words">{dadosDetalhe[coluna] || '—'}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}
