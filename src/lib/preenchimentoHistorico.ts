import type { Achado, AnoConferencia, PaginaLida } from './conferenciaHistorico.ts';
import { DISCIPLINAS, lerHoras } from './conferenciaHistorico.ts';
import { validarDataBR, validarNome } from './validacao.ts';

export interface DocumentoConferencia {
  nomeFrente: string; nomeVerso: string; nascimento: string;
  nomeMae: string; nomePai: string; naturalidade: string; uf: string;
  nacionalidade: string; sexo: string; expedicao: string;
  titulo: string; fundamentacao: string; observacoesGerais: string;
}
export function criarDocumento(): DocumentoConferencia {
  return { nomeFrente: '', nomeVerso: '', nascimento: '', nomeMae: '', nomePai: '', naturalidade: '', uf: '', nacionalidade: '', sexo: '', expedicao: '', titulo: '', fundamentacao: '', observacoesGerais: '' };
}
export function normalizarConferencia(valor: string): string {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
}
export function sugerirDocumento(paginas: PaginaLida[]): DocumentoConferencia {
  const dados = criarDocumento();
  const frente = paginas[0]?.texto ?? '';
  const verso = paginas[1]?.texto ?? '';
  const todo = `${frente}\n${verso}`;

  // Nome na frente (vários padrões comuns em históricos)
  dados.nomeFrente =
    /Certificamos que\s*:\s*(.+?)(?:\s+natural de\s*:|\n|$)/i.exec(frente)?.[1]?.trim()
    ?? /(?:^|\n)\s*NOME\s*(?:DO\s*ALUNO)?\s*:\s*([^\n]+)/i.exec(frente)?.[1]?.trim()
    ?? /(?:^|\n)\s*Aluno\(a\)\s*:\s*([^\n]+)/i.exec(frente)?.[1]?.trim()
    ?? '';

  // Nome no verso
  dados.nomeVerso =
    /(?:^|\n)\s*NOME\s*:\s*([^\n]+)/i.exec(verso)?.[1]?.trim()
    ?? /(?:^|\n)\s*NOME\s*(?:DO\s*ALUNO)?\s*:\s*([^\n]+)/i.exec(verso)?.[1]?.trim()
    ?? '';

  // Data de nascimento
  dados.nascimento =
    /Nascid[oa](?:\(a\))?\s*em\s*:\s*(\d{2}\/\d{2}\/\d{4})/i.exec(frente)?.[1]
    ?? /(?:Data de\s*)?Nascimento\s*:\s*(\d{2}\/\d{2}\/\d{4})/i.exec(todo)?.[1]
    ?? /Nasc\.?\s*em\s*:\s*(\d{2}\/\d{2}\/\d{4})/i.exec(todo)?.[1]
    ?? '';

  // Filiação (vários formatos)
  const filiacao1 = /Filho\(a\)\s*de\s*:\s*(.+?)\s+e de\s*:\s*([^\n]+)/i.exec(frente);
  if (filiacao1) {
    dados.nomePai = filiacao1[1]?.trim() ?? '';
    dados.nomeMae = filiacao1[2]?.trim() ?? '';
  } else {
    const mae = /(?:Filia[çc][ãa]o\s*1|M[ãa]e|Filia[çc][ãa]o\s*materna)\s*:\s*([^\n]+)/i.exec(todo);
    const pai = /(?:Filia[çc][ãa]o\s*2|Pai|Filia[çc][ãa]o\s*paterna)\s*:\s*([^\n]+)/i.exec(todo);
    if (mae) dados.nomeMae = mae[1].trim();
    if (pai) dados.nomePai = pai[1].trim();
    // Formato "Filiação: PAI e MÃE"
    const filiacao2 = /Filia[çc][ãa]o\s*:\s*(.+?)\s+e\s+([^\n]+)/i.exec(frente);
    if (filiacao2 && !dados.nomePai) {
      dados.nomePai = filiacao2[1]?.trim() ?? '';
      dados.nomeMae = filiacao2[2]?.trim() ?? '';
    }
  }

  // UF e naturalidade
  dados.uf = /\bUF\s*:\s*([A-Z]{2})\b/i.exec(frente)?.[1]?.toUpperCase()
    ?? /\bUF\s*:\s*([A-Z]{2})\b/i.exec(todo)?.[1]?.toUpperCase()
    ?? '';
  dados.naturalidade =
    /natural de\s*:\s*(.+?)(?:\s+UF\s*:|\n|$)/i.exec(frente)?.[1]?.trim()
    ?? /Naturalidade\s*:\s*(.+?)(?:\s+UF\s*:|\n|$)/i.exec(todo)?.[1]?.trim()
    ?? '';

  // Nacionalidade e sexo
  dados.nacionalidade =
    /nacionalidade\s*:\s*(.+?)(?:\s+do sexo|\n|$)/i.exec(frente)?.[1]?.trim()
    ?? /Nacionalidade\s*:\s*([^\n]+)/i.exec(todo)?.[1]?.trim()
    ?? '';
  dados.sexo =
    /do sexo\s*:\s*(.+?)(?:\s+Nascid|\n|$)/i.exec(frente)?.[1]?.trim()
    ?? /Sexo\s*:\s*([^\n]+)/i.exec(todo)?.[1]?.trim()
    ?? '';

  // Título
  dados.titulo = frente.split('\n').find((l) => /CERTIFICADO DE CONCLUS|HIST[ÓO]RICO ESCOLAR/i.test(l))?.trim() ?? '';

  // Observações gerais
  dados.observacoesGerais =
    /Observa[çc][õo]es gerais\s*:\s*([^\n]+(?:\n(?!\s*[A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ]{3,})[^\n]+)*)/i.exec(verso)?.[1]?.trim()
    ?? /Observa[çc][õo]es gerais\s*:\s*([^\n]+)/i.exec(verso)?.[1]?.trim()
    ?? '';

  // Data de expedição (vários formatos)
  const expedicaoMatch =
    /(?:Data de\s*)?Expedi[çc][ãa]o\s*:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i.exec(todo)
    ?? /(?:Data de\s*)?Expedi[çc][ãa]o\s*:\s*(\d{1,2}\s+de\s+[A-Za-zçÇ]+\s+de\s+\d{4})/i.exec(todo)
    ?? /(?:emitido|expedido)\s+em\s*:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i.exec(todo)
    ?? /(?:emitido|expedido)\s+em\s+(\d{1,2}\s+de\s+[A-Za-zçÇ]+\s+de\s+\d{4})/i.exec(todo);
  if (expedicaoMatch) {
    dados.expedicao = dataExpedicaoBR(expedicaoMatch[1]) || expedicaoMatch[1].trim();
  }

  // Fundamentação legal
  dados.fundamentacao =
    /Fundament[açc][ãa]o\s*legal\s*:\s*([^\n]+(?:\n(?!\s*[A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ]{4,}\s*:)[^\n]+)*)/i.exec(todo)?.[1]?.trim()
    ?? /(?:Lei\s*n?[º°]?\s*9\.?394\/?1996|LDB|Lei de Diretrizes)[^\n]*/i.exec(todo)?.[0]?.trim()
    ?? '';

  return dados;
}

export function dataExpedicaoBR(valor: string): string {
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(valor.trim())) return valor.trim();
  const meses = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const match = /^(\d{1,2}) DE ([A-Z]+) DE (\d{4})$/.exec(normalizarConferencia(valor));
  if (!match) return '';
  const mes = meses.indexOf(match[2].toLowerCase());
  return mes < 0 ? '' : `${match[1].padStart(2, '0')}/${String(mes + 1).padStart(2, '0')}/${match[3]}`;
}

export function avaliarPreenchimento(paginas: PaginaLida[], anos: AnoConferencia[], dados: DocumentoConferencia): Achado[] {
  const achados: Achado[] = [];
  const obrigatorios: [keyof DocumentoConferencia, string][] = [
    ['nomeFrente', 'Nome na frente'], ['nomeVerso', 'Nome no verso'], ['nascimento', 'Nascimento'],
    ['nomeMae', 'Filiação 1 / mãe'], ['naturalidade', 'Naturalidade'], ['uf', 'UF'],
    ['nacionalidade', 'Nacionalidade'], ['sexo', 'Sexo'], ['expedicao', 'Data de expedição'],
    ['titulo', 'Título'], ['fundamentacao', 'Fundamentação legal'],
  ];
  for (const [chave, rotulo] of obrigatorios) {
    if (!dados[chave].trim()) achados.push({ nivel: 'duvida', campo: `Identificação / ${rotulo}`, motivo: 'Campo do modelo não transcrito ou não reconhecido. Confira o original; ausência no OCR não comprova ausência no documento.' });
  }
  for (const [chave, rotulo] of [['nomeFrente', 'Nome na frente'], ['nomeVerso', 'Nome no verso']] as const) {
    if (dados[chave].trim() && validarNome(dados[chave])) achados.push({ nivel: 'erro', campo: rotulo, motivo: 'Nome transcrito com caracteres inválidos. Confira a leitura.' });
  }
  if (dados.nomeFrente && dados.nomeVerso && normalizarConferencia(dados.nomeFrente) !== normalizarConferencia(dados.nomeVerso)) {
    achados.push({ nivel: 'duvida', campo: 'Identificação / Frente e verso', motivo: 'Os nomes transcritos nas duas páginas são diferentes. Confirme se pertencem ao mesmo aluno ou se há erro de leitura.' });
  }
  if (dados.nascimento && validarDataBR(dados.nascimento)) achados.push({ nivel: 'erro', campo: 'Nascimento', motivo: 'Data inválida, futura ou fora do formato DD/MM/AAAA.' });
  if (dados.uf && !/^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/i.test(dados.uf.trim())) achados.push({ nivel: 'duvida', campo: 'UF', motivo: 'UF não reconhecida. Verifique se é naturalidade estrangeira ou erro de transcrição.' });
  const expedicao = dataExpedicaoBR(dados.expedicao);
  if (dados.expedicao && (!expedicao || validarDataBR(expedicao))) achados.push({ nivel: 'erro', campo: 'Data de expedição', motivo: 'Data inválida ou futura. Use DD/MM/AAAA ou dia de mês de ano.' });
  for (const pagina of paginas) {
    if (/\{(?:nome_|nota_|ch_|ano_|situacao_|fundamentacao_legal)[^}]*\}/i.test(pagina.texto)) achados.push({ nivel: 'erro', campo: `${pagina.lado} / Modelo`, motivo: 'Marcadores do modelo ainda aparecem no documento. Há campos que não foram substituídos.' });
  }
  const textoLegal = normalizarConferencia(`${dados.fundamentacao} ${dados.observacoesGerais} ${paginas.map((p) => p.texto).join(' ')}`);
  for (const ano of anos.filter((a) => a.incluido)) {
    const campo = `${ano.serie}º ano`;
    for (const [valor, rotulo] of [[ano.escola, 'Escola'], [ano.municipio, 'Município / estado'], [ano.situacao, 'Situação']] as const) {
      if (!valor.trim()) achados.push({ nivel: 'duvida', campo: `${campo} / ${rotulo}`, motivo: 'Informação não transcrita. Confira o preenchimento no original.' });
    }
    const pandemia = ano.anoLetivo === '2020' || ano.anoLetivo === '2021';
    const dias = ano.diasLetivos.replace(/^\*/, '').trim();
    if (!dias || !/^\d{1,3}$/.test(dias) || Number(dias) > 366) {
      achados.push({ nivel: dias ? 'erro' : 'duvida', campo: `${campo} / Dias letivos`, motivo: 'Dias letivos ausentes ou inválidos. Campo vazio não significa dispensa.' });
    } else if (Number(dias) < 200 && Number(ano.anoLetivo) >= 1997 && !pandemia) {
      achados.push({ nivel: 'duvida', campo: `${campo} / Dias letivos`, motivo: 'Menos de 200 dias informados. Confira modalidade, calendário, fundamento da exceção e normas vigentes no ano.', fontes: ['ldb'] });
    }
    const horas = lerHoras(ano.anual);
    if (horas !== null && horas < 800 * 60 && Number(ano.anoLetivo) >= 1997) {
      achados.push({ nivel: 'duvida', campo: `${campo} / Mínimo de horas`, motivo: pandemia ? 'Carga anual inferior a 800 horas. A dispensa de dias não dispensa horas no Fundamental; confira eventual integralização no ano seguinte/continuum e os registros do calendário.' : 'Carga anual inferior a 800 horas. Verifique modalidade, trajetória e calendário antes de concluir irregularidade.', fontes: pandemia ? ['ldb', 'lei14040'] : ['ldb'] });
    }
    if (pandemia) {
      const notasPandemia = normalizarConferencia(`${ano.observacoes} ${dados.observacoesGerais}`);
      if (!/COVID|PANDEMIA|14[.\s]*040/.test(notasPandemia)) achados.push({ nivel: 'duvida', campo: `${campo} / Observação de ${ano.anoLetivo}`, motivo: 'Não foi identificada observação sobre a pandemia. Revise o registro documental pedido pela escola, a dispensa de dias e a integralização de horas. A lei federal, isoladamente, não determina uma frase obrigatória em todo histórico.', fontes: ano.anoLetivo === '2021' ? ['lei14040', 'lei14218'] : ['lei14040'] });
      if (!/14[.\s]*040/.test(`${textoLegal} ${notasPandemia}`)) achados.push({ nivel: 'duvida', campo: `${campo} / Referência legal da pandemia`, motivo: 'Referência à Lei 14.040/2020 não identificada. Confira a fundamentação documental com a Secretaria.', fontes: ['lei14040'] });
      if (ano.anoLetivo === '2021' && !/14[.\s]*218/.test(`${textoLegal} ${notasPandemia}`)) achados.push({ nivel: 'duvida', campo: `${campo} / Extensão para 2021`, motivo: 'Referência à Lei 14.218/2021 não identificada. Ela estendeu as normas excepcionais até o encerramento do ano letivo de 2021; confirme a aplicação ao calendário da escola.', fontes: ['lei14218'] });
    }
    const faltas = lerHoras(ano.faltasHoras);
    if (faltas === null) achados.push({ nivel: ano.faltasHoras.trim() ? 'erro' : 'duvida', campo: `${campo} / Faltas em horas`, motivo: 'Faltas em horas não identificadas ou inválidas. Não converter dias/aulas em horas sem os dados do calendário.' });
    else if (horas !== null && horas > 0 && (faltas > horas || (horas - faltas) / horas < .75)) achados.push({ nivel: 'duvida', campo: `${campo} / Frequência`, motivo: faltas > horas ? 'Faltas maiores que a carga anual; confira a unidade e a transcrição.' : 'Frequência calculada abaixo de 75%. Confira o regimento, a contabilização de atividades e a situação do aluno.', fontes: ['ldb'] });
    const limite = ano.escalaNotas === '10' ? 10 : 100;
    const minimoTexto = ano.minimoPromocao.replace('%', '').replace(',', '.');
    const minimo = /^\d+(?:\.\d+)?$/.test(minimoTexto) ? Number(minimoTexto) * (ano.minimoPromocao.includes('%') ? limite / 100 : 1) : null;
    if (ano.escalaNotas !== 'conceitos' && (minimo === null || minimo > limite)) achados.push({ nivel: ano.minimoPromocao ? 'erro' : 'duvida', campo: `${campo} / Mínimo para promoção`, motivo: 'Mínimo não transcrito ou inválido para a escala selecionada. Confira o regimento; não presumir 60 pontos.' });
    for (let i = 0; i < 9; i++) {
      if (i === 1 && ano.serie < 6) continue;
      const valor = ano.notas[i]?.trim() ?? '';
      if (!valor) { achados.push({ nivel: 'duvida', campo: `${campo} / ${DISCIPLINAS[i]}`, motivo: 'Nota/conceito não transcrito. Confira o componente no documento.' }); continue; }
      if (ano.escalaNotas === 'conceitos') {
        if (!/^[ABC]$/i.test(valor)) achados.push({ nivel: 'duvida', campo: `${campo} / ${DISCIPLINAS[i]}`, motivo: 'Conceito fora de A/B/C usados pelo modelo. Confira a legenda e o regimento do ano.' });
      } else if (!/^\d+(?:[.,]\d+)?$/.test(valor) || Number(valor.replace(',', '.')) > limite) {
        achados.push({ nivel: /^--?$/.test(valor) ? 'duvida' : 'erro', campo: `${campo} / ${DISCIPLINAS[i]}`, motivo: `Nota inválida ou componente não avaliado na escala selecionada de 0 a ${limite}. Confira legenda, dispensa e regimento.` });
      } else if (minimo !== null && Number(valor.replace(',', '.')) < minimo && /APROVAD/i.test(ano.situacao)) {
        achados.push({ nivel: 'duvida', campo: `${campo} / ${DISCIPLINAS[i]}`, motivo: 'Nota abaixo do mínimo para promoção transcrito, com situação de aprovação. Confira recuperação, conselho, progressão e regimento; não presumir reprovação automática.' });
      }
    }
  }
  achados.push({ nivel: 'duvida', campo: 'Normas locais', motivo: 'Esta base contém referências federais. Regimento, calendário e atos municipais/estaduais não foram verificados; a conformidade completa depende deles.' });
  return achados;
}
