import type { FonteLegalId } from './fontesLegais.ts';

export const DISCIPLINAS = [
  'Língua Portuguesa', 'Língua Inglesa', 'Arte', 'Educação Física',
  'Matemática', 'Ciências', 'História', 'Geografia', 'Ensino Religioso',
] as const;

export interface AnoConferencia {
  serie: number;
  incluido: boolean;
  anoLetivo: string;
  modo: 'global' | 'disciplinas';
  cargas: string[];
  total: string;
  anual: string;
  confirmado: boolean;
  escola: string;
  municipio: string;
  diasLetivos: string;
  situacao: string;
  observacoes: string;
  notas: string[];
  escalaNotas: '100' | '10' | 'conceitos';
  minimoPromocao: string;
  faltasHoras: string;
}

export interface PaginaLida {
  lado: 'Frente' | 'Verso';
  imagem: string;
  texto: string;
  confianca: number;
  palavrasDuvidosas: string[];
}

export interface Achado {
  nivel: 'erro' | 'duvida' | 'ok';
  campo: string;
  motivo: string;
  fontes?: FonteLegalId[];
}

export function criarAnos(): AnoConferencia[] {
  return Array.from({ length: 9 }, (_, i) => ({
    serie: i + 1, incluido: true, anoLetivo: '',
    modo: i < 5 ? 'global' : 'disciplinas',
    cargas: Array(9).fill(''), total: '', anual: '', confirmado: false,
    escola: '', municipio: '', diasLetivos: '', situacao: '', observacoes: '',
    notas: Array(9).fill(''), escalaNotas: '100',
    minimoPromocao: '', faltasHoras: '',
  }));
}

export function lerHoras(valor: string): number | null {
  const texto = valor.trim();
  const match = /^(\d{1,5})(?::([0-5]\d))?$/.exec(texto);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2] || 0);
}

export function formatarHoras(minutos: number): string {
  return `${Math.floor(minutos / 60)}:${String(minutos % 60).padStart(2, '0')}`;
}

/**
 * Soma todas as cargas preenchidas (curricular + complementares).
 * No 1º–5º, 758:20 + 41:40 deve resultar em 800:00.
 */
export function somarCargas(ano: AnoConferencia): number | null {
  const preenchidas = ano.cargas.filter((c) => c.trim());
  if (!preenchidas.length) return null;
  const valores = preenchidas.map(lerHoras);
  if (valores.some((v) => v === null)) return null;
  return valores.reduce<number>((soma, valor) => soma + (valor ?? 0), 0);
}

function normalizarNota(token: string): string {
  const t = token.trim();
  if (!t || /^(--|—|–|-|=)$/.test(t)) return '';
  if (/^[ABC]$/i.test(t)) return t.toUpperCase();
  const num = t.replace(',', '.');
  if (/^\d+(?:\.\d+)?$/.test(num)) return num;
  return '';
}

function textoFundamental(textos: string[]): string {
  const todo = textos.join('\n');
  const m = /HIST[ÓO]RICO\s+ESCOLAR\s*[-–]?\s*ENSINO\s+FUNDAMENTAL/i.exec(todo);
  if (m) return todo.slice(m.index);
  const m2 = /CICLO\s+DA\s+ALFABETIZA[ÇC][ÃA]O/i.exec(todo);
  if (m2) return todo.slice(m2.index);
  return todo;
}

/** Distribui H:MM da linha de carga global: partes + total quando a soma fecha. */
function aplicarCargasGlobais(reg: AnoConferencia, validas: string[]) {
  if (!validas.length) return;
  const mins = validas.map((h) => lerHoras(h)!);

  // Caso 1: último valor é o total e os anteriores somam exatamente esse total
  if (validas.length >= 2) {
    const totalStr = validas[validas.length - 1]!;
    const totalMin = mins[mins.length - 1]!;
    const partes = validas.slice(0, -1);
    const somaPartes = mins.slice(0, -1).reduce((a, b) => a + b, 0);
    if (somaPartes === totalMin && totalMin > 0) {
      reg.cargas = [...partes];
      while (reg.cargas.length < 9) reg.cargas.push('');
      reg.total = totalStr;
      return;
    }
  }

  // Caso 2: dois (ou mais) valores distintos cuja soma é o maior (total)
  if (validas.length >= 2) {
    const maxMin = Math.max(...mins);
    const totalStr = validas[mins.indexOf(maxMin)]!;
    const partes = validas.filter((_, i) => mins[i] !== maxMin);
    const somaPartes = partes.reduce((a, h) => a + (lerHoras(h) ?? 0), 0);
    if (partes.length >= 1 && somaPartes === maxMin) {
      reg.cargas = [...partes];
      while (reg.cargas.length < 9) reg.cargas.push('');
      reg.total = totalStr;
      return;
    }
  }

  // Caso 3: um único valor (ou repetição do mesmo) = carga e total
  const unico = validas[validas.length - 1]!;
  reg.cargas = [unico, ...Array(8).fill('')];
  reg.total = unico;
}

export function sugerirAnos(textos: string[]): AnoConferencia[] {
  const anos = criarAnos();
  const fund = textoFundamental(textos);
  if (!fund.trim()) return anos;

  const inicios: { serie: number; index: number }[] = [];
  const reInicio = /(?:^|\n)\s*([1-9])\s*[º°oO]?\s*ANO\b/gi;
  let mIni: RegExpExecArray | null;
  while ((mIni = reInicio.exec(fund)) !== null) {
    const serie = Number(mIni[1]);
    if (serie >= 1 && serie <= 9 && !inicios.some((x) => x.serie === serie)) {
      inicios.push({ serie, index: mIni.index });
    }
  }
  inicios.sort((a, b) => a.index - b.index);

  for (let i = 0; i < inicios.length; i++) {
    const { serie: s, index } = inicios[i]!;
    const reg = anos[s - 1]!;
    const fim = i + 1 < inicios.length ? inicios[i + 1]!.index : fund.length;
    const bloco = fund.slice(index, fim);

    const letivo = /\bANO\s*:\s*(\d{4})\b/i.exec(bloco);
    if (letivo) reg.anoLetivo = letivo[1]!;

    const sit = /\b(APROVADO|REPROVADO|RETIDO|TRANSFERIDO|CURSANDO|CLASSIFICADO|EM\s+CURSO)\b/i.exec(bloco);
    if (sit) reg.situacao = sit[1]!.toUpperCase().replace(/\s+/g, ' ').replace('EM CURSO', 'CURSANDO');

    const mApr = /Aproveitamento\s*([\s\S]*?)(?=\b(?:APROVADO|REPROVADO|RETIDO|TRANSFERIDO|CURSANDO|EM\s+CURSO|Carga\s+Hor[áa]ria|Faltas|Observa))/i.exec(bloco);
    if (mApr) {
      const tokens = mApr[1]!.match(/\b\d{1,3}(?:[.,]\d{1,2})?\b|\b[ABC]\b|--|—/gi) ?? [];
      const limpos = tokens.map(normalizarNota);
      reg.notas = Array.from({ length: 9 }, (_, j) => limpos[j] ?? '');
      if (reg.notas.some((n) => /^\d/.test(n))) {
        const nums = reg.notas.filter((n) => /^\d/.test(n)).map((n) => Number(n));
        reg.escalaNotas = Math.max(...nums, 0) <= 10 ? '10' : '100';
      } else if (reg.notas.some((n) => /^[ABC]$/i.test(n))) {
        reg.escalaNotas = 'conceitos';
      }
    }

    const mCarga = /Carga\s+Hor[áa]ria\s+Curricular\s*([\s\S]*?)(?=\b(?:Faltas|ESTABELECIMENTO|MUNIC[ÍI]PIO|DIAS\s+LETIVOS|CARGA\s+HOR[ÁA]RIA\s+ANUAL|M[ÍI]NIMO|Observa))/i.exec(bloco);
    if (mCarga) {
      const validas = (mCarga[1]!.match(/\b\d{1,5}:[0-5]\d\b/g) ?? []).filter((h) => {
        const min = lerHoras(h);
        return min !== null && min <= 2000 * 60;
      });
      if (reg.modo === 'global') {
        aplicarCargasGlobais(reg, validas);
      } else if (validas.length >= 9) {
        reg.cargas = validas.slice(0, 9);
        if (validas[9]) reg.total = validas[9]!;
      } else if (validas.length >= 1) {
        reg.total = validas[validas.length - 1] ?? '';
      }
    }

    const anual = /CARGA\s+HOR[ÁA]RIA\s+ANUAL\s*:?\s*(\d{1,5}:[0-5]\d)/i.exec(bloco)
      ?? /CH\.?\s*ANUAL\s*:?\s*(\d{1,5}:[0-5]\d)/i.exec(bloco);
    if (anual) reg.anual = anual[1]!;
    if (!reg.anual && reg.total) reg.anual = reg.total;
    if (!reg.total && reg.anual) reg.total = reg.anual;
    // Se só há total/anual e nenhuma parte, a carga curricular única é o próprio total
    if (reg.modo === 'global' && !reg.cargas.some((c) => c.trim()) && (reg.total || reg.anual)) {
      const ref = reg.total || reg.anual;
      reg.cargas[0] = ref;
      if (!reg.total) reg.total = ref;
      if (!reg.anual) reg.anual = ref;
    }

    const faltas = /Faltas\s*\/?\s*Horas\s*[\s\S]{0,40}?(\d{1,4}:[0-5]\d)/i.exec(bloco);
    if (faltas) reg.faltasHoras = faltas[1]!;

    const escola = /ESTABELECIMENTO\s*:\s*([^\n]+)/i.exec(bloco);
    if (escola) {
      const e = escola[1]!.replace(/\s+/g, ' ').trim();
      if (e && !/^-+$/.test(e)) reg.escola = e;
    }

    const mun = /MUNIC[ÍI]PIO(?:\s*\/\s*ESTADO)?\s*:\s*([^\n]+)/i.exec(bloco);
    if (mun) {
      const mv = mun[1]!.replace(/\s+/g, ' ').trim();
      if (mv && !/^-+$/.test(mv)) reg.municipio = mv;
    }

    const dias = /DIAS\s+LETIVOS(?:\s+ANUAIS)?\s*:\s*(\*?\d{1,3})\b/i.exec(bloco);
    if (dias) reg.diasLetivos = dias[1]!;

    const min = /M[ÍI]NIMO\s+PARA\s+PROMO[ÇC][ÃA]O\s*:\s*([^\n]{0,20})/i.exec(bloco);
    if (min) {
      const raw = min[1]!.trim();
      if (raw && !/^(--|—|–|-|=|\.+)$/.test(raw)) {
        const num = /(\d+(?:[.,]\d+)?%?)/.exec(raw);
        if (num) reg.minimoPromocao = num[1]!;
      }
    }

    const obs = /Observa[çc][õo]es\s*:?\s*([^\n]{3,150})/i.exec(bloco);
    if (obs) reg.observacoes = obs[1]!.replace(/\s+/g, ' ').trim();
  }

  return anos;
}

export function avaliarConferencia(
  paginas: PaginaLida[], anos: AnoConferencia[], identidade: boolean,
  assinaturas: boolean, normas: boolean,
): Achado[] {
  const achados: Achado[] = [];
  if (paginas.length !== 2) achados.push({ nivel: 'erro', campo: 'Documento', motivo: 'Frente e verso são obrigatórios.' });
  for (const pagina of paginas) {
    if (pagina.texto.replace(/\s/g, '').length < 100) {
      achados.push({ nivel: 'duvida', campo: pagina.lado, motivo: 'Pouco texto reconhecido. Confira a legibilidade e se a página está completa.' });
    }
    if (pagina.confianca < 85 || pagina.palavrasDuvidosas.length > 0) {
      achados.push({ nivel: 'duvida', campo: pagina.lado, motivo: `${pagina.palavrasDuvidosas.length} palavras com leitura incerta; confiança média ${Math.round(pagina.confianca)}%.` });
    }
  }
  const incluidos = anos.filter((ano) => ano.incluido);
  if (!incluidos.length) achados.push({ nivel: 'erro', campo: 'Anos escolares', motivo: 'Nenhum ano foi selecionado para conferência.' });
  for (const ano of incluidos) {
    const campo = `${ano.serie}º ano`;
    const soma = somarCargas(ano);
    const total = lerHoras(ano.total);
    const anual = lerHoras(ano.anual);
    const preenchidas = ano.cargas.filter((c) => c.trim());

    if (ano.modo === 'disciplinas') {
      if (preenchidas.length >= 2 && soma !== null && total !== null) {
        achados.push({
          nivel: soma === total ? 'ok' : 'erro',
          campo: `${campo} / Somatória das disciplinas`,
          motivo: soma === total
            ? `Soma das cargas (${formatarHoras(soma)}) igual ao total impresso (${formatarHoras(total)}).`
            : `Soma das disciplinas ${formatarHoras(soma)} ≠ total ${formatarHoras(total)} (diferença ${formatarHoras(Math.abs(soma - total))}).`,
        });
      } else if (preenchidas.length === 0 && total === null && anual === null && /^\d{4}$/.test(ano.anoLetivo)) {
        achados.push({ nivel: 'duvida', campo: `${campo} / Carga`, motivo: 'Cargas por disciplina e total não identificados. Confira no original (comum em ano em curso).' });
      }
    } else {
      // 1º–5º: carga curricular (+ complementares). Cada célula preenchida precisa ser H:MM válido.
      preenchidas.forEach((hora, idx) => {
        if (lerHoras(hora) === null) {
          achados.push({
            nivel: 'erro',
            campo: `${campo} / ${idx === 0 ? 'Carga curricular' : `Complementar ${idx}`}`,
            motivo: `Carga "${hora}" inválida. Use horas inteiras ou H:MM.`,
          });
        }
      });
      if (!preenchidas.length) {
        achados.push({ nivel: 'duvida', campo: `${campo} / Carga curricular`, motivo: 'Carga curricular não identificada.' });
      }
    }

    if (total === null && ano.modo === 'global') {
      achados.push({ nivel: ano.total.trim() ? 'erro' : 'duvida', campo: `${campo} / Total impresso`, motivo: 'Total ausente ou inválido.' });
    }
    if (anual === null && /^\d{4}$/.test(ano.anoLetivo) && ano.situacao && !/CURSANDO|EM CURSO/i.test(ano.situacao)) {
      achados.push({ nivel: ano.anual.trim() ? 'erro' : 'duvida', campo: `${campo} / Carga anual`, motivo: 'Carga anual ausente ou inválida.' });
    }
    if (!/^\d{4}$/.test(ano.anoLetivo) || Number(ano.anoLetivo) < 1900 || Number(ano.anoLetivo) > new Date().getFullYear() + 1) {
      achados.push({ nivel: 'duvida', campo: `${campo} / Ano letivo`, motivo: 'Ano letivo ausente, inválido ou futuro. Confira no documento.' });
    }

    // Regra central 1º–5º (e global em geral):
    // soma(carga curricular + complementares) DEVE ser igual ao total impresso.
    // Ex.: 758:20 + 41:40 = 800:00 → ok; se faltar complementar → erro com a diferença.
    if (ano.modo === 'global' && soma !== null && total !== null) {
      const partes = preenchidas.map((h) => h.trim()).join(' + ');
      if (soma === total) {
        achados.push({
          nivel: 'ok',
          campo: `${campo} / Somatória`,
          motivo: preenchidas.length > 1
            ? `Soma (${partes} = ${formatarHoras(soma)}) igual ao total impresso (${formatarHoras(total)}).`
            : `Carga ${formatarHoras(soma)} igual ao total impresso (${formatarHoras(total)}).`,
        });
      } else {
        const dif = Math.abs(soma - total);
        achados.push({
          nivel: 'erro',
          campo: `${campo} / Somatória`,
          motivo: soma < total
            ? `Soma ${formatarHoras(soma)} (${partes || 'sem partes'}); total impresso ${formatarHoras(total)}; falta ${formatarHoras(dif)}. Inclua a(s) carga(s) complementar(es) até fechar o total.`
            : `Soma ${formatarHoras(soma)} (${partes}); total impresso ${formatarHoras(total)}; excesso ${formatarHoras(dif)}. Confira as partes e o total no original.`,
        });
      }
    }

    if (total !== null && anual !== null) {
      achados.push({
        nivel: total === anual ? 'ok' : 'erro',
        campo: `${campo} / Carga anual`,
        motivo: total === anual
          ? 'Total impresso igual à carga horária anual.'
          : `Total ${formatarHoras(total)} diferente da carga anual ${formatarHoras(anual)}. Confira atividades complementares e observações.`,
      });
    }
    if (!ano.confirmado) achados.push({ nivel: 'duvida', campo, motivo: 'Transcrição ainda não conferida com a imagem original.' });
  }
  const preenchidos = incluidos.filter((ano) => /^\d{4}$/.test(ano.anoLetivo));
  for (let i = 1; i < preenchidos.length; i++) {
    if (Number(preenchidos[i]!.anoLetivo) <= Number(preenchidos[i - 1]!.anoLetivo)) {
      achados.push({ nivel: 'duvida', campo: `${preenchidos[i]!.serie}º ano / Sequência`, motivo: 'Ano letivo igual ou anterior ao da série precedente. Verifique a trajetória escolar.' });
    }
  }
  if (!identidade) achados.push({ nivel: 'duvida', campo: 'Identificação', motivo: 'Nome, nascimento, filiação e correspondência entre frente e verso ainda não conferidos.' });
  if (!assinaturas) achados.push({ nivel: 'duvida', campo: 'Formalização', motivo: 'Data, assinaturas, registros e carimbos ainda não conferidos visualmente.' });
  if (!normas) achados.push({ nivel: 'duvida', campo: 'Regras escolares', motivo: 'Notas, frequência, situação, dias letivos e fundamento legal dependem do regimento e das normas aplicáveis ao ano. Revisão humana pendente.' });
  return achados;
}
