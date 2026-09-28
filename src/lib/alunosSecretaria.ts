import { supabase } from './supabase';
import type { AlunoSecretariaRow, Json } from '../types/database';
import type { AlunoParaHistorico, RegistroSecretaria } from './importacaoSecretaria';

const TABELA = 'alunos_secretaria';
const TAMANHO_PAGINA = 1000;
export const TAMANHO_LOTE_UPSERT = 200;

/** Carrega todos os registros da tabela (paginando de 1000 em 1000). */
export async function carregarAlunosSecretaria(): Promise<AlunoSecretariaRow[]> {
  const todos: AlunoSecretariaRow[] = [];
  let inicio = 0;

  while (true) {
    const { data, error } = await supabase
      .from(TABELA)
      .select('*')
      .order('nome', { ascending: true })
      .order('codigo_matricula', { ascending: true })
      .range(inicio, inicio + TAMANHO_PAGINA - 1);

    if (error) throw error;
    const lote = data ?? [];
    todos.push(...lote);
    if (lote.length < TAMANHO_PAGINA) break;
    inicio += TAMANHO_PAGINA;
  }

  return todos;
}

export type AlunoSecretariaResumo = AlunoParaHistorico & {
  id: number;
  codigo_matricula: string;
  codigo_estudante: string | null;
  turma: string | null;
  data_matricula: string | null;
};

/** Carrega somente os campos usados no preenchimento do Gerador de Histórico. */
export async function carregarAlunosParaHistorico(): Promise<AlunoSecretariaResumo[]> {
  const todos: AlunoSecretariaResumo[] = [];
  let inicio = 0;

  while (true) {
    const { data, error } = await supabase
      .from(TABELA)
      .select(
        'id, codigo_matricula, codigo_estudante, nome, data_nascimento, nacionalidade, naturalidade, uf_naturalidade, sexo, identidade, filiacao_1, filiacao_2, situacao, periodo, turma, data_matricula'
      )
      .order('nome', { ascending: true })
      .range(inicio, inicio + TAMANHO_PAGINA - 1);

    if (error) throw error;
    const lote = data ?? [];
    todos.push(...lote);
    if (lote.length < TAMANHO_PAGINA) break;
    inicio += TAMANHO_PAGINA;
  }

  return todos;
}

/**
 * Grava (insere ou atualiza) os registros em lotes, usando o código da
 * matrícula como chave. Registros do banco que não vieram no arquivo
 * NÃO são excluídos.
 */
export async function salvarAlunosSecretaria(
  registros: RegistroSecretaria[],
  aoProgredir?: (gravados: number, total: number) => void
): Promise<void> {
  const agora = new Date().toISOString();

  for (let i = 0; i < registros.length; i += TAMANHO_LOTE_UPSERT) {
    const lote = registros.slice(i, i + TAMANHO_LOTE_UPSERT).map((r) => ({
      ...r,
      dados: r.dados as Json,
      updated_at: agora,
    }));

    const { error } = await supabase
      .from(TABELA)
      .upsert(lote, { onConflict: 'codigo_matricula' });

    if (error) throw error;
    aoProgredir?.(Math.min(i + lote.length, registros.length), registros.length);
  }
}
