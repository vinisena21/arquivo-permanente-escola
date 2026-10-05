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
}

export function criarAnos(): AnoConferencia[] {
  return Array.from({ length: 9 }, (_, i) => ({
    serie: i + 1, incluido: true, anoLetivo: '',
    modo: i < 5 ? 'global' : 'disciplinas',
    cargas: Array(9).fill(''), total: '', anual: '', confirmado: false,
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

/** Only unambiguous rows from the repository's model are proposed; every proposal needs review. */
export function sugerirAnos(textos: string[]): AnoConferencia[] {
  const anos = criarAnos();
  const encontrados = new Set<number>();
  for (const texto of textos) {
    let serie: number | null = null;
    let fundamental = false;
    for (const linhaOriginal of texto.split('\n')) {
      const linha = normalizar(linhaOriginal);
      if (/HISTORICO ESCOLAR.*ENSINO FUNDAMENTAL/.test(linha)) fundamental = true;
      if (!fundamental) continue;
      const ano = /\b([1-9])\s*[º°o]?\s*ANO\b/.exec(linha);
      if (ano) serie = Number(ano[1]);
      if (!serie) continue;
      const registro = anos[serie - 1];
      const letivo = /\bANO\s*:\s*(\d{4})\b/.exec(linha);
      if (letivo) registro.anoLetivo = letivo[1];
      if (/CARGA HORARIA CURRICULAR/.test(linha)) {
        const trecho = linha.split('CARGA HORARIA CURRICULAR')[1];
        const horas = trecho.match(/\b\d{1,5}:[0-5]\d\b/g) ?? [];
        // A repeated/ambiguous row must never be silently replaced by another row.
        if (encontrados.has(serie)) {
          registro.cargas = Array(9).fill(''); registro.total = '';
          continue;
        }
        encontrados.add(serie);
        if (registro.modo === 'global' && horas.length === 2) {
          registro.cargas[0] = horas[0]; registro.total = horas[1];
        } else if (registro.modo === 'disciplinas' && horas.length === 10) {
          registro.cargas = horas.slice(0, 9); registro.total = horas[9];
        }
      }
      const anual = /CARGA HORARIA ANUAL\s*:?\s*(\d{1,5}:[0-5]\d)\b/.exec(linha);
      if (anual) registro.anual = anual[1];
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
