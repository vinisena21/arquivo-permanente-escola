/**
 * Leitura/escrita de planilhas no navegador com SheetJS (pacote `xlsx`,
 * instalado a partir da CDN oficial https://cdn.sheetjs.com/).
 *
 * A biblioteca é carregada sob demanda (import dinâmico) para não pesar
 * no carregamento inicial do sistema.
 */
import { saveAs } from 'file-saver';
import type { ValorCelula } from './importacaoSecretaria';

export const EXTENSOES_ACEITAS = '.xls,.xlsx,.csv';

/** Lê a primeira aba do arquivo e devolve uma matriz de células (texto). */
export async function lerArquivoComoMatriz(arquivo: File): Promise<ValorCelula[][]> {
  const XLSX = await import('xlsx');
  const buffer = await arquivo.arrayBuffer();
  const ehCSV = /\.csv$/i.test(arquivo.name);

  const pasta = XLSX.read(buffer, {
    type: 'array',
    cellDates: true,
    dense: true,
    // Em CSV, mantém tudo como texto (preserva zeros à esquerda de CPF, NIS...).
    raw: ehCSV,
  });

  const nomeAba = pasta.SheetNames[0];
  if (!nomeAba) throw new Error('O arquivo não possui nenhuma planilha.');

  return XLSX.utils.sheet_to_json<ValorCelula[]>(pasta.Sheets[nomeAba], {
    header: 1,
    raw: false,
    defval: '',
    blankrows: true,
    dateNF: 'dd/mm/yyyy',
  });
}

/** Gera e baixa um arquivo .xlsx ou .csv a partir de uma lista de objetos. */
export async function baixarPlanilha(
  linhas: Record<string, string | null>[],
  cabecalhos: string[],
  nomeArquivo: string,
  formato: 'xlsx' | 'csv'
): Promise<void> {
  const XLSX = await import('xlsx');
  const planilha = XLSX.utils.json_to_sheet(
    linhas.map((linha) => {
      const saida: Record<string, string> = {};
      for (const c of cabecalhos) saida[c] = linha[c] ?? '';
      return saida;
    }),
    { header: cabecalhos }
  );

  if (formato === 'csv') {
    // BOM + ";" para abrir corretamente no Excel em português.
    const csv = XLSX.utils.sheet_to_csv(planilha, { FS: ';' });
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    saveAs(blob, `${nomeArquivo}.csv`);
    return;
  }

  const pasta = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(pasta, planilha, 'Alunos');
  XLSX.writeFile(pasta, `${nomeArquivo}.xlsx`, { compression: true });
}
