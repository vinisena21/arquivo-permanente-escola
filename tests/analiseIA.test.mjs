import test from 'node:test';
import assert from 'node:assert/strict';
import { criarHandler } from '../api/analisar-historico.ts';
import { criarAnos } from '../src/lib/conferenciaHistorico.ts';
import { criarDocumento } from '../src/lib/preenchimentoHistorico.ts';
import { verificarEvidencias } from '../src/lib/contratoAnaliseIA.ts';

const env = { OPENAI_API_KEY: 'chave-ficticia-de-teste', IA_EMAILS_AUTORIZADOS: 'secretaria@example.invalid', VITE_SUPABASE_URL: 'https://teste.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'chave-publica-ficticia' };
const pedido = { paginas: [{ lado: 'Frente', texto: 'Nome: Aluno Teste' }, { lado: 'Verso', texto: 'Carga horária 800:00' }], documento: criarDocumento(), anos: criarAnos(), regimento: '' };
const resultado = { resumo: 'Pendências documentais para revisão.', achados: [], pendencias: ['Conferir normas locais.'] };
function setup(overrides = {}) {
  let chamadas = 0;
  const handler = criarHandler({ env, fetcher: async () => new Response(JSON.stringify({ id: 'usuario-teste', email: 'secretaria@example.invalid' }), { status: 200 }), analisar: async () => { chamadas++; return resultado; }, ...overrides });
  return { handler, chamadas: () => chamadas };
}
async function chamar(handler, req = {}) {
  let json;
  const res = { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(value) { json = JSON.parse(value); } };
  await handler({ method: 'POST', headers: { host: 'guia-escolar.vercel.app', origin: 'https://guia-escolar.vercel.app', 'content-type': 'application/json', authorization: 'Bearer token-ficticio-autenticado' }, body: pedido, ...req }, res);
  return { status: res.statusCode, json, headers: res.headers };
}
test('sem chave e allowlist: indisponível, nunca simula análise', async () => {
  const s = setup({ env: {} });
  const get = await chamar(s.handler, { method: 'GET' });
  assert.deepEqual(get.json, { configurada: false });
  assert.equal((await chamar(s.handler)).status, 503); assert.equal(s.chamadas(), 0);
});
test('requer autenticação validada pelo Supabase e e-mail autorizado', async () => {
  const anonimo = setup(); assert.equal((await chamar(anonimo.handler, { headers: { 'content-type': 'application/json' } })).status, 401);
  const expirado = setup({ fetcher: async () => new Response('', { status: 401 }) }); assert.equal((await chamar(expirado.handler)).status, 401); assert.equal(expirado.chamadas(), 0);
  const externo = setup({ fetcher: async () => new Response(JSON.stringify({ id: 'externo', email: 'outro@example.invalid' })) }); assert.equal((await chamar(externo.handler)).status, 403); assert.equal(externo.chamadas(), 0);
});
test('origem externa ou malformada, payload inválido e limite de tamanho são rejeitados', async () => {
  const s = setup();
  for (const origin of ['https://outro.example', 'origem-invalida']) assert.equal((await chamar(s.handler, { headers: { origin, host: 'guia-escolar.vercel.app', 'content-type': 'application/json' } })).status, 403);
  assert.equal((await chamar(s.handler, { body: { ...pedido, chave: 'nao-permitida' } })).status, 400);
  assert.equal((await chamar(s.handler, { body: { ...pedido, paginas: [pedido.paginas[0]] } })).status, 400);
  assert.equal((await chamar(s.handler, { body: { ...pedido, regimento: 'x'.repeat(180001) } })).status, 413);
  assert.equal(s.chamadas(), 0);
});
test('resposta real do provedor é validada e não armazenada em cache', async () => {
  const s = setup(); const r = await chamar(s.handler);
  assert.equal(r.status, 200); assert.equal(s.chamadas(), 1); assert.equal(r.headers['Cache-Control'], 'no-store'); assert.equal(r.json.modelo, 'gpt-6-astra');
});
test('erro de provedor e citações inventadas falham sem expor dados', async () => {
  const quebrado = setup({ analisar: async () => { throw new Error('segredo interno'); } });
  const r = await chamar(quebrado.handler); assert.equal(r.status, 502); assert.ok(!JSON.stringify(r.json).includes('segredo'));
  const inventado = setup({ analisar: async () => ({ ...resultado, achados: [{ nivel: 'erro', campo: 'Lei', motivo: 'Teste', origem: 'ocr', pagina: 'Verso', evidencia: '800:00', fontes: ['lei-inventada'] }] }) });
  assert.equal((await chamar(inventado.handler)).status, 502);
});
test('evidência inexistente e ausência no OCR nunca viram erro confirmado', () => {
  const verificado = verificarEvidencias({ ...resultado, achados: [{ nivel: 'erro', campo: 'Nome', motivo: 'Texto diferente', origem: 'ocr', pagina: 'Frente', evidencia: 'Pessoa inventada', fontes: [] }, { nivel: 'erro', campo: 'Nota', motivo: 'Ausente', origem: 'naoLocalizado', pagina: 'Não localizada', evidencia: '', fontes: [] }] }, pedido);
  assert.ok(verificado.achados.every((a) => a.nivel === 'duvida')); assert.equal(verificado.achados[0].evidencia, '');
});
test('guard por usuário limita chamadas na instância e não chama provedor novamente', async () => {
  const s = setup();
  for (let i = 0; i < 10; i++) assert.equal((await chamar(s.handler)).status, 200);
  assert.equal((await chamar(s.handler)).status, 429); assert.equal(s.chamadas(), 10);
});
