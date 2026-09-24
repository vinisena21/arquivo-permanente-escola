/**
 * Tipos gerados manualmente com base na estrutura da tabela `alunos` no Supabase.
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
