import type { AlunoArquivo, AlunoSecretariaRow } from '../types/database';

export type TipoConflito =
  | 'exato_nome_data'
  | 'conflito_pasta_numero'
  | 'similaridade_alta'
  | 'secretaria_multipla'
  | 'documento_duplicado';

export type SeveridadeConflito = 'critico' | 'alerta' | 'atencao';

export interface ConflitoDuplicidade {
  id: string;
  tipo: TipoConflito;
  severidade: SeveridadeConflito;
  titulo: string;
  motivo: string;
  porcentagem: number;
  origem: 'arquivo' | 'secretaria' | 'cruzado';
  alunoA: {
    id?: number | string;
    nome: string;
    dataNascimento: string | null;
    codigoPasta?: string;
    numero?: number;
    codigoMatricula?: string;
    turma?: string;
    turno?: string;
    situacao?: string;
    filiacao?: string;
    cpf?: string;
    detalhes?: any;
  };
  alunoB: {
    id?: number | string;
    nome: string;
    dataNascimento: string | null;
    codigoPasta?: string;
    numero?: number;
    codigoMatricula?: string;
    turma?: string;
    turno?: string;
    situacao?: string;
    filiacao?: string;
    cpf?: string;
    detalhes?: any;
  };
  camposIguais: string[];
  camposDiferentes: string[];
}

/** Normaliza texto removendo acentos, pontuação e preposições */
export function normalizarNome(texto: string): string {
  if (!texto) return '';
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Remove partículas como DE, DA, DO, DOS, DAS, E */
export function simplificarNome(texto: string): string {
  const norm = normalizarNome(texto);
  const ignorar = new Set(['DE', 'DA', 'DO', 'DOS', 'DAS', 'E']);
  return norm
    .split(' ')
    .filter((p) => !ignorar.has(p))
    .join(' ');
}

/** Calcula a distância de Levenshtein entre duas strings */
export function distanciaLevenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const d: number[][] = [];

  for (let i = 0; i <= m; i++) d[i] = [i];
  for (let j = 0; j <= n; j++) d[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1, // deleção
        d[i][j - 1] + 1, // inserção
        d[i - 1][j - 1] + custo // substituição
      );
    }
  }

  return d[m][n];
}

/** Retorna a porcentagem de similaridade (0 a 100) */
export function calcularSimilaridade(str1: string, str2: string): number {
  const s1 = simplificarNome(str1);
  const s2 = simplificarNome(str2);

  if (s1 === s2) return 100;
  if (!s1 || !s2) return 0;

  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 100;

  const dist = distanciaLevenshtein(s1, s2);
  const sim = (1 - dist / maxLen) * 100;
  return Math.max(0, Math.round(sim));
}

/** Formata data para comparação consistente */
function padronizarData(d: string | null | undefined): string {
  if (!d) return '';
  const limpo = d.trim();
  if (limpo.includes('/')) {
    const partes = limpo.split('/');
    if (partes.length === 3) {
      return `${partes[2]}-${partes[1].padStart(2, '0')}-${partes[0].padStart(2, '0')}`;
    }
  }
  return limpo.slice(0, 10);
}

/** Motor Inteligente de Detecção de Duplicidades */
export function detectarDuplicidades(
  alunosArquivo: AlunoArquivo[],
  alunosSecretaria: (AlunoSecretariaRow | any)[]
): ConflitoDuplicidade[] {
  const conflitos: ConflitoDuplicidade[] = [];
  const chavesDetectadas = new Set<string>();

  function addConflito(c: ConflitoDuplicidade) {
    const k1 = `${c.tipo}-${c.alunoA.id}-${c.alunoB.id}`;
    const k2 = `${c.tipo}-${c.alunoB.id}-${c.alunoA.id}`;
    if (!chavesDetectadas.has(k1) && !chavesDetectadas.has(k2)) {
      chavesDetectadas.add(k1);
      chavesDetectadas.add(k2);
      conflitos.push(c);
    }
  }

  // =========================================================================
  // REGRA 1: Conflitos de Pasta e Número Físico (Arquivo Permanente)
  // Dois alunos diferentes ocupando o mesmo compartimento de arquivo
  // =========================================================================
  const porPastaNumero = new Map<string, AlunoArquivo[]>();
  for (const a of alunosArquivo) {
    if (a.codigoPasta && a.numero) {
      const key = `${a.codigoPasta.toUpperCase()}-${a.numero}`;
      if (!porPastaNumero.has(key)) porPastaNumero.set(key, []);
      porPastaNumero.get(key)!.push(a);
    }
  }

  for (const [, grupo] of porPastaNumero.entries()) {
    if (grupo.length > 1) {
      for (let i = 0; i < grupo.length; i++) {
        for (let j = i + 1; j < grupo.length; j++) {
          const a = grupo[i];
          const b = grupo[j];
          const nomesIguais = normalizarNome(a.nome) === normalizarNome(b.nome);

          addConflito({
            id: `pasta-${a.id}-${b.id}`,
            tipo: 'conflito_pasta_numero',
            severidade: nomesIguais ? 'critico' : 'alerta',
            titulo: `Conflito de Pasta Física: ${a.codigoPasta} (Nº ${String(a.numero).padStart(2, '0')})`,
            motivo: nomesIguais
              ? `O mesmo aluno "${a.nome}" está cadastrado duas vezes na mesma Pasta ${a.codigoPasta} e Número ${a.numero}.`
              : `Dois alunos distintos estão cadastrados no mesmo compartimento físico: Pasta ${a.codigoPasta}, Nº ${a.numero} ("${a.nome}" e "${b.nome}").`,
            porcentagem: nomesIguais ? 100 : calcularSimilaridade(a.nome, b.nome),
            origem: 'arquivo',
            alunoA: {
              id: a.id,
              nome: a.nome,
              dataNascimento: a.dataNascimento,
              codigoPasta: a.codigoPasta,
              numero: a.numero,
              situacao: a.status
            },
            alunoB: {
              id: b.id,
              nome: b.nome,
              dataNascimento: b.dataNascimento,
              codigoPasta: b.codigoPasta,
              numero: b.numero,
              situacao: b.status
            },
            camposIguais: ['Pasta', 'Número', ...(nomesIguais ? ['Nome'] : [])],
            camposDiferentes: nomesIguais ? ['ID'] : ['Nome', 'ID']
          });
        }
      }
    }
  }

  // =========================================================================
  // REGRA 2: Duplicidades no Arquivo Permanente (Mesmo Nome + Mesma Data Nasc)
  // =========================================================================
  for (let i = 0; i < alunosArquivo.length; i++) {
    for (let j = i + 1; j < Math.min(alunosArquivo.length, i + 50); j++) {
      const a = alunosArquivo[i];
      const b = alunosArquivo[j];
      const n1 = normalizarNome(a.nome);
      const n2 = normalizarNome(b.nome);
      const d1 = padronizarData(a.dataNascimento);
      const d2 = padronizarData(b.dataNascimento);

      if (n1 === n2 && d1 && d2 && d1 === d2) {
        addConflito({
          id: `exato-arq-${a.id}-${b.id}`,
          tipo: 'exato_nome_data',
          severidade: 'critico',
          titulo: 'Duplicidade Exata no Arquivo Permanente',
          motivo: `Aluno cadastrado em duplicidade no acervo físico com mesmo nome e data de nascimento (${a.dataNascimento}).`,
          porcentagem: 100,
          origem: 'arquivo',
          alunoA: {
            id: a.id,
            nome: a.nome,
            dataNascimento: a.dataNascimento,
            codigoPasta: a.codigoPasta,
            numero: a.numero,
            situacao: a.status
          },
          alunoB: {
            id: b.id,
            nome: b.nome,
            dataNascimento: b.dataNascimento,
            codigoPasta: b.codigoPasta,
            numero: b.numero,
            situacao: b.status
          },
          camposIguais: ['Nome', 'Data de Nascimento'],
          camposDiferentes: ['Pasta', 'Número']
        });
      }
    }
  }

  // =========================================================================
  // REGRA 3: Múltiplas Matrículas no Sistema da Secretaria (585 alunos)
  // =========================================================================
  const secNormalizados = alunosSecretaria.map((s, idx) => ({
    raw: s,
    idx,
    id: s.id || s['Código'] || s.codigo_matricula || `sec-${idx}`,
    nome: s.nome || s['Nome'] || '',
    nomeNorm: normalizarNome(s.nome || s['Nome'] || ''),
    nomeSimp: simplificarNome(s.nome || s['Nome'] || ''),
    dataNasc: padronizarData(s.data_nascimento || s['Data de Nascimento']),
    matricula: s.codigo_matricula || s['Código'] || '',
    turma: s.turma || s['Turma'] || '',
    turno: s.turno || s['Turno'] || '',
    situacao: s.situacao || s['Situação'] || 'NORMAL',
    filiacao: s.filiacao_1 || s['Filiação 1'] || '',
    cpf: s.dados?.['CPF'] || s['CPF'] || s.identidade || ''
  }));

  const porNomeSec = new Map<string, typeof secNormalizados>();
  for (const s of secNormalizados) {
    if (s.nomeNorm) {
      if (!porNomeSec.has(s.nomeNorm)) porNomeSec.set(s.nomeNorm, []);
      porNomeSec.get(s.nomeNorm)!.push(s);
    }
  }

  for (const [, grupo] of porNomeSec.entries()) {
    if (grupo.length > 1) {
      for (let i = 0; i < grupo.length; i++) {
        for (let j = i + 1; j < grupo.length; j++) {
          const a = grupo[i];
          const b = grupo[j];
          const datasIguais = a.dataNasc && b.dataNasc && a.dataNasc === b.dataNasc;

          addConflito({
            id: `sec-${a.matricula}-${b.matricula}`,
            tipo: 'secretaria_multipla',
            severidade: 'alerta',
            titulo: `Multi-Matrícula na Secretaria: ${a.nome}`,
            motivo: `O estudante possui 2 matrículas registradas no sistema: Matrícula ${a.matricula} (${a.situacao} - ${a.turma}) e Matrícula ${b.matricula} (${b.situacao} - ${b.turma}).`,
            porcentagem: 100,
            origem: 'secretaria',
            alunoA: {
              id: a.id,
              nome: a.nome,
              dataNascimento: a.dataNasc,
              codigoMatricula: a.matricula,
              turma: a.turma,
              turno: a.turno,
              situacao: a.situacao,
              filiacao: a.filiacao,
              cpf: a.cpf
            },
            alunoB: {
              id: b.id,
              nome: b.nome,
              dataNascimento: b.dataNasc,
              codigoMatricula: b.matricula,
              turma: b.turma,
              turno: b.turno,
              situacao: b.situacao,
              filiacao: b.filiacao,
              cpf: b.cpf
            },
            camposIguais: ['Nome', ...(datasIguais ? ['Data de Nascimento'] : [])],
            camposDiferentes: ['Código de Matrícula', 'Turma', 'Situação']
          });
        }
      }
    }
  }

  // =========================================================================
  // REGRA 4: Similaridade Inteligente (Fuzzy Matching > 85%)
  // Identifica erros de digitação e variações de grafia
  // =========================================================================
  for (let i = 0; i < secNormalizados.length; i++) {
    for (let j = i + 1; j < secNormalizados.length; j++) {
      const a = secNormalizados[i];
      const b = secNormalizados[j];

      // Pula se já é nome idêntico (já capturado na regra 3)
      if (a.nomeNorm === b.nomeNorm) continue;

      const sim = calcularSimilaridade(a.nome, b.nome);
      // Se similaridade >= 85% e tem mesma data de nascimento ou mesma filiação
      if (sim >= 85) {
        const mesmaData = a.dataNasc && b.dataNasc && a.dataNasc === b.dataNasc;
        const mesmaFiliacao =
          a.filiacao && b.filiacao && simplificarNome(a.filiacao) === simplificarNome(b.filiacao);

        if (mesmaData || mesmaFiliacao || sim >= 92) {
          addConflito({
            id: `fuzzy-sec-${a.matricula}-${b.matricula}`,
            tipo: 'similaridade_alta',
            severidade: mesmaData ? 'critico' : 'atencao',
            titulo: `Possível Duplicidade por Grafia Semelhante (${sim}%)`,
            motivo: `Nomes com alta semelhança fonética/ortográfica: "${a.nome}" e "${b.nome}"${mesmaData ? ` com mesma data de nascimento (${a.dataNasc})` : ''}.`,
            porcentagem: sim,
            origem: 'secretaria',
            alunoA: {
              id: a.id,
              nome: a.nome,
              dataNascimento: a.dataNasc,
              codigoMatricula: a.matricula,
              turma: a.turma,
              turno: a.turno,
              situacao: a.situacao,
              filiacao: a.filiacao
            },
            alunoB: {
              id: b.id,
              nome: b.nome,
              dataNascimento: b.dataNasc,
              codigoMatricula: b.matricula,
              turma: b.turma,
              turno: b.turno,
              situacao: b.situacao,
              filiacao: b.filiacao
            },
            camposIguais: [...(mesmaData ? ['Data de Nascimento'] : []), ...(mesmaFiliacao ? ['Filiação'] : [])],
            camposDiferentes: ['Nome', 'Matrícula', 'Turma']
          });
        }
      }
    }
  }

  // Ordena por severidade (critico -> alerta -> atencao)
  const ordemSev: Record<SeveridadeConflito, number> = { critico: 0, alerta: 1, atencao: 2 };
  return conflitos.sort((x, y) => ordemSev[x.severidade] - ordemSev[y.severidade]);
}
