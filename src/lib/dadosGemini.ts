import type { PedidoAnalise } from './contratoAnaliseIA.ts';
import { normalizarConferencia } from './preenchimentoHistorico.ts';

function numero(valor: string) { return /^\d+(?:[.,]\d+)?%?$/.test(valor.trim()) ? valor.trim() : null; }
function horas(valor: string) { return /^\d{1,5}(?::[0-5]\d)?$/.test(valor.trim()) ? valor.trim() : null; }
function referencias(texto: string) {
  const normalizado = normalizarConferencia(texto);
  return {
    lei14040: /14[.\s]*040/.test(normalizado), lei14218: /14[.\s]*218/.test(normalizado),
    ldb: /9[.\s]*394/.test(normalizado), pandemia: /COVID|PANDEMIA/.test(normalizado),
    dispensaDias: /DISPENSA.{0,35}DIAS|DIAS.{0,35}DISPENSA/.test(normalizado),
    integralizacao: /INTEGRALIZA|CONTINUUM|REANP/.test(normalizado),
  };
}

// Only finite categories, numeric academic values and booleans can leave the server.
export function prepararDadosGemini(pedido: PedidoAnalise) {
  const { documento } = pedido;
  return {
    modalidade: 'Ensino Fundamental',
    identificacao: {
      camposPresentes: Object.fromEntries(Object.entries(documento).map(([k, v]) => [k, Boolean(v.trim())])),
      nomesConferem: documento.nomeFrente && documento.nomeVerso ? normalizarConferencia(documento.nomeFrente) === normalizarConferencia(documento.nomeVerso) : null,
    },
    referenciasDetectadas: referencias(`${documento.fundamentacao} ${documento.observacoesGerais} ${pedido.paginas.map((p) => p.texto).join(' ')}`),
    anos: pedido.anos.filter((a) => a.incluido).map((a) => {
      const situacao = normalizarConferencia(a.situacao);
      return {
        serie: a.serie, anoLetivo: /^\d{4}$/.test(a.anoLetivo) ? a.anoLetivo : null,
        modo: a.modo, cargas: a.cargas.map(horas), total: horas(a.total), anual: horas(a.anual),
        escolaPreenchida: Boolean(a.escola.trim()), municipioPreenchido: Boolean(a.municipio.trim()),
        diasLetivos: /^\*?\d{1,3}$/.test(a.diasLetivos.trim()) ? a.diasLetivos.trim() : null,
        situacao: ['APROVADO', 'APROVADA', 'REPROVADO', 'REPROVADA', 'RETIDO', 'RETIDA', 'TRANSFERIDO', 'TRANSFERIDA', 'CURSANDO', 'CLASSIFICADO'].includes(situacao) ? situacao : null,
        notas: a.notas.map((n) => /^[ABC]$/i.test(n.trim()) ? n.trim().toUpperCase() : numero(n)),
        escalaNotas: a.escalaNotas, minimoPromocao: numero(a.minimoPromocao), faltasHoras: horas(a.faltasHoras),
        observacoesPresentes: Boolean(a.observacoes.trim()), referencias: referencias(a.observacoes),
        transcricaoConfirmada: a.confirmado,
      };
    }),
    regimentoInformado: Boolean(pedido.regimento.trim()),
  };
}
