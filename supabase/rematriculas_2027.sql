-- ========================================================
-- Tabela Oficial de Controle de Rematrículas 2027
-- E.M. MARIA GERALDA MIRANDA BRITO SALOMÃO
-- ========================================================

create table if not exists public.rematriculas_2027 (
  id bigint generated always as identity primary key,
  codigo_matricula text not null unique,
  nome text not null,
  turma_atual text,
  turma_2027 text,
  turno_2027 text not null default 'MAT', -- 'MAT' ou 'VESP'
  confirmado boolean not null default true,
  data_nascimento text,
  responsavel text,
  observacoes text,
  confirmado_em timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Índices para buscas ultrarrápidas
create index if not exists idx_rematriculas_2027_matricula on public.rematriculas_2027 (codigo_matricula);
create index if not exists idx_rematriculas_2027_turma on public.rematriculas_2027 (turma_atual);
create index if not exists idx_rematriculas_2027_turno on public.rematriculas_2027 (turno_2027);

-- Habilita Row Level Security
alter table public.rematriculas_2027 enable row level security;

-- Políticas de Acesso
drop policy if exists "Permitir leitura de rematrículas para autenticados" on public.rematriculas_2027;
create policy "Permitir leitura de rematrículas para autenticados"
  on public.rematriculas_2027 for select
  to authenticated
  using (true);

drop policy if exists "Permitir gravação de rematrículas para autenticados" on public.rematriculas_2027;
create policy "Permitir gravação de rematrículas para autenticados"
  on public.rematriculas_2027 for all
  to authenticated
  using (true)
  with check (true);
