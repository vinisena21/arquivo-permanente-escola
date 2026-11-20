import json
import os

oficiais_path = r'C:\Users\USER\OneDrive\Área de Trabalho\Site Arquivo Permanente\src\data\rematriculas_2027_oficiais.json'
with open(oficiais_path, 'r', encoding='utf-8') as f:
    oficiais = json.load(f)

total_oficiais = len(oficiais)
sql = f"""-- ====================================================================
-- CONFIGURAÇÃO COMPLETA E PERMISSÕES DIRETAS NO SUPABASE
-- Execute este script no SQL Editor do Supabase (apenas 1 clique em Run)
-- Ele cria todas as tabelas, libera as permissões de gravação direta e
-- já insere permanentemente os {total_oficiais} alunos rematriculados oficiais de 2027!
-- ====================================================================

-- 1. TABELA rematriculas_2027
CREATE TABLE IF NOT EXISTS public.rematriculas_2027 (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo_matricula TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  turma_atual TEXT,
  turma_2027 TEXT,
  turno_2027 TEXT NOT NULL DEFAULT 'MAT',
  confirmado BOOLEAN NOT NULL DEFAULT TRUE,
  data_nascimento TEXT,
  responsavel TEXT,
  observacoes TEXT,
  confirmado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_rematriculas_2027_matricula ON public.rematriculas_2027 (codigo_matricula);
CREATE INDEX IF NOT EXISTS idx_rematriculas_2027_turno ON public.rematriculas_2027 (turno_2027);

-- Habilita RLS e concede permissões para a aplicação web gravar em tempo real
ALTER TABLE public.rematriculas_2027 ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permissao_Geral_Leitura_rematriculas_2027" ON public.rematriculas_2027;
CREATE POLICY "Permissao_Geral_Leitura_rematriculas_2027" ON public.rematriculas_2027 FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Permissao_Geral_Gravacao_rematriculas_2027" ON public.rematriculas_2027;
CREATE POLICY "Permissao_Geral_Gravacao_rematriculas_2027" ON public.rematriculas_2027 FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 2. AJUSTES NA TABELA alunos_secretaria (Colunas de Soft Delete e Ano Letivo)
CREATE TABLE IF NOT EXISTS public.alunos_secretaria (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo_matricula TEXT NOT NULL UNIQUE,
  codigo_estudante TEXT,
  ra TEXT,
  nome TEXT NOT NULL,
  data_nascimento DATE,
  periodo TEXT,
  turma TEXT,
  descricao TEXT,
  turno TEXT,
  situacao TEXT,
  data_matricula DATE,
  data_movimentacao DATE,
  nacionalidade TEXT,
  naturalidade TEXT,
  uf_naturalidade TEXT,
  sexo TEXT,
  identidade TEXT,
  filiacao_1 TEXT,
  filiacao_2 TEXT,
  escola TEXT,
  dados JSONB NOT NULL DEFAULT '{{}}'::jsonb,
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  deleted_by TEXT DEFAULT NULL,
  ano_letivo INTEGER DEFAULT 2026,
  importado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.alunos_secretaria ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.alunos_secretaria ADD COLUMN IF NOT EXISTS deleted_by TEXT DEFAULT NULL;
ALTER TABLE public.alunos_secretaria ADD COLUMN IF NOT EXISTS ano_letivo INTEGER DEFAULT 2026;

-- Concede permissões para a aplicação web gravar em tempo real na alunos_secretaria
ALTER TABLE public.alunos_secretaria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permissao_Geral_Leitura_alunos_secretaria" ON public.alunos_secretaria;
CREATE POLICY "Permissao_Geral_Leitura_alunos_secretaria" ON public.alunos_secretaria FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Permissao_Geral_Gravacao_alunos_secretaria" ON public.alunos_secretaria;
CREATE POLICY "Permissao_Geral_Gravacao_alunos_secretaria" ON public.alunos_secretaria FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 3. TABELA fechamento_periodos (Trancamento de Trimestres)
CREATE TABLE IF NOT EXISTS public.fechamento_periodos (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  escola TEXT NOT NULL,
  ano_letivo INTEGER NOT NULL,
  trimestre INTEGER NOT NULL,
  fechado BOOLEAN NOT NULL DEFAULT TRUE,
  fechado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fechado_por TEXT NOT NULL DEFAULT 'secretaria',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (escola, ano_letivo, trimestre)
);

ALTER TABLE public.fechamento_periodos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permissao_Geral_fechamento_periodos" ON public.fechamento_periodos;
CREATE POLICY "Permissao_Geral_fechamento_periodos" ON public.fechamento_periodos FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 4. CARGA PERMANENTE DOS {total_oficiais} ALUNOS REMATRICULADOS DE 2027
"""

valores = []
for cod, r in oficiais.items():
    nome_escapado = r['nome'].replace("'", "''")
    turma_escapada = (r.get('turma2027') or '').replace("'", "''")
    turno = r.get('turno2027', 'MAT')
    valores.append(f"('{cod}', '{nome_escapado}', '{turma_escapada}', '{turno}', true, '2026-11-19 12:09:00+00')")

sql += "INSERT INTO public.rematriculas_2027 (codigo_matricula, nome, turma_2027, turno_2027, confirmado, confirmado_em)\nVALUES\n  "
sql += ",\n  ".join(valores)
sql += """\nON CONFLICT (codigo_matricula) DO UPDATE SET
  nome = EXCLUDED.nome,
  turma_2027 = EXCLUDED.turma_2027,
  turno_2027 = EXCLUDED.turno_2027,
  confirmado = EXCLUDED.confirmado,
  confirmado_em = EXCLUDED.confirmado_em,
  updated_at = NOW();\n\n"""

sql += f"""-- Mensagem de confirmação
SELECT 'Configuração e carga de {total_oficiais} rematrículas 2027 concluída com sucesso!' AS status;
"""

out_path = r'C:\Users\USER\OneDrive\Área de Trabalho\Site Arquivo Permanente\supabase\CONFIGURACAO_COMPLETA_AUTOMATICA.sql'
with open(out_path, 'w', encoding='utf-8') as f:
    f.write(sql)

print('Script SQL gerado com sucesso em:', out_path)
