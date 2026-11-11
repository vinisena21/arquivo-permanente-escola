-- =====================================================================
-- CRIAÇÃO APENAS DAS TABELAS E PERMISSÕES (RÁPIDO)
-- =====================================================================

-- Execute este SQL no painel do Supabase (SQL Editor) ANTES de usar a aba
-- "Alunos da Secretaria". Ele cria a tabela que recebe a Listagem de
-- Matrícula exportada do sistema municipal (EL Sistemas).
--
-- Cada linha da planilha corresponde a UMA matrícula (coluna "Código").
-- Um mesmo estudante ("Código do estudante") pode ter mais de uma matrícula
-- (ex.: transferido e depois rematriculado).
--
-- As colunas principais ficam tipadas; TODAS as colunas da planilha ficam
-- guardadas na coluna jsonb "dados", chaveadas pelo nome do cabeçalho.

create table if not exists public.alunos_secretaria (
  id bigint generated always as identity primary key,
  codigo_matricula text not null unique,       -- "Código"
  codigo_estudante text,                       -- "Código do estudante"
  ra text,                                     -- "Registro do estudante (RA)"
  nome text not null,
  data_nascimento date,
  periodo text,                                -- ex.: "3º ANO"
  turma text,
  descricao text,
  turno text,
  situacao text,                               -- NORMAL, TRANSFERIDO, CLASSIFICADO, DESISTENTE...
  data_matricula date,
  data_movimentacao date,
  nacionalidade text,
  naturalidade text,                           -- apenas a cidade
  uf_naturalidade text,                        -- sigla (MG, SP...)
  sexo text,
  identidade text,
  filiacao_1 text,
  filiacao_2 text,
  escola text,
  dados jsonb not null default '{}'::jsonb,    -- todas as colunas da planilha
  importado_em timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists alunos_secretaria_codigo_estudante_idx
  on public.alunos_secretaria (codigo_estudante);

create index if not exists alunos_secretaria_nome_idx
  on public.alunos_secretaria (nome);

create index if not exists alunos_secretaria_situacao_idx
  on public.alunos_secretaria (situacao);

-- Mantém updated_at atualizado em toda alteração
create or replace function public.alunos_secretaria_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists alunos_secretaria_updated_at on public.alunos_secretaria;
create trigger alunos_secretaria_updated_at
  before update on public.alunos_secretaria
  for each row execute function public.alunos_secretaria_set_updated_at();

-- Políticas RLS (somente usuários autenticados)
alter table public.alunos_secretaria enable row level security;

drop policy if exists "Usuários autenticados podem ler alunos da secretaria"
  on public.alunos_secretaria;
create policy "Usuários autenticados podem ler alunos da secretaria"
  on public.alunos_secretaria
  for select
  to authenticated
  using (true);

drop policy if exists "Usuários autenticados podem inserir alunos da secretaria"
  on public.alunos_secretaria;
create policy "Usuários autenticados podem inserir alunos da secretaria"
  on public.alunos_secretaria
  for insert
  to authenticated
  with check (true);

drop policy if exists "Usuários autenticados podem atualizar alunos da secretaria"
  on public.alunos_secretaria;
create policy "Usuários autenticados podem atualizar alunos da secretaria"
  on public.alunos_secretaria
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Usuários autenticados podem excluir alunos da secretaria"
  on public.alunos_secretaria;
create policy "Usuários autenticados podem excluir alunos da secretaria"
  on public.alunos_secretaria
  for delete
  to authenticated
  using (true);


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
