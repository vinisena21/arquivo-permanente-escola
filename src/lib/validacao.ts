/**
 * Módulo central de validação — Guia Escolar
 * Retorna string de erro ou null se válido.
 */

const MIN_NOME = 3;

/** Remove acentos para comparações opcionais */
export function normalizarTexto(valor: string): string {
  return valor
    .trim()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Nome completo: obrigatório, mínimo de caracteres, só letras/espaços */
export function validarNome(nome: string): string | null {
  const tratado = nome.trim().replace(/\s+/g, ' ');

  if (!tratado) {
    return 'Informe o nome completo.';
  }

  if (tratado.length < MIN_NOME) {
    return `O nome deve ter pelo menos ${MIN_NOME} caracteres.`;
  }

  // Permite letras (incl. acentos), espaços, apóstrofo e hífen
  if (!/^[\p{L}\s'’-]+$/u.test(tratado)) {
    return 'O nome deve conter apenas letras e espaços.';
  }

  return null;
}

/** Data no formato brasileiro DD/MM/AAAA */
export function validarDataBR(data: string, obrigatorio = false): string | null {
  const valor = data.trim();

  if (!valor) {
    return obrigatorio ? 'Informe a data.' : null;
  }

  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(valor);
  if (!match) {
    return 'Use o formato DD/MM/AAAA.';
  }

  const dia = Number(match[1]);
  const mes = Number(match[2]);
  const ano = Number(match[3]);

  if (mes < 1 || mes > 12) {
    return 'Mês inválido.';
  }

  if (dia < 1 || dia > 31) {
    return 'Dia inválido.';
  }

  const dataObj = new Date(ano, mes - 1, dia);

  if (
    dataObj.getFullYear() !== ano ||
    dataObj.getMonth() !== mes - 1 ||
    dataObj.getDate() !== dia
  ) {
    return 'Data inválida.';
  }

  const hoje = new Date();
  hoje.setHours(23, 59, 59, 999);

  if (dataObj > hoje) {
    return 'A data não pode ser no futuro.';
  }

  if (ano < 1900) {
    return 'Ano inválido.';
  }

  return null;
}

/** Data no formato ISO YYYY-MM-DD (input type="date") */
export function validarDataISO(data: string, obrigatorio = false): string | null {
  const valor = data.trim();

  if (!valor) {
    return obrigatorio ? 'Informe a data.' : null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    return 'Data inválida.';
  }

  const [anoStr, mesStr, diaStr] = valor.split('-');
  const ano = Number(anoStr);
  const mes = Number(mesStr);
  const dia = Number(diaStr);

  const dataObj = new Date(ano, mes - 1, dia);

  if (
    dataObj.getFullYear() !== ano ||
    dataObj.getMonth() !== mes - 1 ||
    dataObj.getDate() !== dia
  ) {
    return 'Data inválida.';
  }

  const hoje = new Date();
  hoje.setHours(23, 59, 59, 999);

  if (dataObj > hoje) {
    return 'A data não pode ser no futuro.';
  }

  if (ano < 1900) {
    return 'Ano inválido.';
  }

  return null;
}

/** Número de arquivo: inteiro positivo */
export function validarNumeroArquivo(valor: string | number): string | null {
  const n = typeof valor === 'number' ? valor : Number(valor);

  if (!Number.isInteger(n) || n <= 0) {
    return 'Informe um número de arquivo válido (maior que zero).';
  }

  if (n > 9999) {
    return 'Número de arquivo muito alto.';
  }

  return null;
}

/** Pasta obrigatória */
export function validarPasta(pasta: string): string | null {
  if (!pasta.trim()) {
    return 'Selecione uma pasta.';
  }
  return null;
}

/** E-mail simples */
export function validarEmail(email: string): string | null {
  const valor = email.trim();

  if (!valor) {
    return 'Informe o e-mail.';
  }

  // Validação pragmática
  if (!/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(valor)) {
    return 'E-mail inválido.';
  }

  return null;
}

/** Senha mínima */
export function validarSenha(senha: string, minimo = 6): string | null {
  if (!senha) {
    return 'Informe a senha.';
  }

  if (senha.length < minimo) {
    return `A senha deve ter pelo menos ${minimo} caracteres.`;
  }

  return null;
}

/** Campo de texto obrigatório genérico */
export function validarObrigatorio(valor: string, rotulo = 'Este campo'): string | null {
  if (!valor.trim()) {
    return `${rotulo} é obrigatório.`;
  }
  return null;
}

/**
 * Verifica se um estudante já possui matrícula ativa na turma especificada da escola.
 * REGRA INVIOLÁVEL: Não modifica nem corrompe registros de Rematrícula existentes.
 * Retorna mensagem de erro se houver duplicidade ou null se estiver livre.
 */
export function validarDuplicidadeTurma(
  codigoEstudanteOuMatricula: string,
  turma: string,
  escola?: string | null,
  registrosExistentes: Array<{
    codigo_estudante?: string | null;
    codigo_matricula?: string;
    turma?: string | null;
    escola?: string | null;
    deleted_at?: string | null;
  }> = []
): string | null {
  if (!codigoEstudanteOuMatricula || !turma) return null;

  const idAlvo = codigoEstudanteOuMatricula.trim().toUpperCase();
  const turmaAlvo = turma.trim().toUpperCase();
  const escolaAlvo = escola ? escola.trim().toUpperCase() : null;

  const duplicata = registrosExistentes.find((r) => {
    if (r.deleted_at) return false; // Ignora inativos / soft-deleted

    const rEstudante = (r.codigo_estudante || '').trim().toUpperCase();
    const rMatricula = (r.codigo_matricula || '').trim().toUpperCase();
    const mesmoAluno = rEstudante === idAlvo || rMatricula === idAlvo;

    if (!mesmoAluno) return false;

    const mesmaTurma = (r.turma || '').trim().toUpperCase() === turmaAlvo;
    if (!mesmaTurma) return false;

    if (escolaAlvo && r.escola) {
      return (r.escola || '').trim().toUpperCase() === escolaAlvo;
    }
    return true;
  });

  if (duplicata) {
    return `O estudante (ID/Matrícula: ${codigoEstudanteOuMatricula}) já está cadastrado nesta turma "${turma}". Dupla matrícula não é permitida.`;
  }

  return null;
}
