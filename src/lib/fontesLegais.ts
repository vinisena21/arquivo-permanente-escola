export const FONTES_LEGAIS = [
  {
    id: 'ldb', titulo: 'Lei 9.394/1996 (LDB), art. 24',
    url: 'https://www.planalto.gov.br/ccivil_03/leis/l9394.htm',
    resumo: 'Para Ensino Fundamental regular, o art. 24, I prevê 800 horas anuais e 200 dias de efetivo trabalho escolar. O inciso VI trata do controle de frequência pela escola e da frequência mínima de 75% para aprovação. O inciso VII atribui à instituição a expedição do histórico com as especificações cabíveis. A escala de notas e o mínimo para promoção não são fixados em 60 pontos pela LDB. Considerar a redação vigente no ano estudado e as normas do respectivo sistema.',
  },
  {
    id: 'lei14040', titulo: 'Lei 14.040/2020, art. 2º, II e §§ 1º a 5º',
    url: 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2020/lei/l14040.htm',
    resumo: 'No ano letivo afetado pela calamidade, a lei permitiu, em caráter excepcional e observadas as diretrizes do CNE, BNCC e normas do sistema de ensino, dispensa do mínimo de dias no Ensino Fundamental e Médio, mantendo a carga horária mínima. O § 3º permitiu integralização no ano subsequente, inclusive continuum de duas séries/anos. Atividades não presenciais dependem dos critérios e das normas aplicáveis. Não confundir dispensa de dias com dispensa de horas ou de frequência. Esta fonte não estabelece uma frase obrigatória a ser impressa em todo histórico.',
  },
  {
    id: 'lei14218', titulo: 'Lei 14.218/2021, art. 1º',
    url: 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14218.htm',
    resumo: 'Publicada em 14/10/2021, acrescentou o § 2º ao art. 1º da Lei 14.040/2020: as normas excepcionais vigoraram até o encerramento do ano letivo de 2021, sem vinculação à vigência do Decreto Legislativo 6/2020. A aplicação documental depende do calendário efetivo, das diretrizes e das normas do sistema. Não aplicar esta extensão automaticamente a 2022 ou anos posteriores.',
  },
] as const;
export type FonteLegalId = typeof FONTES_LEGAIS[number]['id'];
export const DATA_BASE_LEGAL = '2026-10-05';
