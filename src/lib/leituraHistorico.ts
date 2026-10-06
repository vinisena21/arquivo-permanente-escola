import type { PaginaLida } from './conferenciaHistorico';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import ocrWorkerUrl from 'tesseract.js/dist/worker.min.js?url';

const LIMITE_BYTES = 25 * 1024 * 1024;
const TIPOS_IMAGEM = ['image/jpeg', 'image/png', 'image/webp'];
const TIPO_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function verificarCancelamento(signal: AbortSignal) {
  if (signal.aborted) throw new DOMException('Leitura cancelada.', 'AbortError');
}

async function aguardar<T>(promessa: Promise<T>, signal: AbortSignal): Promise<T> {
  verificarCancelamento(signal);
  let cancelar: () => void = () => {};
  const cancelada = new Promise<never>((_, reject) => {
    cancelar = () => reject(new DOMException('Leitura cancelada.', 'AbortError'));
    signal.addEventListener('abort', cancelar, { once: true });
  });
  try { return await Promise.race([promessa, cancelada]); }
  finally { signal.removeEventListener('abort', cancelar); }
}

export function validarArquivos(arquivos: File[]): void {
  if (arquivos.some((arquivo) => arquivo.size > LIMITE_BYTES)) throw new Error('Cada arquivo deve ter no máximo 25 MB.');
  const pdf = arquivos.length === 1 && arquivos[0].type === 'application/pdf';
  const docx = arquivos.length === 1 && (arquivos[0].type === TIPO_DOCX || arquivos[0].name.toLowerCase().endsWith('.docx'));
  const imagens = arquivos.length === 2 && arquivos.every((arquivo) => TIPOS_IMAGEM.includes(arquivo.type));
  if (!pdf && !docx && !imagens) {
    throw new Error('Selecione um PDF de duas páginas, um DOCX ou duas imagens PNG, JPG ou WebP (frente e verso).');
  }
}

/** Contraste + escala de cinza para melhorar OCR em scans. */
function preprocessarCanvas(origem: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = origem.width;
  canvas.height = origem.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return origem;
  ctx.drawImage(origem, 0, 0);
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  // Escala de cinza + contraste moderado
  const fator = 1.35;
  const meio = 128;
  for (let i = 0; i < d.length; i += 4) {
    const cinza = 0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!;
    let v = meio + fator * (cinza - meio);
    if (v < 0) v = 0;
    if (v > 255) v = 255;
    // Limiar suave: escurece traços de texto
    if (v < 160) v = Math.max(0, v - 25);
    else if (v > 200) v = 255;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

async function carregarImagem(arquivo: File, paraOcr = false): Promise<string> {
  const bitmap = await createImageBitmap(arquivo, { imageOrientation: 'from-image' });
  try {
    const escala = Math.min(1, 2800 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * escala);
    canvas.height = Math.round(bitmap.height * escala);
    const contexto = canvas.getContext('2d');
    if (!contexto) throw new Error('Não foi possível abrir a imagem.');
    contexto.fillStyle = '#fff';
    contexto.fillRect(0, 0, canvas.width, canvas.height);
    contexto.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const final = paraOcr ? preprocessarCanvas(canvas) : canvas;
    return final.toDataURL('image/png');
  } finally {
    bitmap.close();
  }
}

function textoDeCelula(xmlCelula: string): string {
  return xmlCelula
    .replace(/<w:tab\b[^/]*\/>/gi, ' ')
    .replace(/<w:br\b[^/]*\/>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/&/g, '&')
    .replace(/"/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extrai texto de DOCX preservando estrutura de tabela:
 * células separadas por " | " e linhas de tabela por quebra de linha.
 */
async function extrairTextoDocx(arquivo: File, signal: AbortSignal): Promise<string> {
  verificarCancelamento(signal);
  const PizZip = (await import('pizzip')).default;
  const zip = new PizZip(await arquivo.arrayBuffer());
  const doc = zip.file('word/document.xml');
  if (!doc) throw new Error('Arquivo DOCX inválido: não contém word/document.xml.');
  let xml = doc.asText();

  // Normaliza cada linha de tabela: células com separador |
  xml = xml.replace(/<w:tr[\s>][\s\S]*?<\/w:tr>/gi, (linha) => {
    const celulas: string[] = [];
    const reTc = /<w:tc[\s>][\s\S]*?<\/w:tc>/gi;
    let m: RegExpExecArray | null;
    while ((m = reTc.exec(linha)) !== null) {
      celulas.push(textoDeCelula(m[0]));
    }
    if (!celulas.length) return '\n';
    return `\n${celulas.join(' | ')}\n`;
  });

  const texto = xml
    .replace(/<\/w:p>/gi, '\n')
    .replace(/<w:br\b[^/]*\/>/gi, '\n')
    .replace(/<w:tab\b[^/]*\/>/gi, '\t')
    .replace(/<[^>]+>/g, '')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/&/g, '&')
    .replace(/"/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/[ \t]+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (texto.length < 50) {
    throw new Error('Não foi possível extrair texto suficiente do DOCX. Verifique se o arquivo não está vazio ou protegido.');
  }
  return texto;
}

function imagemPlaceholder(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 800;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 2;
  ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);
  ctx.fillStyle = '#64748b';
  ctx.font = '18px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Documento digital (DOCX)', canvas.width / 2, canvas.height / 2 - 10);
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillText('Texto extraído automaticamente', canvas.width / 2, canvas.height / 2 + 20);
  return canvas.toDataURL('image/png');
}

async function prepararPaginas(arquivos: File[], signal: AbortSignal): Promise<{ imagens: string[]; imagensOcr?: string[]; textos?: string[] }> {
  validarArquivos(arquivos);
  const isDocx = arquivos.length === 1 && (arquivos[0].type === TIPO_DOCX || arquivos[0].name.toLowerCase().endsWith('.docx'));
  if (isDocx) {
    const texto = await extrairTextoDocx(arquivos[0], signal);
    const normalizado = texto.replace(/\r\n/g, '\n');
    const idxFund = normalizado.search(/HIST[ÓO]RICO ESCOLAR\s*[-–]?\s*ENSINO FUNDAMENTAL/i);
    let frente = normalizado;
    let verso = normalizado;
    if (idxFund > 80) {
      frente = normalizado.slice(0, idxFund).trim();
      verso = normalizado.slice(idxFund).trim();
    }
    const placeholder = imagemPlaceholder();
    return { imagens: [placeholder, placeholder], textos: [frente, verso] };
  }
  if (arquivos.length === 2) {
    const imagens: string[] = [];
    const imagensOcr: string[] = [];
    for (const arquivo of arquivos) {
      verificarCancelamento(signal);
      imagens.push(await carregarImagem(arquivo, false));
      imagensOcr.push(await carregarImagem(arquivo, true));
    }
    return { imagens, imagensOcr };
  }
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  verificarCancelamento(signal);
  const tarefa = pdfjs.getDocument({ data: await arquivos[0].arrayBuffer() });
  const cancelar = () => { void tarefa.destroy(); };
  signal.addEventListener('abort', cancelar, { once: true });
  try {
    const pdf = await tarefa.promise;
    if (pdf.numPages !== 2) throw new Error(`O PDF tem ${pdf.numPages} página(s). É necessário exatamente frente e verso.`);
    const imagens: string[] = [];
    const imagensOcr: string[] = [];
    for (let n = 1; n <= 2; n++) {
      verificarCancelamento(signal);
      const pagina = await pdf.getPage(n);
      const base = pagina.getViewport({ scale: 1 });
      const viewport = pagina.getViewport({ scale: Math.min(3, 2800 / Math.max(base.width, base.height)) });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      await pagina.render({ canvas, viewport }).promise;
      imagens.push(canvas.toDataURL('image/png'));
      imagensOcr.push(preprocessarCanvas(canvas).toDataURL('image/png'));
      pagina.cleanup();
    }
    return { imagens, imagensOcr };
  } finally {
    signal.removeEventListener('abort', cancelar);
    await tarefa.destroy();
  }
}

export async function lerDocumento(
  arquivos: File[], signal: AbortSignal, progresso: (texto: string) => void,
): Promise<PaginaLida[]> {
  progresso('Preparando documento…');
  const { imagens, imagensOcr, textos } = await prepararPaginas(arquivos, signal);
  verificarCancelamento(signal);

  if (textos) {
    progresso('Texto do DOCX extraído automaticamente (tabelas preservadas).');
    return textos.map((texto, i) => ({
      lado: (i === 0 ? 'Frente' : 'Verso') as 'Frente' | 'Verso',
      imagem: imagens[i]!,
      texto,
      confianca: 99,
      palavrasDuvidosas: [],
    }));
  }

  const fontesOcr = imagensOcr ?? imagens;
  const { createWorker } = await import('tesseract.js');
  let paginaAtual = 0;
  progresso('Carregando leitura em português…');
  const criandoWorker = createWorker('por', 1, {
    workerPath: ocrWorkerUrl,
    logger: ({ status, progress }) => {
      if (!signal.aborted && status === 'recognizing text') progresso(`Lendo ${paginaAtual === 0 ? 'frente' : 'verso'}: ${Math.round(progress * 100)}%`);
    },
  });
  void criandoWorker.then((w) => { if (signal.aborted) void w.terminate(); }, () => {});
  const worker = await aguardar(criandoWorker, signal);
  const cancelar = () => { void worker.terminate(); };
  signal.addEventListener('abort', cancelar, { once: true });
  try {
    verificarCancelamento(signal);
    const paginas: PaginaLida[] = [];
    for (paginaAtual = 0; paginaAtual < fontesOcr.length; paginaAtual++) {
      verificarCancelamento(signal);
      const { data } = await aguardar(
        worker.recognize(fontesOcr[paginaAtual]!, { rotateAuto: true }, { text: true, blocks: true }),
        signal,
      );
      const palavras = (data.blocks ?? []).flatMap((bloco) => bloco.paragraphs.flatMap((p) => p.lines.flatMap((linha) => linha.words)));
      const ordenadas = [...palavras].sort((a, b) => a.bbox.y0 - b.bbox.y0);
      const linhas: typeof palavras[] = [];
      for (const palavra of ordenadas) {
        const ultima = linhas.at(-1);
        const tolerancia = Math.max(4, (palavra.bbox.y1 - palavra.bbox.y0) * 0.55);
        if (ultima && Math.abs(palavra.bbox.y0 - ultima[0]!.bbox.y0) <= tolerancia) ultima.push(palavra);
        else linhas.push([palavra]);
      }
      const texto = linhas.length
        ? linhas.map((linha) => linha.sort((a, b) => a.bbox.x0 - b.bbox.x0).map((p) => p.text).join(' ')).join('\n')
        : data.text;
      paginas.push({
        lado: paginaAtual === 0 ? 'Frente' : 'Verso',
        imagem: imagens[paginaAtual]!,
        texto,
        confianca: data.confidence,
        palavrasDuvidosas: palavras.filter((p) => p.confidence < 80 && /[\p{L}\d]/u.test(p.text)).map((p) => p.text),
      });
    }
    verificarCancelamento(signal);
    return paginas;
  } finally {
    signal.removeEventListener('abort', cancelar);
    await worker.terminate();
  }
}
