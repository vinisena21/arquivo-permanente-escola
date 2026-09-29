import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Download,
  FileText,
  LoaderCircle,
  Pencil,
  Search,
  Trash2,
  RefreshCw,
  Upload,
  ExternalLink,
} from 'lucide-react';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { saveAs } from 'file-saver';
import {
  excluirHistoricoSalvo,
  formatarDataHora,
  listarHistoricosSalvos,
  uploadArquivoHistorico,
  type HistoricoSalvo,
} from '../lib/historicosSalvos';

interface HistoricosSalvosProps {
  onContinuarEditando?: (dados: Record<string, string>) => void;
}

const EXTENSOES_OK = ['.docx', '.doc', '.pdf'];

export default function HistoricosSalvos({
  onContinuarEditando,
}: HistoricosSalvosProps) {
  const [lista, setLista] = useState<HistoricoSalvo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [gerandoId, setGerandoId] = useState<string | null>(null);
  const [excluindoId, setExcluindoId] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [erroMsg, setErroMsg] = useState('');
  const inputArquivoRef = useRef<HTMLInputElement>(null);

  const buscarHistoricos = useCallback(
    () =>
      listarHistoricosSalvos()
        .then((dados) => {
          setLista(dados);
          setErroMsg('');
        })
        .catch((e) => {
          console.error(e);
          setErroMsg('Não foi possível carregar os históricos salvos.');
        })
        .finally(() => setCarregando(false)),
    []
  );

  useEffect(() => {
    buscarHistoricos();
  }, [buscarHistoricos]);

  const carregar = useCallback(() => {
    setCarregando(true);
    return buscarHistoricos();
  }, [buscarHistoricos]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase('pt-BR');
    if (!termo) return lista;
    return lista.filter(
      (h) =>
        h.nomeAluno.toLocaleLowerCase('pt-BR').includes(termo) ||
        h.tituloDocumento.toLocaleLowerCase('pt-BR').includes(termo) ||
        (h.nomeArquivo || '').toLocaleLowerCase('pt-BR').includes(termo)
    );
  }, [lista, busca]);

  async function regenerarDocx(item: HistoricoSalvo) {
    if (item.arquivoUrl && item.origem === 'upload') {
      window.open(item.arquivoUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    setGerandoId(item.id);
    setMensagem('');
    setErroMsg('');
    try {
      const response = await fetch('/modelo_historico.docx');
      if (!response.ok) throw new Error('Modelo não encontrado');

      const blob = await response.blob();
      const buffer = await blob.arrayBuffer();
      const zip = new PizZip(buffer);
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        nullGetter: () => '',
      });

      doc.render(item.dados);

      const out = doc.getZip().generate({
        type: 'blob',
        mimeType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      const nomeArquivo = item.nomeAluno
        ? item.nomeAluno.replace(/\s+/g, '_')
        : 'Aluno';
      saveAs(out, `Historico_${nomeArquivo}.docx`);
      setMensagem(`Documento de ${item.nomeAluno} baixado novamente.`);
    } catch (e) {
      console.error(e);
      setErroMsg('Erro ao regenerar o documento.');
    } finally {
      setGerandoId(null);
    }
  }

  function continuarEditando(item: HistoricoSalvo) {
    if (!onContinuarEditando) return;
    onContinuarEditando(item.dados);
  }

  async function excluir(item: HistoricoSalvo) {
    if (
      !window.confirm(
        `Excluir o histórico salvo de "${item.nomeAluno}"?\n\nEssa ação não pode ser desfeita.`
      )
    ) {
      return;
    }

    setExcluindoId(item.id);
    try {
      await excluirHistoricoSalvo(item.id);
      setLista((atual) => atual.filter((h) => h.id !== item.id));
      setMensagem('Histórico excluído.');
    } catch (e) {
      console.error(e);
      setErroMsg('Não foi possível excluir.');
    } finally {
      setExcluindoId(null);
    }
  }

  async function aoEscolherArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setEnviando(true);
    setMensagem('');
    setErroMsg('');

    let ok = 0;
    let falhas = 0;

    for (const file of Array.from(files)) {
      const lower = file.name.toLowerCase();
      if (!EXTENSOES_OK.some((ext) => lower.endsWith(ext))) {
        falhas += 1;
        continue;
      }
      try {
        const registro = await uploadArquivoHistorico(file);
        setLista((atual) => [registro, ...atual.filter((h) => h.id !== registro.id)]);
        ok += 1;
      } catch (err) {
        console.error(err);
        falhas += 1;
        setErroMsg(
          err instanceof Error ? err.message : 'Falha ao enviar arquivo para o Supabase.'
        );
      }
    }

    if (ok > 0) {
      setMensagem(
        ok === 1
          ? 'Arquivo enviado e salvo no banco de dados.'
          : `${ok} arquivos enviados e salvos no banco de dados.`
      );
    }
    if (falhas > 0 && ok === 0) {
      setErroMsg(
        (prev) =>
          prev ||
          `Nenhum arquivo válido. Use ${EXTENSOES_OK.join(', ')}.`
      );
    }

    setEnviando(false);
    if (inputArquivoRef.current) inputArquivoRef.current.value = '';
  }

  return (
    <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <FileText size={22} className="text-blue-700" />
            Históricos salvos
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Tudo fica gravado no Supabase. Você pode salvar pelo gerador, baixar de
            novo, continuar editando ou enviar arquivos (.docx / .pdf) diretamente
            aqui.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={inputArquivoRef}
            type="file"
            accept=".docx,.doc,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            multiple
            className="hidden"
            onChange={aoEscolherArquivo}
          />
          <button
            type="button"
            onClick={() => inputArquivoRef.current?.click()}
            disabled={enviando}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:opacity-60"
          >
            {enviando ? (
              <LoaderCircle size={16} className="animate-spin" />
            ) : (
              <Upload size={16} />
            )}
            {enviando ? 'Enviando...' : 'Enviar arquivo'}
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

      <div className="flex items-center gap-2 mb-4 px-3 py-2 border border-gray-200 rounded-lg bg-gray-50">
        <Search size={18} className="text-gray-400" />
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome do aluno, título ou arquivo..."
          className="w-full bg-transparent outline-none text-sm text-gray-800"
        />
      </div>

      {mensagem && (
        <p className="mb-4 text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          {mensagem}
        </p>
      )}
      {erroMsg && (
        <p className="mb-4 text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {erroMsg}
        </p>
      )}

      {carregando && (
        <div className="flex items-center justify-center gap-2 py-12 text-gray-500">
          <LoaderCircle className="animate-spin" size={22} />
          Carregando históricos...
        </div>
      )}

      {!carregando && filtrados.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <FileText size={40} className="mx-auto mb-3 text-gray-300" />
          <p className="font-medium">Nenhum histórico salvo ainda</p>
          <p className="text-sm mt-1">
            Use o botão &quot;Salvar&quot; no Gerador de Históricos ou envie um
            arquivo (.docx / .pdf) por aqui.
          </p>
        </div>
      )}

      {!carregando && filtrados.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500 uppercase text-xs tracking-wide">
                <th className="py-3 pr-3">Aluno</th>
                <th className="py-3 pr-3">Título / Arquivo</th>
                <th className="py-3 pr-3">Nascimento</th>
                <th className="py-3 pr-3">Salvo em</th>
                <th className="py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-gray-100 hover:bg-gray-50"
                >
                  <td className="py-3 pr-3 font-semibold text-gray-900">
                    {item.nomeAluno}
                    {item.origem === 'upload' && (
                      <span className="ml-2 text-[10px] uppercase tracking-wide font-bold text-violet-700 bg-violet-50 border border-violet-200 px-1.5 py-0.5 rounded">
                        upload
                      </span>
                    )}
                  </td>
                  <td
                    className="py-3 pr-3 text-gray-600 max-w-[240px] truncate"
                    title={item.tituloDocumento || item.nomeArquivo}
                  >
                    {item.tituloDocumento || item.nomeArquivo || '—'}
                  </td>
                  <td className="py-3 pr-3 text-gray-600">
                    {item.dataNascimento || '—'}
                  </td>
                  <td className="py-3 pr-3 text-gray-600 whitespace-nowrap">
                    {formatarDataHora(item.dataGeracao)}
                  </td>
                  <td className="py-3">
                    <div className="flex items-center justify-end gap-2 flex-wrap">
                      {onContinuarEditando && item.origem !== 'upload' && (
                        <button
                          type="button"
                          onClick={() => continuarEditando(item)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-50"
                          title="Abrir no gerador para continuar editando"
                        >
                          <Pencil size={14} />
                          Continuar
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => regenerarDocx(item)}
                        disabled={gerandoId === item.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-50 disabled:opacity-50"
                        title={
                          item.arquivoUrl
                            ? 'Abrir / baixar arquivo enviado'
                            : 'Baixar .docx novamente'
                        }
                      >
                        {gerandoId === item.id ? (
                          <LoaderCircle size={14} className="animate-spin" />
                        ) : item.arquivoUrl ? (
                          <ExternalLink size={14} />
                        ) : (
                          <Download size={14} />
                        )}
                        {item.arquivoUrl ? 'Abrir' : 'Baixar'}
                      </button>
                      <button
                        type="button"
                        onClick={() => excluir(item)}
                        disabled={excluindoId === item.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-700 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50"
                        title="Excluir registro"
                      >
                        {excluindoId === item.id ? (
                          <LoaderCircle size={14} className="animate-spin" />
                        ) : (
                          <Trash2 size={14} />
                        )}
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!carregando && filtrados.length > 0 && (
        <p className="mt-4 text-xs text-gray-400">
          {filtrados.length} registro(s)
          {busca ? ' encontrados' : ' no total'} · persistidos no Supabase
        </p>
      )}
    </section>
  );
}
