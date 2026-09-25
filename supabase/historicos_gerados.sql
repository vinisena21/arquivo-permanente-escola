-- Execute este SQL no painel do Supabase (SQL Editor)
-- para salvar os históricos também no banco (além do navegador).

create table if not exists public.historicos_gerados (
  id bigint generated always as identity primary key,
  id_local text not null,
  nome_aluno text not null,
  titulo_documento text,
  data_nascimento text,
  data_geracao timestamptz not null default now(),
  dados jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists historicos_gerados_data_geracao_idx
  on public.historicos_gerados (data_geracao desc);

create index if not exists historicos_gerados_id_local_idx
  on public.historicos_gerados (id_local);

-- Políticas RLS (ajuste conforme sua autenticação)
alter table public.historicos_gerados enable row level security;

create policy "Usuários autenticados podem ler históricos"
  on public.historicos_gerados
  for select
  to authenticated
  using (true);

create policy "Usuários autenticados podem inserir históricos"
  on public.historicos_gerados
  for insert
  to authenticated
  with check (true);

create policy "Usuários autenticados podem excluir históricos"
  on public.historicos_gerados
  for delete
  to authenticated
  using (true);
