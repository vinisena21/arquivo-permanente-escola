import { supabase } from './supabase';

export interface FatoMemoriaIA {
  id: string;
  categoria: 'regras' | 'escola' | 'aluno' | 'pedagogico' | 'geral';
  titulo: string;
  conteudo: string;
  autor?: string;
  criadoEm: string;
  atualizadoEm: string;
}

export interface MensagemHistoricoIA {
  id: string;
  sessaoId: string;
  remetente: 'usuario' | 'ia';
  texto: string;
  dataHora: string;
  criadoEm: string;
}

const LOCAL_STORAGE_MEMORIA_KEY = 'guia_escolar_ia_memoria_fatos';
const LOCAL_STORAGE_HISTORICO_KEY = 'guia_escolar_ia_conversas_historico';

// SQL para o usuário criar as tabelas no Supabase se ainda não existirem
export const SCRIPT_SQL_SUPABASE_IA = `-- SCRIPT PARA CRIAR AS TABELAS DE MEMÓRIA DA IA NO SUPABASE
-- Copie e execute este código no SQL Editor do Supabase (https://supabase.com/dashboard)

-- 1. Tabela de Memória e Fatos Aprendidos pela IA
CREATE TABLE IF NOT EXISTS public.ia_memoria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria TEXT NOT NULL DEFAULT 'geral',
  titulo TEXT NOT NULL,
  conteudo TEXT NOT NULL,
  autor TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Tabela de Histórico de Conversas da IA
CREATE TABLE IF NOT EXISTS public.ia_conversas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sessao_id TEXT NOT NULL,
  remetente TEXT NOT NULL,
  texto TEXT NOT NULL,
  data_hora TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS ou permitir leitura/escrita autenticada e anônima
ALTER TABLE public.ia_memoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ia_conversas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir leitura total ia_memoria" ON public.ia_memoria FOR SELECT USING (true);
CREATE POLICY "Permitir insercao total ia_memoria" ON public.ia_memoria FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir exclusao total ia_memoria" ON public.ia_memoria FOR DELETE USING (true);

CREATE POLICY "Permitir leitura total ia_conversas" ON public.ia_conversas FOR SELECT USING (true);
CREATE POLICY "Permitir insercao total ia_conversas" ON public.ia_conversas FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir exclusao total ia_conversas" ON public.ia_conversas FOR DELETE USING (true);
`;

// Fatos iniciais padrão aprendidos sobre a escola
const FATOS_PADRAO_INICIAIS: FatoMemoriaIA[] = [
  {
    id: 'padrao-1',
    categoria: 'regras',
    titulo: 'Divisão Oficial de Pontos Trimestrais (30+30+40)',
    conteudo: 'A escola utiliza o sistema trimestral com a distribuição: 1º Trimestre (30 pontos), 2º Trimestre (30 pontos) e 3º Trimestre (40 pontos), totalizando 100 pontos anuais. O mínimo exigido para promoção direta é de 60,0 pontos.',
    autor: 'Diretoria Escolar',
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString()
  },
  {
    id: 'padrao-2',
    categoria: 'regras',
    titulo: 'Critério de Frequência e Alunos Transferidos',
    conteudo: 'Frequência mínima exigida por lei é de 75% das horas letivas do ano escolar (Art. 24 da LDB 9.394/96). Estudantes com status TRANSFERIDO nunca são contabilizados na frequência ativa ou chamada regular das turmas.',
    autor: 'Secretaria Escolar',
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString()
  },
  {
    id: 'padrao-3',
    categoria: 'escola',
    titulo: 'Dados Oficiais da Instituição',
    conteudo: 'Escola Municipal Maria Geralda Miranda Brito Salomão, Código INEP 31054366, Município de Ponto dos Volantes - MG. Diretor: Marcos Vinícius Sena Sousa. Turno Matutino: 07:00 às 11:30 (Anos Finais). Turno Vespertino: 12:30 às 17:00 (Anos Iniciais).',
    autor: 'Gestão Escolar',
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString()
  },
  {
    id: 'padrao-4',
    categoria: 'pedagogico',
    titulo: 'Passo a Passo Oficial para Gerar Histórico Escolar',
    conteudo: '1) No menu superior, clique em "Arquivo & Históricos" e selecione "Gerar Histórico". 2) Digite o nome ou matrícula do aluno para preencher os dados cadastrais (nome, filiação, certidão, nascimento). 3) Selecione as séries cursadas do Ensino Fundamental (1º ao 9º Ano), informando ano letivo, notas/conceitos, carga horária e resultado. 4) Preencha o verso com os dados de regularidade legal, convenções e carimbos. 5) Clique em "Baixar DOCX" ou "Gerar Documento". O histórico fica gravado automaticamente no Supabase e pode ser reaberto ou reimpresso a qualquer momento na aba "Históricos Salvos".',
    autor: 'Equipe de Documentação',
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString()
  },
  {
    id: 'padrao-5',
    categoria: 'pedagogico',
    titulo: 'Passo a Passo Oficial para Emitir Declarações',
    conteudo: '1) Clique no botão "Declarações" no topo ou no atalho da barra de navegação. 2) Escolha o modelo desejado entre os 7 modelos oficiais: Matrícula e Frequência, Transferência, Conclusão de Curso, Escolaridade, Comparecimento de Responsável, Transporte Escolar Rural ou Personalizada. 3) Digite o nome do aluno no campo de busca para puxar matrícula, turma, turno e filiação direto do banco. 4) Personalize finalidades, justificativas ou edite o texto livremente se necessário. 5) Clique em "Imprimir Declaração". O layout é calibrado milimetricamente para 1 única página A4 com brasão oficial e termo de autenticidade.',
    autor: 'Secretaria Escolar',
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString()
  },
  {
    id: 'padrao-6',
    categoria: 'escola',
    titulo: 'Quantitativo Oficial de Alunos, Turmas e Servidores',
    conteudo: 'O acervo escolar possui 585 estudantes matriculados, distribuídos em 30 turmas ativas entre os turnos Matutino (6º ao 9º Ano) e Vespertino (1º ao 5º Ano). O corpo funcional conta com 86 profissionais da educação (professores, especialistas e apoio administrativo). A escola opera 200 dias letivos e 800 horas anuais de efetivo trabalho escolar.',
    autor: 'Censo Escolar',
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString()
  },
  {
    id: 'padrao-7',
    categoria: 'pedagogico',
    titulo: 'Módulos Pedagógicos do SIGP (Boletim, Diário e Atas)',
    conteudo: 'O menu "Pedagógico (SIGP)" contém: 1) Quadro de Horários: grade semanal das 30 turmas por disciplina e professor. 2) Boletim & Notas: visualização individual e mapa da turma com lançamento trimestral (30+30+40) e exportação em CSV. 3) Diário & Frequência: chamada interativa com controle C/F/FJ e registro de conteúdos da BNCC. 4) Ficha Individual & Ata Final: encerramento letivo com ata oficial para livro de arquivo. 5) Remanejamento: registro de movimentações e transferências escolares.',
    autor: 'Coordenação SIGP',
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString()
  }
];

// Ler fatos locais
function lerFatosLocais(): FatoMemoriaIA[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_MEMORIA_KEY);
    if (!raw) return FATOS_PADRAO_INICIAIS;
    const lista = JSON.parse(raw);
    return Array.isArray(lista) && lista.length > 0 ? lista : FATOS_PADRAO_INICIAIS;
  } catch {
    return FATOS_PADRAO_INICIAIS;
  }
}

// Salvar fatos locais
function salvarFatosLocais(fatos: FatoMemoriaIA[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_MEMORIA_KEY, JSON.stringify(fatos));
  } catch {
    // quota
  }
}

/**
 * Carrega a memória e fatos aprendidos pela IA (Supabase com fallback para LocalStorage)
 */
export async function carregarMemoriaIA(): Promise<{ fatos: FatoMemoriaIA[]; conectadoSupabase: boolean }> {
  try {
    const { data, error } = await (supabase as any)
      .from('ia_memoria')
      .select('*')
      .order('created_at', { ascending: true });

    if (!error && Array.isArray(data) && data.length > 0) {
      const formatados: FatoMemoriaIA[] = data.map((item: any) => ({
        id: String(item.id),
        categoria: item.categoria || 'geral',
        titulo: item.titulo,
        conteudo: item.conteudo,
        autor: item.autor,
        criadoEm: item.created_at || new Date().toISOString(),
        atualizadoEm: item.updated_at || new Date().toISOString()
      }));

      // Sincroniza com local
      salvarFatosLocais(formatados);
      return { fatos: formatados, conectadoSupabase: true };
    }

    // Se a tabela ainda não tiver dados ou não foi criada, retorna os locais
    const locais = lerFatosLocais();
    return { fatos: locais, conectadoSupabase: !error };
  } catch {
    return { fatos: lerFatosLocais(), conectadoSupabase: false };
  }
}

/**
 * Salva um novo fato aprendido na memória da IA (no Supabase e localmente)
 */
export async function salvarFatoMemoria(
  fato: Omit<FatoMemoriaIA, 'id' | 'criadoEm' | 'atualizadoEm'>
): Promise<FatoMemoriaIA> {
  const agora = new Date().toISOString();
  const novoFato: FatoMemoriaIA = {
    id: `fato-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    ...fato,
    criadoEm: agora,
    atualizadoEm: agora
  };

  // 1. Salvar no Supabase (se a tabela estiver pronta)
  try {
    const { data, error } = await (supabase as any)
      .from('ia_memoria')
      .insert({
        categoria: fato.categoria,
        titulo: fato.titulo,
        conteudo: fato.conteudo,
        autor: fato.autor || 'Usuário do Guia Escolar'
      })
      .select()
      .single();

    if (!error && data) {
      novoFato.id = String(data.id);
    }
  } catch {
    // Tabela pode ainda não ter sido criada no Supabase — persiste no fallback local
  }

  // 2. Atualizar estado local
  const atuais = lerFatosLocais();
  const atualizados = [...atuais, novoFato];
  salvarFatosLocais(atualizados);

  return novoFato;
}

/**
 * Exclui um fato da memória da IA
 */
export async function excluirFatoMemoria(id: string): Promise<boolean> {
  try {
    await (supabase as any).from('ia_memoria').delete().eq('id', id);
  } catch {
    // fallback
  }

  const atuais = lerFatosLocais();
  const filtrados = atuais.filter((f) => f.id !== id);
  salvarFatosLocais(filtrados);
  return true;
}

/**
 * Carrega o histórico das últimas mensagens da sessão
 */
export async function carregarHistoricoConversa(sessaoId = 'sessao-principal'): Promise<MensagemHistoricoIA[]> {
  try {
    const { data, error } = await (supabase as any)
      .from('ia_conversas')
      .select('*')
      .eq('sessao_id', sessaoId)
      .order('created_at', { ascending: true })
      .limit(50);

    if (!error && Array.isArray(data) && data.length > 0) {
      return data.map((item: any) => ({
        id: String(item.id),
        sessaoId: item.sessao_id,
        remetente: item.remetente,
        texto: item.texto,
        dataHora: item.data_hora,
        criadoEm: item.created_at
      }));
    }
  } catch {
    // fallback
  }

  // Fallback Local
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_HISTORICO_KEY}_${sessaoId}`);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignora
  }

  return [];
}

/**
 * Salva uma mensagem no histórico contínuo de conversas
 */
export async function salvarMensagemNoHistorico(
  msg: { sessaoId: string; remetente: 'usuario' | 'ia'; texto: string; dataHora: string }
): Promise<void> {
  // 1. Tentar salvar no Supabase
  try {
    await (supabase as any).from('ia_conversas').insert({
      sessao_id: msg.sessaoId,
      remetente: msg.remetente,
      texto: msg.texto,
      data_hora: msg.dataHora
    });
  } catch {
    // ignora se tabela ainda não criada
  }

  // 2. Salvar no localStorage (mantém até 100 mensagens)
  try {
    const chave = `${LOCAL_STORAGE_HISTORICO_KEY}_${msg.sessaoId}`;
    const raw = localStorage.getItem(chave);
    const lista = raw ? JSON.parse(raw) : [];
    const novaLista = [...lista, { id: `msg-${Date.now()}`, ...msg, criadoEm: new Date().toISOString() }].slice(-100);
    localStorage.setItem(chave, JSON.stringify(novaLista));
  } catch {
    // quota
  }
}

/**
 * Converte toda a memória aprendida em um resumo estruturado para alimentar o Prompt da IA
 */
export function formatarMemoriaParaPrompt(fatos: FatoMemoriaIA[]): string {
  if (!fatos || fatos.length === 0) return '';

  const linhas = fatos.map((f, i) => `${i + 1}. [${f.categoria.toUpperCase()}] **${f.titulo}**: ${f.conteudo}`);
  return `\n\n### BASE DE MEMÓRIA E APRENDIZADOS DA ESCOLA (Armazenados no Supabase):\n${linhas.join('\n')}\nUtilize rigorosamente estes conhecimentos memorizados para responder à equipe escolar.\n`;
}

/**
 * Testa a conexão ativa com o Supabase
 */
export async function testarConexaoSupabase(): Promise<{
  conectado: boolean;
  tabelaMemoriaExiste: boolean;
  url: string;
  mensagem: string;
}> {
  const url = (import.meta as any).env?.VITE_SUPABASE_URL || 'Configurado';

  try {
    const { error } = await (supabase as any).from('ia_memoria').select('id').limit(1);

    if (!error) {
      return {
        conectado: true,
        tabelaMemoriaExiste: true,
        url,
        mensagem: 'Conectado ao Supabase com tabelas de IA ativas e sincronizadas!'
      };
    }

    if (error.code === '42P01' || error.message?.includes('does not exist')) {
      return {
        conectado: true,
        tabelaMemoriaExiste: false,
        url,
        mensagem: 'Conectado ao Supabase! A tabela ia_memoria ainda não foi criada no banco.'
      };
    }

    return {
      conectado: true,
      tabelaMemoriaExiste: false,
      url,
      mensagem: `Conectado ao Supabase (${error.message || 'aguardando tabela'}).`
    };
  } catch (err: any) {
    return {
      conectado: false,
      tabelaMemoriaExiste: false,
      url,
      mensagem: `Não foi possível alcançar o Supabase: ${err?.message || 'erro de rede'}`
    };
  }
}
