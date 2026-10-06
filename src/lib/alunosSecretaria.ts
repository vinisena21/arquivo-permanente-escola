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

/** Dados mínimos para cadastro manual de aluno da secretaria. */
export type NovoAlunoSecretaria = {
  codigo_matricula: string;
  nome: string;
  data_nascimento?: string | null;
  codigo_estudante?: string | null;
  periodo?: string | null;
  turma?: string | null;
  turno?: string | null;
  situacao?: string | null;
  nacionalidade?: string | null;
  naturalidade?: string | null;
  uf_naturalidade?: string | null;
  sexo?: string | null;
  filiacao_1?: string | null;
  filiacao_2?: string | null;
};

/** Insere um aluno da secretaria manualmente (não sobrescreve matrícula existente). */
export async function inserirAlunoSecretaria(
  aluno: NovoAlunoSecretaria
): Promise<AlunoSecretariaRow> {
  const agora = new Date().toISOString();
  const nome = aluno.nome.trim().replace(/\s+/g, ' ').toLocaleUpperCase('pt-BR');
  const codigo = aluno.codigo_matricula.trim();

  if (!nome) throw new Error('Informe o nome do aluno.');
  if (!codigo) throw new Error('Informe o código da matrícula.');

  const { data: existentes, error: erroConsulta } = await supabase
    .from(TABELA)
    .select('id')
    .eq('codigo_matricula', codigo)
    .limit(1);

  if (erroConsulta) throw erroConsulta;
  if (existentes && existentes.length > 0) {
    throw new Error(`Já existe aluno com a matrícula ${codigo}.`);
  }

  const dados: Record<string, string | null> = {
    Código: codigo,
    Nome: nome,
    'Código do estudante': aluno.codigo_estudante?.trim() || null,
    'Data de Nascimento': aluno.data_nascimento
      ? aluno.data_nascimento.includes('-')
        ? aluno.data_nascimento.split('-').reverse().join('/')
        : aluno.data_nascimento
      : null,
    Período: aluno.periodo?.trim() || null,
    Turma: aluno.turma?.trim() || null,
    Turno: aluno.turno?.trim() || null,
    Situação: aluno.situacao?.trim() || null,
    Nacionalidade: aluno.nacionalidade?.trim() || null,
    Naturalidade: aluno.naturalidade?.trim() || null,
    'UF da naturalidade': aluno.uf_naturalidade?.trim() || null,
    Sexo: aluno.sexo?.trim() || null,
    'Filiação 1': aluno.filiacao_1?.trim() || null,
    'Filiação 2': aluno.filiacao_2?.trim() || null,
  };

  const payload = {
    codigo_matricula: codigo,
    codigo_estudante: aluno.codigo_estudante?.trim() || null,
    nome,
    data_nascimento: aluno.data_nascimento || null,
    periodo: aluno.periodo?.trim() || null,
    turma: aluno.turma?.trim() || null,
    turno: aluno.turno?.trim() || null,
    situacao: aluno.situacao?.trim() || 'NORMAL',
    nacionalidade: aluno.nacionalidade?.trim() || null,
    naturalidade: aluno.naturalidade?.trim() || null,
    uf_naturalidade: aluno.uf_naturalidade?.trim() || null,
    sexo: aluno.sexo?.trim() || null,
    filiacao_1: aluno.filiacao_1?.trim() || null,
    filiacao_2: aluno.filiacao_2?.trim() || null,
    dados: dados as Json,
    importado_em: agora,
    updated_at: agora,
  };

  const { data, error } = await supabase
    .from(TABELA)
    .insert(payload)
    .select('*')
    .single();

  if (error) throw error;
  return data as AlunoSecretariaRow;
}

/** Exclui um registro de aluno da secretaria pelo id. */
export async function excluirAlunoSecretaria(id: number): Promise<void> {
  const { error } = await supabase.from(TABELA).delete().eq('id', id);
  if (error) throw error;
}

/** Campos editáveis de um aluno da secretaria (colunas tipadas). */
export type AlunoSecretariaEditavel = {
  id: number;
  codigo_matricula: string;
  codigo_estudante: string | null;
  nome: string;
  data_nascimento: string | null;
  periodo: string | null;
  turma: string | null;
  turno: string | null;
  situacao: string | null;
  nacionalidade: string | null;
  naturalidade: string | null;
  uf_naturalidade: string | null;
  sexo: string | null;
  identidade: string | null;
  filiacao_1: string | null;
  filiacao_2: string | null;
};

/**
 * Atualiza as colunas tipadas de um aluno da secretaria e sincroniza
 * o objeto JSON `dados` para manter consistência com a importação.
 */
export async function atualizarAlunoSecretaria(
  aluno: AlunoSecretariaEditavel,
  dadosAtuais: Json
): Promise<AlunoSecretariaRow> {
  const agora = new Date().toISOString();

  const dadosBase: Record<string, string | null> =
    dadosAtuais && typeof dadosAtuais === 'object' && !Array.isArray(dadosAtuais)
      ? Object.fromEntries(
          Object.entries(dadosAtuais as Record<string, unknown>).map(([k, v]) => [
            k,
            v === null || v === undefined ? null : String(v),
          ])
        )
      : {};

  const mapaRotulos: Record<string, string | null> = {
    'Código': aluno.codigo_matricula,
    'Código do estudante': aluno.codigo_estudante,
    'Nome': aluno.nome,
    'Data de Nascimento': aluno.data_nascimento
      ? aluno.data_nascimento.includes('-')
        ? aluno.data_nascimento.split('-').reverse().join('/')
        : aluno.data_nascimento
      : null,
    'Período': aluno.periodo,
    'Turma': aluno.turma,
    'Turno': aluno.turno,
    'Situação': aluno.situacao,
    'Nacionalidade': aluno.nacionalidade,
    'Naturalidade': aluno.naturalidade,
    'UF da naturalidade': aluno.uf_naturalidade,
    'Sexo': aluno.sexo,
    'Identidade': aluno.identidade,
    'Filiação 1': aluno.filiacao_1,
    'Filiação 2': aluno.filiacao_2,
  };

  for (const [rotulo, valor] of Object.entries(mapaRotulos)) {
    if (valor !== undefined) {
      dadosBase[rotulo] = valor;
    }
  }

  const payload = {
    codigo_matricula: aluno.codigo_matricula.trim(),
    codigo_estudante: aluno.codigo_estudante?.trim() || null,
    nome: aluno.nome.trim().replace(/\s+/g, ' ').toLocaleUpperCase('pt-BR'),
    data_nascimento: aluno.data_nascimento || null,
    periodo: aluno.periodo?.trim() || null,
    turma: aluno.turma?.trim() || null,
    turno: aluno.turno?.trim() || null,
    situacao: aluno.situacao?.trim() || null,
    nacionalidade: aluno.nacionalidade?.trim() || null,
    naturalidade: aluno.naturalidade?.trim() || null,
    uf_naturalidade: aluno.uf_naturalidade?.trim() || null,
    sexo: aluno.sexo?.trim() || null,
    identidade: aluno.identidade?.trim() || null,
    filiacao_1: aluno.filiacao_1?.trim() || null,
    filiacao_2: aluno.filiacao_2?.trim() || null,
    dados: dadosBase as Json,
    updated_at: agora,
  };

  const { data, error } = await supabase
    .from(TABELA)
    .update(payload)
    .eq('id', aluno.id)
    .select('*')
    .single();

  if (error) throw error;
  return data as AlunoSecretariaRow;
}

/**
 * Indica se o erro do Supabase/PostgREST é de tabela inexistente
 * (o SQL supabase/alunos_secretaria.sql ainda não foi executado).
 */
export function ehErroTabelaAusente(erro: unknown): boolean {
  if (!erro || typeof erro !== 'object') return false;
  const { code, message } = erro as { code?: unknown; message?: unknown };
  if (code === '42P01' || code === 'PGRST205') return true;
  const texto = typeof message === 'string' ? message : '';
  return /relation .* does not exist|could not find the table/i.test(texto);
}
