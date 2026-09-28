/**
 * Tipos gerados manualmente com base na estrutura das tabelas no Supabase.
 * Quando possível, gere automaticamente com:
 *   npx supabase gen types typescript --project-id SEU_PROJECT_ID > src/types/database.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      alunos: {
        Row: {
          id: number;
          nome: string;
          data_nascimento: string | null;
          codigo_pasta: string;
          numero: number;
          status: string;
        };
        Insert: {
          id?: number;
          nome: string;
          data_nascimento?: string | null;
          codigo_pasta: string;
          numero: number;
          status?: string;
        };
        Update: {
          id?: number;
          nome?: string;
          data_nascimento?: string | null;
          codigo_pasta?: string;
          numero?: number;
          status?: string;
        };
        Relationships: [];
      };
      historicos_gerados: {
        Row: {
          id: number;
          id_local: string;
          nome_aluno: string;
          titulo_documento: string | null;
          data_nascimento: string | null;
          data_geracao: string;
          dados: Json;
          created_at: string;
        };
        Insert: {
          id?: number;
          id_local: string;
          nome_aluno: string;
          titulo_documento?: string | null;
          data_nascimento?: string | null;
          data_geracao?: string;
          dados?: Json;
          created_at?: string;
        };
        Update: {
          id?: number;
          id_local?: string;
          nome_aluno?: string;
          titulo_documento?: string | null;
          data_nascimento?: string | null;
          data_geracao?: string;
          dados?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      alunos_secretaria: {
        Row: {
          id: number;
          codigo_matricula: string;
          codigo_estudante: string | null;
          ra: string | null;
          nome: string;
          data_nascimento: string | null;
          periodo: string | null;
          turma: string | null;
          descricao: string | null;
          turno: string | null;
          situacao: string | null;
          data_matricula: string | null;
          data_movimentacao: string | null;
          nacionalidade: string | null;
          naturalidade: string | null;
          uf_naturalidade: string | null;
          sexo: string | null;
          identidade: string | null;
          filiacao_1: string | null;
          filiacao_2: string | null;
          escola: string | null;
          dados: Json;
          importado_em: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          codigo_matricula: string;
          codigo_estudante?: string | null;
          ra?: string | null;
          nome: string;
          data_nascimento?: string | null;
          periodo?: string | null;
          turma?: string | null;
          descricao?: string | null;
          turno?: string | null;
          situacao?: string | null;
          data_matricula?: string | null;
          data_movimentacao?: string | null;
          nacionalidade?: string | null;
          naturalidade?: string | null;
          uf_naturalidade?: string | null;
          sexo?: string | null;
          identidade?: string | null;
          filiacao_1?: string | null;
          filiacao_2?: string | null;
          escola?: string | null;
          dados?: Json;
          importado_em?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          codigo_matricula?: string;
          codigo_estudante?: string | null;
          ra?: string | null;
          nome?: string;
          data_nascimento?: string | null;
          periodo?: string | null;
          turma?: string | null;
          descricao?: string | null;
          turno?: string | null;
          situacao?: string | null;
          data_matricula?: string | null;
          data_movimentacao?: string | null;
          nacionalidade?: string | null;
          naturalidade?: string | null;
          uf_naturalidade?: string | null;
          sexo?: string | null;
          identidade?: string | null;
          filiacao_1?: string | null;
          filiacao_2?: string | null;
          escola?: string | null;
          dados?: Json;
          importado_em?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

/** Tipo de uma linha da tabela alunos (como vem do banco) */
export type AlunoRow = Database['public']['Tables']['alunos']['Row'];

/** Tipo usado para inserir um novo aluno */
export type AlunoInsert = Database['public']['Tables']['alunos']['Insert'];

/** Tipo usado para atualizar um aluno */
export type AlunoUpdate = Database['public']['Tables']['alunos']['Update'];

/** Linha da tabela de históricos gerados */
export type HistoricoGeradoRow =
  Database['public']['Tables']['historicos_gerados']['Row'];

/**
 * Tipo usado na interface da aplicação (campos em camelCase + data formatada).
 */
export interface AlunoArquivo {
  id: number;
  nome: string;
  dataNascimento: string;
  codigoPasta: string;
  numero: number;
  status: string;
}

/** Linha da tabela alunos_secretaria (listagem importada do sistema municipal) */
export type AlunoSecretariaRow =
  Database['public']['Tables']['alunos_secretaria']['Row'];

/** Tipo usado para inserir/atualizar (upsert) alunos da secretaria */
export type AlunoSecretariaInsert =
  Database['public']['Tables']['alunos_secretaria']['Insert'];
