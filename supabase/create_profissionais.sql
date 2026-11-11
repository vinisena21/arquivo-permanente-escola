-- Criação da tabela de profissionais escolares / professores
CREATE TABLE IF NOT EXISTS public.profissionais (
  id BIGSERIAL PRIMARY KEY,
  codigo TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  cpf TEXT,
  data_nascimento DATE,
  idade INTEGER,
  sexo TEXT,
  cor TEXT,
  contato TEXT,
  email TEXT,
  municipio TEXT,
  escolaridade TEXT,
  curso_superior TEXT,
  instituicao TEXT,
  ativo TEXT DEFAULT 'Sim',
  dados JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ativar RLS
ALTER TABLE public.profissionais ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "Permitir leitura para autenticados" ON public.profissionais
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Permitir insercao/atualizacao para autenticados" ON public.profissionais
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
