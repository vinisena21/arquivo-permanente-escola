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
    notas: Array(9).fill(''), escalaNotas: i < 3 ? 'conceitos' : '100',
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

export function somarCargas(ano: AnoConferencia): number | null {
  const valores = (ano.modo === 'global' ? ano.cargas.slice(0, 1) : ano.cargas).map(lerHoras);
  if (valores.some((v) => v === null)) return null;
  return valores.reduce<number>((soma, valor) => soma + (valor ?? 0), 0);
}

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
}

/** Converte token de nota do documento (85,0 | 85.0 | 85 | A | --) para valor do formulário. */
function normalizarNota(token: string): string {
  const t = token.trim();
  if (!t || /^(--|—|–|-)$/.test(t)) return '';
  if (/^[ABC]$/i.test(t)) return t.toUpperCase();
  const num = t.replace(',', '.');
  if (/^\d+(?:\.\d+)?$/.test(num)) return num;
  return '';
}

/**
 * Extrai anos a partir do texto plano (OCR ou DOCX de tabela).
 * Layout real observado: "1º ANO" + "ANO: 2021" + "Aproveitamento" + notas + "APROVADO"
 * e linhas "Carga Horária Curricular 800:00", "Faltas/Horas 00:00", ESTABELECIMENTO, etc.
 */
export function sugerirAnos(textos: string[]): AnoConferencia[] {
  const anos = criarAnos();
  const texto = textos.join('\n');
  const norm = normalizar(texto);

  // Só processa se parecer Ensino Fundamental (evita bloco de Ensino Médio vazio do mesmo arquivo)
  const eFundamental = /HISTORICO ESCOLAR\s*[-–]?\s*ENSINO FUNDAMENTAL|CICLO DA ALFABETIZACAO|CICLO COMPLEMENTAR|CICLO INTERMEDIARIO/.test(norm);
  if (!eFundamental && !/\d\s*[º°O]?\s*ANO\s+ANO\s*:\s*\d{4}/.test(norm)) {
    // ainda tenta se houver padrões de série + ano letivo
  }

  for (let s = 1; s <= 9; s++) {
    const reg = anos[s - 1];

    // Localiza bloco do ano: "1º ANO" ... até próximo "Nº ANO" ou fim
    const reBloco = new RegExp(
      `${s}\\s*[º°O]?\\s*ANO\\b([\\s\\S]*?)(?=${s < 9 ? `${s + 1}\\s*[º°O]?\\s*ANO\\b` : '$'})`,
      'i',
    );
    const mBloco = reBloco.exec(texto);
    const bloco = mBloco?.[1] ?? '';
    const blocoN = normalizar(bloco);

    // Ano letivo
    const letivo = /\bANO\s*:\s*(\d{4})\b/i.exec(bloco) ?? /\bANO\s*:\s*(\d{4})\b/i.exec(texto);
    if (letivo && (!reg.anoLetivo || mBloco)) reg.anoLetivo = letivo[1];

    // Situação
    const sit = /\b(APROVADO|REPROVADO|RETIDO|TRANSFERIDO|CURSANDO|CLASSIFICADO|EM CURSO)\b/i.exec(bloco);
    if (sit) reg.situacao = sit[1].toUpperCase().replace('EM CURSO', 'CURSANDO');

    // Notas após "Aproveitamento"
    const idxApr = blocoN.search(/APROVEITAMENTO/);
    if (idxApr >= 0) {
      const trechoApr = bloco.slice(idxApr);
      // Tokens: números com vírgula/ponto, letras A-C, ou --
      const tokens = trechoApr.match(/\b\d{1,3}(?:[.,]\d{1,2})?\b|\b[ABC]\b|--|—/gi) ?? [];
      // Para 1º–5º: LP, (skip inglês), Arte, EdF, Mat, Cie, Hist, Geo, ER → 8 valores úteis
      // Ordem no documento: LP, Inglês(--), Arte, EdF, Mat, Ciências, História, Geografia, Ensino Religioso
      const limpos = tokens.map(normalizarNota);
      // Pega até 9 primeiros tokens significativos após Aproveitamento
      const candidatas = limpos.slice(0, 12);
      if (candidatas.length >= 6) {
        if (s < 6) {
          // índice 0 = LP, 1 = Inglês (pode ser --), 2.. = resto
          reg.notas = [
            candidatas[0] ?? '',
            candidatas[1] ?? '', // inglês vazio no fundamental I
            candidatas[2] ?? '',
            candidatas[3] ?? '',
            candidatas[4] ?? '',
            candidatas[5] ?? '',
            candidatas[6] ?? '',
            candidatas[7] ?? '',
            candidatas[8] ?? '',
          ];
        } else {
          reg.notas = candidatas.slice(0, 9);
          while (reg.notas.length < 9) reg.notas.push('');
        }
        // Escala numérica se houver números
        if (reg.notas.some((n) => /^\d/.test(n))) {
          reg.escalaNotas = reg.notas.some((n) => /^\d{1,2}(?:\.\d+)?$/.test(n) && Number(n) <= 10 && !n.includes('.'))
            ? '10'
            : '100';
          // Se tem decimais tipo 85.0 ou 71.5 → escala 100
          if (reg.notas.some((n) => /^\d{2,}/.test(n) || (n.includes('.') && Number(n) > 10))) {
            reg.escalaNotas = '100';
          }
        }
      }
    }

    // Carga horária curricular
    const cargaMatch = /CARGA\s*HORARIA\s*CURRICULAR[\s\S]{0,200}?(\d{1,5}:[0-5]\d)/i.exec(bloco);
    if (cargaMatch) {
      const horas = bloco.match(/\b\d{1,5}:[0-5]\d\b/g) ?? [];
      // Primeira H:MM após o rótulo costuma ser a carga global ou a 1ª disciplina
      const primeira = cargaMatch[1];
      if (reg.modo === 'global') {
        reg.cargas[0] = primeira;
        // Última H:MM do trecho de carga costuma ser o total da linha
        if (horas.length >= 2) reg.total = horas[horas.length - 1] ?? primeira;
        else reg.total = primeira;
      } else {
        // 6º–9º: tenta preencher por disciplina se houver várias
        const apos = bloco.slice(bloco.toUpperCase().search(/CARGA\s*HORARIA\s*CURRICULAR/i));
        const hs = apos.match(/\b\d{1,5}:[0-5]\d\b/g) ?? [];
        if (hs.length >= 9) {
          reg.cargas = hs.slice(0, 9);
          if (hs.length >= 10) reg.total = hs[9] ?? '';
        } else if (hs.length >= 1) {
          // Só total / global no 6º em curso
          reg.cargas[0] = hs[0] ?? '';
          reg.total = hs[hs.length - 1] ?? hs[0] ?? '';
        }
      }
    }

    // Carga anual explícita
    const anual = /CARGA\s*HORARIA\s*ANUAL\s*:?\s*(\d{1,5}:[0-5]\d)/i.exec(bloco)
      ?? /CH\.?\s*ANUAL\s*:?\s*(\d{1,5}:[0-5]\d)/i.exec(bloco);
    if (anual) reg.anual = anual[1];
    if (!reg.anual && reg.total) reg.anual = reg.total;
    if (!reg.total && reg.anual) reg.total = reg.anual;
    if (reg.modo === 'global' && !reg.cargas[0] && reg.anual) reg.cargas[0] = reg.anual;

    // Faltas
    const faltas = /FALTAS\s*\/?\s*HORAS[\s\S]{0,80}?(\d{1,5}:[0-5]\d|\d{1,5})/i.exec(bloco);
    if (faltas) {
      const v = faltas[1];
      reg.faltasHoras = v.includes(':') ? v : `${v}:00`;
    }

    // Escola
    const escola = /ESTABELECIMENTO\s*:\s*([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ0-9][A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ0-9\s.\-ºª]+?)(?=\s*MUNICIPIO|\s*DIAS|\s*$)/i.exec(bloco);
    if (escola) reg.escola = escola[1].replace(/\s+/g, ' ').trim();

    // Município
    const mun = /MUNICIPIO(?:\s*\/\s*ESTADO)?\s*:\s*([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ][A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ\s.\/\-]+)/i.exec(bloco);
    if (mun) reg.municipio = mun[1].replace(/\s+/g, ' ').trim();

    // Dias letivos
    const dias = /DIAS\s*LETIVOS(?:\s*ANUAIS)?\s*:\s*(\*?\d{1,3})/i.exec(bloco);
    if (dias) reg.diasLetivos = dias[1];

    // Mínimo promoção
    const min = /MINIMO\s*PARA\s*PROMOCAO\s*:\s*(\d+(?:[.,]\d+)?%?|--)/i.exec(bloco);
    if (min && min[1] !== '--') reg.minimoPromocao = min[1];

    // Observações do ano
    const obs = /OBSERVACOES\s*:?\s*([^\n]{3,120})/i.exec(bloco);
    if (obs) reg.observacoes = obs[1].replace(/\s+/g, ' ').trim();
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
    const horas = ano.modo === 'global' ? ano.cargas.slice(0, 1) : ano.cargas;
    horas.forEach((hora, i) => {
      if (lerHoras(hora) === null) achados.push({ nivel: hora.trim() ? 'erro' : 'duvida', campo: `${campo} / ${ano.modo === 'global' ? 'Carga global' : (DISCIPLINAS[i] ?? `Componente ${i + 1}`)}`, motivo: hora.trim() ? `Carga "${hora}" inválida ou ambígua. Use horas inteiras ou H:MM, com minutos de 00 a 59.` : 'Carga não identificada. Campo vazio não equivale a zero.' });
    });
    if (total === null) achados.push({ nivel: ano.total.trim() ? 'erro' : 'duvida', campo: `${campo} / Total impresso`, motivo: 'Total ausente ou inválido.' });
    if (anual === null) achados.push({ nivel: ano.anual.trim() ? 'erro' : 'duvida', campo: `${campo} / Carga anual`, motivo: 'Carga anual ausente ou inválida.' });
    if (!/^\d{4}$/.test(ano.anoLetivo) || Number(ano.anoLetivo) < 1900 || Number(ano.anoLetivo) > new Date().getFullYear()) {
      achados.push({ nivel: 'duvida', campo: `${campo} / Ano letivo`, motivo: 'Ano letivo ausente, inválido ou futuro. Confira no documento.' });
    }
    if (soma !== null && total !== null) {
      achados.push({ nivel: soma === total ? 'ok' : 'erro', campo: `${campo} / Somatória`, motivo: soma === total ? `Soma ${formatarHoras(soma)} igual ao total impresso.` : `Soma ${formatarHoras(soma)}; total impresso ${formatarHoras(total)}; diferença ${formatarHoras(Math.abs(soma - total))}.` });
      if (soma === 0) achados.push({ nivel: 'duvida', campo, motivo: 'Carga horária igual a zero. Verifique se os componentes foram preenchidos.' });
    }
    if (total !== null && anual !== null) {
      achados.push({ nivel: total === anual ? 'ok' : 'erro', campo: `${campo} / Carga anual`, motivo: total === anual ? 'Total impresso igual à carga horária anual.' : `Total ${formatarHoras(total)} diferente da carga anual ${formatarHoras(anual)}. Confira atividades complementares e observações.` });
    }
    if (!ano.confirmado) achados.push({ nivel: 'duvida', campo, motivo: 'Transcrição ainda não conferida com a imagem original.' });
  }
  const preenchidos = incluidos.filter((ano) => /^\d{4}$/.test(ano.anoLetivo));
  for (let i = 1; i < preenchidos.length; i++) {
    if (Number(preenchidos[i].anoLetivo) <= Number(preenchidos[i - 1].anoLetivo)) {
      achados.push({ nivel: 'duvida', campo: `${preenchidos[i].serie}º ano / Sequência`, motivo: 'Ano letivo igual ou anterior ao da série precedente. Verifique a trajetória escolar.' });
    }
  }
  if (!identidade) achados.push({ nivel: 'duvida', campo: 'Identificação', motivo: 'Nome, nascimento, filiação e correspondência entre frente e verso ainda não conferidos.' });
  if (!assinaturas) achados.push({ nivel: 'duvida', campo: 'Formalização', motivo: 'Data, assinaturas, registros e carimbos ainda não conferidos visualmente.' });
  if (!normas) achados.push({ nivel: 'duvida', campo: 'Regras escolares', motivo: 'Notas, frequência, situação, dias letivos e fundamento legal dependem do regimento e das normas aplicáveis ao ano. Revisão humana pendente.' });
  return achados;
}
