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

const ANOS_CONFIG = [
  { num: '1', titulo: '1o Ano', temIngles: false, temCHSeparada: false, keyCHAnual: 'ch_a_1ano', keyFaltasMeio: 'faltas_1ano', exibirFaltasMeio: false },
  { num: '2', titulo: '2o Ano', temIngles: false, temCHSeparada: false, keyCHAnual: 'ch_a_2ano', keyFaltasMeio: 'faltas_2ano', exibirFaltasMeio: false },
  { num: '3', titulo: '3o Ano', temIngles: false, temCHSeparada: false, keyCHAnual: 'ch_a_3ano', keyFaltasMeio: 'faltas_3ano', exibirFaltasMeio: false },
  { num: '4', titulo: '4o Ano', temIngles: false, temCHSeparada: false, keyCHAnual: 'ch_a_4ano', keyFaltasMeio: 'faltas_4ano', exibirFaltasMeio: false },
  { num: '5', titulo: '5o Ano', temIngles: false, temCHSeparada: false, keyCHAnual: 'ch_a_5ano', keyFaltasMeio: 'faltas_5ano', exibirFaltasMeio: false },
  { num: '6', titulo: '6o Ano', temIngles: true, temCHSeparada: true, keyCHAnual: 'ch_a_6ano', keyFaltasMeio: 'faltas_6ano', exibirFaltasMeio: true },
  { num: '7', titulo: '7o Ano', temIngles: true, temCHSeparada: true, keyCHAnual: 'ch_a_7ano', keyFaltasMeio: 'faltas_7ano', exibirFaltasMeio: true },
  { num: '8', titulo: '8o Ano', temIngles: true, temCHSeparada: true, keyCHAnual: 'ch_a_8ano', keyFaltasMeio: 'faltas_8ano', exibirFaltasMeio: true },
  { num: '9', titulo: '9o Ano', temIngles: true, temCHSeparada: true, keyCHAnual: 'ch_a_9ano', keyFaltasMeio: 'faltas_9ano', exibirFaltasMeio: true },
];

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

const TITULOS_NORMALIZADOS: Record<string, string> = {
  'HISTORICO ESCOLAR - TRANSFERENCIA': 'HISTÓRICO ESCOLAR - TRANSFERÊNCIA',
  'CERTIFICADO DE CONCLUSAO DA EDUCACAO BASICA': 'CERTIFICADO DE CONCLUSÃO DA EDUCAÇÃO BÁSICA',
  'HISTORICO ESCOLAR - ENSINO FUNDAMENTAL': 'HISTÓRICO ESCOLAR - ENSINO FUNDAMENTAL',
};

function normalizarTituloDocumento(titulo: string | undefined): string {
  if (!titulo) return '';
  return TITULOS_NORMALIZADOS[titulo] ?? titulo;
}

function carregarRascunho(): Record<string, string> | null {
  try {
    const salvo = localStorage.getItem(STORAGE_KEY);
    if (!salvo) return null;
    const parsed = JSON.parse(salvo) as Record<string, string>;
    return {
      ...estadoInicial,
      ...parsed,
      data_extenso: dataExtensoHoje(),
      historico_escolar: normalizarTituloDocumento(parsed.historico_escolar),
    };
  } catch {
    return null;
  }
}

export default function GeradorHistorico({
  alunos = [],
  dadosParaCarregar = null,
  onDadosCarregados,
  alunoSecretariaParaCarregar = null,
  onAlunoSecretariaCarregado,
}: GeradorHistoricoProps) {
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
        setRascunhoSalvo(true);
        window.setTimeout(() => setRascunhoSalvo(false), 1500);
      } catch {
        // ignore
      }
    }, 600);
    return () => window.clearTimeout(timer);
  }, [dados]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'data_nascimento') {
      setDados({ ...dados, data_nascimento: mascararDataBR(value) });
      return;
    }
    setDados({ ...dados, [name]: value });
  };

  const limparFormulario = () => {
    if (!window.confirm('Tem certeza que deseja limpar todo o formulario?')) return;
    setDados({ ...estadoInicial, data_extenso: dataExtensoHoje() });
    setBuscaAluno('');
    setBuscaSecretaria('');
    setPreenchimentoPendente(null);
    setAvisoPreenchimento('');
    setErrosValidacao([]);
    localStorage.removeItem(STORAGE_KEY);
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
        void salvarHistoricoGerado(dados).catch((err) =>
          console.error('Falha ao salvar historico:', err)
        );
      };
      reader.readAsArrayBuffer(blob);
    } catch (error) {
      console.error(error);
      alert('Erro ao gerar documento.');
    }
  };

  const cssCaixa = {
    border: '1px solid #cbd5e1',
    borderRadius: '12px',
    padding: '22px',
    marginBottom: '18px',
    backgroundColor: '#ffffff',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
  };
  const cssTitulo = {
    fontWeight: '700' as const,
    fontSize: '16px',
    cursor: 'pointer',
    outline: 'none',
    paddingBottom: '6px',
    color: '#1e3a8a',
  };
  const cssInput = {
    width: '100%',
    padding: '10px 12px',
    marginTop: '6px',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    fontSize: '14px',
    boxSizing: 'border-box' as const,
    outline: 'none',
    backgroundColor: '#f8fafc',
  };
  const cssGrid2 = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '18px',
    marginTop: '14px',
  };
  const cssGrid4 = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '14px',
    marginTop: '14px',
  };

  return (
    <div style={{ padding: '10px 0 100px 0' }}>
      <div style={{ backgroundColor: '#1e3a8a', color: '#fff', padding: '20px 24px', borderRadius: '16px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', borderBottom: '4px solid #3b82f6' }}>
        <div>
          <span style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase', color: '#93c5fd' }}>E.M. MARIA GERALDA MIRANDA BRITO SALOMAO</span>
          <h2 style={{ margin: '4px 0 0 0', fontSize: '20px', fontWeight: 900 }}>Gerador Oficial de Historico Escolar</h2>
        </div>
        <div style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: '8px 14px', borderRadius: '10px', fontSize: '13px', fontWeight: 600 }}>Ponto dos Volantes - MG</div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px 18px', marginBottom: '18px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '13px', color: '#475569' }}>
          <span><strong style={{ color: '#1e3a8a' }}>Identificacao:</strong> {progresso.identificacao}/{progresso.identificacaoTotal}</span>
          <span><strong style={{ color: '#1e3a8a' }}>Anos preenchidos:</strong> {progresso.anos}/{progresso.anosTotal}</span>
        </div>
        <div style={{ fontSize: '12px', color: rascunhoSalvo ? '#059669' : '#94a3b8' }}>{rascunhoSalvo ? 'Rascunho salvo' : 'Salvando rascunho...'}</div>
      </div>

      {errosValidacao.length > 0 && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '14px 18px', marginBottom: '18px', color: '#991b1b' }}>
          <strong style={{ display: 'block', marginBottom: '8px' }}>Corrija os seguintes pontos antes de gerar:</strong>
          <ul style={{ margin: 0, paddingLeft: '20px' }}>
            {errosValidacao.map((msg) => (
              <li key={msg} style={{ marginBottom: '4px', fontSize: '13px' }}>{msg}</li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={gerarDocumento} style={{ display: 'flex', flexDirection: 'column' }}>
        <details open style={cssCaixa}>
          <summary style={cssTitulo}>2. Dados do Documento</summary>
          <div style={cssGrid2}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: '13px', fontWeight: 800, color: '#be123c' }}>Titulo do Documento:</label>
              <select
                name="historico_escolar"
                value={dados.historico_escolar}
                onChange={handleChange}
                style={{ ...cssInput, border: '1px solid #fda4af', backgroundColor: '#fff1f2' }}
              >
                <option value="">Selecione o título que vai sair no documento...</option>
                <option value="HISTÓRICO ESCOLAR - TRANSFERÊNCIA">HISTÓRICO ESCOLAR - TRANSFERÊNCIA</option>
                <option value="CERTIFICADO DE CONCLUSÃO DA EDUCAÇÃO BÁSICA">CERTIFICADO DE CONCLUSÃO DA EDUCAÇÃO BÁSICA</option>
                <option value="HISTÓRICO ESCOLAR - ENSINO FUNDAMENTAL">HISTÓRICO ESCOLAR - ENSINO FUNDAMENTAL</option>
                <option value="HISTORICO ESCOLAR - TRANSFERENCIA">HISTORICO ESCOLAR - TRANSFERENCIA</option>
                <option value="CERTIFICADO DE CONCLUSAO DA EDUCACAO BASICA">CERTIFICADO DE CONCLUSAO DA EDUCACAO BASICA</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>Data de Expedicao (Extenso):</label>
              <input
                name="data_extenso"
                value={dados.data_extenso}
                onChange={handleChange}
                placeholder="Ex.: 29 de setembro de 2026"
                style={cssInput}
              />
            </div>
          </div>
          <div style={{ marginTop: '14px' }}>
            <label style={{ fontSize: '13px', fontWeight: 800, color: '#1e3a8a' }}>Fundamentacao Legal:</label>
            <textarea
              name="fundamentacao_legal"
              value={dados.fundamentacao_legal}
              onChange={handleChange}
              rows={3}
              style={{ ...cssInput, border: '1px solid #bfdbfe', backgroundColor: '#eff6ff', resize: 'vertical' as const }}
            />
          </div>
        </details>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
          <button type="button" onClick={limparFormulario} style={{ padding: '12px 18px', background: '#fff', color: '#b91c1c', border: '1px solid #fecaca', fontWeight: 700, borderRadius: '10px', cursor: 'pointer' }}>Limpar formulario</button>
          <button type="submit" style={{ padding: '12px 22px', background: '#1e3a8a', color: '#fff', border: 'none', fontWeight: 800, borderRadius: '10px', cursor: 'pointer', boxShadow: '0 8px 16px -4px rgba(30, 58, 138, 0.35)' }}>Gerar Historico (.DOCX)</button>
        </div>
      </form>
    </div>
  );
}
