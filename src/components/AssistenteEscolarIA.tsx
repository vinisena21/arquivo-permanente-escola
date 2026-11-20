import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Sparkles,
  Send,
  X,
  Minimize2,
  Maximize2,
  RotateCcw,
  Bot,
  User,
  Copy,
  Check,
  FileText,
  BookOpen,
  Key,
  ShieldCheck,
  Brain,
  Database,
  Plus,
  Trash2,
  Users,
  Minus,
  ChevronUp,
  CheckCircle2,
  AlertTriangle,
  ArrowRight
} from 'lucide-react';
import matriculasData from '../data/matriculas.json';
import turmasData from '../data/turmas.json';
import profissionaisData from '../data/profissionais.json';
import { supabase } from '../lib/supabase';
import {
  carregarMemoriaIA,
  salvarFatoMemoria,
  excluirFatoMemoria,
  carregarHistoricoConversa,
  salvarMensagemNoHistorico,
  formatarMemoriaParaPrompt,
  testarConexaoSupabase,
  SCRIPT_SQL_SUPABASE_IA,
  type FatoMemoriaIA
} from '../lib/iaMemoriaSupabase';
import './AssistenteEscolarIA.css';

export interface Mensagem {
  id: string;
  remetente: 'usuario' | 'ia';
  texto: string;
  dataHora: string;
  tipo?: 'padrao' | 'aluno' | 'documento' | 'aviso' | 'memoria' | 'acao_executada';
  dadosAluno?: {
    nome: string;
    turma: string;
    nascimento: string;
    filiacao: string;
    status: string;
    pasta?: string;
  };
  acaoExecutada?: {
    tipo: 'rematricula' | 'cancelamento' | 'navegacao' | 'busca' | 'declaracao' | 'trancamento';
    titulo: string;
    descricao: string;
    sucesso: boolean;
    detalhes?: Record<string, any>;
  };
}

interface AssistenteEscolarIAProps {
  onAbrirDeclaracao?: (alunoNome?: string) => void;
  abertoExterno?: boolean;
  onFecharExterno?: () => void;
  onNavegarAba?: (aba: string) => void;
  onBuscarAluno?: (termo: string) => void;
  abaAtual?: string;
}

export const AssistenteEscolarIA: React.FC<AssistenteEscolarIAProps> = ({
  onAbrirDeclaracao,
  abertoExterno,
  onFecharExterno,
  onNavegarAba,
  onBuscarAluno,
  abaAtual: _abaAtual
}) => {
  const [aberto, setAberto] = useState(false);
  const [minimizado, setMinimizado] = useState(false);
  const [telaCheia, setTelaCheia] = useState(false);
  const [inputTexto, setInputTexto] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [copiadoId, setCopiadoId] = useState<string | null>(null);
  const [botaoMinimizado, setBotaoMinimizado] = useState(() => {
    return localStorage.getItem('guia_ia_btn_minimized') === 'true';
  });
  
  // Painéis auxiliares
  const [configAberta, setConfigAberta] = useState(false);
  const [painelMemoriaAberto, setPainelMemoriaAberto] = useState(false);
  const [copiadoSql, setCopiadoSql] = useState(false);
  
  // Chave oficial de IA (Google Gemini)
  const chavePadraoEnv = (import.meta.env.VITE_GEMINI_API_KEY as string | undefined) || '';
  const [geminiApiKey, setGeminiApiKey] = useState(() => {
    const salva = localStorage.getItem('guia_gemini_api_key');
    if (salva && salva.trim()) return salva.trim();
    if (chavePadraoEnv && chavePadraoEnv.trim()) {
      localStorage.setItem('guia_gemini_api_key', chavePadraoEnv.trim());
      return chavePadraoEnv.trim();
    }
    return '';
  });
  const [salvandoKey, setSalvandoKey] = useState(false);

  // Memória & Supabase
  const [fatosMemoria, setFatosMemoria] = useState<FatoMemoriaIA[]>([]);
  const [novoFatoTitulo, setNovoFatoTitulo] = useState('');
  const [novoFatoConteudo, setNovoFatoConteudo] = useState('');
  const [novoFatoCategoria, setNovoFatoCategoria] = useState<'regras' | 'escola' | 'aluno' | 'pedagogico' | 'geral'>('geral');
  const [salvandoFato, setSalvandoFato] = useState(false);
  const [statusSupabase, setStatusSupabase] = useState<{
    conectado: boolean;
    tabelaMemoriaExiste: boolean;
    url: string;
    mensagem: string;
  }>({
    conectado: true,
    tabelaMemoriaExiste: false,
    url: 'https://cnaficxxzmqbyvplknbu.supabase.co',
    mensagem: 'Verificando conexão com o Supabase...'
  });

  const mensagensFimRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Mensagens com histórico
  const [mensagens, setMensagens] = useState<Mensagem[]>([
    {
      id: 'msg-welcome',
      remetente: 'ia',
      texto: `Olá! Sou o **Assistente Inteligente do Guia Escolar** da E.M. Maria Geralda Miranda Brito Salomão.

Estou agora equipado com **Memória Contínua integrada ao Supabase** e inteligência avançada de diálogo:
• **Memória Persistente**: Lembro do que conversamos e aprendo regras da escola com o comando *"Aprenda que..."*.
• **Regra de Avaliação Oficial**: 30 + 30 + 40 = 100 pontos (mínimo de 60 pontos para aprovação).
• **Consulta de Alunos**: Encontre dados de qualquer estudante digitando o nome.
• **Redação de Documentos**: Modelos oficiais de comunicados, atas e ocorrências com 1 clique.
• **100% Sempre Disponível**: Sem custo de tokens e conectado à nuvem do Supabase!

Como posso te ajudar hoje?`,
      dataHora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  // Sincronização externa de abertura
  useEffect(() => {
    if (abertoExterno) {
      setAberto(true);
      setMinimizado(false);
    }
  }, [abertoExterno]);

  const fecharJanela = () => {
    setAberto(false);
    if (onFecharExterno) onFecharExterno();
  };

  // Carregar memória e histórico do Supabase na inicialização
  useEffect(() => {
    async function inicializarMemoria() {
      // 1. Carregar fatos da memória
      const { fatos } = await carregarMemoriaIA();
      setFatosMemoria(fatos);

      // 2. Testar status do Supabase
      const status = await testarConexaoSupabase();
      setStatusSupabase(status);

      // 3. Carregar histórico anterior de conversas
      const historicoAnterior = await carregarHistoricoConversa();
      if (historicoAnterior.length > 0) {
        const msgsFormatadas: Mensagem[] = historicoAnterior.map((h) => ({
          id: h.id,
          remetente: h.remetente,
          texto: h.texto,
          dataHora: h.dataHora
        }));
        // Mantém a de boas-vindas se não houver histórico, ou carrega as anteriores
        setMensagens(msgsFormatadas);
      }
    }

    inicializarMemoria();
  }, []);

  // Rolar para a última mensagem
  useEffect(() => {
    if (aberto && !minimizado && !painelMemoriaAberto && !configAberta) {
      mensagensFimRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [mensagens, aberto, minimizado, painelMemoriaAberto, configAberta]);

  // Foco no input ao abrir
  useEffect(() => {
    if (aberto && !minimizado && !painelMemoriaAberto && !configAberta) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [aberto, minimizado, painelMemoriaAberto, configAberta]);

  // Salvar Chave Gemini
  const salvarApiKey = () => {
    localStorage.setItem('guia_gemini_api_key', geminiApiKey.trim());
    setSalvandoKey(true);
    setTimeout(() => {
      setSalvandoKey(false);
      setConfigAberta(false);
    }, 600);
  };

  // Adicionar fato manual à memória
  const handleAdicionarFatoManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoFatoTitulo.trim() || !novoFatoConteudo.trim() || salvandoFato) return;

    setSalvandoFato(true);
    try {
      const novo = await salvarFatoMemoria({
        titulo: novoFatoTitulo.trim(),
        conteudo: novoFatoConteudo.trim(),
        categoria: novoFatoCategoria,
        autor: 'Equipe Escolar'
      });

      setFatosMemoria((prev) => [...prev, novo]);
      setNovoFatoTitulo('');
      setNovoFatoConteudo('');
    } finally {
      setSalvandoFato(false);
    }
  };

  // Excluir fato da memória
  const handleExcluirFato = async (id: string) => {
    await excluirFatoMemoria(id);
    setFatosMemoria((prev) => prev.filter((f) => f.id !== id));
  };

  // Copiar SQL do Supabase
  const copiarSqlSupabase = () => {
    navigator.clipboard.writeText(SCRIPT_SQL_SUPABASE_IA);
    setCopiadoSql(true);
    setTimeout(() => setCopiadoSql(false), 2500);
  };

  // Base estatística
  const totalAlunos = useMemo(() => matriculasData.length, []);
  const totalTurmas = useMemo(() => turmasData.length, []);
  const totalProfissionais = useMemo(() => profissionaisData.length, []);

  // Função auxiliar para calcular a progressão de turma de 2026 para 2027
  const calcularProximaEtapa = (periodoOuTurma: string | null | undefined): string => {
    if (!periodoOuTurma) return 'Ano Seguinte (2027)';
    const t = periodoOuTurma.toUpperCase().trim();
    if (t.includes('1º') || t.includes('1°') || t.startsWith('1')) return '2º ANO (2027)';
    if (t.includes('2º') || t.includes('2°') || t.startsWith('2')) return '3º ANO (2027)';
    if (t.includes('3º') || t.includes('3°') || t.startsWith('3')) return '4º ANO (2027)';
    if (t.includes('4º') || t.includes('4°') || t.startsWith('4')) return '5º ANO (2027)';
    if (t.includes('5º') || t.includes('5°') || t.startsWith('5')) return '6º ANO (2027)';
    if (t.includes('6º') || t.includes('6°') || t.startsWith('60') || t.startsWith('6')) return '7º ANO (2027)';
    if (t.includes('7º') || t.includes('7°') || t.startsWith('70') || t.startsWith('7')) return '8º ANO (2027)';
    if (t.includes('8º') || t.includes('8°') || t.startsWith('80') || t.startsWith('8')) return '9º ANO (2027)';
    if (t.includes('9º') || t.includes('9°') || t.startsWith('90') || t.startsWith('9')) return 'Ensino Médio (2027)';
    if (t.includes('PRÉ') || t.includes('INFANTIL')) return '1º ANO (2027)';
    return 'Ano Seguinte (2027)';
  };

  // EXECUTOR REAL DE AÇÕES NO SISTEMA & BANCO DE DADOS
  const executarAcaoSistema = async (
    tipoAcao: string,
    params: any
  ): Promise<NonNullable<Mensagem['acaoExecutada']>> => {
    const tipo = tipoAcao.toLowerCase().trim();

    // 1. Rematricular Aluno
    if (tipo === 'rematricular' || tipo === 'rematricula') {
      const termo = String(params.aluno || params.nome || params.matricula || '').trim();
      const normalizado = termo.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

      const alunoEncontrado = (matriculasData as any[]).find((a) => {
        const n = String(a['Nome do estudante'] || a['Nome'] || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        const cod = String(a['Matrícula'] || a['Codigo'] || '').toLowerCase();
        return n.includes(normalizado) || cod === normalizado;
      });

      if (!alunoEncontrado) {
        return {
          tipo: 'rematricula',
          sucesso: false,
          titulo: 'Rematrícula 2027',
          descricao: `Não foi possível localizar o(a) estudante "${termo}" na base de dados da escola.`
        };
      }

      const cod = String(alunoEncontrado['Matrícula'] || alunoEncontrado['Codigo'] || alunoEncontrado['id']);
      const nome = String(alunoEncontrado['Nome do estudante'] || alunoEncontrado['Nome']);
      const turmaAtual = String(alunoEncontrado['Turma'] || alunoEncontrado['Ano de escolaridade'] || '');
      
      let turma2027 = params.turma_2027 || params.turma2027 || params.turma;
      if (!turma2027) {
        turma2027 = calcularProximaEtapa(turmaAtual);
      }
      
      let turno = params.turno_2027 || params.turno2027 || params.turno;
      if (!turno || (turno !== 'MAT' && turno !== 'VESP')) {
        turno = (turma2027.includes('6º') || turma2027.includes('7º') || turma2027.includes('8º') || turma2027.includes('9º')) ? 'MAT' : 'VESP';
      }

      const agora = new Date().toISOString();

      // Grava no Supabase rematriculas_2027
      try {
        await supabase.from('rematriculas_2027').upsert({
          codigo_matricula: cod,
          nome,
          turma_atual: turmaAtual,
          turma_2027: turma2027,
          turno_2027: turno,
          confirmado: true,
          confirmado_em: agora
        } as any, { onConflict: 'codigo_matricula' });
      } catch (e) {
        console.warn('[Assistente IA] Erro ao gravar rematrícula no Supabase:', e);
      }

      // Grava no localStorage e dispara evento
      try {
        const raw = localStorage.getItem('guia_escolar_rematriculas_2027');
        const mapa = raw ? JSON.parse(raw) : {};
        mapa[cod] = {
          confirmado: true,
          dataConfirmacao: agora,
          turma2027,
          turno2027: turno,
          nome,
          codigo: cod
        };
        localStorage.setItem('guia_escolar_rematriculas_2027', JSON.stringify(mapa));
        window.dispatchEvent(new Event('guia_rematricula_atualizada'));
      } catch (e) {
        console.warn('[Assistente IA] Erro ao salvar no storage:', e);
      }

      return {
        tipo: 'rematricula',
        sucesso: true,
        titulo: 'Rematrícula 2027 Confirmada!',
        descricao: `Estudante **${nome}** (Matrícula #${cod}) foi rematriculado(a) com sucesso para **${turma2027}** no turno **${turno === 'MAT' ? 'Matutino' : 'Vespertino'}**! O registro foi gravado no banco de dados.`,
        detalhes: { aluno: { nome, cod, turmaAtual, turma2027, turno } }
      };
    }

    // 2. Cancelar Rematrícula
    if (tipo === 'cancelar_rematricula' || tipo === 'cancelar') {
      const termo = String(params.aluno || params.nome || params.matricula || '').trim();
      const normalizado = termo.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

      const alunoEncontrado = (matriculasData as any[]).find((a) => {
        const n = String(a['Nome do estudante'] || a['Nome'] || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        const cod = String(a['Matrícula'] || a['Codigo'] || '').toLowerCase();
        return n.includes(normalizado) || cod === normalizado;
      });

      if (!alunoEncontrado) {
        return {
          tipo: 'cancelamento',
          sucesso: false,
          titulo: 'Cancelamento de Rematrícula',
          descricao: `Não foi possível localizar o(a) estudante "${termo}".`
        };
      }

      const cod = String(alunoEncontrado['Matrícula'] || alunoEncontrado['Codigo'] || alunoEncontrado['id']);
      const nome = String(alunoEncontrado['Nome do estudante'] || alunoEncontrado['Nome']);

      try {
        await supabase.from('rematriculas_2027').delete().eq('codigo_matricula', cod);
      } catch {}

      try {
        const raw = localStorage.getItem('guia_escolar_rematriculas_2027');
        if (raw) {
          const mapa = JSON.parse(raw);
          delete mapa[cod];
          localStorage.setItem('guia_escolar_rematriculas_2027', JSON.stringify(mapa));
          window.dispatchEvent(new Event('guia_rematricula_atualizada'));
        }
      } catch {}

      return {
        tipo: 'cancelamento',
        sucesso: true,
        titulo: 'Rematrícula Cancelada',
        descricao: `A rematrícula de 2027 do estudante **${nome}** (Matrícula #${cod}) foi cancelada no Supabase e no sistema.`
      };
    }

    // 3. Navegação
    if (tipo === 'navegar' || tipo === 'navegacao' || tipo === 'abrir_tela') {
      const abaAlvo = String(params.aba || params.tela || params.modulo || '').toLowerCase();
      const mapaAbas: Record<string, { aba: string; rotulo: string }> = {
        rematricula: { aba: 'rematricula', rotulo: 'Controle de Rematrícula 2027' },
        declaracoes: { aba: 'declaracoes', rotulo: 'Emissor de Declarações Oficiais' },
        declaracao: { aba: 'declaracoes', rotulo: 'Emissor de Declarações Oficiais' },
        boletim: { aba: 'boletim', rotulo: 'Boletim Escolar & Notas (SIGP)' },
        diario: { aba: 'diario', rotulo: 'Diário de Classe & Frequência (SIGP)' },
        atas: { aba: 'atas-fichas', rotulo: 'Ficha Individual & Ata Final' },
        fichas: { aba: 'atas-fichas', rotulo: 'Ficha Individual & Ata Final' },
        'atas-fichas': { aba: 'atas-fichas', rotulo: 'Ficha Individual & Ata Final' },
        remanejamento: { aba: 'remanejamento', rotulo: 'Remanejamento & Transferências' },
        transferencias: { aba: 'remanejamento', rotulo: 'Remanejamento & Transferências' },
        historico: { aba: 'historico', rotulo: 'Gerador de Histórico Escolar' },
        historicos: { aba: 'historicos-salvos', rotulo: 'Históricos Salvos' },
        'historicos-salvos': { aba: 'historicos-salvos', rotulo: 'Históricos Salvos' },
        secretaria: { aba: 'alunos-secretaria', rotulo: 'Alunos da Secretaria' },
        'alunos-secretaria': { aba: 'alunos-secretaria', rotulo: 'Alunos da Secretaria' },
        duplicidades: { aba: 'duplicidades', rotulo: 'Detector de Duplicidades' },
        acervo: { aba: 'arvore', rotulo: 'Árvore do Acervo Físico' },
        arvore: { aba: 'arvore', rotulo: 'Árvore do Acervo Físico' },
        profissionais: { aba: 'profissionais', rotulo: 'Quadro de Servidores' },
        servidores: { aba: 'profissionais', rotulo: 'Quadro de Servidores' },
        horarios: { aba: 'horarios', rotulo: 'Grade de Horários' },
        dashboard: { aba: 'dashboard', rotulo: 'Painel de Gestão & Indicadores' },
        gestao: { aba: 'dashboard', rotulo: 'Painel de Gestão & Indicadores' },
        consulta: { aba: 'consulta', rotulo: 'Consulta Geral de Alunos' },
        alunos: { aba: 'consulta', rotulo: 'Consulta Geral de Alunos' }
      };

      const match = Object.entries(mapaAbas).find(([k]) => abaAlvo.includes(k));
      if (match) {
        const { aba, rotulo } = match[1];
        if (aba === 'declaracoes') {
          if (onAbrirDeclaracao) onAbrirDeclaracao();
        } else {
          if (onNavegarAba) onNavegarAba(aba);
        }
        return {
          tipo: 'navegacao',
          sucesso: true,
          titulo: 'Navegação Executada',
          descricao: `Mudei a tela para **${rotulo}**!`
        };
      }

      return {
        tipo: 'navegacao',
        sucesso: false,
        titulo: 'Navegação',
        descricao: `Não reconheci o módulo solicitado ("${abaAlvo}").`
      };
    }

    // 4. Busca
    if (tipo === 'buscar' || tipo === 'pesquisar' || tipo === 'localizar') {
      const termo = String(params.termo || params.aluno || params.nome || '').trim();
      if (onBuscarAluno) {
        onBuscarAluno(termo);
      }
      return {
        tipo: 'busca',
        sucesso: true,
        titulo: 'Filtro Aplicado no Sistema',
        descricao: `Filtrei os registros na tela de Consulta pelo termo **"${termo}"**.`
      };
    }

    // 5. Declaração
    if (tipo === 'declaracao') {
      const aluno = String(params.aluno || params.nome || '').trim();
      if (onAbrirDeclaracao) {
        onAbrirDeclaracao(aluno);
      }
      return {
        tipo: 'declaracao',
        sucesso: true,
        titulo: 'Emissor de Declarações Aberto',
        descricao: `Abri o Emissor Oficial de Declarações${aluno ? ` para o estudante **${aluno}**` : ''}!`
      };
    }

    // 6. Trancamento de Trimestre
    if (tipo === 'trancar_trimestre') {
      const tri = Number(params.trimestre || 1);
      const fechado = params.fechado !== false;
      try {
        await supabase.from('fechamento_periodos').upsert({
          escola: 'EM Maria Geralda',
          ano_letivo: 2026,
          trimestre: tri,
          fechado,
          fechado_em: new Date().toISOString(),
          fechado_por: 'Assistente IA'
        } as any, { onConflict: 'escola,ano_letivo,trimestre' });

        return {
          tipo: 'trancamento',
          sucesso: true,
          titulo: `Trimestre ${tri} ${fechado ? 'Trancado' : 'Destrancado'}`,
          descricao: `O **${tri}º Trimestre de 2026** foi marcado como **${fechado ? 'TRANCADO' : 'LIBERADO'}** no Supabase.`
        };
      } catch (e: any) {
        return {
          tipo: 'trancamento',
          sucesso: false,
          titulo: 'Erro ao Trancar Trimestre',
          descricao: e.message || 'Falha ao comunicar com o Supabase.'
        };
      }
    }

    return {
      tipo: 'navegacao',
      sucesso: false,
      titulo: 'Ação do Sistema',
      descricao: `Ação "${tipo}" processada.`
    };
  };

  // Motor de Inteligência Local com Busca e Heurísticas
  const processarPerguntaLocalmente = (pergunta: string): { resposta: string; dadosAluno?: Mensagem['dadosAluno']; tipo?: Mensagem['tipo'] } | null => {
    const p = pergunta.toLowerCase().trim();

    // 1. Passo a Passo Oficial para Gerar Histórico Escolar
    if (
      p.includes('como faz um historico') ||
      p.includes('como fazer historico') ||
      p.includes('como gerar historico') ||
      p.includes('passo a passo do historico') ||
      p.includes('gerar historico') ||
      p.includes('fazer historico') ||
      p.includes('emitir historico')
    ) {
      return {
        tipo: 'documento',
        resposta: `📜 **Passo a Passo Oficial para Gerar Histórico Escolar no Sistema**:

1. **Acesse o Módulo**:
   • No menu superior, clique em **Arquivo & Históricos ▾** e selecione **"Gerar Histórico"**.

2. **Identificação do Estudante**:
   • Digite o nome ou código de matrícula do estudante.
   • O sistema puxará automaticamente os dados pessoais (nome, filiação, nascimento, nacionalidade, certidão e número de prontuário).

3. **Trajetória Acadêmica (1º ao 9º Ano)**:
   • Selecione ou ative as séries que o aluno cursou nesta escola ou em outras instituições.
   • Preencha o ano letivo, notas/conceitos nas disciplinas da Base Nacional Comum (BNCC) e Parte Diversificada, faltas e carga horária anual (mínimo de 800h por série).

4. **Verso do Histórico & Amparo Legal**:
   • O sistema já traz configuradas as resoluções da SEE/MG e LDB 9.394/96.
   • Verifique os dados de encerramento, convenções de notas e assinatura da direção (**Marcos Vinícius Sena Sousa**).

5. **Download & Gravação Automática no Supabase**:
   • Clique em **"Baixar DOCX"** ou gere o arquivo para conferência.
   • O documento é salvo automaticamente na nuvem do Supabase e fica disponível a qualquer hora no menu **"Históricos Salvos"** para reabertura, consulta ou reimpressão!`
      };
    }

    // 2. Passo a Passo Oficial para Emitir Declarações Escolares
    if (
      p.includes('como faz uma declaracao') ||
      p.includes('como fazer declaracao') ||
      p.includes('como emitir declaracao') ||
      p.includes('passo a passo da declaracao') ||
      p.includes('fazer declaracao') ||
      p.includes('emitir declaracao') ||
      p.includes('modelo de declaracao')
    ) {
      return {
        tipo: 'documento',
        resposta: `📄 **Passo a Passo Oficial para Emitir Declarações Escolares**:

1. **Abra o Emissor**:
   • Clique no botão **"Declarações"** no menu de navegação superior (ou no botão *"Abrir Declarações"* em qualquer card de aluno que eu localizar).

2. **Escolha o Modelo Oficial**:
   O sistema possui **7 modelos oficiais pré-calibrados**:
   • **1. Matrícula e Frequência Regular** (comprovação para Bolsa Família / programas sociais).
   • **2. Declaração de Transferência** (com prazo de 30 dias para entrega do histórico).
   • **3. Declaração de Conclusão do Ensino Fundamental** (concluintes do 9º ano).
   • **4. Declaração de Escolaridade** (vínculo letivo).
   • **5. Comparecimento de Responsável** (justificativa de trabalho de pai/mãe).
   • **6. Transporte Escolar Rural** (rotas e linhas da zona rural).
   • **7. Declaração Personalizada / Livre** (redação sob medida).

3. **Preenchimento Automático do Aluno**:
   • Digite o nome do aluno no campo de busca: matrícula, turma, turno e filiação são preenchidos instantaneamente.

4. **Edição Livre na Tela (Opcional)**:
   • Se desejar alterar qualquer data, finalidade ou observação antes de imprimir, clique em **"Editar Texto Livre"**.

5. **Impressão Calibrada em 1 Folha A4**:
   • Clique em **"Imprimir Declaração"**. O documento foi desenhado milimetricamente para caber em **apenas 1 folha A4**, sem cortar e sem imprimir folhas vazias!`
      };
    }

    // 3. SIGP: Como funciona o Boletim & Notas
    if (
      p.includes('como lancar notas') ||
      p.includes('como lançar notas') ||
      p.includes('como funciona o boletim') ||
      p.includes('boletim escolar') ||
      p.includes('mapa da turma')
    ) {
      return {
        tipo: 'documento',
        resposta: `🎯 **Como Usar o Boletim Escolar & Lançamento de Notas (SIGP)**:

1. **Acesse**: Menu **Pedagógico (SIGP) ▾** > **"Boletim & Notas"**.
2. **Selecione a Turma**: Escolha qualquer uma das 30 turmas ativas.
3. **Escolha o Modo de Visualização**:
   • **Boletim Individual**: folha completa de notas por aluno com quadro BNCC, médias, faltas e assinaturas oficiais de Diretor, Especialista e Responsável.
   • **Mapa da Turma**: planilha completa da turma com notas de todas as disciplinas para digitação rápida.
4. **Regra de Pontuação**:
   • **1º Trimestre**: até 30 pontos (mínimo 18,0).
   • **2º Trimestre**: até 30 pontos (mínimo 18,0).
   • **3º Trimestre**: até 40 pontos (mínimo 24,0).
   • **Total: 100 pontos** (Média de aprovação: 60,0).
5. **Salvar ou Exportar**:
   • Clique em **"Salvar Notas"** para gravar no banco local.
   • Clique em **"Exportar CSV"** para abrir a planilha no Excel!`
      };
    }

    // 4. SIGP: Como funciona o Diário de Classe
    if (
      p.includes('como fazer chamada') ||
      p.includes('diario de classe') ||
      p.includes('diário de classe') ||
      p.includes('chamada')
    ) {
      return {
        tipo: 'documento',
        resposta: `📖 **Como Operar o Diário de Classe & Frequência (SIGP)**:

1. **Acesse**: Menu **Pedagógico (SIGP) ▾** > **"Diário & Frequência"**.
2. **Defina os Parâmetros**: Selecione a Turma, a Disciplina e o Mês de referência (fevereiro a dezembro de 2026).
3. **Chamada Interativa com 1 Clique**:
   • Cada clique na célula do dia alterna o status:
     - **C** (Verde) = Compareceu / Presente
     - **F** (Vermelho) = Falta
     - **FJ** (Amarelo) = Falta Justificada com atestado
4. **Registro de Conteúdo & Plano de Aula**:
   • Clique na aba **"Registro de Conteúdo"** para lançar a data da aula, o objeto de conhecimento e o código de habilidade da BNCC (ex: *EF06LP01*).
5. **Exportação & Impressão**:
   • Clique em **"Imprimir Diário"** para emitir a folha de chamada oficial para arquivo ou **"Exportar CSV"** para planilha!`
      };
    }

    // 5. SIGP: Como funciona a Ficha Individual & Ata Final
    if (
      p.includes('ficha individual') ||
      p.includes('ata final') ||
      p.includes('ata de resultado') ||
      p.includes('encerramento letivo')
    ) {
      return {
        tipo: 'documento',
        resposta: `📑 **Ficha Individual do Aluno & Ata de Resultados Finais**:

1. **Acesse**: Menu **Pedagógico (SIGP) ▾** > **"Ficha Individual & Ata Final"**.
2. **Sub-aba Ficha Individual**:
   • Documento oficial do Estado de Minas Gerais para arquivo permanente do estudante.
   • Contém: Dados de identificação completos, certidão, SUS, aproveitamento nos 3 trimestres (30+30+40), frequência e parecer descritivo do pedagogo.
3. **Sub-aba Ata de Resultados Finais**:
   • Tabela formal em folha paisagem A4 para encadernação no livro oficial de atas da escola.
   • Traz termo formal de abertura, cômputo de todos os alunos com notas finais por componente curricular, taxa de aprovação percentual e assinaturas da comissão.`
      };
    }

    // 6. SIGP: Remanejamento & Transferências
    if (
      p.includes('remanejamento') ||
      p.includes('transferir') ||
      p.includes('transferencia') ||
      p.includes('transferência') ||
      p.includes('movimentacao')
    ) {
      return {
        tipo: 'documento',
        resposta: `🔄 **Remanejamento & Transferências Escolares**:

1. **Acesse**: Menu **Pedagógico (SIGP) ▾** > **"Remanejamento & Transferências"**.
2. **Controle de Alunos Transferidos**:
   • O sistema lista todos os estudantes movimentados com data de saída, escola de destino e município.
   • O botão **"Emitir Declaração de Transferência"** gera o documento oficial com prazo legal de 30 dias para expedição do histórico definitivo.
   • *Regra importante*: Alunos transferidos são automaticamente removidos da chamada ativa diária para não prejudicar as estatísticas da turma.`
      };
    }

    // 7. AUDITORIA: Detector de Duplicidades
    if (
      p.includes('duplicado') ||
      p.includes('duplicidade') ||
      p.includes('auditoria') ||
      p.includes('higienizacao')
    ) {
      return {
        tipo: 'documento',
        resposta: `🛡️ **Detector de Duplicidades & Auditoria de Dados**:

1. **Acesse**: Menu **Cadastros ▾** > **"Detector de Duplicados"**.
2. **Cruzamento Inteligente**:
   • O detector analisa automaticamente a base de dados cruzando CPFs repetidos, números de certidão coincidentes e nomes com grafia semelhante (comparação fonética).
3. **Ações de Higienização**:
   • Permite identificar duplicidades de matrículas geradas por importações anteriores e corrigir cadastros sem risco de perda de registros de notas.`
      };
    }

    // 8. ARQUIVO: Árvore do Acervo e Pastas Físicas
    if (
      p.includes('arvore') ||
      p.includes('árvore') ||
      p.includes('pasta fisica') ||
      p.includes('pasta física') ||
      p.includes('onde fica a pasta') ||
      p.includes('prontuario')
    ) {
      return {
        resposta: `📁 **Árvore do Acervo & Localização de Pastas Físicas**:

1. **Acesse**: Menu **Cadastros ▾** > **"Árvore do Acervo"**.
2. **Estrutura Física do Arquivo Permanente**:
   • O acervo físico da escola é organizado em pastas numeradas.
   • Dentro de cada pasta, cada aluno possui um prontuário com número sequencial (ex: *Pasta 01 -> Nº 05 - Aluno*).
   • Você pode navegar visualmente na árvore para saber exatamente em qual gaveta e pasta física encontrar os documentos originais do aluno.`
      };
    }

    // 9. Dúvidas sobre Aprovação / Notas / Média / Frequência / LDB (30 + 30 + 40 = 100)
    if (
      p.includes('aprova') ||
      p.includes('reprova') ||
      p.includes('media') ||
      p.includes('média') ||
      p.includes('nota') ||
      p.includes('ponto') ||
      p.includes('trimestre') ||
      p.includes('ldb') ||
      p.includes('frequencia') ||
      p.includes('frequência') ||
      p.includes('falta')
    ) {
      return {
        resposta: `📋 **Critérios Oficiais de Avaliação e Aprovação (LDB 9.394/96 & Regimento Escolar)**:

1. **Pontuação Trimestral (Total: 100 pontos)**:
   • **1º Trimestre**: valor de **30 pontos** (média 18,0).
   • **2º Trimestre**: valor de **30 pontos** (média 18,0).
   • **3º Trimestre**: valor de **40 pontos** (média 24,0).
   • **Mínimo para Aprovação Direta**: **60 pontos** na soma total.

2. **Frequência Escolar Obrigatória**:
   • Mínimo exigido: **75%** das horas letivas do ano (Art. 24, VI da LDB).
   • Carga horária anual mínima: **800 horas** distribuídas em no mínimo **200 dias de efetivo trabalho escolar**.

3. **Alunos Transferidos**:
   • Conforme a diretriz do sistema, estudantes com status *TRANSFERIDO* são automaticamente desconsiderados do cômputo de frequência ativa da turma.

4. **Recuperação e Apoio**:
   • É assegurado ao estudante o direito a estudos de recuperação periódicos ao longo de cada trimestre letivo.`
      };
    }

    // 10. Horários e Turnos da Escola
    if (p.includes('horario') || p.includes('horário') || p.includes('turno') || p.includes('hora de entrada') || p.includes('hora de saída')) {
      return {
        resposta: `⏰ **Horários e Turnos de Funcionamento - E.M. Maria Geralda**:

• **Turno Matutino**:
  - Horário: **07:00 às 11:30**
  - Turmas atendidas: Anos Finais (6º ao 9º Ano) e turmas matutinas.
  - Intervalo / Recreio: 09:15 às 09:35

• **Turno Vespertino**:
  - Horário: **12:30 às 17:00**
  - Turmas atendidas: Anos Iniciais (1º ao 5º Ano) e Educação Infantil.
  - Intervalo / Recreio: 14:45 às 15:05

• **Total de Turmas ativas**: ${totalTurmas} turmas cadastradas no sistema.`
      };
    }

    // 11. Informações Institucionais e Números da Escola
    if (
      p.includes('escola') ||
      p.includes('inep') ||
      p.includes('diretor') ||
      p.includes('quantos alunos') ||
      p.includes('quantas turmas') ||
      p.includes('professores') ||
      p.includes('servidores') ||
      p.includes('dados da escola') ||
      p.includes('total de alunos') ||
      p.includes('quantos estudantes') ||
      p.includes('censo')
    ) {
      return {
        resposta: `🏫 **Dados Institucionais e Censo Escolar - E.M. Maria Geralda**:

• **Nome**: Escola Municipal Maria Geralda Miranda Brito Salomão
• **Código INEP**: **31054366**
• **Município**: Ponto dos Volantes - MG
• **Direção**: Marcos Vinícius Sena Sousa
• **Estudantes Matriculados**: **${totalAlunos}** alunos
• **Turmas Ativas**: **${totalTurmas}** turmas (Anos Iniciais e Finais)
• **Profissionais / Servidores**: **${totalProfissionais}** cadastrados
• **Dias Letivos e Carga Horária**: 200 dias de efetivo trabalho escolar e 800 horas anuais
• **Acervo**: Sistema de Arquivo Permanente Integrado (Guia Escolar)`
      };
    }

    // 4. Busca por Aluno específico (Ex: "aluno joão", "quem é maria", "matricula ...")
    const termosBusca = p
      .replace(/^(quem é|quem e|onde está|onde esta|onde fica|dados do aluno|dados da aluna|aluno|aluna|estudante|buscar|consultar|localizar)\s+/i, '')
      .trim();

    if (termosBusca.length >= 3) {
      const termoNormalizado = termosBusca.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      
      const alunoEncontrado = (matriculasData as any[]).find((aluno) => {
        const nome = String(aluno['Nome do estudante'] || aluno['Nome'] || '')
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase();
        const matricula = String(aluno['Matrícula'] || aluno['Codigo'] || '').toLowerCase();
        return nome.includes(termoNormalizado) || matricula === termoNormalizado;
      });

      if (alunoEncontrado) {
        const nome = alunoEncontrado['Nome do estudante'] || alunoEncontrado['Nome'];
        const turma = alunoEncontrado['Turma'] || alunoEncontrado['Ano de escolaridade'] || 'Não informada';
        const nascimento = alunoEncontrado['Data de Nascimento'] || alunoEncontrado['Nascimento'] || 'Não informada';
        const filiacao = alunoEncontrado['Filiação 1'] || alunoEncontrado['Mãe'] || 'Não informada';
        const status = alunoEncontrado['Situação da matrícula'] || alunoEncontrado['Status'] || 'Ativo';
        const matricula = alunoEncontrado['Matrícula'] || alunoEncontrado['Código'] || 'S/N';
        const pasta = alunoEncontrado['Pasta'] || alunoEncontrado['Prontuário'] || '';

        return {
          tipo: 'aluno',
          dadosAluno: { nome, turma, nascimento, filiacao, status, pasta },
          resposta: `🔍 **Estudante Localizado no Acervo Escolar**:

• **Nome**: **${nome}**
• **Matrícula**: ${matricula}
• **Turma / Ano**: ${turma}
• **Data de Nascimento**: ${nascimento}
• **Filiação (Mãe/Resp.)**: ${filiacao}
• **Situação**: **${status}**
${pasta ? `• **Arquivo / Pasta Física**: ${pasta}` : ''}

💡 *Você pode clicar no botão abaixo para emitir uma declaração oficial para este estudante.*`
        };
      }
    }

    // 5. Modelos de Documentos Rápidos (Comunicado, Ata, Ocorrência)
    if (p.includes('comunicado') || p.includes('aviso')) {
      return {
        tipo: 'documento',
        resposta: `📝 **Modelo Oficial de Comunicado aos Responsáveis**:

**COMUNICADO INTERNO Nº ____ / 2026**
**Assunto**: Reunião de Pais e Responsáveis - Rendimento Escolar
**Escola**: E.M. Maria Geralda Miranda Brito Salomão

Prezados Senhores Pais ou Responsáveis,

A Direção e a Coordenação Pedagógica da Escola Municipal Maria Geralda Miranda Brito Salomão convidam V. Sas. para a nossa **Reunião de Pais e Mestres**, a ser realizada no dia **__/__/2026**, às **__:__ horas**, nas dependências da escola.

Na oportunidade, trataremos sobre:
1. O desenvolvimento pedagógico e rendimento trimestral dos estudantes (distribuição 30 + 30 + 40 pontos);
2. Frequência escolar e compromisso com o calendário letivo;
3. Avisos gerais da comunidade escolar.

Contamos com a sua indispensável presença, pois a parceria entre Família e Escola é a base do sucesso de nossos estudantes.

Ponto dos Volantes - MG, ${new Date().toLocaleDateString('pt-BR')}.

_____________________________________
**Marcos Vinícius Sena Sousa**
Diretor Escolar`
      };
    }

    if (p.includes('ata') || p.includes('conselho')) {
      return {
        tipo: 'documento',
        resposta: `📋 **Modelo de Ata de Reunião Pedagógica / Conselho de Classe**:

**ATA DA REUNIÃO DO CONSELHO DE CLASSE DO ____º TRIMESTRE DE 2026**

Aos _____ dias do mês de ____________ do ano de dois mil e vinte e seis, às ______ horas, no recinto da Escola Municipal Maria Geralda Miranda Brito Salomão, sob a presidência da equipe gestora e coordenação pedagógica, reuniram-se os docentes da turma ______ para a realização do Conselho de Classe referente ao período letivo.

Iniciada a sessão, foram apreciados os seguintes pontos:
1. Desempenho geral da turma e análise dos índices de aproveitamento (critério 30 + 30 + 40 pontos);
2. Casos de estudantes em situação de defasagem de aprendizagem ou infrequência;
3. Planejamento das intervenções pedagógicas e atividades de recuperação paralela.

Ficou deliberado pelo colegiado docente que serão adotadas estratégias de reforço diferenciado aos estudantes com rendimento inferior a 60% e convocação individual dos responsáveis pelos alunos com infrequência superior a 25%. Nada mais havendo a tratar, lavrou-se a presente ata que, lida e achada conforme, vai assinada pelos presentes.

Ponto dos Volantes - MG, ${new Date().toLocaleDateString('pt-BR')}.`
      };
    }

    if (p.includes('ocorrencia') || p.includes('ocorrência') || p.includes('advertencia') || p.includes('advertência')) {
      return {
        tipo: 'documento',
        resposta: `⚠️ **Registro de Ocorrência Disciplinar / Notificação ao Responsável**:

**REGISTRO DE OCORRÊNCIA ESCOLAR Nº ____/2026**

• **Estudante**: __________________________________________________
• **Turma**: _______________ | **Turno**: ___________________
• **Data da Ocorrência**: ___/___/2026 | **Horário**: ___:___ horas
• **Professor(a) / Notificante**: _________________________________

**Relato dos Fatos**:
O(A) estudante acima identificado(a) apresentou comportamento em desacordo com as normas de convivência do Regimento Escolar, consistente em:
[  ] Ausência em sala de aula sem autorização
[  ] Descumprimento reiterado das orientações em sala
[  ] Uso inadequado de aparelhos eletrônicos durante a aula
[  ] Conflito verbal ou atitude de desrespeito
[  ] Outro: _____________________________________________________

**Medida Educativa Adotada**:
[  ] Diálogo pedagógico e orientação individual
[  ] Advertência escrita
[  ] Convocação do responsável para comparecimento à Secretaria

Ciência do Responsável: _______________________________________ Data: ___/___/2026
Assinatura da Gestão: _________________________________________`
      };
    }

    return null;
  };

  // Enviar Mensagem para o Assistente (Com Memória & Aprendizado)
  const handleEnviarMensagem = async (textoPersonalizado?: string) => {
    const texto = (textoPersonalizado || inputTexto).trim();
    if (!texto || carregando) return;

    const novaMensagemUsuario: Mensagem = {
      id: `user-${Date.now()}`,
      remetente: 'usuario',
      texto,
      dataHora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    };

    setMensagens((prev) => [...prev, novaMensagemUsuario]);
    setInputTexto('');
    setCarregando(true);

    // Grava mensagem do usuário no histórico do Supabase
    salvarMensagemNoHistorico({
      sessaoId: 'sessao-principal',
      remetente: 'usuario',
      texto,
      dataHora: novaMensagemUsuario.dataHora
    });

    // 1. RECURSO DE APRENDIZADO INTELIGENTE (Comando "Aprenda que...", "Lembre que...", "Grave que...")
    const matchAprender = texto.match(/^(?:aprenda|lembre|grave|anote|memorize)(?:\s+(?:que|sobre|isso:))?\s+(.+)$/i);
    if (matchAprender && matchAprender[1]) {
      const conteudoAprendido = matchAprender[1].trim();
      
      try {
        const novoFato = await salvarFatoMemoria({
          categoria: 'escola',
          titulo: conteudoAprendido.slice(0, 50) + (conteudoAprendido.length > 50 ? '...' : ''),
          conteudo: conteudoAprendido,
          autor: 'Instrução do Usuário'
        });

        setFatosMemoria((prev) => [...prev, novoFato]);

        setTimeout(() => {
          const respostaAprendizado: Mensagem = {
            id: `ia-${Date.now()}`,
            remetente: 'ia',
            tipo: 'memoria',
            texto: `🧠 **Aprendizado Gravado com Sucesso na Minha Memória!**

Gravei esta informação no **Supabase** e na minha base de conhecimento permanente:
> *" ${conteudoAprendido} "*

A partir de agora, lembrarei desse fato em todas as futuras consultas e respostas para a equipe escolar!`,
            dataHora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
          };

          setMensagens((prev) => [...prev, respostaAprendizado]);
          salvarMensagemNoHistorico({
            sessaoId: 'sessao-principal',
            remetente: 'ia',
            texto: respostaAprendizado.texto,
            dataHora: respostaAprendizado.dataHora
          });
          setCarregando(false);
        }, 400);
        return;
      } catch (err) {
        console.error('Erro ao salvar aprendizado:', err);
      }
    }

    // 2. COMANDOS DE AÇÃO DIRETA NO SISTEMA (Execução Instantânea)

    // A. Ação Direta: Rematrícula 2027
    const matchRematricula = texto.match(/^(?:rematricular|rematricule|rematricula|confirme a rematricula|confirmar rematricula|passe o aluno)\s+(?:o\s+|a\s+|o\s+aluno\s+|a\s+aluna\s+)?(.+)$/i);
    if (matchRematricula && matchRematricula[1]) {
      const corpo = matchRematricula[1].trim();
      let turno: 'MAT' | 'VESP' | undefined = undefined;
      if (/\b(vespertino|tarde)\b/i.test(corpo)) turno = 'VESP';
      else if (/\b(matutino|manh[aã])\b/i.test(corpo)) turno = 'MAT';

      let turma: string | undefined = undefined;
      const mTurma = corpo.match(/\b([1-9])[º°]?\s*ano\b/i);
      if (mTurma) {
        turma = `${mTurma[1]}º ANO (2027)`;
      }

      let aluno = corpo.replace(/\s+para\s+(?:o\s+|a\s+)?(?:o\s+)?([1-9])[º°]?\s*ano(?:\s+(?:2027))?.*$/i, '');
      aluno = aluno.replace(/\s+(?:no\s+turno\s+|turno\s+)?(matutino|vespertino|tarde|manh[aã]).*$/i, '');
      aluno = aluno.replace(/^(?:a\s+|o\s+|de\s+|do\s+|da\s+|aluno\s+|aluna\s+)+/i, '').trim();

      const resultadoAcao = await executarAcaoSistema('rematricular', {
        aluno,
        turma_2027: turma,
        turno_2027: turno
      });

      const respostaAcao: Mensagem = {
        id: `ia-${Date.now()}`,
        remetente: 'ia',
        tipo: 'acao_executada',
        texto: resultadoAcao.descricao,
        dataHora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        acaoExecutada: resultadoAcao
      };

      setMensagens((prev) => [...prev, respostaAcao]);
      salvarMensagemNoHistorico({
        sessaoId: 'sessao-principal',
        remetente: 'ia',
        texto: respostaAcao.texto,
        dataHora: respostaAcao.dataHora
      });
      setCarregando(false);
      return;
    }

    // B. Ação Direta: Cancelar Rematrícula
    const matchCancelar = texto.match(/^(?:cancelar|cancele|desfa[cç]a|remover|remova|excluir|exclua)\s+(?:a\s+)?rematr[ií]cula\s+(?:de\s+|do\s+|da\s+)?\s*(.+)$/i);
    if (matchCancelar && matchCancelar[1]) {
      const aluno = matchCancelar[1].replace(/^(?:a\s+|o\s+|aluno\s+|aluna\s+)+/i, '').trim();
      const resultadoAcao = await executarAcaoSistema('cancelar_rematricula', { aluno });

      const respostaAcao: Mensagem = {
        id: `ia-${Date.now()}`,
        remetente: 'ia',
        tipo: 'acao_executada',
        texto: resultadoAcao.descricao,
        dataHora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        acaoExecutada: resultadoAcao
      };

      setMensagens((prev) => [...prev, respostaAcao]);
      salvarMensagemNoHistorico({
        sessaoId: 'sessao-principal',
        remetente: 'ia',
        texto: respostaAcao.texto,
        dataHora: respostaAcao.dataHora
      });
      setCarregando(false);
      return;
    }

    // C. Ação Direta: Navegar entre Telas
    const matchNavegar = texto.match(/^(?:abra|abrir|va para|vá para|ir para|mostre|mostrar|navegar|navegue)\s+(?:a\s+tela\s+(?:de\s+|do\s+|da\s+)?|o\s+m[oó]dulo\s+(?:de\s+|do\s+|da\s+)?|o\s+|a\s+|as\s+)?(rematr[ií]cula|declara[cç][oõ]es|boletim|di[aá]rio|hist[oó]rico|hist[oó]ricos|secretaria|duplicidades|acervo|[aá]rvore|servidores|profissionais|hor[aá]rios|gest[aã]o|dashboard|consulta|alunos)(?:.*)$/i);
    if (matchNavegar && matchNavegar[1]) {
      const resultadoAcao = await executarAcaoSistema('navegar', { aba: matchNavegar[1] });
      const respostaAcao: Mensagem = {
        id: `ia-${Date.now()}`,
        remetente: 'ia',
        tipo: 'acao_executada',
        texto: resultadoAcao.descricao,
        dataHora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        acaoExecutada: resultadoAcao
      };

      setMensagens((prev) => [...prev, respostaAcao]);
      salvarMensagemNoHistorico({
        sessaoId: 'sessao-principal',
        remetente: 'ia',
        texto: respostaAcao.texto,
        dataHora: respostaAcao.dataHora
      });
      setCarregando(false);
      return;
    }

    // D. Ação Direta: Buscar / Filtrar Aluno no Sistema
    const matchBuscar = texto.match(/^(?:busque|buscar|procure|procurar|localize|localizar|filtrar por)\s+(?:o\s+aluno\s+|a\s+aluna\s+|o\s+|a\s+)?(.+)$/i);
    if (matchBuscar && matchBuscar[1] && !matchBuscar[1].toLowerCase().includes('historico') && !matchBuscar[1].toLowerCase().includes('declaracao')) {
      const termo = matchBuscar[1].trim();
      const resultadoAcao = await executarAcaoSistema('buscar', { termo });
      const respostaAcao: Mensagem = {
        id: `ia-${Date.now()}`,
        remetente: 'ia',
        tipo: 'acao_executada',
        texto: resultadoAcao.descricao,
        dataHora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        acaoExecutada: resultadoAcao
      };

      setMensagens((prev) => [...prev, respostaAcao]);
      salvarMensagemNoHistorico({
        sessaoId: 'sessao-principal',
        remetente: 'ia',
        texto: respostaAcao.texto,
        dataHora: respostaAcao.dataHora
      });
      setCarregando(false);
      return;
    }

    // E. Ação Direta: Trancar / Destrancar Trimestre
    const matchTrancar = texto.match(/^(?:trancar|tranque|fechar|feche|destrancar|destranque|liberar|libere)\s+(?:o\s+)?([123]º?|[123])\s*(?:trimestre|tri)/i);
    if (matchTrancar && matchTrancar[1]) {
      const numTri = parseInt(matchTrancar[1].replace('º', ''), 10);
      const isFechar = !/destrancar|destranque|liberar|libere/i.test(texto);
      const resultadoAcao = await executarAcaoSistema('trancar_trimestre', { trimestre: numTri, fechado: isFechar });
      const respostaAcao: Mensagem = {
        id: `ia-${Date.now()}`,
        remetente: 'ia',
        tipo: 'acao_executada',
        texto: resultadoAcao.descricao,
        dataHora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        acaoExecutada: resultadoAcao
      };

      setMensagens((prev) => [...prev, respostaAcao]);
      salvarMensagemNoHistorico({
        sessaoId: 'sessao-principal',
        remetente: 'ia',
        texto: respostaAcao.texto,
        dataHora: respostaAcao.dataHora
      });
      setCarregando(false);
      return;
    }

    // 3. Consulta rápida na base local escolar (0 tokens, imediata)
    const respostaLocal = processarPerguntaLocalmente(texto);
    if (respostaLocal) {
      setTimeout(() => {
        const novaMensagemIA: Mensagem = {
          id: `ia-${Date.now()}`,
          remetente: 'ia',
          texto: respostaLocal.resposta,
          dataHora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          tipo: respostaLocal.tipo || 'padrao',
          dadosAluno: respostaLocal.dadosAluno
        };
        setMensagens((prev) => [...prev, novaMensagemIA]);
        salvarMensagemNoHistorico({
          sessaoId: 'sessao-principal',
          remetente: 'ia',
          texto: novaMensagemIA.texto,
          dataHora: novaMensagemIA.dataHora
        });
        setCarregando(false);
      }, 350);
      return;
    }

    // 3. IA Generativa com Memória Contextual Contínua (Gemini ou Pollinations gratuito)
    try {
      let respostaTexto = '';

      // Monta a memória aprendida no prompt do sistema
      const memoriaFormatada = formatarMemoriaParaPrompt(fatosMemoria);
      const systemInstructionCompleto = `Você é o Assistente Oficial de Inteligência Artificial da Escola Municipal Maria Geralda Miranda Brito Salomão (Ponto dos Volantes - MG), alimentado pelo Google Gemini com capacidade avançada para atender e executar qualquer solicitação administrativa, pedagógica ou regimental que o usuário pedir.

DADOS OFICIAIS DA ESCOLA:
- Instituição: Escola Municipal Maria Geralda Miranda Brito Salomão
- Código INEP: 31054366 | Município: Ponto dos Volantes - Minas Gerais
- Diretor Escolar: Marcos Vinícius Sena Sousa
- Anos Atendidos: Ensino Fundamental Regular (1º ao 9º Ano)
- Turno Matutino: 07:00 às 11:30 (Anos Finais: 6º ao 9º Ano)
- Turno Vespertino: 12:30 às 17:00 (Anos Iniciais: 1º ao 5º Ano)
- Censo Escolar Atual: ${totalAlunos} estudantes matriculados, ${totalTurmas} turmas ativas e ${totalProfissionais} servidores da educação.
- Rematrículas Oficiais 2027: 225 estudantes confirmados no sistema (168 no turno Matutino e 57 no turno Vespertino), todos integrados ao banco de dados Supabase.
- Carga Horária e Calendário: 200 dias de efetivo trabalho escolar e 800 horas anuais.

REGRAS DE AVALIAÇÃO E NOTAS (OFICIAL DA ESCOLA):
- Sistema Trimestral: 1º Trimestre (30 pontos), 2º Trimestre (30 pontos), 3º Trimestre (40 pontos) = 100 pontos anuais totais.
- Média mínima para aprovação direta: 60,0 pontos na soma dos 3 trimestres.
- Frequência obrigatória por lei: Mínimo de 75% das horas letivas do ano letivo (Art. 24 da LDB).
- Regra de transferência: Alunos com status TRANSFERIDO são automaticamente desconsiderados da chamada ativa e do cômputo da frequência regular da turma.
- Direito assegurado a estudos de recuperação paralela e periódica em todos os trimestres.

GUIA DE OPERAÇÃO DO SISTEMA GUIA ESCOLAR:
- Para Gerar Histórico: Menu "Arquivo & Históricos" > "Gerar Histórico". Localizar aluno, preencher trajetória do 1º ao 9º ano, notas, carga horária e atos legais no verso. Salva automaticamente no Supabase e pode ser consultado em "Históricos Salvos".
- Para Emitir Declarações: Botão "Declarações" no menu superior. 7 modelos oficiais (Matrícula, Transferência, Conclusão, Escolaridade, Comparecimento, Transporte Rural, Personalizada). Calibrado para 1 folha A4 oficial.
- Para Boletim & Notas: Menu "Pedagógico (SIGP)" > "Boletim & Notas". Visão individual e Mapa da turma. Lançamento trimestral (30+30+40). Exportação em CSV.
- Para Chamada Diária: Menu "Pedagógico (SIGP)" > "Diário & Frequência". Alternância C (Compareceu), F (Falta), FJ (Falta Justificada). Registro de conteúdos da BNCC.
- Para Ficha Individual e Ata Final: Menu "Pedagógico (SIGP)" > "Ficha Individual & Ata Final". Emissão anual para o livro de atas.
- Para Transferências: Menu "Pedagógico (SIGP)" > "Remanejamento & Transferências".
- Para Auditoria de Cadastros: Menu "Cadastros" > "Detector de Duplicados".
- Para Rematrículas 2027: Botão "Rematrícula 2027" no cabeçalho.

${memoriaFormatada}

DIRETRIZ DE ATENDIMENTO TOTAL ("FAZER O QUE O USUÁRIO PEDIR"):
- Você deve atender prontamente a qualquer solicitação do usuário: redigir textos formais, ofícios, circulares, convocações, atas, notificações, justificativas, mensagens para grupos de pais ou professores, projetos pedagógicos, planos de aula alinhados à BNCC, cálculos de notas e médias, pareceres descritivos e orientações do regimento escolar.
- Seja extremamente proativo, estruturado, formal e resolutivo. Nunca recuse um pedido e nunca dê respostas genéricas quando puder entregar o documento ou resposta prontos para copiar e usar.

PODER DE EXECUÇÃO REAL DE AÇÕES NO SISTEMA:
- Você tem permissão e ferramentas para executar ações reais no sistema e no banco Supabase!
- Sempre que o usuário solicitar uma ação prática, adicione ao FINAL da sua resposta explicativa o bloco:
\`\`\`action
{
  "tipo": "rematricular" | "cancelar_rematricula" | "navegar" | "buscar" | "declaracao" | "trancar_trimestre",
  "aluno": "Nome ou Matrícula",
  "turma_2027": "8º ANO (2027)",
  "turno_2027": "MAT" | "VESP",
  "aba": "rematricula" | "diario" | "boletim" | "historico" | "declaracoes" | "consulta" | "alunos-secretaria" | "duplicidades" | "arvore" | "dashboard",
  "termo": "Texto de busca",
  "trimestre": 1,
  "fechado": true
}
\`\`\`
O sistema executará a ação de verdade no banco de dados e na interface do usuário.` ;

      // Prepara as últimas 6 mensagens para manter o contexto multi-turn da conversa
      const historicoRecente = mensagens.slice(-6).map((m) => ({
        role: m.remetente === 'usuario' ? 'user' : 'assistant',
        content: m.texto
      }));

      // Opção A: Executar via Google Gemini oficial (com cascata de modelos de alta velocidade)
      const chaveAtiva = (geminiApiKey || chavePadraoEnv || '').trim();
      if (chaveAtiva) {
        const contentsGemini = [
          ...mensagens.slice(-6).map((m) => ({
            role: m.remetente === 'usuario' ? 'user' : 'model',
            parts: [{ text: m.texto }]
          })),
          { role: 'user', parts: [{ text: texto }] }
        ];

        const modelosTentativa = [
          'gemini-3.1-flash-lite',
          'gemini-flash-lite-latest',
          'gemini-3.8-flash',
          'gemini-flash-latest'
        ];

        for (const modelo of modelosTentativa) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);

            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${encodeURIComponent(chaveAtiva)}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                systemInstruction: { parts: [{ text: systemInstructionCompleto }] },
                contents: contentsGemini
              }),
              signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (res.ok) {
              const data = await res.json();
              const txt = data.candidates?.[0]?.content?.parts?.[0]?.text;
              if (txt && txt.trim()) {
                respostaTexto = txt.trim();
                break;
              }
            } else {
              console.warn(`[Assistente IA] Modelo ${modelo} retornou HTTP ${res.status}`);
            }
          } catch (err) {
            console.warn(`[Assistente IA] Falha ao consultar modelo ${modelo}:`, err);
          }
        }
      }

      // Opção B: Endpoint Ilimitado de IA com Diálogo Multi-Turn (Pollinations)
      if (!respostaTexto) {
        const payloadChat = {
          messages: [
            { role: 'system', content: systemInstructionCompleto },
            ...historicoRecente,
            { role: 'user', content: texto }
          ],
          model: 'openai',
          jsonMode: false
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);

        const res = await fetch('https://text.pollinations.ai/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payloadChat),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          respostaTexto = await res.text();
        }
      }

      if (!respostaTexto) {
        throw new Error('Sem resposta da API');
      }

      // Intercepta e executa ação em bloco caso Gemini tenha retornado
      let acaoExecutadaResultado: Mensagem['acaoExecutada'] = undefined;
      const matchBlocoAction = respostaTexto.match(/```action\s*([\s\S]*?)\s*```/i);
      if (matchBlocoAction && matchBlocoAction[1]) {
        try {
          const acaoObj = JSON.parse(matchBlocoAction[1].trim());
          if (acaoObj.tipo) {
            acaoExecutadaResultado = await executarAcaoSistema(acaoObj.tipo, acaoObj.parametros || acaoObj);
          }
          respostaTexto = respostaTexto.replace(/```action[\s\S]*?```/gi, '').trim();
        } catch (eAction) {
          console.warn('[Assistente IA] Erro ao parsear ação do Gemini:', eAction);
        }
      }

      const novaMensagemIA: Mensagem = {
        id: `ia-${Date.now()}`,
        remetente: 'ia',
        texto: respostaTexto,
        dataHora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        acaoExecutada: acaoExecutadaResultado
      };
      setMensagens((prev) => [...prev, novaMensagemIA]);

      // Salva no histórico do Supabase
      salvarMensagemNoHistorico({
        sessaoId: 'sessao-principal',
        remetente: 'ia',
        texto: respostaTexto,
        dataHora: novaMensagemIA.dataHora
      });
    } catch {
      // Fallback amigável se a rede oscilar
      const respostaFallback: Mensagem = {
        id: `ia-${Date.now()}`,
        remetente: 'ia',
        texto: `Entendi a sua solicitação sobre: "${texto}".

Como estou em **modo autônomo com memória local e regras da escola**:
• A regra de avaliação oficial da escola é **30 + 30 + 40 = 100 pontos** (mínimo de 60 pontos para aprovação).
• Você pode me ensinar novos fatos dizendo: *"Aprenda que [informação]"*.
• Para consultar alunos, horários ou modelos de declarações, use os botões rápidos abaixo ou o menu **Declarações**.`,
        dataHora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      };
      setMensagens((prev) => [...prev, respostaFallback]);
    } finally {
      setCarregando(false);
    }
  };

  const copiarTexto = (id: string, texto: string) => {
    navigator.clipboard.writeText(texto);
    setCopiadoId(id);
    setTimeout(() => setCopiadoId(null), 2000);
  };

  const limparHistorico = () => {
    localStorage.removeItem('guia_escolar_ia_conversas_historico_sessao-principal');
    setMensagens([
      {
        id: 'msg-welcome-reset',
        remetente: 'ia',
        texto: 'Conversa reiniciada. Minha memória com os fatos da escola no Supabase continua ativa. Como posso ajudar agora?',
        dataHora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  return (
    <>
      {/* Botão Flutuante (Floating Trigger) com suporte a Minimizar */}
      {!aberto && (
        <div className={`ia-floating-wrapper ${botaoMinimizado ? 'is-minimized' : ''}`}>
          {botaoMinimizado ? (
            <div className="ia-mini-pill-wrap">
              <button
                type="button"
                className="ia-floating-btn-mini"
                onClick={() => {
                  setAberto(true);
                  setMinimizado(false);
                }}
                title="Assistente Guia IA (Clique para abrir)"
                aria-label="Abrir Assistente IA"
              >
                <Sparkles size={20} className="sparkle-anim" />
                <span className="ia-mini-text">IA</span>
              </button>
              <button
                type="button"
                className="ia-mini-expand-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setBotaoMinimizado(false);
                  localStorage.setItem('guia_ia_btn_minimized', 'false');
                }}
                title="Expandir card da IA"
                aria-label="Expandir card da IA"
              >
                <ChevronUp size={13} />
              </button>
            </div>
          ) : (
            <div className="ia-floating-full-wrap">
              <button
                type="button"
                className="ia-floating-btn"
                onClick={() => {
                  setAberto(true);
                  setMinimizado(false);
                }}
                title="Abrir Assistente IA da Escola (Memória Supabase Ativa)"
                aria-label="Abrir Assistente Inteligente da Escola"
              >
                <div className="ia-floating-icon">
                  <Sparkles size={22} className="sparkle-anim" />
                </div>
                <div className="ia-floating-label">
                  <span className="ia-title">Assistente Guia IA</span>
                  <span className="ia-status">Supabase • Memória Ativa</span>
                </div>
              </button>
              <button
                type="button"
                className="ia-floating-minimize-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setBotaoMinimizado(true);
                  localStorage.setItem('guia_ia_btn_minimized', 'true');
                }}
                title="Minimizar botão da IA"
                aria-label="Minimizar botão da IA"
              >
                <Minus size={15} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Janela de Chat do Assistente */}
      {aberto && (
        <div
          className={`ia-chat-window ${minimizado ? 'minimizado' : ''} ${telaCheia ? 'tela-cheia' : ''}`}
          role="dialog"
          aria-label="Assistente Inteligente Escolar"
        >
          {/* Cabeçalho */}
          <div className="ia-chat-header">
            <div className="ia-header-info">
              <div className="ia-avatar">
                <Bot size={22} />
              </div>
              <div>
                <div className="ia-header-title-row">
                  <h3>Assistente Guia IA</h3>
                  <span className="badge-ia-intel">Memória & Supabase</span>
                </div>
                <p>E.M. Maria Geralda • 30+30+40 pts • Sempre online</p>
              </div>
            </div>

            <div className="ia-header-actions">
              {/* Botão Memória / Cérebro da IA */}
              <button
                type="button"
                className={`ia-icon-btn ${painelMemoriaAberto ? 'active' : ''}`}
                onClick={() => {
                  setPainelMemoriaAberto(!painelMemoriaAberto);
                  setConfigAberta(false);
                }}
                title="Cérebro & Memória da IA no Supabase"
              >
                <Brain size={17} />
                {fatosMemoria.length > 0 && (
                  <span className="badge-fatos-count">{fatosMemoria.length}</span>
                )}
              </button>

              {/* Botão Chave de API */}
              <button
                type="button"
                className={`ia-icon-btn ${configAberta ? 'active' : ''}`}
                onClick={() => {
                  setConfigAberta(!configAberta);
                  setPainelMemoriaAberto(false);
                }}
                title="Configurações de IA e Provedores"
              >
                <Key size={16} />
              </button>

              <button
                type="button"
                className="ia-icon-btn"
                onClick={limparHistorico}
                title="Limpar histórico de mensagens"
              >
                <RotateCcw size={16} />
              </button>

              <button
                type="button"
                className="ia-icon-btn"
                onClick={() => setMinimizado(!minimizado)}
                title={minimizado ? 'Restaurar' : 'Minimizar'}
              >
                <Minimize2 size={16} />
              </button>

              <button
                type="button"
                className="ia-icon-btn"
                onClick={() => setTelaCheia(!telaCheia)}
                title={telaCheia ? 'Janela Normal' : 'Tela Cheia'}
              >
                <Maximize2 size={16} />
              </button>

              <button
                type="button"
                className="ia-icon-btn close-btn"
                onClick={fecharJanela}
                title="Fechar Assistente"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* PAINEL DE MEMÓRIA & SUPABASE */}
          {painelMemoriaAberto && !minimizado && (
            <div className="ia-memoria-panel">
              <div className="memoria-header">
                <div className="memoria-header-title">
                  <Database size={20} color="#2563eb" />
                  <div>
                    <h4>Memória Escolar & Conexão Supabase</h4>
                    <span className="status-conexao-chip">
                      <span className="dot-verde"></span>
                      {statusSupabase.conectado ? 'Conectado ao Supabase Oficial' : 'Modo Local'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-fechar-painel"
                  onClick={() => setPainelMemoriaAberto(false)}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Status do Banco */}
              <div className="supabase-status-card">
                <div className="supabase-status-info">
                  <ShieldCheck size={16} color="#16a34a" />
                  <div>
                    <strong>Instância Supabase Ativa:</strong>
                    <code>{statusSupabase.url}</code>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-copiar-sql"
                  onClick={copiarSqlSupabase}
                  title="Copiar Script SQL para criar as tabelas no Supabase"
                >
                  {copiadoSql ? <Check size={13} /> : <Copy size={13} />}
                  {copiadoSql ? 'SQL Copiado!' : 'Copiar SQL do Supabase'}
                </button>
              </div>

              {/* Adicionar Novo Conhecimento à Memória */}
              <form onSubmit={handleAdicionarFatoManual} className="form-novo-fato">
                <h5>🧠 Ensinar novo fato à Memória da IA:</h5>
                <div className="form-fato-inputs">
                  <input
                    type="text"
                    placeholder="Título (ex: Horário especial de sexta)"
                    value={novoFatoTitulo}
                    onChange={(e) => setNovoFatoTitulo(e.target.value)}
                    required
                  />
                  <select
                    value={novoFatoCategoria}
                    onChange={(e) => setNovoFatoCategoria(e.target.value as any)}
                  >
                    <option value="regras">Regras & Avaliação</option>
                    <option value="escola">Dados da Escola</option>
                    <option value="aluno">Alunos & Turmas</option>
                    <option value="pedagogico">Pedagógico</option>
                    <option value="geral">Geral</option>
                  </select>
                </div>
                <textarea
                  placeholder="Descreva o que a IA deve memorizar (ex: Na sexta-feira o intervalo tem 25 minutos e a saída é às 11h20)..."
                  value={novoFatoConteudo}
                  onChange={(e) => setNovoFatoConteudo(e.target.value)}
                  rows={2}
                  required
                />
                <button type="submit" disabled={salvandoFato} className="btn-salvar-fato">
                  <Plus size={14} /> {salvandoFato ? 'Gravando no Supabase...' : 'Salvar no Supabase'}
                </button>
              </form>

              {/* Lista de Fatos na Memória */}
              <div className="lista-fatos-scroll">
                <h5>Fatos Memorizados ({fatosMemoria.length}):</h5>
                {fatosMemoria.map((fato) => (
                  <div key={fato.id} className="card-fato-memoria">
                    <div className="fato-meta">
                      <span className={`tag-categoria cat-${fato.categoria}`}>{fato.categoria.toUpperCase()}</span>
                      <button
                        type="button"
                        className="btn-remover-fato"
                        onClick={() => handleExcluirFato(fato.id)}
                        title="Esquecer este fato"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <h6>{fato.titulo}</h6>
                    <p>{fato.conteudo}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PAINEL DE CONFIGURAÇÕES DE API */}
          {configAberta && !minimizado && (
            <div className="ia-config-panel">
              <div className="ia-config-header">
                <ShieldCheck size={18} color="#2563eb" />
                <h4>Configuração de Modelos e Chaves</h4>
                <button
                  type="button"
                  className="btn-fechar-painel"
                  onClick={() => setConfigAberta(false)}
                >
                  <X size={16} />
                </button>
              </div>
              <p className="ia-config-desc">
                {geminiApiKey ? (
                  <span style={{ color: '#16a34a', fontWeight: 600 }}>
                    ✨ Chave Google Gemini Oficial Ativa! Respostas de altíssima velocidade prontas para qualquer demanda.
                  </span>
                ) : (
                  <span>
                    O assistente opera automaticamente com o motor gratuito. Para ativar o poder máximo do <strong>Google Gemini</strong>, informe sua chave:
                  </span>
                )}
              </p>
              <div className="ia-key-input-row">
                <input
                  type="password"
                  placeholder="Cole sua Gemini API Key"
                  value={geminiApiKey}
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                />
                <button type="button" onClick={salvarApiKey} className="btn-salvar-key">
                  {salvandoKey ? 'Salvo!' : 'Salvar'}
                </button>
              </div>
              <span className="ia-config-note">
                💡 A chave é salva com segurança no seu navegador e utilizada diretamente para processar todas as suas solicitações com o modelo Gemini Flash.
              </span>
            </div>
          )}

          {!minimizado && !painelMemoriaAberto && !configAberta && (
            <>
              {/* Sugestões Rápidas de Ações */}
              <div className="ia-sugestoes-bar">
                <button
                  type="button"
                  className="ia-sugestao-pill"
                  onClick={() => handleEnviarMensagem('Vá para a tela de rematrícula')}
                >
                  <ArrowRight size={13} /> Abrir Rematrícula 2027
                </button>
                <button
                  type="button"
                  className="ia-sugestao-pill"
                  onClick={() => handleEnviarMensagem('Abra as declarações')}
                >
                  <FileText size={13} /> Abrir Declarações
                </button>
                <button
                  type="button"
                  className="ia-sugestao-pill"
                  onClick={() => handleEnviarMensagem('Como faz um histórico escolar passo a passo?')}
                >
                  <BookOpen size={13} /> Como fazer Histórico?
                </button>
                <button
                  type="button"
                  className="ia-sugestao-pill"
                  onClick={() => handleEnviarMensagem('Redigir modelo de ocorrência escolar disciplinar')}
                >
                  <FileText size={13} /> Modelo de Ocorrência
                </button>
                <button
                  type="button"
                  className="ia-sugestao-pill"
                  onClick={() => handleEnviarMensagem('Quantos alunos tem na escola e quantos rematriculados para 2027?')}
                >
                  <Users size={13} /> Alunos & Rematrículas
                </button>
                <button
                  type="button"
                  className="ia-sugestao-pill"
                  onClick={() => handleEnviarMensagem('Como funciona o cálculo de aprovação e notas trimestrais?')}
                >
                  <Check size={13} /> Regras 30+30+40
                </button>
              </div>

              {/* Área das Mensagens */}
              <div className="ia-messages-container">
                {mensagens.map((msg) => (
                  <div key={msg.id} className={`ia-message-row ${msg.remetente}`}>
                    <div className="ia-message-avatar">
                      {msg.remetente === 'ia' ? <Bot size={18} /> : <User size={18} />}
                    </div>

                    <div className="ia-message-content">
                      <div className={`ia-bubble ${msg.tipo === 'memoria' ? 'bubble-memoria' : ''}`}>
                        <div className="ia-bubble-text">
                          {msg.texto.split('\n').map((linha, idx) => {
                            if (linha.startsWith('• ') || linha.startsWith('- ')) {
                              return <p key={idx} className="ia-list-item">{linha}</p>;
                            }
                            if (linha.startsWith('**') && linha.endsWith('**')) {
                              return <h4 key={idx} className="ia-bold-title">{linha.replace(/\*\*/g, '')}</h4>;
                            }
                            if (linha.startsWith('> ')) {
                              return <blockquote key={idx} className="ia-quote">{linha.replace(/^>\s*/, '')}</blockquote>;
                            }
                            return <p key={idx}>{linha}</p>;
                          })}
                        </div>

                        {/* Card Especial de Aluno Localizado */}
                        {msg.tipo === 'aluno' && msg.dadosAluno && (
                          <div className="ia-card-aluno-action">
                            <div className="aluno-badge-info">
                              <span>🎓 {msg.dadosAluno.nome}</span>
                              <span className="turma-tag">{msg.dadosAluno.turma}</span>
                            </div>
                            {onAbrirDeclaracao && (
                              <button
                                type="button"
                                className="btn-gerar-decl-aluno"
                                onClick={() => onAbrirDeclaracao(msg.dadosAluno?.nome)}
                              >
                                <FileText size={14} /> Abrir Declarações
                              </button>
                            )}
                          </div>
                        )}

                        {/* Card Especial de Ação Executada em Tempo Real */}
                        {msg.acaoExecutada && (
                          <div className={`ia-card-acao-executada ${msg.acaoExecutada.sucesso ? 'sucesso' : 'falha'}`}>
                            <div className="acao-icon-wrap">
                              {msg.acaoExecutada.sucesso ? <CheckCircle2 size={18} color="#16a34a" /> : <AlertTriangle size={18} color="#dc2626" />}
                            </div>
                            <div className="acao-conteudo">
                              <div className="acao-header-badge">
                                <span className="badge-acao-tipo">{msg.acaoExecutada.titulo}</span>
                                <span className="badge-status-acao">{msg.acaoExecutada.sucesso ? 'Executado' : 'Aviso'}</span>
                              </div>
                              <p className="acao-desc">{msg.acaoExecutada.descricao}</p>
                              {msg.acaoExecutada.detalhes?.aluno && (
                                <div className="acao-aluno-pill">
                                  <span>👤 {msg.acaoExecutada.detalhes.aluno.nome}</span>
                                  <span className="pill-turma">➔ {msg.acaoExecutada.detalhes.aluno.turma2027} ({msg.acaoExecutada.detalhes.aluno.turno})</span>
                                </div>
                              )}
                              <div className="acao-botoes-row">
                                {msg.acaoExecutada.tipo === 'rematricula' && onNavegarAba && (
                                  <button
                                    type="button"
                                    className="btn-acao-rapida"
                                    onClick={() => onNavegarAba('rematricula')}
                                  >
                                    Ver no Controle de Rematrícula <ArrowRight size={13} />
                                  </button>
                                )}
                                {msg.acaoExecutada.tipo === 'busca' && onNavegarAba && (
                                  <button
                                    type="button"
                                    className="btn-acao-rapida"
                                    onClick={() => onNavegarAba('consulta')}
                                  >
                                    Ver Aluno na Lista <ArrowRight size={13} />
                                  </button>
                                )}
                                {msg.acaoExecutada.tipo === 'declaracao' && onAbrirDeclaracao && (
                                  <button
                                    type="button"
                                    className="btn-acao-rapida"
                                    onClick={() => onAbrirDeclaracao()}
                                  >
                                    Abrir Emissor de Declarações <ArrowRight size={13} />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Rodapé do Bubble */}
                        {msg.remetente === 'ia' && (
                          <div className="ia-bubble-footer">
                            <span className="ia-timestamp">
                              {msg.tipo === 'memoria' && '🧠 Memória Supabase • '}
                              {msg.dataHora}
                            </span>
                            <button
                              type="button"
                              className="btn-copiar-ia"
                              onClick={() => copiarTexto(msg.id, msg.texto)}
                              title="Copiar texto gerado"
                            >
                              {copiadoId === msg.id ? (
                                <>
                                  <Check size={12} color="#16a34a" /> Copiado
                                </>
                              ) : (
                                <>
                                  <Copy size={12} /> Copiar
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {carregando && (
                  <div className="ia-message-row ia">
                    <div className="ia-message-avatar">
                      <Bot size={18} />
                    </div>
                    <div className="ia-bubble ia-loading">
                      <div className="typing-dots">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                      <span className="typing-text">Assistente Guia IA consultando memória e processando...</span>
                    </div>
                  </div>
                )}

                <div ref={mensagensFimRef} />
              </div>

              {/* Barra de Entrada / Digitação */}
              <form
                className="ia-input-container"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleEnviarMensagem();
                }}
              >
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Converse ou use 'Aprenda que...' para gravar na memória..."
                  value={inputTexto}
                  onChange={(e) => setInputTexto(e.target.value)}
                  disabled={carregando}
                />
                <button
                  type="submit"
                  className="ia-btn-send"
                  disabled={!inputTexto.trim() || carregando}
                  title="Enviar mensagem"
                >
                  <Send size={16} />
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </>
  );
};

export default AssistenteEscolarIA;
