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

// All arithmetic uses integer minutes. Empty, ambiguous and invalid values stay unknown.
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

function extrairNotasDoTrecho(trecho: string, serie: number): string[] | null {
  const notas = trecho.match(/\b(?:\d{1,3}(?:[.,]\d{1,2})?|[ABC])\b/gi) ?? [];
  const esperadas = serie < 6 ? 8 : 9;
  if (notas.length >= esperadas) {
    const selecionadas = notas.slice(0, esperadas).map((n) => n.replace(',', '.'));
    return serie < 6 ? [selecionadas[0] ?? '', '', ...selecionadas.slice(1)] : selecionadas;
  }
  if (notas.length >= 6) {
    // Preenche o que conseguiu; resto fica vazio para revisão
    const base = notas.map((n) => n.replace(',', '.'));
    if (serie < 6) {
      const arr = [base[0] ?? '', '', ...base.slice(1)];
      while (arr.length < 9) arr.push('');
      return arr.slice(0, 9);
    }
    while (base.length < 9) base.push('');
    return base.slice(0, 9);
  }
  return null;
}

function extrairHorasDoTrecho(trecho: string): string[] {
  return trecho.match(/\b\d{1,5}:[0-5]\d\b/g) ?? [];
}

/** Only unambiguous rows from the repository's model are proposed; every proposal needs review. */
export function sugerirAnos(textos: string[]): AnoConferencia[] {
  const anos = criarAnos();
  const encontradosCarga = new Set<number>();
  const preenchidosNotas = new Set<number>();

  for (const texto of textos) {
    let serie: number | null = null;
    let fundamental = false;
    let aguardandoNotas = false;
    let aguardandoCarga = false;

    for (const linhaOriginal of texto.split('\n')) {
      const linha = normalizar(linhaOriginal);
      if (!linha.trim()) continue;

      if (/HISTORICO ESCOLAR.*ENSINO FUNDAMENTAL|ENSINO FUNDAMENTAL.*HISTORICO|HISTORICO ESCOLAR/.test(linha)) {
        fundamental = true;
      }
      if (!fundamental && !/HISTORICO|APROVEITAMENTO|CARGA HORARIA|\d\s*[º°O]?\s*ANO/.test(linha)) continue;

      const anoMatch = /\b([1-9])\s*[º°O]?\s*ANO\b/.exec(linha);
      if (anoMatch) {
        serie = Number(anoMatch[1]);
        aguardandoNotas = false;
        aguardandoCarga = false;
      }
      if (!serie) continue;
      const registro = anos[serie - 1];

      // Metadados do ano
      const letivo = /\bANO\s*(?:LETIVO)?\s*:\s*(\d{4})\b/.exec(linha) ?? /\b(\d{4})\s*(?:ANO LETIVO|LETIVO)\b/.exec(linha);
      if (letivo) registro.anoLetivo = letivo[1];

      const escola = /ESTABELECIMENTO\s*:\s*(.+?)(?:\s+MUNICIPIO|$)/.exec(linha)
        ?? /ESCOLA\s*:\s*(.+?)(?:\s+MUNICIPIO|$)/.exec(linha);
      if (escola) registro.escola = escola[1].trim();

      const municipio = /MUNICIPIO(?:\s*\/\s*ESTADO)?\s*:\s*(.+)/.exec(linha);
      if (municipio) registro.municipio = municipio[1].trim();

      const dias = /DIAS LETIVOS(?: ANUAIS)?\s*:\s*(\*?\d{1,3})\b/.exec(linha);
      if (dias) registro.diasLetivos = dias[1];

      const minimo = /MINIMO PARA PROMOCAO\s*:\s*(\d+(?:[.,]\d+)?%?)/.exec(linha);
      if (minimo) registro.minimoPromocao = minimo[1];

      const observacao = /OBSERVACOES\s*:\s*(.*)/.exec(linha);
      if (observacao) registro.observacoes = observacao[1].trim();

      const situacao = /\b(APROVADO|REPROVADO|RETIDO|TRANSFERIDO|CURSANDO|CLASSIFICADO)\b/.exec(linha);
      if (situacao && (/APROVEITAMENTO/.test(linha) || /SITUACAO/.test(linha) || !registro.situacao)) {
        registro.situacao = situacao[1];
      }

      // ——— NOTAS / APROVEITAMENTO ———
      if (/APROVEITAMENTO|NOTAS?|CONCEITOS?/.test(linha)) {
        aguardandoNotas = true;
        const trecho = linha
          .replace(/.*(?:APROVEITAMENTO|NOTAS?|CONCEITOS?)\s*/i, '')
          .split(/APROVADO|REPROVADO|RETIDO|TRANSFERIDO|CURSANDO|OBSERVACOES|SITUACAO|CARGA/)[0];
        const extraidas = extrairNotasDoTrecho(trecho, serie);
        if (extraidas && !preenchidosNotas.has(serie)) {
          registro.notas = extraidas;
          preenchidosNotas.add(serie);
          aguardandoNotas = false;
        }
      } else if (aguardandoNotas && !preenchidosNotas.has(serie)) {
        // Linha seguinte ainda pode trazer as notas
        const extraidas = extrairNotasDoTrecho(linha, serie);
        if (extraidas) {
          registro.notas = extraidas;
          preenchidosNotas.add(serie);
          aguardandoNotas = false;
        } else if (/CARGA|ESTABELECIMENTO|MUNICIPIO|DIAS LETIVOS|\d\s*[º°O]?\s*ANO/.test(linha)) {
          aguardandoNotas = false;
        }
      }

      // ——— FALTAS ———
      if (/FALTAS\s*\/\s*HORAS|FALTAS\s*EM\s*HORAS|FALTAS\s*:/.test(linha)) {
        const valores = linha.split(/FALTAS\s*\/\s*HORAS|FALTAS\s*EM\s*HORAS|FALTAS\s*:/)[1]?.match(/\b\d+(?::[0-5]\d)?\b/g) ?? [];
        if (valores.length >= 1) registro.faltasHoras = valores[valores.length - 1] ?? '';
      }

      // ——— CARGA HORÁRIA CURRICULAR ———
      if (/CARGA HORARIA CURRICULAR|CARGA HORARIA\s*:|CH\s*CURRICULAR/.test(linha)) {
        aguardandoCarga = true;
        const trecho = linha.split(/CARGA HORARIA CURRICULAR|CARGA HORARIA\s*:|CH\s*CURRICULAR/)[1] ?? linha;
        const horas = extrairHorasDoTrecho(trecho);
        if (horas.length > 0 && !encontradosCarga.has(serie)) {
          encontradosCarga.add(serie);
          if (registro.modo === 'global') {
            registro.cargas[0] = horas[0] ?? '';
            if (horas.length >= 2) registro.total = horas[horas.length - 1] ?? '';
          } else if (horas.length >= 9) {
            registro.cargas = horas.slice(0, 9);
            if (horas.length >= 10) registro.total = horas[9] ?? '';
          } else if (horas.length >= 1) {
            // Preenche o que tiver
            for (let i = 0; i < Math.min(horas.length, 9); i++) {
              registro.cargas[i] = horas[i] ?? '';
            }
            if (horas.length > 9) registro.total = horas[horas.length - 1] ?? '';
          }
          aguardandoCarga = horas.length < (registro.modo === 'global' ? 1 : 9);
        }
      } else if (aguardandoCarga && !encontradosCarga.has(serie)) {
        const horas = extrairHorasDoTrecho(linha);
        if (horas.length > 0) {
          encontradosCarga.add(serie);
          if (registro.modo === 'global') {
            registro.cargas[0] = horas[0] ?? '';
            if (horas.length >= 2) registro.total = horas[horas.length - 1] ?? '';
          } else {
            for (let i = 0; i < Math.min(horas.length, 9); i++) {
              registro.cargas[i] = horas[i] ?? '';
            }
            if (horas.length >= 10) registro.total = horas[9] ?? '';
            else if (horas.length > 9) registro.total = horas[horas.length - 1] ?? '';
          }
          aguardandoCarga = false;
        } else if (/ESTABELECIMENTO|MUNICIPIO|DIAS LETIVOS|\d\s*[º°O]?\s*ANO|APROVEITAMENTO/.test(linha)) {
          aguardandoCarga = false;
        }
      }

      // Carga anual (pode estar em linha própria)
      const anual = /CARGA HORARIA ANUAL\s*:?\s*(\d{1,5}:[0-5]\d)\b/.exec(linha)
        ?? /CH\s*ANUAL\s*:?\s*(\d{1,5}:[0-5]\d)\b/.exec(linha);
      if (anual) registro.anual = anual[1];

      // Se ainda não tem total, tenta pegar um H:MM isolado depois de “total”
      if (!registro.total) {
        const totalMatch = /TOTAL\s*:?\s*(\d{1,5}:[0-5]\d)\b/.exec(linha);
        if (totalMatch) registro.total = totalMatch[1];
      }

      // Se ainda não tem carga global e achou um único H:MM grande em linha de carga
      if (registro.modo === 'global' && !registro.cargas[0] && /CARGA|HORARIA|CH\b/.test(linha)) {
        const horas = extrairHorasDoTrecho(linha);
        if (horas.length === 1) registro.cargas[0] = horas[0] ?? '';
        else if (horas.length >= 2) {
          registro.cargas[0] = horas[0] ?? '';
          registro.total = horas[horas.length - 1] ?? '';
        }
      }
    }
  }

  // Pós-processamento: se tem cargas por disciplina mas não tem total, não inventa;
  // se tem anual e não tem total, copia anual para total em modo global quando fizer sentido
  for (const registro of anos) {
    if (registro.modo === 'global' && registro.cargas[0] && !registro.total && registro.anual) {
      registro.total = registro.anual;
    }
    if (registro.modo === 'global' && !registro.anual && registro.total) {
      registro.anual = registro.total;
    }
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
