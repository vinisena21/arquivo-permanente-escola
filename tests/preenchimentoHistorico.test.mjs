import test from 'node:test';
import assert from 'node:assert/strict';
import { criarAnos } from '../src/lib/conferenciaHistorico.ts';
import { avaliarPreenchimento, criarDocumento, dataExpedicaoBR, sugerirDocumento } from '../src/lib/preenchimentoHistorico.ts';

const paginas = ['Frente', 'Verso'].map((lado) => ({ lado, texto: '', imagem: '', confianca: 90, palavrasDuvidosas: [] }));
const documento = { ...criarDocumento(), nomeFrente: 'Aluno Teste', nomeVerso: 'Aluno Teste', nascimento: '10/03/2010', nomeMae: 'Responsável Teste', naturalidade: 'Ponto dos Volantes', uf: 'MG', nacionalidade: 'Brasileira', sexo: 'M', expedicao: '01/10/2026', titulo: 'Histórico Escolar', fundamentacao: 'Lei 9.394/1996' };
const ano = { ...criarAnos()[5], anoLetivo: '2020', escola: 'Escola Teste', municipio: 'Ponto dos Volantes/MG', diasLetivos: '*180', situacao: 'APROVADO', notas: Array(9).fill('70'), anual: '800:00', faltasHoras: '0:00', minimoPromocao: '60' };
const avaliar = (a = ano, d = documento) => avaliarPreenchimento(paginas, [a], d);

test('2020 sinaliza falta de observação e referência como dúvida, sem condenação legal', () => {
  const avisos = avaliar().filter((a) => a.campo.includes('pandemia') || a.campo.includes('Observação de 2020'));
  assert.equal(avisos.length, 2); assert.ok(avisos.every((a) => a.nivel === 'duvida'));
  assert.ok(!avaliar().some((a) => a.campo.includes('Dias letivos')));
});
test('2021 exige revisar a extensão; 2022 não recebe dispensa automática', () => {
  assert.ok(avaliar({ ...ano, anoLetivo: '2021' }).some((a) => a.fontes?.includes('lei14218')));
  const fora = avaliar({ ...ano, anoLetivo: '2022' });
  assert.ok(fora.some((a) => a.campo.includes('Dias letivos') && a.fontes.includes('ldb')));
  assert.ok(!fora.some((a) => a.fontes?.includes('lei14218')));
});
test('2021 com referências e observação dispensa alertas de citação, não as normas locais', () => {
  const resultado = avaliar({ ...ano, anoLetivo: '2021', observacoes: 'Pandemia COVID-19. Lei 14.040/2020 e Lei 14.218/2021.' });
  assert.ok(!resultado.some((a) => a.campo.includes('Extensão') || a.campo.includes('Observação de') || a.campo.includes('Referência legal da pandemia')));
  assert.ok(resultado.some((a) => a.campo === 'Normas locais'));
});
test('a pandemia não dispensa horas; menos de 800 exige verificar continuum', () => {
  const aviso = avaliar({ ...ano, anual: '700:00' }).find((a) => a.campo.includes('Mínimo de horas'));
  assert.equal(aviso.nivel, 'duvida'); assert.ok(aviso.motivo.includes('continuum'));
});
test('não presume 60 pontos; recuperação não é reprovação automática', () => {
  assert.ok(avaliar({ ...ano, minimoPromocao: '' }).some((a) => a.motivo.includes('não presumir 60 pontos')));
  const notaBaixa = avaliar({ ...ano, notas: Array(9).fill('50') }).filter((a) => a.motivo.includes('abaixo do mínimo'));
  assert.equal(notaBaixa.length, 9); assert.ok(notaBaixa.every((a) => a.nivel === 'duvida'));
  assert.ok(avaliar({ ...ano, escalaNotas: '10', notas: Array(9).fill('11'), minimoPromocao: '6' }).some((a) => a.nivel === 'erro' && a.motivo.includes('0 a 10')));
});
test('identificação e datas inválidas, nomes distintos, marcadores e frequência são apontados', () => {
  assert.ok(avaliar(ano, { ...documento, nomeVerso: 'Outra Pessoa' }).some((a) => a.campo.includes('Frente e verso')));
  assert.ok(avaliar(ano, { ...documento, nascimento: '31/02/2010' }).some((a) => a.campo === 'Nascimento' && a.nivel === 'erro'));
  assert.ok(avaliar({ ...ano, faltasHoras: '201:00' }).some((a) => a.campo.includes('Frequência')));
  assert.ok(avaliarPreenchimento([{ ...paginas[0], texto: '{nome_aluno}' }, paginas[1]], [ano], documento).some((a) => a.campo.includes('Modelo')));
});
test('leitura conservadora da identificação e data por extenso', () => {
  const dados = sugerirDocumento([{ ...paginas[0], texto: 'Certificamos que: ALUNO TESTE natural de: PONTO DOS VOLANTES\nUF: MG de nacionalidade: BRASILEIRA do sexo: M Nascido(a) em: 10/03/2010\nFilho(a) de: PAI TESTE e de: MAE TESTE' }, { ...paginas[1], texto: 'NOME: ALUNO TESTE\nHISTÓRICO ESCOLAR' }]);
  assert.equal(dados.nomeFrente, 'ALUNO TESTE'); assert.equal(dados.nomeVerso, 'ALUNO TESTE');
  assert.equal(dados.nomeMae, 'MAE TESTE'); assert.equal(dados.nascimento, '10/03/2010');
  assert.equal(dataExpedicaoBR('5 de março de 2026'), '05/03/2026');
});
