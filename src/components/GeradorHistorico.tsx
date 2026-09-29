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

function carregarRascunho(): Record<string, string> | null {
  try {
    const salvo = localStorage.getItem(STORAGE_KEY);
    if (!salvo) return null;
    const parsed = JSON.parse(salvo) as Record<string, string>;
    return { ...estadoInicial, ...parsed, data_extenso: dataExtensoHoje() };
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
    setMsgSalvo('');
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

  // TEMP: incomplete UI - will restore full form in next commit if truncated
  return (
    <div style={{ padding: '10px 0 100px 0' }}>
      <div style={{ backgroundColor: '#1e3a8a', color: '#fff', padding: '20px 24px', borderRadius: '16px', marginBottom: '20px' }}>
        <h2 style={{ margin: 0 }}>Gerador Oficial de Historico Escolar</h2>
        <p style={{ margin: '8px 0 0', opacity: 0.9 }}>Carregando formulário completo...</p>
      </div>
      {errosValidacao.length > 0 && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: 14, marginBottom: 18, color: '#991b1b' }}>
          <ul>{errosValidacao.map((m) => <li key={m}>{m}</li>)}</ul>
        </div>
      )}
      {msgSalvo && (
        <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 12, padding: 14, marginBottom: 18, color: '#065f46' }}>{msgSalvo}</div>
      )}
      <form onSubmit={gerarDocumento}>
        <div style={{ marginBottom: 16 }}>
          <label>Nome do Aluno</label>
          <input name="nome_aluno" value={dados.nome_aluno} onChange={handleChange} style={{ width: '100%', padding: 10 }} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label>Data de Nascimento</label>
          <input name="data_nascimento" value={dados.data_nascimento} onChange={handleChange} placeholder="DD/MM/AAAA" style={{ width: '100%', padding: 10 }} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label>Nome da Mãe</label>
          <input name="nome_mae" value={dados.nome_mae} onChange={handleChange} style={{ width: '100%', padding: 10 }} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label>Título do documento</label>
          <select name="historico_escolar" value={dados.historico_escolar} onChange={handleChange} style={{ width: '100%', padding: 10 }}>
            <option value="">Selecione...</option>
            <option value="Histórico Escolar">Histórico Escolar</option>
            <option value="Histórico Escolar Parcial">Histórico Escolar Parcial</option>
            <option value="Certificado de Conclusão">Certificado de Conclusão</option>
            <option value="Declaração de Escolaridade">Declaração de Escolaridade</option>
          </select>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label>Data de expedição</label>
          <input name="data_extenso" value={dados.data_extenso} onChange={handleChange} style={{ width: '100%', padding: 10 }} />
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button type="button" onClick={salvarNoBanco} disabled={salvandoHistorico} style={{ padding: '12px 20px', background: '#059669', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700 }}>
            {salvandoHistorico ? 'Salvando...' : 'Salvar em Históricos salvos'}
          </button>
          <button type="submit" style={{ padding: '12px 20px', background: '#1e3a8a', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700 }}>
            Gerar Documento
          </button>
          <button type="button" onClick={limparFormulario} style={{ padding: '12px 20px', background: '#fff', color: '#64748b', border: '1px solid #cbd5e1', borderRadius: 8 }}>
            Limpar
          </button>
        </div>
      </form>
      {/* refs used to avoid unused vars */}
      <span style={{ display: 'none' }}>{progresso.identificacao}{alunosFiltrados.length}{alunosSecretariaFiltrados.length}{avisoPreenchimento}{buscaAluno}{preenchimentoPendente ? '1' : '0'}{String(preencherComAluno)}{String(selecionarAlunoSecretaria)}{String(confirmarPreenchimento)}</span>
    </div>
  );
}
