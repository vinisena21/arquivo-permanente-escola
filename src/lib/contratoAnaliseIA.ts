import { z } from 'zod';

const campo = z.string().max(1500);
export const DocumentoSchema = z.object({
  nomeFrente: campo, nomeVerso: campo, nascimento: campo, nomeMae: campo, nomePai: campo,
  naturalidade: campo, uf: campo, nacionalidade: campo, sexo: campo, expedicao: campo,
  titulo: campo, fundamentacao: z.string().max(5000), observacoesGerais: z.string().max(5000),
}).strict();
export const PedidoAnaliseSchema = z.object({
  paginas: z.array(z.object({ lado: z.enum(['Frente', 'Verso']), texto: z.string().max(24000) }).strict()).length(2)
    .refine((p) => p[0]?.lado === 'Frente' && p[1]?.lado === 'Verso'),
  documento: DocumentoSchema,
  anos: z.array(z.object({
    serie: z.number().int().min(1).max(9), incluido: z.boolean(), anoLetivo: z.string().max(4),
    modo: z.enum(['global', 'disciplinas']), cargas: z.array(z.string().max(20)).min(9).max(30),
    total: z.string().max(20), anual: z.string().max(20), confirmado: z.boolean(),
    escola: campo, municipio: campo, diasLetivos: z.string().max(10), situacao: campo,
    observacoes: z.string().max(5000), notas: z.array(z.string().max(20)).length(9),
    escalaNotas: z.enum(['100', '10', 'conceitos']), minimoPromocao: z.string().max(20), faltasHoras: z.string().max(20),
  }).strict()).min(1).max(9).refine((a) => new Set(a.map((v) => v.serie)).size === a.length),
  regimento: z.string().max(12000),
}).strict();

export const ResultadoModeloSchema = z.object({
  resumo: z.string().max(1500),
  achados: z.array(z.object({
    nivel: z.enum(['erro', 'duvida']), campo: z.string().max(150), motivo: z.string().max(1500),
    origem: z.enum(['ocr', 'transcricao', 'naoLocalizado']),
    pagina: z.enum(['Frente', 'Verso', 'Não localizada']), evidencia: z.string().max(500),
    fontes: z.array(z.enum(['ldb', 'lei14040', 'lei14218'])).max(3),
  }).strict()).max(30),
  pendencias: z.array(z.string().max(500)).max(15),
}).strict();
export const ResultadoAnaliseSchema = ResultadoModeloSchema.extend({ modelo: z.string(), data: z.string() });
export type PedidoAnalise = z.infer<typeof PedidoAnaliseSchema>;
export type ResultadoModelo = z.infer<typeof ResultadoModeloSchema>;
export type ResultadoAnalise = z.infer<typeof ResultadoAnaliseSchema>;

function normalizar(valor: string) { return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase(); }
export function verificarEvidencias(resultado: ResultadoModelo, pedido: PedidoAnalise): ResultadoModelo {
  return { ...resultado, achados: resultado.achados.map((achado) => {
    if (achado.origem === 'naoLocalizado') return { ...achado, nivel: 'duvida' as const };
    const fonte = achado.origem === 'ocr' ? pedido.paginas.find((p) => p.lado === achado.pagina)?.texto ?? '' : JSON.stringify({ documento: pedido.documento, anos: pedido.anos, regimento: pedido.regimento });
    if (!achado.evidencia.trim() || !normalizar(fonte).includes(normalizar(achado.evidencia))) {
      return { ...achado, nivel: 'duvida' as const, evidencia: '', motivo: `${achado.motivo} A evidência indicada pela IA não foi localizada nos dados enviados; confirme no original.` };
    }
    return achado;
  }) };
}
