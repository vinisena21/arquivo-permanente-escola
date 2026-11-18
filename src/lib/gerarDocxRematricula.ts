import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  Header,
  Footer,
  PageNumber,
  ShadingType
} from 'docx';
import { saveAs } from 'file-saver';
import type { AlunoRematriculaItem } from '../components/ControleRematricula';

interface GerarDocxOptions {
  alunos: AlunoRematriculaItem[];
  turmaFiltro: string;
  totalGeral: number;
  totalConfirmados: number;
  totalMatutino: number;
  totalVespertino: number;
  dataEmissaoFormatada: string;
  nomeEscola?: string;
  municipio?: string;
}

/**
 * Gera um documento Microsoft Word (.docx) oficial, elegante e completo
 * para o Relatório de Rematrículas 2027
 */
export async function gerarDocxRematricula({
  alunos,
  turmaFiltro,
  totalGeral,
  totalConfirmados,
  totalMatutino,
  totalVespertino,
  dataEmissaoFormatada,
  nomeEscola = 'E.M. MARIA GERALDA MIRANDA BRITO SALOMÃO',
  municipio = 'PONTO DOS VOLANTES'
}: GerarDocxOptions): Promise<void> {
  const tableRows: TableRow[] = [];

  // Cabeçalho da Tabela
  const headerRow = new TableRow({
    tableHeader: true,
    cantSplit: true,
    children: [
      createHeaderCell('Nº', 500),
      createHeaderCell('MATRÍCULA', 1200),
      createHeaderCell('NOME COMPLETO DO ESTUDANTE', 3400),
      createHeaderCell('DATA NASC.', 1100),
      createHeaderCell('TURMA 2026', 1200),
      createHeaderCell('TURMA 2027', 1300),
      createHeaderCell('TURNO', 900),
      createHeaderCell('STATUS', 1300),
      createHeaderCell('ASSINATURA DO RESPONSÁVEL', 2400)
    ]
  });

  tableRows.push(headerRow);

  // Linhas com os dados dos alunos
  alunos.forEach((aluno, index) => {
    const isEven = index % 2 === 0;
    const bgCor = isEven ? 'FFFFFF' : 'F8FAFC';
    const statusTexto = aluno.rematriculado ? 'OK (2027)' : 'PENDENTE';
    const turnoTexto = aluno.turno2027 === 'VESP' ? 'VESP' : 'MAT';

    const row = new TableRow({
      cantSplit: true,
      children: [
        createDataCell(String(index + 1), 500, AlignmentType.CENTER, bgCor),
        createDataCell(aluno.codigo, 1200, AlignmentType.CENTER, bgCor),
        createDataCell(aluno.nome, 3400, AlignmentType.LEFT, bgCor, true),
        createDataCell(aluno.dataNascimento || '—', 1100, AlignmentType.CENTER, bgCor),
        createDataCell(aluno.turmaAtual, 1200, AlignmentType.CENTER, bgCor),
        createDataCell(aluno.turma2027Prevista, 1300, AlignmentType.CENTER, bgCor, false, '#1E3A8A'),
        createDataCell(turnoTexto, 900, AlignmentType.CENTER, bgCor, true, aluno.turno2027 === 'VESP' ? '#C2410C' : '#1D4ED8'),
        createDataCell(statusTexto, 1300, AlignmentType.CENTER, bgCor, true, aluno.rematriculado ? '#059669' : '#D97706'),
        createDataCell('', 2400, AlignmentType.LEFT, bgCor) // Espaço para assinatura do responsável
      ]
    });

    tableRows.push(row);
  });

  // Tabela Principal
  const relatorioTable = new Table({
    width: {
      size: 100,
      type: WidthType.PERCENTAGE
    },
    rows: tableRows
  });

  // Tabela de Assinaturas (Secretaria & Direção)
  const assinaturasTable = new Table({
    width: {
      size: 100,
      type: WidthType.PERCENTAGE
    },
    borders: {
      top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({ text: '', spacing: { before: 400, after: 100 } }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: '____________________________________________________',
                    color: '334155'
                  })
                ]
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: 'SECRETARIA ESCOLAR',
                    bold: true,
                    size: 18,
                    color: '0F172A'
                  })
                ]
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: 'Responsável pelo Registro e Matrícula',
                    size: 16,
                    color: '64748B'
                  })
                ]
              })
            ]
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({ text: '', spacing: { before: 400, after: 100 } }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: '____________________________________________________',
                    color: '334155'
                  })
                ]
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: 'DIREÇÃO ESCOLAR',
                    bold: true,
                    size: 18,
                    color: '0F172A'
                  })
                ]
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: nomeEscola,
                    size: 16,
                    color: '64748B'
                  })
                ]
              })
            ]
          })
        ]
      })
    ]
  });

  // Criação do Documento Word
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 720, // 0.5 inch (aprox 1.27 cm)
              bottom: 720,
              left: 720,
              right: 720
            }
          }
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: `${nomeEscola} · Sistema Guia Escolar`,
                    size: 15,
                    color: '94A3B8'
                  })
                ]
              })
            ]
          })
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: 'Documento Oficial de Rematrícula · Página ',
                    size: 16,
                    color: '64748B'
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    bold: true,
                    size: 16,
                    color: '334155'
                  }),
                  new TextRun({
                    text: ' de ',
                    size: 16,
                    color: '64748B'
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    bold: true,
                    size: 16,
                    color: '334155'
                  })
                ]
              })
            ]
          })
        },
        children: [
          // Cabeçalho Institucional
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: `PREFEITURA MUNICIPAL DE ${municipio.toUpperCase()}`,
                bold: true,
                size: 19,
                color: '1E293B'
              })
            ]
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: 'SECRETARIA MUNICIPAL DE EDUCAÇÃO',
                bold: true,
                size: 18,
                color: '334155'
              })
            ]
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
            children: [
              new TextRun({
                text: nomeEscola.toUpperCase(),
                bold: true,
                size: 22,
                color: '1E3A8A'
              })
            ]
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: 'RELATÓRIO OFICIAL DE REMATRÍCULA – ANO LETIVO 2027',
                bold: true,
                size: 20,
                color: '0F172A',
                underline: {}
              })
            ]
          }),

          // Bloco de Informações / Metadados
          new Paragraph({
            spacing: { after: 60 },
            children: [
              new TextRun({ text: 'Data de Emissão: ', bold: true, size: 17, color: '1E293B' }),
              new TextRun({ text: dataEmissaoFormatada, size: 17, color: '334155' }),
              new TextRun({ text: '    |    Filtro de Turma: ', bold: true, size: 17, color: '1E293B' }),
              new TextRun({ text: turmaFiltro === 'todas' ? 'Todas as Turmas' : turmaFiltro, size: 17, color: '334155' }),
              new TextRun({ text: '    |    Total de Estudantes: ', bold: true, size: 17, color: '1E293B' }),
              new TextRun({ text: `${alunos.length} registros`, bold: true, size: 17, color: '1E3A8A' })
            ]
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun({ text: 'Rematriculados Confirmados: ', bold: true, size: 17, color: '059669' }),
              new TextRun({ text: `${totalConfirmados} de ${totalGeral}`, bold: true, size: 17, color: '059669' }),
              new TextRun({ text: '    |    Turno Matutino (MAT): ', bold: true, size: 17, color: '1D4ED8' }),
              new TextRun({ text: `${totalMatutino}`, bold: true, size: 17, color: '1D4ED8' }),
              new TextRun({ text: '    |    Turno Vespertino (VESP): ', bold: true, size: 17, color: 'C2410C' }),
              new TextRun({ text: `${totalVespertino}`, bold: true, size: 17, color: 'C2410C' })
            ]
          }),

          // Tabela Oficial de Alunos
          relatorioTable,

          // Espaçamento e Bloco de Assinaturas
          new Paragraph({ text: '', spacing: { before: 200 } }),
          assinaturasTable
        ]
      }
    ]
  });

  // Gera o arquivo .docx e faz download automático
  const blob = await Packer.toBlob(doc);
  const dataArquivo = new Date().toISOString().slice(0, 10);
  saveAs(blob, `Relatorio_Rematriculas_2027_${dataArquivo}.docx`);
}

function createHeaderCell(texto: string, widthTwips: number): TableCell {
  return new TableCell({
    width: { size: widthTwips, type: WidthType.DXA },
    shading: { type: ShadingType.CLEAR, fill: '1E3A8A' },
    margins: { top: 120, bottom: 120, left: 100, right: 100 },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: texto,
            bold: true,
            size: 15,
            color: 'FFFFFF'
          })
        ]
      })
    ]
  });
}

function createDataCell(
  texto: string,
  widthTwips: number,
  align: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT,
  bgCor: string = 'FFFFFF',
  bold: boolean = false,
  textColor: string = '1E293B'
): TableCell {
  return new TableCell({
    width: { size: widthTwips, type: WidthType.DXA },
    shading: { type: ShadingType.CLEAR, fill: bgCor },
    margins: { top: 90, bottom: 90, left: 90, right: 90 },
    children: [
      new Paragraph({
        alignment: align,
        children: [
          new TextRun({
            text: texto,
            bold: bold,
            size: 15,
            color: textColor
          })
        ]
      })
    ]
  });
}
