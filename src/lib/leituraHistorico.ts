import type { PaginaLida } from './conferenciaHistorico';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import ocrWorkerUrl from 'tesseract.js/dist/worker.min.js?url';

const LIMITE_BYTES = 25 * 1024 * 1024;
const TIPOS_IMAGEM = ['image/jpeg', 'image/png', 'image/webp'];

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
  const imagens = arquivos.length === 2 && arquivos.every((arquivo) => TIPOS_IMAGEM.includes(arquivo.type));
  if (!pdf && !imagens) throw new Error('Selecione um PDF de duas páginas ou duas imagens PNG, JPG ou WebP (frente e verso).');
}

async function carregarImagem(arquivo: File): Promise<string> {
  const bitmap = await createImageBitmap(arquivo, { imageOrientation: 'from-image' });
  try {
    const escala = Math.min(1, 2800 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * escala);
    canvas.height = Math.round(bitmap.height * escala);
    const contexto = canvas.getContext('2d');
    if (!contexto) throw new Error('Não foi possível abrir a imagem.');
    contexto.fillStyle = '#fff'; contexto.fillRect(0, 0, canvas.width, canvas.height);
    contexto.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  } finally {
    bitmap.close();
  }
}

async function prepararPaginas(arquivos: File[], signal: AbortSignal): Promise<string[]> {
  validarArquivos(arquivos);
  if (arquivos.length === 2) {
    const imagens: string[] = [];
    for (const arquivo of arquivos) {
      verificarCancelamento(signal);
      imagens.push(await carregarImagem(arquivo));
    }
    return imagens;
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
    for (let n = 1; n <= 2; n++) {
      verificarCancelamento(signal);
      const pagina = await pdf.getPage(n);
      const base = pagina.getViewport({ scale: 1 });
      const viewport = pagina.getViewport({ scale: Math.min(3, 2800 / Math.max(base.width, base.height)) });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width); canvas.height = Math.round(viewport.height);
      await pagina.render({ canvas, viewport }).promise;
      imagens.push(canvas.toDataURL('image/png'));
      pagina.cleanup();
    }
    return imagens;
  } finally {
    signal.removeEventListener('abort', cancelar);
    await tarefa.destroy();
  }
}

export async function lerDocumento(
  arquivos: File[], signal: AbortSignal, progresso: (texto: string) => void,
): Promise<PaginaLida[]> {
  progresso('Preparando frente e verso…');
  const imagens = await prepararPaginas(arquivos, signal);
  verificarCancelamento(signal);
  const { createWorker } = await import('tesseract.js');
  let paginaAtual = 0;
  progresso('Carregando leitura em português…');
  const criandoWorker = createWorker('por', 1, {
    workerPath: ocrWorkerUrl,
    logger: ({ status, progress }) => {
      if (!signal.aborted && status === 'recognizing text') progresso(`Lendo ${paginaAtual === 0 ? 'frente' : 'verso'}: ${Math.round(progress * 100)}%`);
    },
  });
  // Worker creation can finish after cancellation; terminate that late worker as well.
  void criandoWorker.then((w) => { if (signal.aborted) void w.terminate(); }, () => {});
  const worker = await aguardar(criandoWorker, signal);
  const cancelar = () => { void worker.terminate(); };
  signal.addEventListener('abort', cancelar, { once: true });
  try {
    verificarCancelamento(signal);
    const paginas: PaginaLida[] = [];
    for (paginaAtual = 0; paginaAtual < imagens.length; paginaAtual++) {
      verificarCancelamento(signal);
      const { data } = await aguardar(worker.recognize(imagens[paginaAtual], { rotateAuto: true }, { text: true, blocks: true }), signal);
      const palavras = (data.blocks ?? []).flatMap((bloco) => bloco.paragraphs.flatMap((p) => p.lines.flatMap((linha) => linha.words)));
      // Preserve table row order from word positions instead of OCR paragraph ordering.
      const ordenadas = [...palavras].sort((a, b) => a.bbox.y0 - b.bbox.y0);
      const linhas: typeof palavras[] = [];
      for (const palavra of ordenadas) {
        const ultima = linhas.at(-1);
        const tolerancia = Math.max(4, (palavra.bbox.y1 - palavra.bbox.y0) * 0.55);
        if (ultima && Math.abs(palavra.bbox.y0 - ultima[0].bbox.y0) <= tolerancia) ultima.push(palavra);
        else linhas.push([palavra]);
      }
      const texto = linhas.length ? linhas.map((linha) => linha.sort((a, b) => a.bbox.x0 - b.bbox.x0).map((p) => p.text).join(' ')).join('\n') : data.text;
      paginas.push({
        lado: paginaAtual === 0 ? 'Frente' : 'Verso', imagem: imagens[paginaAtual], texto,
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
