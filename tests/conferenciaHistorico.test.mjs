import assert from 'node:assert/strict';
import test from 'node:test';
import { avaliarConferencia, criarAnos, formatarHoras, lerHoras, somarCargas, sugerirAnos } from '../src/lib/conferenciaHistorico.ts';

const paginas = ['Frente', 'Verso'].map((lado) => ({ lado, imagem: '', texto: 'Texto legível '.repeat(30), confianca: 95, palavrasDuvidosas: [] }));
function anoValido() {
  const ano = criarAnos()[5];
  return { ...ano, anoLetivo: '2023', cargas: ['166:40', '66:40', '33:20', '66:40', '166:40', '100:00', '100:00', '100:00', '33:20'], total: '833:20', anual: '833:20', confirmado: true };
}

test('horas e minutos, sem aceitar decimal ambíguo ou minutos impossíveis', () => {
  assert.equal(lerHoras('166:40'), 10000);
  assert.equal(lerHoras('800'), 48000);
  assert.equal(lerHoras('0:00'), 0);
  for (const valor of ['', '166,40', '166.40', '1:60', '-2:00', '800h', 'O:30', '1:3', '1:000']) assert.equal(lerHoras(valor), null, valor);
});
test('soma exata da grade real do modelo: 833:20', () => {
  assert.equal(formatarHoras(somarCargas(anoValido())), '833:20');
  assert.equal(formatarHoras(lerHoras('0:40') + lerHoras('0:40')), '1:20');
});
test('campo ausente não vira zero e não aprova a soma parcial', () => {
  const ano = anoValido(); ano.cargas[3] = '';
  assert.equal(somarCargas(ano), null);
  const resultado = avaliarConferencia(paginas, [ano], true, true, true);
  assert.ok(resultado.some((a) => a.nivel === 'duvida' && a.campo.includes('Educação Física')));
  assert.ok(!resultado.some((a) => a.nivel === 'ok' && a.campo.includes('Somatória')));
});
test('carga global repetida no documento não é somada por disciplina', () => {
  const ano = { ...criarAnos()[0], cargas: ['800:00', '800:00'], total: '800:00' };
  assert.equal(somarCargas(ano), 48000);
});
test('divergências aritméticas e no total anual são apontadas separadamente', () => {
  const ano = { ...anoValido(), total: '834:00', anual: '835:00' };
  const erros = avaliarConferencia(paginas, [ano], true, true, true).filter((a) => a.nivel === 'erro');
  assert.equal(erros.length, 2);
  assert.ok(erros[0].motivo.includes('diferença 0:40'));
});
test('documento incompleto, OCR incerto e transcrição não revisada continuam pendentes', () => {
  const resultado = avaliarConferencia([{ ...paginas[0], confianca: 60, palavrasDuvidosas: ['833:?0'] }], [{ ...anoValido(), confirmado: false }], false, false, false);
  assert.ok(resultado.some((a) => a.nivel === 'erro' && a.campo === 'Documento'));
  for (const campo of ['Frente', '6º ano', 'Identificação', 'Formalização', 'Regras escolares']) assert.ok(resultado.some((a) => a.nivel === 'duvida' && a.campo === campo), campo);
});
test('ano excluído não gera exigências de campos; nenhum ano incluído gera erro', () => {
  assert.equal(avaliarConferencia(paginas, [{ ...anoValido(), incluido: false }], true, true, true).filter((a) => a.nivel === 'erro').length, 1);
});
test('extração conservadora separa notas de cargas e não confirma propostas', () => {
  const texto = 'HISTÓRICO ESCOLAR – ENSINO FUNDAMENTAL\n6º ANO ANO: 2023\nAproveitamento 60 70 80 90\nCarga Horária Curricular 166:40 66:40 33:20 66:40 166:40 100:00 100:00 100:00 33:20 833:20\nCARGA HORÁRIA ANUAL: 833:20';
  const ano = sugerirAnos([texto])[5];
  assert.deepEqual(ano.cargas, anoValido().cargas);
  assert.equal(ano.total, '833:20'); assert.equal(ano.anual, '833:20');
  assert.equal(ano.anoLetivo, '2023'); assert.equal(ano.confirmado, false);
});
test('linhas incompletas, duplicadas e tabelas de ensino médio não produzem soma artificial', () => {
  const inicio = 'HISTÓRICO ESCOLAR – ENSINO FUNDAMENTAL\n6º ANO\n';
  assert.equal(somarCargas(sugerirAnos([inicio + 'Carga Horária Curricular 166:40 833:20'])[5]), null);
  const linha = 'Carga Horária Curricular 166:40 66:40 33:20 66:40 166:40 100:00 100:00 100:00 33:20 833:20';
  assert.equal(somarCargas(sugerirAnos([inicio + linha + '\n' + linha])[5]), null);
  assert.equal(sugerirAnos(['HISTÓRICO ESCOLAR – ENSINO MÉDIO\n1º ANO\nCarga Horária Curricular 800:00 800:00'])[0].total, '');
});
test('cargas complementares entram no somatório e zero gera dúvida', () => {
  const ano = anoValido(); ano.cargas.push('20:40');
  assert.equal(formatarHoras(somarCargas(ano)), '854:00');
  const zerado = { ...anoValido(), cargas: Array(9).fill('0'), total: '0', anual: '0' };
  assert.ok(avaliarConferencia(paginas, [zerado], true, true, true).some((a) => a.nivel === 'duvida'));
});
test('metadados, notas e observação são extraídos sem misturar a linha de carga', () => {
  const texto = 'HISTÓRICO ESCOLAR – ENSINO FUNDAMENTAL\n6º ANO ANO: 2020\nAproveitamento 70 71 72 73 74 75 76 77 78 APROVADO Observações: Pandemia COVID-19\nESTABELECIMENTO: ESCOLA TESTE MUNICÍPIO/ESTADO: PONTO DOS VOLANTES/MG\nMÍNIMO PARA PROMOÇÃO: 60 DIAS LETIVOS ANUAIS: *180 CARGA HORÁRIA ANUAL: 800:00';
  const ano = sugerirAnos([texto])[5];
  assert.deepEqual(ano.notas, ['70', '71', '72', '73', '74', '75', '76', '77', '78']);
  assert.equal(ano.escola, 'ESCOLA TESTE'); assert.equal(ano.diasLetivos, '*180');
  assert.equal(ano.situacao, 'APROVADO'); assert.equal(ano.observacoes, 'PANDEMIA COVID-19');
  assert.equal(ano.minimoPromocao, '60');
});
