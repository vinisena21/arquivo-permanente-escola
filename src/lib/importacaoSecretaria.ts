/**
 * Leitura e normalização da exportação "Listagem de Matrícula" do sistema
 * municipal (EL Sistemas).
 *
 * Este módulo é "puro": não acessa o Supabase nem a tela. Ele recebe as
 * linhas da planilha já convertidas em matriz (array de arrays) e devolve
 * registros prontos para gravar na tabela `alunos_secretaria`.
 */

export type ValorCelula = string | number | boolean | Date | null | undefined;

/** Todas as colunas da planilha, chaveadas pelo cabeçalho (já desambiguado). */
export type DadosCompletos = Record<string, string | null>;

/** Registro normalizado, no formato da tabela `alunos_secretaria`. */
export interface RegistroSecretaria {
  codigo_matricula: string;
  codigo_estudante: string | null;
  ra: string | null;
  nome: string;
  data_nascimento: string | null; // ISO yyyy-mm-dd
  periodo: string | null;
  turma: string | null;
  descricao: string | null;
  turno: string | null;
  situacao: string | null;
  data_matricula: string | null; // ISO
  data_movimentacao: string | null; // ISO
  nacionalidade: string | null;
  naturalidade: string | null; // apenas a cidade
  uf_naturalidade: string | null; // sigla (MG, SP...)
  sexo: string | null;
  identidade: string | null;
  filiacao_1: string | null;
  filiacao_2: string | null;
  escola: string | null;
  dados: DadosCompletos;
}

export interface ResultadoLeitura {
  registros: RegistroSecretaria[];
  cabecalhos: string[];
  linhaCabecalho: number; // índice (0-based) da linha de cabeçalho
  escola: string | null;
  linhasIgnoradas: number; // linhas sem código/nome (rodapé, linhas vazias)
  matriculasDuplicadas: string[]; // códigos de matrícula repetidos no arquivo
}

/* ------------------------------------------------------------------ */
/* Normalização                                                        */
/* ------------------------------------------------------------------ */

/** Remove acentos e padroniza para comparação de textos. */
export function chaveTexto(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function doisDigitos(n: number): string {
  return String(n).padStart(2, '0');
}

/** Converte qualquer valor de célula em texto limpo; "-" e "" viram null. */
export function limparValor(valor: ValorCelula): string | null {
  if (valor === null || valor === undefined) return null;
  if (valor instanceof Date) {
    if (Number.isNaN(valor.getTime())) return null;
    return `${doisDigitos(valor.getDate())}/${doisDigitos(valor.getMonth() + 1)}/${valor.getFullYear()}`;
  }
  const texto = String(valor).replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  if (texto === '' || texto === '-' || texto === '--') return null;
  return texto;
}

/** "dd/mm/aaaa" (ou "aaaa-mm-dd") -> "aaaa-mm-dd". Retorna null se inválida. */
export function dataParaISO(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const texto = valor.trim();

  let dia: number;
  let mes: number;
  let ano: number;

  const br = texto.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})(?:\s.*)?$/);
  const iso = texto.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);

  if (iso) {
    ano = Number(iso[1]);
    mes = Number(iso[2]);
    dia = Number(iso[3]);
  } else if (br) {
    dia = Number(br[1]);
    mes = Number(br[2]);
    ano = Number(br[3]);
    if (br[3].length === 2) ano += ano > 50 ? 1900 : 2000;
  } else {
    return null;
  }

  const data = new Date(Date.UTC(ano, mes - 1, dia));
  if (
    data.getUTCFullYear() !== ano ||
    data.getUTCMonth() !== mes - 1 ||
    data.getUTCDate() !== dia
  ) {
    return null;
  }
  return `${ano}-${doisDigitos(mes)}-${doisDigitos(dia)}`;
}

/** "aaaa-mm-dd" -> "dd/mm/aaaa". */
export function isoParaDataBR(valor: string | null | undefined): string {
  if (!valor) return '';
  const partes = valor.slice(0, 10).split('-');
  if (partes.length !== 3) return valor;
  const [ano, mes, dia] = partes;
  return `${dia}/${mes}/${ano}`;
}

/** Padroniza "3° ANO" / "3º ano" -> "3º ANO". */
export function normalizarPeriodo(valor: string | null): string | null {
  if (!valor) return null;
  return valor
    .replace(/(\d)\s*[°ºo˚]\s*/gi, '$1º ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

const ESTADOS_UF: Record<string, string> = {
  acre: 'AC',
  alagoas: 'AL',
  amapa: 'AP',
  amazonas: 'AM',
  bahia: 'BA',
  ceara: 'CE',
  'distrito federal': 'DF',
  'espirito santo': 'ES',
  goias: 'GO',
  maranhao: 'MA',
  'mato grosso': 'MT',
  'mato grosso do sul': 'MS',
  'minas gerais': 'MG',
  para: 'PA',
  paraiba: 'PB',
  parana: 'PR',
  pernambuco: 'PE',
  piaui: 'PI',
  'rio de janeiro': 'RJ',
  'rio grande do norte': 'RN',
  'rio grande do sul': 'RS',
  rondonia: 'RO',
  roraima: 'RR',
  'santa catarina': 'SC',
  'sao paulo': 'SP',
  sergipe: 'SE',
  tocantins: 'TO',
};

const SIGLAS_UF = new Set(Object.values(ESTADOS_UF));

/** "MINAS GERAIS" -> "MG" (aceita também a própria sigla). */
export function estadoParaUF(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const chave = chaveTexto(valor);
  if (ESTADOS_UF[chave]) return ESTADOS_UF[chave];
  const sigla = valor.trim().toUpperCase();
  return SIGLAS_UF.has(sigla) ? sigla : null;
}

/**
 * Separa a naturalidade no formato "CIDADE - ESTADO".
 * Ex.: "ITAOBIM - MINAS GERAIS" -> { cidade: "ITAOBIM", uf: "MG" }
 */
export function separarNaturalidade(valor: string | null | undefined): {
  cidade: string | null;
  uf: string | null;
} {
  if (!valor) return { cidade: null, uf: null };
  const partes = valor
    .split(/\s+-\s+|\s*\/\s*/)
    .map((p) => p.replace(/^-+|-+$/g, '').trim())
    .filter((p) => p !== '');

  if (partes.length === 0) return { cidade: null, uf: null };

  const ultima = partes[partes.length - 1];
  const uf = partes.length > 1 ? estadoParaUF(ultima) : null;
  const partesCidade = uf ? partes.slice(0, -1) : partes;
  const cidade = partesCidade.join(' - ').trim() || null;
  return { cidade, uf };
}

/* ------------------------------------------------------------------ */
/* Cabeçalho                                                           */
/* ------------------------------------------------------------------ */

/**
 * Procura a linha de cabeçalho: a primeira que contém "Código do estudante"
 * e "Nome". Retorna -1 se não encontrar.
 */
export function encontrarLinhaCabecalho(linhas: ValorCelula[][]): number {
  const limite = Math.min(linhas.length, 50);
  for (let i = 0; i < limite; i++) {
    const chaves = (linhas[i] ?? []).map((c) => chaveTexto(String(c ?? '')));
    if (chaves.includes('codigo do estudante') && chaves.includes('nome')) {
      return i;
    }
  }
  return -1;
}

/**
 * Gera nomes únicos para as colunas. Cabeçalhos repetidos (ex.: "Falecido",
 * que aparece depois de "Filiação 1" e de "Filiação 2") recebem o contexto
 * da filiação anterior: "Falecido (Filiação 1)", "Falecido (Filiação 2)".
 */
export function desambiguarCabecalhos(brutos: ValorCelula[]): string[] {
  const textos = brutos.map((c, i) => limparValor(c) ?? `Coluna ${i + 1}`);
  const contagem = new Map<string, number>();
  textos.forEach((t) => contagem.set(t, (contagem.get(t) ?? 0) + 1));

  const usados = new Set<string>();
  let ultimaFiliacao: string | null = null;

  return textos.map((texto) => {
    const filiacao = texto.match(/^Filia[çc][ãa]o\s*\d+$/i);
    if (filiacao) ultimaFiliacao = texto;

    let nome = texto;
    if ((contagem.get(texto) ?? 0) > 1) {
      if (ultimaFiliacao && !usados.has(`${texto} (${ultimaFiliacao})`)) {
        nome = `${texto} (${ultimaFiliacao})`;
      }
    }
    let final = nome;
    let n = 2;
    while (usados.has(final)) {
      final = `${nome} (${n})`;
      n++;
    }
    usados.add(final);
    return final;
  });
}

/** Tenta identificar o nome da escola no bloco acima do cabeçalho. */
function detectarEscola(linhas: ValorCelula[][], ate: number): string | null {
  for (let i = 0; i < ate; i++) {
    for (const celula of linhas[i] ?? []) {
      const texto = limparValor(celula);
      if (!texto) continue;
      if (/^(E\.?\s?M\.?|E\.?\s?E\.?|EM|EE|ESCOLA|COLEGIO|COLÉGIO|CEI|CMEI)\s/i.test(texto)) {
        return texto;
      }
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Leitura das linhas                                                  */
/* ------------------------------------------------------------------ */

/** Localiza a coluna pelo nome (sem acento / caixa). */
function indiceColuna(cabecalhos: string[], ...nomes: string[]): number {
  const chaves = cabecalhos.map(chaveTexto);
  for (const nome of nomes) {
    const i = chaves.indexOf(chaveTexto(nome));
    if (i >= 0) return i;
  }
  return -1;
}

/**
 * Converte a matriz de células da planilha em registros normalizados.
 * @throws Error se a linha de cabeçalho não for encontrada.
 */
export function lerListagemMatricula(linhas: ValorCelula[][]): ResultadoLeitura {
  const linhaCabecalho = encontrarLinhaCabecalho(linhas);
  if (linhaCabecalho < 0) {
    throw new Error(
      'Não foi encontrada a linha de cabeçalho (com as colunas "Código do estudante" e "Nome"). Verifique se o arquivo é a Listagem de Matrícula exportada do sistema.'
    );
  }

  const cabecalhos = desambiguarCabecalhos(linhas[linhaCabecalho]);
  const escola = detectarEscola(linhas, linhaCabecalho);

  const col = {
    codigo: indiceColuna(cabecalhos, 'Código', 'Código da matrícula'),
    codigoEstudante: indiceColuna(cabecalhos, 'Código do estudante'),
    ra: indiceColuna(cabecalhos, 'Registro do estudante (RA)', 'RA'),
    nome: indiceColuna(cabecalhos, 'Nome'),
    nascimento: indiceColuna(cabecalhos, 'Data de Nascimento'),
    periodo: indiceColuna(cabecalhos, 'Período'),
    turma: indiceColuna(cabecalhos, 'Turma'),
    descricao: indiceColuna(cabecalhos, 'Descrição'),
    turno: indiceColuna(cabecalhos, 'Turno'),
    situacao: indiceColuna(cabecalhos, 'Situação'),
    dataMatricula: indiceColuna(cabecalhos, 'Data da matrícula'),
    dataMovimentacao: indiceColuna(cabecalhos, 'Data da movimentação'),
    nacionalidade: indiceColuna(cabecalhos, 'Nacionalidade'),
    naturalidade: indiceColuna(cabecalhos, 'Naturalidade'),
    sexo: indiceColuna(cabecalhos, 'Sexo'),
    identidade: indiceColuna(cabecalhos, 'Identidade', 'RG'),
    filiacao1: indiceColuna(cabecalhos, 'Filiação 1'),
    filiacao2: indiceColuna(cabecalhos, 'Filiação 2'),
  };

  if (col.codigo < 0) {
    throw new Error('A coluna "Código" (código da matrícula) não foi encontrada no arquivo.');
  }

  const porMatricula = new Map<string, RegistroSecretaria>();
  const duplicadas = new Set<string>();
  let linhasIgnoradas = 0;

  for (let i = linhaCabecalho + 1; i < linhas.length; i++) {
    const linha = linhas[i] ?? [];
    const valor = (indice: number) => (indice >= 0 ? limparValor(linha[indice]) : null);

    const codigo = valor(col.codigo);
    const nome = valor(col.nome);
    // Linhas sem código ou sem nome: vazias ou rodapé ("Usuário: ...").
    if (!codigo || !nome) {
      linhasIgnoradas++;
      continue;
    }

    const dados: DadosCompletos = {};
    cabecalhos.forEach((cabecalho, indice) => {
      dados[cabecalho] = limparValor(linha[indice]);
    });

    const nat = separarNaturalidade(valor(col.naturalidade));

    const registro: RegistroSecretaria = {
      codigo_matricula: codigo,
      codigo_estudante: valor(col.codigoEstudante),
      ra: valor(col.ra),
      nome: nome.toUpperCase(),
      data_nascimento: dataParaISO(valor(col.nascimento)),
      periodo: normalizarPeriodo(valor(col.periodo)),
      turma: valor(col.turma),
      descricao: valor(col.descricao),
      turno: valor(col.turno)?.toUpperCase() ?? null,
      situacao: valor(col.situacao)?.toUpperCase() ?? null,
      data_matricula: dataParaISO(valor(col.dataMatricula)),
      data_movimentacao: dataParaISO(valor(col.dataMovimentacao)),
      nacionalidade: valor(col.nacionalidade),
      naturalidade: nat.cidade,
      uf_naturalidade: nat.uf,
      sexo: valor(col.sexo),
      identidade: valor(col.identidade),
      filiacao_1: valor(col.filiacao1),
      filiacao_2: valor(col.filiacao2),
      escola,
      dados,
    };

    if (porMatricula.has(codigo)) duplicadas.add(codigo);
    porMatricula.set(codigo, registro); // mantém a última ocorrência
  }

  return {
    registros: Array.from(porMatricula.values()),
    cabecalhos,
    linhaCabecalho,
    escola,
    linhasIgnoradas,
    matriculasDuplicadas: Array.from(duplicadas),
  };
}

/* ------------------------------------------------------------------ */
/* Comparação com o banco                                              */
/* ------------------------------------------------------------------ */

/** Campos tipados comparados na prévia (além do jsonb `dados`). */
export const CAMPOS_COMPARADOS = [
  'codigo_estudante',
  'ra',
  'nome',
  'data_nascimento',
  'periodo',
  'turma',
  'descricao',
  'turno',
  'situacao',
  'data_matricula',
  'data_movimentacao',
  'nacionalidade',
  'naturalidade',
  'uf_naturalidade',
  'sexo',
  'identidade',
  'filiacao_1',
  'filiacao_2',
  'escola',
] as const satisfies readonly (keyof RegistroSecretaria)[];

/**
 * Colunas que mudam sozinhas com o passar do tempo e não devem, por si só,
 * marcar o aluno como "alterado" (mas continuam sendo gravadas).
 */
export const COLUNAS_IGNORADAS_NA_COMPARACAO = ['Idade na data atual'];

export type TipoAlteracao = 'novo' | 'situacao' | 'outros' | 'igual';

export interface ItemComparacao {
  tipo: TipoAlteracao;
  novo: RegistroSecretaria;
  situacaoAnterior: string | null;
  camposAlterados: string[];
}

export interface ResumoComparacao {
  itens: ItemComparacao[];
  novos: number;
  situacaoAlterada: number;
  outrosAlterados: number;
  semAlteracao: number;
  /** Matrículas que estão no banco mas não vieram no arquivo (não são excluídas). */
  ausentesNoArquivo: number;
}

/** Forma mínima de um registro já existente no banco. */
export type RegistroExistente = Pick<RegistroSecretaria, 'codigo_matricula'> &
  Partial<Omit<RegistroSecretaria, 'dados'>> & { dados?: unknown };

function comoDados(valor: unknown): Record<string, unknown> {
  return valor && typeof valor === 'object' && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : {};
}

function igual(a: unknown, b: unknown): boolean {
  const na = a === undefined || a === '' ? null : a;
  const nb = b === undefined || b === '' ? null : b;
  return String(na ?? '') === String(nb ?? '');
}

export function compararComExistentes(
  registros: RegistroSecretaria[],
  existentes: RegistroExistente[]
): ResumoComparacao {
  const mapa = new Map(existentes.map((e) => [e.codigo_matricula, e]));
  const vistos = new Set<string>();

  const itens: ItemComparacao[] = registros.map((novo) => {
    const antigo = mapa.get(novo.codigo_matricula);
    vistos.add(novo.codigo_matricula);

    if (!antigo) {
      return { tipo: 'novo', novo, situacaoAnterior: null, camposAlterados: [] };
    }

    const alterados = new Set<string>();
    for (const campo of CAMPOS_COMPARADOS) {
      if (!igual(novo[campo], antigo[campo])) alterados.add(campo);
    }

    const dadosAntigos = comoDados(antigo.dados);
    const chaves = new Set([...Object.keys(novo.dados), ...Object.keys(dadosAntigos)]);
    for (const chave of chaves) {
      if (COLUNAS_IGNORADAS_NA_COMPARACAO.includes(chave)) continue;
      if (!igual(novo.dados[chave], dadosAntigos[chave])) alterados.add(chave);
    }

    const situacaoMudou = !igual(novo.situacao, antigo.situacao);
    const lista = Array.from(alterados);
    return {
      tipo: situacaoMudou ? 'situacao' : lista.length > 0 ? 'outros' : 'igual',
      novo,
      situacaoAnterior: antigo.situacao ?? null,
      camposAlterados: lista,
    };
  });

  let ausentes = 0;
  for (const codigo of mapa.keys()) if (!vistos.has(codigo)) ausentes++;

  return {
    itens,
    novos: itens.filter((i) => i.tipo === 'novo').length,
    situacaoAlterada: itens.filter((i) => i.tipo === 'situacao').length,
    outrosAlterados: itens.filter((i) => i.tipo === 'outros').length,
    semAlteracao: itens.filter((i) => i.tipo === 'igual').length,
    ausentesNoArquivo: ausentes,
  };
}

/* ------------------------------------------------------------------ */
/* Mapeamento para o Gerador de Histórico                              */
/* ------------------------------------------------------------------ */

export interface AlunoParaHistorico {
  nome: string;
  data_nascimento: string | null;
  nacionalidade: string | null;
  naturalidade: string | null;
  uf_naturalidade: string | null;
  sexo: string | null;
  identidade: string | null;
  filiacao_1: string | null;
  filiacao_2: string | null;
  situacao: string | null;
  periodo: string | null;
}

/** Rótulos dos campos do gerador que podem ser preenchidos automaticamente. */
export const ROTULOS_CAMPOS_HISTORICO: Record<string, string> = {
  nome_aluno: 'Nome do Aluno',
  data_nascimento: 'Data de Nascimento',
  nome_mae: 'Nome da Mãe',
  nome_pai: 'Nome do Pai',
  naturalidade: 'Naturalidade',
  uf: 'UF',
  nacionalidade: 'Nacionalidade',
  sexo: 'Sexo',
  rg: 'RG',
  status_curso: 'Status Atual',
  ano_curso: 'Série Atual',
};

/**
 * Converte o aluno da secretaria para os campos do Gerador de Histórico.
 * Campos sem valor não são incluídos (para não apagar o que já existe).
 *
 * Suposição: na exportação do sistema, "Filiação 1" corresponde à mãe e
 * "Filiação 2" ao pai (padrão do Censo Escolar). O usuário pode editar.
 */
export function mapearParaHistorico(aluno: AlunoParaHistorico): Record<string, string> {
  const campos: Record<string, string> = {};
  const definir = (chave: string, valor: string | null | undefined) => {
    const texto = valor?.trim();
    if (texto) campos[chave] = texto;
  };

  definir('nome_aluno', aluno.nome.toUpperCase());
  definir('data_nascimento', isoParaDataBR(aluno.data_nascimento));
  definir('nome_mae', aluno.filiacao_1?.toUpperCase());
  definir('nome_pai', aluno.filiacao_2?.toUpperCase());
  definir('naturalidade', aluno.naturalidade?.toUpperCase());
  definir('uf', aluno.uf_naturalidade);
  definir('nacionalidade', aluno.nacionalidade?.toUpperCase());
  definir('rg', aluno.identidade);

  const sexo = chaveTexto(aluno.sexo ?? '');
  if (sexo.startsWith('m')) campos.sexo = 'MASCULINO';
  else if (sexo.startsWith('f')) campos.sexo = 'FEMININO';

  const situacao = chaveTexto(aluno.situacao ?? '');
  if (situacao === 'normal' || situacao === 'classificado' || situacao === 'reclassificado') {
    campos.status_curso = 'CURSANDO';
  } else if (situacao.startsWith('transferid')) {
    campos.status_curso = 'TRANSFERIDO';
  } else if (situacao.startsWith('conclu')) {
    campos.status_curso = 'CONCLUIU';
  }

  definir('ano_curso', normalizarPeriodo(aluno.periodo));

  return campos;
}

/**
 * Ordem das colunas da Listagem de Matrícula do sistema municipal.
 * Usada para exibir/exportar o jsonb `dados` (que não preserva a ordem das
 * chaves). Colunas desconhecidas aparecem no final, em ordem alfabética.
 */
export const ORDEM_COLUNAS_SECRETARIA: readonly string[] = [
  'Código',
  'Código do estudante',
  'Registro do estudante (RA)',
  'Nome',
  'Data de Nascimento',
  'Identificação CENSO',
  'Período',
  'Turma',
  'Descrição',
  'Turno',
  'Situação',
  'Data da matrícula',
  'Data da movimentação',
  'Idade na matrícula',
  'Idade na data atual',
  'Nacionalidade',
  'Naturalidade',
  'Sexo',
  'Cor',
  'CPF',
  'Identidade',
  'Número da certidão',
  'Livro da certidão',
  'Folha da certidão',
  'Data emissão certidão nascimento',
  'Município do cartório',
  'Nome do cartório',
  'Carteira de trabalho',
  'Série da carteira profissional',
  'Bolsa Família',
  'Número Bolsa Família',
  'Responsável pelo Bolsa Família',
  'Matrícula Nova',
  'Número do PIS/PASEP/NIS',
  'Nº do Cartão Nacional do SUS',
  'Contato 1',
  'Contato 2',
  'Contato 3',
  'E-mail',
  'E-mail 2',
  'Religião',
  'Filiação 1',
  'CPF Filiação 1',
  'Contato Filiação 1',
  'Falecido (Filiação 1)',
  'Filiação 2',
  'CPF Filiação 2',
  'Contato Filiação 2',
  'Falecido (Filiação 2)',
  'Filiação adicional',
  'Responsável',
  'CPF do responsável',
  'Tipo Logradouro',
  'Logradouro',
  'Número',
  'Cep',
  'Bairro',
  'Município',
  'Estado',
  'País de residência (CENSO)',
  'Localização diferenciada (CENSO)',
  'Localização da Residência (CENSO)',
  'Código de consumidor de energia',
  'Empresa que fornece energia',
  'Recebe Escolarização em Outro Espaço (CENSO)',
  'Estudante com deficiência',
  'Tipo de deficiência, transtorno do espectro autista e altas habilidades/superdotação',
  'Pessoa física com transtorno(s) que impacta(m) o desenvolvimento da aprendizagem',
  'Tipo(s) de transtorno(s) que impacta(m) o desenvolvimento da aprendizagem',
  'Recursos necessários para uso do estudante e para a participação em avaliações do Inep (Saeb)',
  'Tipo de Atendimento Educacional Especializado',
  'Utiliza transporte',
  'Poder Público Responsável',
  'Transporte escolar',
  'Utiliza passe',
  'Rota',
  'Ponto / Local de embarque',
  'Turma complementar',
  'Possui restrição alimentar?',
  'Restrição alimentar',
  'Observação',
  'CID',
  'Autorização do Uso de Imagem',
  'Avaliado por PDI/PEI/PDP',
  'Usuário',
  'Ativo para acessar o portal do estudante',
  'Frequenta a APAE',
  'Dias da semana que frequenta a APAE, CAPP ou AABB',
  'Escola Anterior',
  'Ano que ingressou na escola',
  'Entregou histórico?',
  'Cadastro único',
  'Confirmou rematrícula',
  'Latitude',
  'Longitude',
  'Tamanho do uniforme',
  'Retorno sem documentação',
  'Ponto de referência',
];

/** Ordena as chaves de `dados` seguindo a ordem da planilha original. */
export function ordenarColunas(chaves: Iterable<string>): string[] {
  const conhecidas = new Map(ORDEM_COLUNAS_SECRETARIA.map((c, i) => [c, i]));
  return Array.from(new Set(chaves)).sort((a, b) => {
    const ia = conhecidas.get(a);
    const ib = conhecidas.get(b);
    if (ia !== undefined && ib !== undefined) return ia - ib;
    if (ia !== undefined) return -1;
    if (ib !== undefined) return 1;
    return a.localeCompare(b, 'pt-BR');
  });
}
