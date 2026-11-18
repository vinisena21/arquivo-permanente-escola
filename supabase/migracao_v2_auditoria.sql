-- ============================================================
-- MIGRAÇÃO V2: AUDITORIA, SOFT DELETE, ANO LETIVO E SEGURANÇA
-- Guia Escolar — Arquivo Permanente
-- Data: 18/11/2026
-- REGRA INVIOLÁVEL: 100% não-destrutivo. Não altera dados existentes.
-- ============================================================

-- 1. Soft Delete e Ano Letivo na tabela alunos_secretaria
ALTER TABLE public.alunos_secretaria 
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ano_letivo INTEGER DEFAULT 2026;

-- 2. Soft Delete e Ano Letivo na tabela profissionais
ALTER TABLE public.profissionais 
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ano_letivo INTEGER DEFAULT 2026;

-- 3. Soft Delete em rematriculas_2027 (proteção do módulo de rematrícula)
ALTER TABLE public.rematriculas_2027 
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by TEXT DEFAULT NULL;

-- 4. Soft Delete e Ano Letivo em historicos_gerados
ALTER TABLE public.historicos_gerados 
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ano_letivo INTEGER DEFAULT 2026;

-- 5. Constraint: Impedir dupla matrícula do mesmo estudante na mesma turma/escola/ano
-- Registros com deleted_at preenchido (inativos) são desconsiderados
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_estudante_turma_escola_ano
  ON public.alunos_secretaria (
    COALESCE(codigo_estudante, codigo_matricula),
    COALESCE(turma, ''),
    COALESCE(escola, ''),
    COALESCE(ano_letivo, 2026)
  )
  WHERE deleted_at IS NULL;

-- 6. Índices de performance para consultas com filtro temporal e de escola
CREATE INDEX IF NOT EXISTS idx_alunos_secretaria_ano_letivo ON public.alunos_secretaria (ano_letivo);
CREATE INDEX IF NOT EXISTS idx_alunos_secretaria_escola ON public.alunos_secretaria (escola);
CREATE INDEX IF NOT EXISTS idx_alunos_secretaria_deleted ON public.alunos_secretaria (deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profissionais_ano_letivo ON public.profissionais (ano_letivo);

-- 7. Tabela de controle de fechamento de períodos (trancamento de trimestres)
CREATE TABLE IF NOT EXISTS public.fechamento_periodos (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  escola TEXT NOT NULL,
  ano_letivo INTEGER NOT NULL DEFAULT 2026,
  trimestre INTEGER NOT NULL CHECK (trimestre BETWEEN 1 AND 3),
  turma TEXT,
  fechado BOOLEAN NOT NULL DEFAULT FALSE,
  fechado_em TIMESTAMPTZ,
  fechado_por TEXT,
  reaberto_em TIMESTAMPTZ,
  reaberto_por TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_unique_fechamento') THEN
    CREATE UNIQUE INDEX idx_unique_fechamento ON public.fechamento_periodos (escola, ano_letivo, trimestre, COALESCE(turma, '__GLOBAL__'));
  END IF;
END $$;

ALTER TABLE public.fechamento_periodos ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'fechamento_periodos' AND policyname = 'fechamento_select') THEN
    CREATE POLICY fechamento_select ON public.fechamento_periodos FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'fechamento_periodos' AND policyname = 'fechamento_all') THEN
    CREATE POLICY fechamento_all ON public.fechamento_periodos FOR ALL TO authenticated USING (true);
  END IF;
END $$;

-- 8. Tabela de logs de auditoria (rastreabilidade de exclusões e alterações)
CREATE TABLE IF NOT EXISTS public.audit_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tabela TEXT NOT NULL,
  registro_id BIGINT,
  acao TEXT NOT NULL,
  dados_anteriores JSONB,
  dados_novos JSONB,
  usuario TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'audit_log' AND policyname = 'audit_select') THEN
    CREATE POLICY audit_select ON public.audit_log FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'audit_log' AND policyname = 'audit_insert') THEN
    CREATE POLICY audit_insert ON public.audit_log FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;

-- 9. Views para registros ativos (filtrando soft-deleted)
CREATE OR REPLACE VIEW public.alunos_secretaria_ativos AS 
  SELECT * FROM public.alunos_secretaria WHERE deleted_at IS NULL;

CREATE OR REPLACE VIEW public.profissionais_ativos AS 
  SELECT * FROM public.profissionais WHERE deleted_at IS NULL;

-- 10. Trigger de auto-atualização do updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at() 
RETURNS TRIGGER AS $$ 
BEGIN 
  NEW.updated_at = NOW(); 
  RETURN NEW; 
END; 
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS fechamento_periodos_updated_at ON public.fechamento_periodos;
CREATE TRIGGER fechamento_periodos_updated_at 
  BEFORE UPDATE ON public.fechamento_periodos 
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
