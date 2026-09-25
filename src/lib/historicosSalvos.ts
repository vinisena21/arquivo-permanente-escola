import { supabase } from './supabase';

const STORAGE_KEY = 'guia-escolar-historicos-gerados';

export interface HistoricoSalvo {
  id: string;
  nomeAluno: string;
  tituloDocumento: string;
  dataNascimento: string;
  dataGeracao: string; // ISO
  dados: Record<string, string>;
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
}

/** Salva o histórico no navegador e tenta gravar no Supabase (se a tabela existir). */
export async function salvarHistoricoGerado(
  dados: Record<string, string>
): Promise<HistoricoSalvo> {
  const registro: HistoricoSalvo = {
    id: gerarId(),
    nomeAluno: (dados.nome_aluno || 'Sem nome').trim(),
    tituloDocumento: (dados.historico_escolar || '').trim(),
    dataNascimento: (dados.data_nascimento || '').trim(),
    dataGeracao: new Date().toISOString(),
    dados: { ...dados },
  };

  const lista = lerLocal();
  lista.unshift(registro);
  // Mantém no máximo 200 registros locais
  escreverLocal(lista.slice(0, 200));

  // Tenta persistir no Supabase (opcional — não quebra se a tabela não existir)
  try {
    await supabase.from('historicos_gerados').insert({
      id_local: registro.id,
      nome_aluno: registro.nomeAluno,
      titulo_documento: registro.tituloDocumento,
      data_nascimento: registro.dataNascimento || null,
      data_geracao: registro.dataGeracao,
      dados: registro.dados,
    });
  } catch {
    // Tabela pode não existir ainda — ok
  }

  return registro;
}

/** Lista históricos salvos (local + tentativa Supabase). */
export async function listarHistoricosSalvos(): Promise<HistoricoSalvo[]> {
  const locais = lerLocal();

  try {
    const { data, error } = await supabase
      .from('historicos_gerados')
      .select('id_local, nome_aluno, titulo_documento, data_nascimento, data_geracao, dados')
      .order('data_geracao', { ascending: false })
      .limit(200);

    if (error || !data) return locais;

    const remotos: HistoricoSalvo[] = data.map((row: {
      id_local?: string;
      nome_aluno?: string;
      titulo_documento?: string;
      data_nascimento?: string | null;
      data_geracao?: string;
      dados?: Record<string, string>;
    }) => ({
      id: row.id_local || gerarId(),
      nomeAluno: row.nome_aluno || 'Sem nome',
      tituloDocumento: row.titulo_documento || '',
      dataNascimento: row.data_nascimento || '',
      dataGeracao: row.data_geracao || new Date().toISOString(),
      dados: (row.dados as Record<string, string>) || {},
    }));

    // Mescla por id, priorizando remoto
    const mapa = new Map<string, HistoricoSalvo>();
    for (const h of [...remotos, ...locais]) {
      if (!mapa.has(h.id)) mapa.set(h.id, h);
    }

    return Array.from(mapa.values()).sort(
      (a, b) =>
        new Date(b.dataGeracao).getTime() - new Date(a.dataGeracao).getTime()
    );
  } catch {
    return locais;
  }
}

/** Remove um histórico salvo (local + tenta Supabase). */
export async function excluirHistoricoSalvo(id: string): Promise<void> {
  const lista = lerLocal().filter((h) => h.id !== id);
  escreverLocal(lista);

  try {
    await supabase.from('historicos_gerados').delete().eq('id_local', id);
  } catch {
    // ignore
  }
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
