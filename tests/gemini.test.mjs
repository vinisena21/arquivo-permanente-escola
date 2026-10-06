import test from 'node:test';
import assert from 'node:assert/strict';
import { prepararDadosGemini } from '../src/lib/dadosGemini.ts';
import { criarAnos } from '../src/lib/conferenciaHistorico.ts';
import { criarDocumento } from '../src/lib/preenchimentoHistorico.ts';
import { analisarGemini } from '../api/analisar-historico.ts';

const segredo = 'IDENTIFICADOR_PESSOAL_NAO_ENVIAR';
const documento = Object.fromEntries(Object.keys(criarDocumento()).map((k) => [k, segredo]));
const pedido = { documento, paginas: [{ lado: 'Frente', texto: segredo }, { lado: 'Verso', texto: segredo }], anos: criarAnos().map((a) => ({ ...a, escola: segredo, municipio: segredo, observacoes: segredo, situacao: segredo, diasLetivos: segredo, anoLetivo: segredo, notas: Array(9).fill(segredo), cargas: Array(9).fill(segredo), total: segredo, anual: segredo, minimoPromocao: segredo, faltasHoras: segredo })), regimento: segredo };
test('não envia texto integral, identificadores pessoais ou texto livre ao Gemini', () => {
  const anonimo = JSON.stringify(prepararDadosGemini(pedido));
  assert.ok(!anonimo.includes(segredo));
  assert.ok(!anonimo.includes('paginas')); assert.ok(!anonimo.includes('nomeMae":"'));
});
test('preserva valores acadêmicos válidos e sinais legais sem nomes', () => {
  const p = structuredClone(pedido); p.anos[5] = { ...criarAnos()[5], anoLetivo: '2021', cargas: Array(9).fill('100:00'), notas: Array(9).fill('70'), observacoes: 'COVID-19, Lei 14.040/2020; integralização em continuum.', situacao: 'APROVADO' };
  const dados = prepararDadosGemini(p);
  assert.equal(dados.anos[5].anoLetivo, '2021'); assert.equal(dados.anos[5].cargas[0], '100:00'); assert.equal(dados.anos[5].referencias.lei14040, true);
});
test('envia schema JSON, sem chave no corpo, e valida resposta do Gemini', async () => {
  const resultado = { resumo: 'Revisão pendente.', achados: [], pendencias: [] };
  const fetcher = async (url, opcoes) => {
    const request = new Request(url, opcoes); const body = await request.text();
    assert.ok(new URL(request.url).pathname.endsWith('/interactions')); assert.equal(request.headers.get('x-goog-api-key'), 'chave-ficticia');
    assert.ok(!body.includes(segredo)); assert.ok(!body.includes('chave-ficticia'));
    assert.equal(JSON.parse(body).response_format.mime_type, 'application/json');
    assert.equal(JSON.parse(body).store, false);
    return new Response(JSON.stringify({ id: 'interacao-teste', status: 'completed', steps: [{ type: 'model_output', content: [{ type: 'text', text: JSON.stringify(resultado) }] }] }), { headers: { 'Content-Type': 'application/json' } });
  };
  assert.deepEqual(await analisarGemini(pedido, 'gemini-3.8-flash', 'chave-ficticia', fetcher), resultado);
});
test('quota e respostas truncadas não produzem aprovação ou fallback', async () => {
  await assert.rejects(analisarGemini(pedido, 'gemini-3.8-flash', 'chave-ficticia', async () => new Response('', { status: 429 })), { name: 'LimiteGemini' });
  await assert.rejects(analisarGemini(pedido, 'gemini-3.8-flash', 'chave-ficticia', async () => new Response('', { status: 503 })), { name: 'GeminiIndisponivel' });
  await assert.rejects(analisarGemini(pedido, 'gemini-3.8-flash', 'chave-ficticia', async () => new Response(JSON.stringify({ status: 'incomplete', steps: [] }))));
});
