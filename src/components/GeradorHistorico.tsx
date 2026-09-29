import React, { useEffect, useMemo, useState } from 'react';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { saveAs } from 'file-saver';
import {
  validarNome,
  validarDataBR,
  validarObrigatorio,
} from '../lib/validacao';
import { salvarHistoricoGerado } from '../lib/historicosSalvos';
import {
  carregarAlunosParaHistorico,
  type AlunoSecretariaResumo,
} from '../lib/alunosSecretaria';
import {
  chaveTexto,
  isoParaDataBR,
  mapearParaHistorico,
  ROTULOS_CAMPOS_HISTORICO,
  type AlunoParaHistorico,
} from '../lib/importacaoSecretaria';

const STORAGE_KEY = 'guia-escolar-historico-rascunho';

const MESES_PT = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
] as const;

function dataExtensoHoje(data: Date = new Date()): string {
  return `${data.getDate()} de ${MESES_PT[data.getMonth()]} de ${data.getFullYear()}`;
}

function mascararDataBR(valor: string): string {
  const digitos = valor.replace(/\D/g, '').slice(0, 8);
  if (digitos.length <= 2) return digitos;
  if (digitos.length <= 4) return `${digitos.slice(0, 2)}/${digitos.slice(2)}`;
  return `${digitos.slice(0, 2)}/${digitos.slice(2, 4)}/${digitos.slice(4)}`;
}

const ANOS_CONFIG = [
  { num: '1', titulo: '✏️ 1º Ano (Ciclo da Alfabetização)', temIngles: false, temCHSeparada: false, keyCHAnual: 'ch_a_1ano', keyFaltasMeio: 'faltas_1ano', exibirFaltasMeio: false },
  { num: '2', titulo: '✏️ 2º Ano (Ciclo da Alfabetização)', temIngles: false, temCHSeparada: false, keyCHAnual: 'ch_a_2ano', keyFaltasMeio: 'faltas_2ano', exibirFaltasMeio: false },
  { num: '3', titulo: '✏️ 3º Ano (Ciclo da Alfabetização)', temIngles: false, temCHSeparada: false, keyCHAnual: 'ch_a_3ano', keyFaltasMeio: 'faltas_3ano', exibirFaltasMeio: false },
  { num: '4', titulo: '📘 4º Ano (Ciclo Complementar)', temIngles: false, temCHSeparada: false, keyCHAnual: 'ch_a_4ano', keyFaltasMeio: 'faltas_4ano', exibirFaltasMeio: false },
  { num: '5', titulo: '📘 5º Ano (Ciclo Complementar)', temIngles: false, temCHSeparada: false, keyCHAnual: 'ch_a_5ano', keyFaltasMeio: 'faltas_5ano', exibirFaltasMeio: false },
  { num: '6', titulo: '📚 6º Ano (Ciclo Intermediário)', temIngles: true, temCHSeparada: true, keyCHAnual: 'ch_a_6ano', keyFaltasMeio: 'faltas_6ano', exibirFaltasMeio: true },
  { num: '7', titulo: '📚 7º Ano (Ciclo Intermediário)', temIngles: true, temCHSeparada: true, keyCHAnual: 'ch_a_7ano', keyFaltasMeio: 'faltas_7ano', exibirFaltasMeio: true },
  { num: '8', titulo: '🎓 8º Ano (Ciclo da Consolidação)', temIngles: true, temCHSeparada: true, keyCHAnual: 'ch_a_8ano', keyFaltasMeio: 'faltas_8ano', exibirFaltasMeio: true },
  { num: '9', titulo: '🎓 9º Ano (Ciclo da Consolidação)', temIngles: true, temCHSeparada: true, keyCHAnual: 'ch_a_9ano', keyFaltasMeio: 'faltas_9ano', exibirFaltasMeio: true },
];
