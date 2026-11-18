import { createClient } from '@supabase/supabase-js';

const client = createClient('https://cnaficxxzmqbyvplknbu.supabase.co', 'sb_publishable_E1SW88bZ9UMBj54-SFiTmw_ZQo8baPg');

async function testAll() {
  const possibleTables = [
    'alunos',
    'alunos_secretaria',
    'profissionais',
    'historicos_gerados',
    'memorias_ia',
    'configuracoes',
    'rematriculas_2027',
    'rematricula',
    'rematriculas',
    'matriculas'
  ];

  for (const t of possibleTables) {
    const { data, error } = await client.from(t).select('*').limit(1);
    console.log(`Table '${t}':`, error ? error.message : `OK (${data?.length} rows)`);
  }
}

testAll();
