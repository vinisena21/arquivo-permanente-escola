import { supabase } from './supabase';
import type { Json } from '../types/database';

const STORAGE_KEY = 'guia-escolar-historicos-gerados';
const BUCKET_ARQUIVOS = 'historicos-arquivos';

export interface HistoricoSalvo {
  id: string;
  nomeAluno: string;
  tituloDocumento: string;
  dataNascimento: string;
  dataGeracao: string; // ISO
  dados: Record<string, string>;
  /** URL pública ou assinada do arquivo enviado (docx/pdf) */
  arquivoUrl?: string;
  /** Nome original do arquivo enviado */
  nomeArquivo?: string;
  /** Origem: gerado no formulário ou upload manual */
  origem?: 'gerado' | 'upload';
}

function gerarId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function lerLocal(): HistoricoSalvo[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HistoricoSalvo[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function escreverLocal(lista: HistoricoSalvo[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lista.slice(0, 300)));
  } catch {
    // quota cheia — ignora cache local
  }
}

function dadosComoRecord(valor: Json | null | undefined): Record<string, string> {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) {
    return {};
  }
  const resultado: Record<string, string> = {};
  for (const [chave, item] of Object.entries(valor)) {
    if (item === null || item === undefined) continue;
    resultado[chave] = String(item);
  }
  return resultado;
}

function rowParaHistorico(row: {
  id_local?: string | null;
  nome_aluno?: string | null;
  titulo_documento?: string | null;
  data_nascimento?: string | null;
  data_geracao?: string | null;
  dados?: Json | null;
}): HistoricoSalvo {
  const dados = dadosComoRecord(row.dados);
  return {
    id: row.id_local || gerarId(),
    nomeAluno: row.nome_aluno || dados.nome_aluno || 'Sem nome',
    tituloDocumento: row.titulo_documento || dados.historico_escolar || '',
    dataNascimento: row.data_nascimento || dados.data_nascimento || '',
    dataGeracao: row.data_geracao || new Date().toISOString(),
    dados,
    arquivoUrl: dados.arquivo_url || undefined,
    nomeArquivo: dados.nome_arquivo || undefined,
    origem: (dados.origem as 'gerado' | 'upload') || (dados.arquivo_url ? 'upload' : 'gerado'),
  };
}

/**
 * Grava no Supabase (fonte da verdade) e mantém cache no localStorage.
 * Falha se o Supabase rejeitar — assim o usuário sabe que não persistiu.
 */
export async function salvarHistoricoGerado(
  dados: Record<string, string>,
  extras?: { arquivoUrl?: string; nomeArquivo?: string; origem?: 'gerado' | 'upload' }
): Promise<HistoricoSalvo> {
  const origem = extras?.origem || (extras?.arquivoUrl ? 'upload' : 'gerado');
  const dadosCompletos: Record<string, string> = {
    ...dados,
    ...(extras?.arquivoUrl ? { arquivo_url: extras.arquivoUrl } : {}),
    ...(extras?.nomeArquivo ? { nome_arquivo: extras.nomeArquivo } : {}),
    origem,
  };

  const registro: HistoricoSalvo = {
    id: gerarId(),
    nomeAluno: (dadosCompletos.nome_aluno || extras?.nomeArquivo || 'Sem nome').trim(),
    tituloDocumento: (dadosCompletos.historico_escolar || extras?.nomeArquivo || '').trim(),
    dataNascimento: (dadosCompletos.data_nascimento || '').trim(),
    dataGeracao: new Date().toISOString(),
    dados: dadosCompletos,
    arquivoUrl: extras?.arquivoUrl,
    nomeArquivo: extras?.nomeArquivo,
    origem,
  };

  const { error } = await supabase.from('historicos_gerados').insert({
    id_local: registro.id,
    nome_aluno: registro.nomeAluno,
    titulo_documento: registro.tituloDocumento || null,
    data_nascimento: registro.dataNascimento || null,
    data_geracao: registro.dataGeracao,
    dados: registro.dados as Json,
  });

  if (error) {
    const lista = lerLocal();
    lista.unshift(registro);
    escreverLocal(lista);
    throw new Error(
      error.message ||
        'Não foi possível salvar no banco de dados (Supabase). Verifique a tabela historicos_gerados.'
    );
  }

  const lista = lerLocal();
  lista.unshift(registro);
  escreverLocal(lista);

  return registro;
}

/** Lista históricos: prioriza Supabase e mescla com cache local. */
export async function listarHistoricosSalvos(): Promise<HistoricoSalvo[]> {
  const locais = lerLocal();

  try {
    const { data, error } = await supabase
      .from('historicos_gerados')
      .select('id_local, nome_aluno, titulo_documento, data_nascimento, data_geracao, dados')
      .order('data_geracao', { ascending: false })
      .limit(300);

    if (error || !data) {
      if (error) console.warn('listarHistoricosSalvos Supabase:', error.message);
      return locais;
    }

    const remotos = data.map((row) => rowParaHistorico(row));
    const mapa = new Map<string, HistoricoSalvo>();
    for (const h of [...remotos, ...locais]) {
      if (!mapa.has(h.id)) mapa.set(h.id, h);
    }

    return Array.from(mapa.values()).sort(
      (a, b) => new Date(b.dataGeracao).getTime() - new Date(a.dataGeracao).getTime()
    );
  } catch (e) {
    console.warn('listarHistoricosSalvos:', e);
    return locais;
  }
}

/** Remove do Supabase e do cache local. */
export async function excluirHistoricoSalvo(id: string): Promise<void> {
  const lista = lerLocal().filter((h) => h.id !== id);
  escreverLocal(lista);

  const { error } = await supabase.from('historicos_gerados').delete().eq('id_local', id);
  if (error) {
    console.warn('excluirHistoricoSalvo:', error.message);
  }
}

/**
 * Envia um arquivo (docx/pdf) para o Storage e registra em historicos_gerados.
 * Bucket sugerido: historicos-arquivos (público ou com políticas de leitura autenticada).
 */
export async function uploadArquivoHistorico(
  arquivo: File,
  meta?: { nomeAluno?: string; tituloDocumento?: string }
): Promise<HistoricoSalvo> {
  const extensao = arquivo.name.split('.').pop()?.toLowerCase() || 'bin';
  const id = gerarId();
  const caminho = `${id}/${arquivo.name.replace(/[^\w.\-À-ÿ ]+/gi, '_')}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_ARQUIVOS)
    .upload(caminho, arquivo, {
      cacheControl: '3600',
      upsert: false,
      contentType: arquivo.type || undefined,
    });

  if (uploadError) {
    throw new Error(
      uploadError.message.includes('Bucket not found')
        ? 'Bucket "historicos-arquivos" não existe no Supabase. Crie o bucket e tente de novo.'
        : `Falha no upload: ${uploadError.message}`
    );
  }

  const { data: urlData } = supabase.storage.from(BUCKET_ARQUIVOS).getPublicUrl(caminho);
  const arquivoUrl = urlData?.publicUrl || caminho;

  const nomeBase = arquivo.name.replace(/\.[^.]+$/, '');
  const dados: Record<string, string> = {
    nome_aluno: (meta?.nomeAluno || nomeBase).trim(),
    historico_escolar: (meta?.tituloDocumento || arquivo.name).trim(),
    nome_arquivo: arquivo.name,
    arquivo_url: arquivoUrl,
    tipo_arquivo: extensao,
    origem: 'upload',
  };

  return salvarHistoricoGerado(dados, {
    arquivoUrl,
    nomeArquivo: arquivo.name,
    origem: 'upload',
  });
}

export function formatarDataHora(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}
