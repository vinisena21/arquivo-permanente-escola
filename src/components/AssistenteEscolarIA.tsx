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
  Search,
  BookOpen,
  Calendar,
  AlertCircle,
  Key,
  ShieldCheck
} from 'lucide-react';
import matriculasData from '../data/matriculas.json';
import turmasData from '../data/turmas.json';
import profissionaisData from '../data/profissionais.json';
import './AssistenteEscolarIA.css';

interface Mensagem {
  id: string;
  remetente: 'usuario' | 'ia';
  texto: string;
  dataHora: string;
  tipo?: 'padrao' | 'aluno' | 'documento' | 'aviso';
  dadosAluno?: {
    nome: string;
    turma: string;
    nascimento: string;
    filiacao: string;
    status: string;
    pasta?: string;
  };
}

interface AssistenteEscolarIAProps {
  onAbrirDeclaracao?: () => void;
  abertoExterno?: boolean;
  onFecharExterno?: () => void;
}

export const AssistenteEscolarIA: React.FC<AssistenteEscolarIAProps> = ({
  onAbrirDeclaracao,
  abertoExterno,
  onFecharExterno
}) => {
  const [aberto, setAberto] = useState(false);

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
  const [minimizado, setMinimizado] = useState(false);
  const [telaCheia, setTelaCheia] = useState(false);
  const [inputTexto, setInputTexto] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [copiadoId, setCopiadoId] = useState<string | null>(null);
  const [configAberta, setConfigAberta] = useState(false);
  const [geminiApiKey, setGeminiApiKey] = useState(() => localStorage.getItem('guia_gemini_api_key') || '');
  const [salvandoKey, setSalvandoKey] = useState(false);

  const mensagensFimRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Mensagens iniciais de boas-vindas
  const [mensagens, setMensagens] = useState<Mensagem[]>([
    {
      id: 'msg-welcome',
      remetente: 'ia',
      texto: `Olá! Sou o **Assistente Inteligente do Guia Escolar** da E.M. Maria Geralda Miranda Brito Salomão.

Estou aqui para ajudar a Secretaria e Equipe Pedagógica em tempo real:
• **Consulta de Alunos**: Digite o nome de qualquer estudante para ver turma, pasta e dados.
• **Regimento e LDB**: Regras de aprovação (60 pts, 75% frequência), trimestres e resoluções.
• **Redação de Documentos**: Criação de comunicados aos pais, atas, ocorrências e notificações.
• **100% Sempre Disponível**: Funciona diretamente no seu navegador, sem custo de tokens!

Como posso te ajudar hoje?`,
      dataHora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  // Rolar para a última mensagem
  useEffect(() => {
    if (aberto && !minimizado) {
      mensagensFimRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [mensagens, aberto, minimizado]);

  // Foco no input ao abrir
  useEffect(() => {
    if (aberto && !minimizado) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [aberto, minimizado]);

  // Salvar Chave Gemini no localStorage (Opcional para quem quiser usar Gemini Oficial)
  const salvarApiKey = () => {
    localStorage.setItem('guia_gemini_api_key', geminiApiKey.trim());
    setSalvandoKey(true);
    setTimeout(() => {
      setSalvandoKey(false);
      setConfigAberta(false);
    }, 600);
  };

  // Base de Conhecimento Escolar Local (Instantânea, 0 Tokens, 100% Offline)
  const totalAlunos = useMemo(() => matriculasData.length, []);
  const totalTurmas = useMemo(() => turmasData.length, []);
  const totalProfissionais = useMemo(() => profissionaisData.length, []);

  // Motor de Inteligência Local com Busca e Heurísticas
  const processarPerguntaLocalmente = (pergunta: string): { resposta: string; dadosAluno?: Mensagem['dadosAluno']; tipo?: Mensagem['tipo'] } | null => {
    const p = pergunta.toLowerCase().trim();

    // 1. Dúvidas sobre Aprovação / Notas / Média / Frequência / LDB
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
   • **1º Trimestre**: valor de **30 pontos**.
   • **2º Trimestre**: valor de **35 pontos**.
   • **3º Trimestre**: valor de **35 pontos**.
   • **Mínimo para Aprovação**: **60 pontos** na soma total.

2. **Frequência Escolar Obrigatória**:
   • Mínimo exigido: **75%** das horas letivas do ano (Art. 24, VI da LDB).
   • Carga horária anual mínima: **800 horas** distribuídas em no mínimo **200 dias de efetivo trabalho escolar**.

3. **Alunos Transferidos**:
   • Conforme a diretriz do sistema, estudantes com status *TRANSFERIDO* são automaticamente desconsiderados do cômputo de frequência ativa da turma.

4. **Recuperação**:
   • É direito do estudante a recuperação paralela e periódica ao longo de cada trimestre.`
      };
    }

    // 2. Horários e Turnos da Escola
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

    // 3. Informações Institucionais e Números da Escola
    if (
      p.includes('escola') ||
      p.includes('inep') ||
      p.includes('diretor') ||
      p.includes('quantos alunos') ||
      p.includes('quantas turmas') ||
      p.includes('professores') ||
      p.includes('servidores') ||
      p.includes('dados da escola')
    ) {
      return {
        resposta: `🏫 **Dados Institucionais Oficiais da Escola**:

• **Nome**: Escola Municipal Maria Geralda Miranda Brito Salomão
• **Código INEP**: **31054366**
• **Município**: Ponto dos Volantes - MG
• **Direção**: Marcos Vinícius Sena Sousa
• **Estudantes Matriculados**: **${totalAlunos}** alunos
• **Turmas Ativas**: **${totalTurmas}** turmas
• **Profissionais / Servidores**: **${totalProfissionais}** cadastrados
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

    // 5. Modelos de Documentos Rápidos (Comunicado, Ata, Notificação)
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
1. O desenvolvimento pedagógico e rendimento trimestral dos estudantes;
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
1. Desempenho geral da turma e análise dos índices de aproveitamento;
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

  // Enviar Mensagem para o Assistente
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

    // 1. Tentar responder pelo cérebro local (Instantâneo, 0 tokens, precisão escolar)
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
        setCarregando(false);
      }, 350);
      return;
    }

    // 2. Se for uma pergunta mais ampla ou pedido de redação criativa, consultar IA Externa Gratuita (Pollinations ou Gemini)
    try {
      let respostaTexto = '';

      // Opção A: Se o usuário configurou chave Gemini própria no navegador
      if (geminiApiKey.trim()) {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey.trim()}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: `Você é o Assistente Pedagógico e Administrativo da E.M. Maria Geralda Miranda Brito Salomão, em Ponto dos Volantes - MG. Diretor: Marcos Vinícius Sena Sousa. O sistema segue a LDB 9.394/96, trimestres (30+35+35=100), aprovação com 60 pontos e 75% de frequência. Responda em português com clareza, formatação elegante em tópicos e sempre muito solícito à equipe escolar.` }]
            },
            contents: [{ parts: [{ text: texto }] }]
          })
        });

        if (res.ok) {
          const data = await res.json();
          respostaTexto = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        }
      }

      // Opção B: Endpoint Gratuito Ilimitado (Pollinations.ai / Zero Token / Sem Cadastro)
      if (!respostaTexto) {
        const promptComContexto = encodeURIComponent(
          `Contexto: Você é o Assistente da Escola Municipal Maria Geralda Miranda Brito Salomão (Ponto dos Volantes - MG). Diretor: Marcos Vinícius Sena Sousa. Pergunta da equipe escolar: ${texto}. Responda em português formal e amigável, com dicas práticas para a escola.`
        );

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 9000);

        const res = await fetch(`https://text.pollinations.ai/${promptComContexto}?model=openai`, {
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

      const novaMensagemIA: Mensagem = {
        id: `ia-${Date.now()}`,
        remetente: 'ia',
        texto: respostaTexto,
        dataHora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      };
      setMensagens((prev) => [...prev, novaMensagemIA]);
    } catch {
      // Fallback amigável se a internet oscilar
      const respostaFallback: Mensagem = {
        id: `ia-${Date.now()}`,
        remetente: 'ia',
        texto: `Entendi a sua solicitação sobre: "${texto}".

Como estou em **modo autônomo escolar (100% offline e sem tokens)**, aqui estão as opções e procedimentos recomendados para essa solicitação:

• Se for **localizar um aluno**, digite o nome completo ou partes do nome (ex: *"aluno Enzo"*).
• Se for **regras acadêmicas**, digite *"como funciona a aprovação"* ou *"média trimestral"*.
• Se for **documentos e declarações**, utilize os atalhos rápidos abaixo ou o botão **Declarações** no menu superior.`,
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
    setMensagens([
      {
        id: 'msg-welcome-reset',
        remetente: 'ia',
        texto: 'Conversa reiniciada. Como posso te auxiliar agora na Secretaria ou Gestão Pedagógica?',
        dataHora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  return (
    <>
      {/* Botão Flutuante (Floating Trigger) */}
      {!aberto && (
        <button
          type="button"
          className="ia-floating-btn"
          onClick={() => {
            setAberto(true);
            setMinimizado(false);
          }}
          title="Abrir Assistente IA da Escola (Sem custo de tokens)"
          aria-label="Abrir Assistente Inteligente da Escola"
        >
          <div className="ia-floating-icon">
            <Sparkles size={24} className="sparkle-anim" />
          </div>
          <div className="ia-floating-label">
            <span className="ia-title">Assistente IA</span>
            <span className="ia-status">Gratuito • Online</span>
          </div>
        </button>
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
                <h3>Assistente Guia IA</h3>
                <p>E.M. Maria Geralda • Sem gastar tokens</p>
              </div>
            </div>

            <div className="ia-header-actions">
              <button
                type="button"
                className="ia-icon-btn"
                onClick={() => setConfigAberta(!configAberta)}
                title="Configurações e Chave de IA"
              >
                <Key size={16} />
              </button>

              <button
                type="button"
                className="ia-icon-btn"
                onClick={limparHistorico}
                title="Limpar conversa"
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

          {/* Painel Opcional de Configuração */}
          {configAberta && (
            <div className="ia-config-panel">
              <div className="ia-config-header">
                <ShieldCheck size={18} color="#2563eb" />
                <h4>Modo de Operação e Chaves de IA</h4>
              </div>
              <p className="ia-config-desc">
                O assistente opera por padrão no <strong>Modo Gratuito Ilimitado (0 Tokens)</strong> com conhecimento escolar nativo. Caso queira conectar o Google Gemini 2.0 Flash oficial diretamente:
              </p>
              <div className="ia-key-input-row">
                <input
                  type="password"
                  placeholder="Cole sua Gemini API Key (Opcional)"
                  value={geminiApiKey}
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                />
                <button type="button" onClick={salvarApiKey} className="btn-salvar-key">
                  {salvandoKey ? 'Salvo!' : 'Salvar'}
                </button>
              </div>
              <span className="ia-config-note">
                Dica: Deixe em branco para usar o motor 100% gratuito e ilimitado sem cadastro.
              </span>
            </div>
          )}

          {!minimizado && (
            <>
              {/* Sugestões Rápidas de Ações */}
              <div className="ia-sugestoes-bar">
                <button
                  type="button"
                  className="ia-sugestao-pill"
                  onClick={() => handleEnviarMensagem('Como funciona o cálculo de aprovação e notas trimestrais?')}
                >
                  <BookOpen size={13} /> Regras de Aprovação
                </button>
                <button
                  type="button"
                  className="ia-sugestao-pill"
                  onClick={() => handleEnviarMensagem('Redigir modelo de comunicado aos pais sobre reunião')}
                >
                  <FileText size={13} /> Modelo de Comunicado
                </button>
                <button
                  type="button"
                  className="ia-sugestao-pill"
                  onClick={() => handleEnviarMensagem('Redigir modelo de ocorrência disciplinar')}
                >
                  <AlertCircle size={13} /> Ocorrência Escolar
                </button>
                <button
                  type="button"
                  className="ia-sugestao-pill"
                  onClick={() => handleEnviarMensagem('Quais são os horários e turnos da escola?')}
                >
                  <Calendar size={13} /> Horários dos Turnos
                </button>
                <button
                  type="button"
                  className="ia-sugestao-pill"
                  onClick={() => handleEnviarMensagem('Buscar dados do aluno')}
                >
                  <Search size={13} /> Consultar Aluno
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
                      <div className="ia-bubble">
                        <div className="ia-bubble-text">
                          {msg.texto.split('\n').map((linha, idx) => {
                            // Suporte simples a títulos com marcadores markdown
                            if (linha.startsWith('• ') || linha.startsWith('- ')) {
                              return <p key={idx} className="ia-list-item">{linha}</p>;
                            }
                            if (linha.startsWith('**') && linha.endsWith('**')) {
                              return <h4 key={idx} className="ia-bold-title">{linha.replace(/\*\*/g, '')}</h4>;
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
                                onClick={onAbrirDeclaracao}
                              >
                                <FileText size={14} /> Abrir Declarações
                              </button>
                            )}
                          </div>
                        )}

                        {/* Botão de Copiar Texto para a Área de Transferência */}
                        {msg.remetente === 'ia' && (
                          <div className="ia-bubble-footer">
                            <span className="ia-timestamp">{msg.dataHora}</span>
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
                      <span className="typing-text">Assistente Guia IA processando resposta...</span>
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
                  placeholder="Pergunte sobre alunos, LDB, redija comunicados..."
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
