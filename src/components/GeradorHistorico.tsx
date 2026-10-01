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
  mapearParaHistorico,
  type AlunoParaHistorico,
} from '../lib/importacaoSecretaria';
import GeradorHistoricoView from './GeradorHistoricoView';

const STORAGE_KEY = 'guia-escolar-historico-rascunho';
const STORAGE_MODELO_KEY = 'guia-escolar-historico-modelo';

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

const ESCOLA_PADRAO = 'E.M.MARIA GERALDA MIRANDA BRITO SALOMÃO';
const MUNICIPIO_PADRAO = 'PONTO DOS VOLANTES/MG';

function obterPrefillModelo9Ano2026(): Record<string, string> {
  const pre: Record<string, string> = {
    data_extenso: '1 de dezembro de 2026',
    historico_escolar: 'CERTIFICADO DE CONCLUSÃO DA EDUCAÇÃO BÁSICA',
    status_curso: 'CONCLUIU',
    ano_curso: '9º ANO',
    fundamentacao_legal:
      'Lei Federal n 9.394/1996 (LDBEN); Resolucao CNE/CP n 02/2017 (BNCC); Resolucao CEE/MG n 481/2021; Curriculo Referencia de Minas Gerais (CRMG). Instituicao registrada sob o Codigo INEP n 31353426.',
  };
  const anosLetivos: Record<string, string> = {
    '1': '2018', '2': '2019', '3': '2020', '4': '2021', '5': '2022',
    '6': '2023', '7': '2024', '8': '2025', '9': '2026',
  };
  ANOS_CONFIG.forEach((ano) => {
    const n = ano.num;
    pre[`ano_letivo_${n}ano`] = anosLetivos[n] || '';
    pre[`escola_${n}ano`] = ESCOLA_PADRAO;
    pre[`municipio_estado_${n}ano`] = MUNICIPIO_PADRAO;
    pre[`situacao_${n}ano`] = 'APROVADO';
    pre[`obs_${n}ano`] = n === '3' || n === '4'
      ? 'Dispensa de dias letivos (COVID-19) cf. Lei Fed. 14.040/20 e Res. SEE 4.310/20.'
      : '';
    if (ano.temCHSeparada) {
      pre[`dias_letivos_${n}ano`] = '200';
      pre[`minimo_promocao_${n}ano`] = '60%';
      pre[ano.keyCHAnual] = '833:20';
      pre[`ch_total_${n}ano`] = '833:20';
      pre[`ch_lp_${n}ano`] = '166:40';
      pre[`ch_ing_${n}ano`] = '66:40';
      pre[`ch_arte_${n}ano`] = '33:20';
      pre[`ch_edf_${n}ano`] = '66:40';
      pre[`ch_mat_${n}ano`] = '166:40';
      pre[`ch_cie_${n}ano`] = '100:00';
      pre[`ch_hist_${n}ano`] = '100:00';
      pre[`ch_geo_${n}ano`] = '100:00';
      pre[`ch_ensr_${n}ano`] = '33:20';
    } else {
      pre[`dias_letivos_${n}ano`] = n === '3' ? '*180' : '200';
      pre[`minimo_promocao_${n}ano`] = '';
      pre[ano.keyCHAnual] = '800:00';
      pre[`ch_total_${n}ano`] = '800:00';
    }
  });
  return pre;
}

const estadoInicial: Record<string, string> = {
  nome_aluno: '', naturalidade: '', uf: '', nacionalidade: '',
  sexo: '', data_nascimento: '', nome_pai: '', nome_mae: '',
  rg: '', orgao_rg: '', status_curso: '', ano_curso: '',
  data_extenso: dataExtensoHoje(),
  historico_escolar: '',
  fundamentacao_legal: 'Lei Federal n 9.394/1996 (LDBEN); Resolucao CNE/CP n 02/2017 (BNCC); Resolucao CEE/MG n 481/2021; Curriculo Referencia de Minas Gerais (CRMG). Instituicao registrada sob o Codigo INEP n 31353426.',
};

ANOS_CONFIG.forEach((ano) => {
  const n = ano.num;
  estadoInicial[`ano_letivo_${n}ano`] = '';
  estadoInicial[`escola_${n}ano`] = '';
  estadoInicial[`municipio_estado_${n}ano`] = '';
  estadoInicial[`dias_letivos_${n}ano`] = '';
  estadoInicial[`minimo_promocao_${n}ano`] = '';
  estadoInicial[`situacao_${n}ano`] = '';
  estadoInicial[`obs_${n}ano`] = '';
  estadoInicial[ano.keyCHAnual] = '';
  estadoInicial[ano.keyFaltasMeio] = '';
  estadoInicial[`ch_total_${n}ano`] = '';
  estadoInicial[`faltas_totais_${n}ano`] = '';
  estadoInicial[`nota_lp_${n}ano`] = '';
  if (ano.temIngles) estadoInicial[`nota_ing_${n}ano`] = '';
  estadoInicial[`nota_Arte_${n}ano`] = '';
  estadoInicial[`nota_edf_${n}ano`] = '';
  estadoInicial[`nota_mat_${n}ano`] = '';
  estadoInicial[`nota_cie_${n}ano`] = '';
  estadoInicial[`nota_hist_${n}ano`] = '';
  estadoInicial[`nota_geo_${n}ano`] = '';
  estadoInicial[`nota_ensr_${n}ano`] = '';
  if (ano.temCHSeparada) {
    estadoInicial[`ch_lp_${n}ano`] = '';
    estadoInicial[`ch_ing_${n}ano`] = '';
    estadoInicial[`ch_arte_${n}ano`] = '';
    estadoInicial[`ch_edf_${n}ano`] = '';
    estadoInicial[`ch_mat_${n}ano`] = '';
    estadoInicial[`ch_cie_${n}ano`] = '';
    estadoInicial[`ch_hist_${n}ano`] = '';
    estadoInicial[`ch_geo_${n}ano`] = '';
    estadoInicial[`ch_ensr_${n}ano`] = '';
  }
});

export type ModeloHistorico = 'padrao' | '9ano2026';

export interface AlunoOpcao {
  id: number;
  nome: string;
  dataNascimento: string;
}

interface GeradorHistoricoProps {
  alunos?: AlunoOpcao[];
  dadosParaCarregar?: Record<string, string> | null;
  onDadosCarregados?: () => void;
  alunoSecretariaParaCarregar?: AlunoParaHistorico | null;
  onAlunoSecretariaCarregado?: () => void;
}

interface PreenchimentoPendente {
  nomeAluno: string;
  campos: Record<string, string>;
  conflitos: string[];
}

function prepararPreenchimento(
  atuais: Record<string, string>,
  aluno: AlunoParaHistorico
): PreenchimentoPendente {
  const campos = mapearParaHistorico(aluno);
  const conflitos = Object.keys(campos).filter((chave) => {
    const atual = (atuais[chave] ?? '').trim();
    return atual !== '' && atual !== campos[chave];
  });
  return { nomeAluno: aluno.nome, campos, conflitos };
}

function aplicarPreenchimento(
  atuais: Record<string, string>,
  pendente: PreenchimentoPendente,
  substituirPreenchidos: boolean
): Record<string, string> {
  const novos = { ...atuais };
  for (const [chave, valor] of Object.entries(pendente.campos)) {
    if (!substituirPreenchidos && (atuais[chave] ?? '').trim() !== '') continue;
    novos[chave] = valor;
  }
  return novos;
}

const AVISO_FILIACAO =
  'Confira os dados preenchidos: "Filiação 2" da Secretaria foi usada como Nome do Pai (1º no histórico) e "Filiação 1" como Nome da Mãe (2º no histórico). As notas continuam manuais.';

function carregarRascunho(): Record<string, string> | null {
  try {
    const salvo = localStorage.getItem(STORAGE_KEY);
    if (!salvo) return null;
    const parsed = JSON.parse(salvo) as Record<string, string>;
    return { ...estadoInicial, ...parsed };
  } catch {
    return null;
  }
}

function carregarModeloSalvo(): ModeloHistorico {
  try {
    const m = localStorage.getItem(STORAGE_MODELO_KEY);
    if (m === '9ano2026' || m === 'padrao') return m;
  } catch { /* ignore */ }
  return 'padrao';
}

export default function GeradorHistorico({
  alunos = [],
  dadosParaCarregar = null,
  onDadosCarregados,
  alunoSecretariaParaCarregar = null,
  onAlunoSecretariaCarregado,
}: GeradorHistoricoProps) {
  const [modelo, setModelo] = useState<ModeloHistorico>(() => carregarModeloSalvo());

  const [estadoAbertura] = useState(() => {
    const base = dadosParaCarregar
      ? { ...estadoInicial, ...dadosParaCarregar }
      : carregarRascunho() ?? { ...estadoInicial };
    if (!alunoSecretariaParaCarregar) return { dados: base, pendente: null, aplicado: false };
    const pendente = prepararPreenchimento(base, alunoSecretariaParaCarregar);
    if (pendente.conflitos.length === 0) {
      return { dados: aplicarPreenchimento(base, pendente, true), pendente: null, aplicado: true };
    }
    return { dados: base, pendente, aplicado: false };
  });
  const [dados, setDados] = useState<Record<string, string>>(estadoAbertura.dados);
  const [alunosSecretaria, setAlunosSecretaria] = useState<AlunoSecretariaResumo[]>([]);
  const [buscaSecretaria, setBuscaSecretaria] = useState('');
  const [preenchimentoPendente, setPreenchimentoPendente] =
    useState<PreenchimentoPendente | null>(estadoAbertura.pendente);
  const [avisoPreenchimento, setAvisoPreenchimento] = useState(
    estadoAbertura.aplicado ? AVISO_FILIACAO : ''
  );
  const [buscaAluno, setBuscaAluno] = useState('');
  const [rascunhoSalvo, setRascunhoSalvo] = useState(false);
  const [errosValidacao, setErrosValidacao] = useState<string[]>([]);
  const [salvandoHistorico, setSalvandoHistorico] = useState(false);
  const [msgSalvo, setMsgSalvo] = useState('');

  useEffect(() => {
    if (!dadosParaCarregar) return;
    onDadosCarregados?.();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [dadosParaCarregar, onDadosCarregados]);

  useEffect(() => {
    if (alunoSecretariaParaCarregar) onAlunoSecretariaCarregado?.();
  }, [alunoSecretariaParaCarregar, onAlunoSecretariaCarregado]);

  useEffect(() => {
    let ativo = true;
    carregarAlunosParaHistorico()
      .then((lista) => {
        if (ativo) setAlunosSecretaria(lista);
      })
      .catch((erro) => console.warn('Alunos da secretaria indisponíveis:', erro));
    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(dados));
        localStorage.setItem(STORAGE_MODELO_KEY, modelo);
        setRascunhoSalvo(true);
        window.setTimeout(() => setRascunhoSalvo(false), 1500);
      } catch {
        // ignore
      }
    }, 600);
    return () => window.clearTimeout(timer);
  }, [dados, modelo]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'data_nascimento') {
      setDados({ ...dados, data_nascimento: mascararDataBR(value) });
      return;
    }
    setDados({ ...dados, [name]: value });
  };

  const aplicarModelo = (novoModelo: ModeloHistorico) => {
    setModelo(novoModelo);
    if (novoModelo === '9ano2026') {
      const prefill = obterPrefillModelo9Ano2026();
      setDados((atual) => ({ ...atual, ...prefill }));
      setAvisoPreenchimento(
        'Modelo 9º Ano 2026 aplicado: escola, município, cargas horárias, anos letivos e data (1 de dezembro de 2026) já preenchidos. Notas e dados pessoais continuam editáveis.'
      );
    } else {
      setAvisoPreenchimento('Modelo padrão selecionado (formulário em branco para preencher).');
    }
  };

  const limparFormulario = () => {
    if (!window.confirm('Tem certeza que deseja limpar todo o formulario?')) return;
    setDados({ ...estadoInicial, data_extenso: dataExtensoHoje() });
    setModelo('padrao');
    setBuscaAluno('');
    setBuscaSecretaria('');
    setPreenchimentoPendente(null);
    setAvisoPreenchimento('');
    setErrosValidacao([]);
    setMsgSalvo('');
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_MODELO_KEY);
  };

  const preencherComAluno = (aluno: AlunoOpcao) => {
    setDados((atual) => ({
      ...atual,
      nome_aluno: aluno.nome,
      data_nascimento: aluno.dataNascimento || atual.data_nascimento,
    }));
    setBuscaAluno('');
  };

  const selecionarAlunoSecretaria = (aluno: AlunoParaHistorico) => {
    const pendente = prepararPreenchimento(dados, aluno);
    setBuscaSecretaria('');
    if (pendente.conflitos.length === 0) {
      setDados((atual) => aplicarPreenchimento(atual, pendente, true));
      setPreenchimentoPendente(null);
      setAvisoPreenchimento(AVISO_FILIACAO);
    } else {
      setPreenchimentoPendente(pendente);
      setAvisoPreenchimento('');
    }
  };

  const confirmarPreenchimento = (substituirPreenchidos: boolean) => {
    if (!preenchimentoPendente) return;
    setDados((atual) => aplicarPreenchimento(atual, preenchimentoPendente, substituirPreenchidos));
    setPreenchimentoPendente(null);
    setAvisoPreenchimento(AVISO_FILIACAO);
  };

  const alunosSecretariaFiltrados = useMemo(() => {
    const termo = chaveTexto(buscaSecretaria);
    if (termo.length < 2) return [];
    return alunosSecretaria.filter((a) => chaveTexto(a.nome).includes(termo)).slice(0, 10);
  }, [alunosSecretaria, buscaSecretaria]);

  const alunosFiltrados = useMemo(() => {
    const termo = buscaAluno.trim().toLocaleLowerCase('pt-BR');
    if (!termo) return [];
    return alunos.filter((a) => a.nome.toLocaleLowerCase('pt-BR').includes(termo)).slice(0, 8);
  }, [alunos, buscaAluno]);

  const progresso = useMemo(() => {
    const identCampos = ['nome_aluno', 'data_nascimento', 'nome_mae', 'historico_escolar'];
    const identPreenchidos = identCampos.filter((c) => Boolean(dados[c]?.trim())).length;
    const anosPreenchidos = ANOS_CONFIG.filter((ano) => Boolean(dados[`ano_letivo_${ano.num}ano`]?.trim())).length;
    return {
      identificacao: identPreenchidos,
      identificacaoTotal: identCampos.length,
      anos: anosPreenchidos,
      anosTotal: ANOS_CONFIG.length,
    };
  }, [dados]);

  const salvarNoBanco = async () => {
    setMsgSalvo('');
    setErrosValidacao([]);
    const erros: string[] = [];
    const eNome = validarNome(dados.nome_aluno);
    if (eNome) erros.push(eNome);
    if (erros.length > 0) {
      setErrosValidacao(erros);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setSalvandoHistorico(true);
    try {
      await salvarHistoricoGerado(dados);
      setMsgSalvo('Histórico salvo no banco de dados (Históricos salvos).');
      window.setTimeout(() => setMsgSalvo(''), 4000);
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Falha ao salvar no Supabase.';
      setErrosValidacao([msg]);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSalvandoHistorico(false);
    }
  };

  const gerarDocumento = async (e: React.FormEvent) => {
    e.preventDefault();
    const erros: string[] = [];
    const eTitulo = validarObrigatorio(dados.historico_escolar, 'Titulo do documento');
    if (eTitulo) erros.push(eTitulo);
    const eFund = validarObrigatorio(dados.fundamentacao_legal, 'Fundamentacao legal');
    if (eFund) erros.push(eFund);
    const eNome = validarNome(dados.nome_aluno);
    if (eNome) erros.push(eNome);
    const eData = validarDataBR(dados.data_nascimento, true);
    if (eData) erros.push(eData);
    const eMae = validarObrigatorio(dados.nome_mae, 'Nome da mae');
    if (eMae) erros.push(eMae);
    setErrosValidacao(erros);
    if (erros.length > 0) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    try {
      const response = await fetch('/modelo_historico.docx');
      if (!response.ok) throw new Error('Arquivo modelo_historico.docx nao encontrado.');
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onload = (evento) => {
        const content = evento.target?.result as ArrayBuffer;
        const zip = new PizZip(content);
        const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true, nullGetter: () => '' });
        doc.render(dados);
        const out = doc.getZip().generate({
          type: 'blob',
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        });
        const nomeArquivo = dados.nome_aluno ? dados.nome_aluno.replace(/\s+/g, '_') : 'Aluno';
        saveAs(out, `Historico_${nomeArquivo}.docx`);
        void salvarHistoricoGerado(dados)
          .then(() => {
            setMsgSalvo('Documento gerado e histórico salvo no banco de dados.');
            window.setTimeout(() => setMsgSalvo(''), 4000);
          })
          .catch((err) => {
            console.error('Falha ao salvar historico:', err);
            setErrosValidacao([
              err instanceof Error
                ? err.message
                : 'Documento baixado, mas falhou ao gravar no Supabase.',
            ]);
          });
      };
      reader.readAsArrayBuffer(blob);
    } catch (error) {
      console.error(error);
      alert('Erro ao gerar documento.');
    }
  };

  return (
    <GeradorHistoricoView
      dados={dados}
      handleChange={handleChange}
      gerarDocumento={gerarDocumento}
      limparFormulario={limparFormulario}
      salvarNoBanco={salvarNoBanco}
      salvandoHistorico={salvandoHistorico}
      rascunhoSalvo={rascunhoSalvo}
      progresso={progresso}
      errosValidacao={errosValidacao}
      msgSalvo={msgSalvo}
      avisoPreenchimento={avisoPreenchimento}
      preenchimentoPendente={preenchimentoPendente}
      confirmarPreenchimento={confirmarPreenchimento}
      alunosSecretaria={alunosSecretaria}
      buscaSecretaria={buscaSecretaria}
      setBuscaSecretaria={setBuscaSecretaria}
      alunosSecretariaFiltrados={alunosSecretariaFiltrados}
      selecionarAlunoSecretaria={selecionarAlunoSecretaria}
      alunos={alunos}
      buscaAluno={buscaAluno}
      setBuscaAluno={setBuscaAluno}
      alunosFiltrados={alunosFiltrados}
      preencherComAluno={preencherComAluno}
      ANOS_CONFIG={ANOS_CONFIG}
      modelo={modelo}
      onMudarModelo={aplicarModelo}
    />
  );
}
