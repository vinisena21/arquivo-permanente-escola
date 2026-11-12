import React, { useState, useMemo, useEffect } from 'react';
import {
  BookOpen,
  Calendar,
  Users,
  FileCheck,
  Printer,
  Save,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  Download
} from 'lucide-react';
import turmasData from '../data/turmas.json';
import matriculasData from '../data/matriculas.json';
import './DiarioClasse.css';

interface DiarioClasseProps {
  onToast?: (toast: { message: string; type: 'success' | 'error' }) => void;
}

export type StatusPresenca = 'C' | 'F' | 'FJ';

export interface RegistroConteudo {
  id: string;
  data: string; // YYYY-MM-DD
  aulas: number;
  habilidade: string;
  objetoConhecimento: string;
  descricaoAtividade: string;
}

const MESES_LETIVOS = [
  { valor: 2, nome: 'Fevereiro' },
  { valor: 3, nome: 'Março' },
  { valor: 4, nome: 'Abril' },
  { valor: 5, nome: 'Maio' },
  { valor: 6, nome: 'Junho' },
  { valor: 7, nome: 'Julho' },
  { valor: 8, nome: 'Agosto' },
  { valor: 9, nome: 'Setembro' },
  { valor: 10, nome: 'Outubro' },
  { valor: 11, nome: 'Novembro' },
  { valor: 12, nome: 'Dezembro' }
];

const DISCIPLINAS = [
  'Língua Portuguesa',
  'Matemática',
  'Ciências',
  'História',
  'Geografia',
  'Arte',
  'Educação Física',
  'Língua Inglesa',
  'Ensino Religioso'
];

// Obtém os dias úteis (segunda a sexta) do mês no ano de 2026
function obterDiasLetivosDoMes(ano: number, mes: number): number[] {
  const dias: number[] = [];
  const totalDias = new Date(ano, mes, 0).getDate();

  for (let dia = 1; dia <= totalDias; dia++) {
    const data = new Date(ano, mes - 1, dia);
    const diaSemana = data.getDay();
    // 0 = Domingo, 6 = Sábado
    if (diaSemana !== 0 && diaSemana !== 6) {
      dias.push(dia);
    }
  }
  return dias;
}

// Conteúdos pedagógicos pré-definidos para demonstração rica
const CONTEUDOS_EXEMPLO: Record<string, RegistroConteudo[]> = {
  'Língua Portuguesa': [
    {
      id: 'lp-1',
      data: '2026-11-03',
      aulas: 2,
      habilidade: 'EF06LP01 / EF15LP03',
      objetoConhecimento: 'Gêneros Textuais: Crônica e Notícia',
      descricaoAtividade: 'Leitura compartilhada, identificação de elementos narrativos, tempo e espaço. Atividade interpretativa individual.'
    },
    {
      id: 'lp-2',
      data: '2026-11-05',
      aulas: 2,
      habilidade: 'EF06LP04',
      objetoConhecimento: 'Coesão e Coerência Textual',
      descricaoAtividade: 'Uso dos pronomes e conjunções coordenativas na estruturação de parágrafos argumentativos.'
    },
    {
      id: 'lp-3',
      data: '2026-11-10',
      aulas: 1,
      habilidade: 'EF06LP12',
      objetoConhecimento: 'Produção Textual e Revisão',
      descricaoAtividade: 'Redação de relato pessoal em primeira pessoa com foco na correção gramatical e pontuação.'
    }
  ],
  'Matemática': [
    {
      id: 'mat-1',
      data: '2026-11-04',
      aulas: 2,
      habilidade: 'EF06MA07',
      objetoConhecimento: 'Frações e Números Decimais',
      descricaoAtividade: 'Representação geométrica de frações equivalentes e resolução de problemas contextuais do cotidiano.'
    },
    {
      id: 'mat-2',
      data: '2026-11-06',
      aulas: 2,
      habilidade: 'EF06MA09',
      objetoConhecimento: 'Operações Fundamentais com Decimais',
      descricaoAtividade: 'Adição, subtração e multiplicação com vírgula aplicados a situações de compras e orçamento familiar.'
    }
  ]
};

export const DiarioClasse: React.FC<DiarioClasseProps> = ({ onToast }) => {
  const turmasValidas = useMemo(() => {
    return turmasData.filter(t => t.Turma && t.Turma !== 'TURMA VALIDAÇÃO RELATÓRIOS TRIMESTRE');
  }, []);

  const [turmaSelecionada, setTurmaSelecionada] = useState<string>(() => {
    return turmasValidas[0]?.Turma || '1º  1';
  });

  const [disciplinaSelecionada, setDisciplinaSelecionada] = useState<string>('Língua Portuguesa');
  const [mesSelecionado, setMesSelecionado] = useState<number>(11); // Novembro por padrão
  const [abaAtiva, setAbaAtiva] = useState<'frequencia' | 'conteudo'>('frequencia');

  // Alunos da turma
  const todosAlunosTurma = useMemo(() => {
    return matriculasData.filter(m => (m.Turma || '').trim() === turmaSelecionada.trim());
  }, [turmaSelecionada]);

  // Alunos ativos na chamada regular
  const alunosAtivos = useMemo(() => {
    return todosAlunosTurma.filter(m => m.Situação !== 'TRANSFERIDO');
  }, [todosAlunosTurma]);

  // Alunos transferidos (aparecem com aviso ou na seção de movimentados)
  const alunosTransferidos = useMemo(() => {
    return todosAlunosTurma.filter(m => m.Situação === 'TRANSFERIDO');
  }, [todosAlunosTurma]);

  const turmaObj = useMemo(() => {
    return turmasData.find(t => t.Turma === turmaSelecionada) || turmasValidas[0];
  }, [turmaSelecionada, turmasValidas]);

  // Dias letivos úteis do mês
  const diasDoMes = useMemo(() => {
    return obterDiasLetivosDoMes(2026, mesSelecionado);
  }, [mesSelecionado]);

  // Chave de armazenamento no localStorage
  const storageKeyPresencas = `guia_diario_presenca_${turmaSelecionada}_${disciplinaSelecionada}_${mesSelecionado}`;
  const storageKeyConteudos = `guia_diario_conteudo_${turmaSelecionada}_${disciplinaSelecionada}_${mesSelecionado}`;

  // Estado da presença: { [matricula]: { [dia]: 'C' | 'F' | 'FJ' } }
  const [presencas, setPresencas] = useState<Record<string, Record<number, StatusPresenca>>>(() => {
    const salvo = localStorage.getItem(storageKeyPresencas);
    if (salvo) {
      try {
        return JSON.parse(salvo);
      } catch {
        // fallback
      }
    }
    // Inicial padrão: todos presentes 'C'
    const inicial: Record<string, Record<number, StatusPresenca>> = {};
    todosAlunosTurma.forEach(aluno => {
      inicial[aluno.Código] = {};
      diasDoMes.forEach(dia => {
        // Gera algumas faltas ocasionais simuladas
        const seed = (parseInt(aluno.Código, 10) || 1) + dia;
        if (aluno.Situação === 'TRANSFERIDO' && dia > 15) {
          // transferido na metade do mês
          inicial[aluno.Código][dia] = 'F';
        } else if (seed % 17 === 0) {
          inicial[aluno.Código][dia] = 'F';
        } else if (seed % 29 === 0) {
          inicial[aluno.Código][dia] = 'FJ';
        } else {
          inicial[aluno.Código][dia] = 'C';
        }
      });
    });
    return inicial;
  });

  // Atualizar quando mudar de turma, disciplina ou mês
  useEffect(() => {
    const salvo = localStorage.getItem(storageKeyPresencas);
    if (salvo) {
      try {
        setPresencas(JSON.parse(salvo));
        return;
      } catch {
        // fallback
      }
    }
    const inicial: Record<string, Record<number, StatusPresenca>> = {};
    todosAlunosTurma.forEach(aluno => {
      inicial[aluno.Código] = {};
      diasDoMes.forEach(dia => {
        const seed = (parseInt(aluno.Código, 10) || 1) + dia;
        if (aluno.Situação === 'TRANSFERIDO' && dia > 15) {
          inicial[aluno.Código][dia] = 'F';
        } else if (seed % 17 === 0) {
          inicial[aluno.Código][dia] = 'F';
        } else if (seed % 29 === 0) {
          inicial[aluno.Código][dia] = 'FJ';
        } else {
          inicial[aluno.Código][dia] = 'C';
        }
      });
    });
    setPresencas(inicial);
  }, [storageKeyPresencas, todosAlunosTurma, diasDoMes]);

  // Estado dos Conteúdos Ministrados
  const [conteudos, setConteudos] = useState<RegistroConteudo[]>(() => {
    const salvo = localStorage.getItem(storageKeyConteudos);
    if (salvo) {
      try {
        return JSON.parse(salvo);
      } catch {
        // fallback
      }
    }
    return CONTEUDOS_EXEMPLO[disciplinaSelecionada] || [
      {
        id: 'padrao-1',
        data: '2026-11-04',
        aulas: 2,
        habilidade: 'BNCC Geral',
        objetoConhecimento: 'Unidade Temática Introdutória',
        descricaoAtividade: 'Apresentação de conteúdos do componente curricular e exercícios práticos em sala de aula.'
      }
    ];
  });

  useEffect(() => {
    const salvo = localStorage.getItem(storageKeyConteudos);
    if (salvo) {
      try {
        setConteudos(JSON.parse(salvo));
        return;
      } catch {
        // fallback
      }
    }
    setConteudos(CONTEUDOS_EXEMPLO[disciplinaSelecionada] || [
      {
        id: 'padrao-1',
        data: `2026-${String(mesSelecionado).padStart(2, '0')}-05`,
        aulas: 2,
        habilidade: 'Habilidade da BNCC',
        objetoConhecimento: `Conteúdo de ${disciplinaSelecionada}`,
        descricaoAtividade: 'Atividades pedagógicas planejadas e desenvolvidas em sala de aula.'
      }
    ]);
  }, [storageKeyConteudos, disciplinaSelecionada, mesSelecionado]);

  // Modal para adicionar novo conteúdo ministrado
  const [modalNovoConteudo, setModalNovoConteudo] = useState(false);
  const [novoRegistro, setNovoRegistro] = useState<Partial<RegistroConteudo>>({
    data: `2026-${String(mesSelecionado).padStart(2, '0')}-10`,
    aulas: 2,
    habilidade: '',
    objetoConhecimento: '',
    descricaoAtividade: ''
  });

  // Alterna status de presença ao clicar na célula
  function alternarPresenca(codAluno: string, dia: number) {
    setPresencas(prev => {
      const alunoMap = { ...(prev[codAluno] || {}) };
      const atual = alunoMap[dia] || 'C';
      let proximo: StatusPresenca = 'C';
      if (atual === 'C') proximo = 'F';
      else if (atual === 'F') proximo = 'FJ';
      else proximo = 'C';

      alunoMap[dia] = proximo;
      return {
        ...prev,
        [codAluno]: alunoMap
      };
    });
  }

  // Marcar todos os alunos como presentes num determinado dia
  function marcarTodosPresentesNoDia(dia: number) {
    setPresencas(prev => {
      const novo = { ...prev };
      alunosAtivos.forEach(aluno => {
        novo[aluno.Código] = {
          ...(novo[aluno.Código] || {}),
          [dia]: 'C'
        };
      });
      return novo;
    });
    if (onToast) {
      onToast({
        message: `Todos os alunos marcados como PRESENTES no dia ${dia}!`,
        type: 'success'
      });
    }
  }

  // Marcar todo o mês como 100% presente para os alunos ativos
  function marcarMesInteiroPresente() {
    setPresencas(prev => {
      const novo = { ...prev };
      alunosAtivos.forEach(aluno => {
        novo[aluno.Código] = {};
        diasDoMes.forEach(dia => {
          novo[aluno.Código][dia] = 'C';
        });
      });
      return novo;
    });
    if (onToast) {
      onToast({
        message: 'Chamada do mês inteiro preenchida como PRESENTE para alunos ativos!',
        type: 'success'
      });
    }
  }

  function salvarDiario() {
    localStorage.setItem(storageKeyPresencas, JSON.stringify(presencas));
    localStorage.setItem(storageKeyConteudos, JSON.stringify(conteudos));
    if (onToast) {
      onToast({
        message: `Diário de Classe (${disciplinaSelecionada} - ${MESES_LETIVOS.find(m => m.valor === mesSelecionado)?.nome}) salvo com sucesso!`,
        type: 'success'
      });
    }
  }

  function adicionarConteudo() {
    if (!novoRegistro.objetoConhecimento || !novoRegistro.data) {
      if (onToast) onToast({ message: 'Preencha ao menos a data e o objeto de conhecimento.', type: 'error' });
      return;
    }

    const reg: RegistroConteudo = {
      id: `cont-${Date.now()}`,
      data: novoRegistro.data || `2026-${String(mesSelecionado).padStart(2, '0')}-01`,
      aulas: Number(novoRegistro.aulas) || 1,
      habilidade: novoRegistro.habilidade || 'BNCC Geral',
      objetoConhecimento: novoRegistro.objetoConhecimento || '',
      descricaoAtividade: novoRegistro.descricaoAtividade || ''
    };

    setConteudos(prev => [...prev, reg]);
    setModalNovoConteudo(false);
    setNovoRegistro({
      data: `2026-${String(mesSelecionado).padStart(2, '0')}-10`,
      aulas: 2,
      habilidade: '',
      objetoConhecimento: '',
      descricaoAtividade: ''
    });

    if (onToast) {
      onToast({ message: 'Conteúdo de aula registrado no Diário!', type: 'success' });
    }
  }

  function removerConteudo(id: string) {
    setConteudos(prev => prev.filter(c => c.id !== id));
    if (onToast) {
      onToast({ message: 'Registro de aula removido.', type: 'success' });
    }
  }

  // Exportar frequência para CSV
  function exportarFrequenciaCSV() {
    let csv = 'Matricula;Nome;Situacao;';
    diasDoMes.forEach(d => {
      csv += `Dia ${d};`;
    });
    csv += 'Total Presencas;Total Faltas;Faltas Justif;% Frequencia\n';

    todosAlunosTurma.forEach(aluno => {
      const mapaAluno = presencas[aluno.Código] || {};
      let cCount = 0;
      let fCount = 0;
      let fjCount = 0;

      let linha = `"${aluno.Código}";"${aluno.Nome}";"${aluno.Situação}";`;
      diasDoMes.forEach(d => {
        const st = mapaAluno[d] || 'C';
        if (st === 'C') cCount++;
        else if (st === 'F') fCount++;
        else if (st === 'FJ') fjCount++;
        linha += `${st};`;
      });

      const totalAulas = diasDoMes.length;
      const perc = totalAulas > 0 ? (((cCount + fjCount) / totalAulas) * 100).toFixed(1) : '100';
      linha += `${cCount};${fCount};${fjCount};${perc}%\n`;
      csv += linha;
    });

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Frequencia_${turmaSelecionada}_${disciplinaSelecionada}_Mes${mesSelecionado}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function imprimir() {
    window.print();
  }

  const mesNomeAtual = MESES_LETIVOS.find(m => m.valor === mesSelecionado)?.nome || 'Mês';

  return (
    <div className="diario-container">
      {/* Cabeçalho do Módulo */}
      <div className="diario-header">
        <div className="diario-header-title">
          <BookOpen className="icon-header" size={28} />
          <div>
            <h2>Diário de Classe Eletrônico (SIGP Educação)</h2>
            <p>E.M. MARIA GERALDA MIRANDA BRITO SALOMÃO &bull; Frequência Escolar & Plano de Conteúdos</p>
          </div>
        </div>

        <div className="diario-actions no-print">
          <div className="view-mode-toggle">
            <button
              type="button"
              className={abaAtiva === 'frequencia' ? 'toggle-btn active' : 'toggle-btn'}
              onClick={() => setAbaAtiva('frequencia')}
            >
              <Calendar size={16} /> Chamada & Frequência
            </button>
            <button
              type="button"
              className={abaAtiva === 'conteudo' ? 'toggle-btn active' : 'toggle-btn'}
              onClick={() => setAbaAtiva('conteudo')}
            >
              <FileCheck size={16} /> Conteúdos Ministrados ({conteudos.length})
            </button>
          </div>

          <button
            type="button"
            className="btn-secundario"
            onClick={exportarFrequenciaCSV}
            title="Exportar planilha de chamada para CSV"
          >
            <Download size={16} /> Exportar CSV
          </button>
          <button
            type="button"
            className="btn-primario"
            onClick={salvarDiario}
            title="Salvar alterações no diário"
          >
            <Save size={16} /> Salvar Diário
          </button>
          <button
            type="button"
            className="btn-print"
            onClick={imprimir}
            title="Imprimir folha oficial do diário"
          >
            <Printer size={16} /> Imprimir Diário
          </button>
        </div>
      </div>

      {/* Barra de Filtros: Turma, Disciplina e Mês */}
      <div className="diario-filter-card no-print">
        <div className="diario-filter-grid">
          <div className="filter-box">
            <label htmlFor="select-turma-diario">
              <Users size={16} /> Turma:
            </label>
            <select
              id="select-turma-diario"
              value={turmaSelecionada}
              onChange={(e) => setTurmaSelecionada(e.target.value)}
            >
              {turmasValidas.map((t) => (
                <option key={t.Turma} value={t.Turma}>
                  {t.Período} - Turma {t.Turma} ({t.Turno})
                </option>
              ))}
            </select>
          </div>

          <div className="filter-box">
            <label htmlFor="select-disc-diario">
              <BookOpen size={16} /> Disciplina:
            </label>
            <select
              id="select-disc-diario"
              value={disciplinaSelecionada}
              onChange={(e) => setDisciplinaSelecionada(e.target.value)}
            >
              {DISCIPLINAS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-box">
            <label htmlFor="select-mes-diario">
              <Calendar size={16} /> Mês de Referência:
            </label>
            <select
              id="select-mes-diario"
              value={mesSelecionado}
              onChange={(e) => setMesSelecionado(Number(e.target.value))}
            >
              {MESES_LETIVOS.map((m) => (
                <option key={m.valor} value={m.valor}>
                  {m.nome} / 2026 ({obterDiasLetivosDoMes(2026, m.valor).length} dias letivos)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Barra de Ações Rápidas de Presença */}
        {abaAtiva === 'frequencia' && (
          <div className="chamada-atalhos-row">
            <div className="legenda-chamada">
              <span className="legenda-item">
                <span className="badge-status c">C</span> Compareceu (Presente)
              </span>
              <span className="legenda-item">
                <span className="badge-status f">F</span> Falta Não Justificada
              </span>
              <span className="legenda-item">
                <span className="badge-status fj">FJ</span> Falta Justificada (Atestado)
              </span>
            </div>
            <div className="botoes-atalho">
              <button
                type="button"
                className="btn-atalho"
                onClick={marcarMesInteiroPresente}
                title="Preencher todos os dias como 'C' para todos os alunos normais"
              >
                <CheckCircle2 size={15} /> Preencher Mês com Presença Integral
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CABEÇALHO OFICIAL DE IMPRESSÃO (Visível apenas ao imprimir) */}
      <div className="diario-impressao-cabecalho only-print">
        <div className="diario-print-top">
          <h3>ESTADO DE MINAS GERAIS &bull; PREFEITURA MUNICIPAL DE PONTO DOS VOLANTES</h3>
          <h4>SECRETARIA MUNICIPAL DE EDUCAÇÃO &bull; SIGP EDUCAÇÃO</h4>
          <h2>ESCOLA MUNICIPAL MARIA GERALDA MIRANDA BRITO SALOMÃO</h2>
          <p>DIÁRIO DE CLASSE &bull; ANO LETIVO 2026 &bull; {abaAtiva === 'frequencia' ? 'FOLHA DE FREQUÊNCIA' : 'REGISTRO DE CONTEÚDOS'}</p>
        </div>
        <div className="diario-print-meta">
          <div><strong>TURMA:</strong> {turmaSelecionada} ({turmaObj?.Período})</div>
          <div><strong>TURNO:</strong> {turmaObj?.Turno}</div>
          <div><strong>COMPONENTE CURRICULAR:</strong> {disciplinaSelecionada}</div>
          <div><strong>MÊS DE REFERÊNCIA:</strong> {mesNomeAtual.toUpperCase()} / 2026</div>
        </div>
      </div>

      {/* ABA 1: CHAMADA & FREQUÊNCIA ESCOLAR */}
      {abaAtiva === 'frequencia' && (
        <div className="diario-frequencia-wrapper">
          <div className="frequencia-tabela-scroll">
            <table className="tabela-chamada">
              <thead>
                <tr>
                  <th className="th-aluno-fixo">Nº &bull; Estudante</th>
                  <th className="th-situacao">Situação</th>
                  {diasDoMes.map(dia => (
                    <th
                      key={dia}
                      className="th-dia-col"
                      onClick={() => marcarTodosPresentesNoDia(dia)}
                      title={`Dia ${dia} - Clique para marcar todos presentes neste dia`}
                    >
                      <span>{dia}</span>
                    </th>
                  ))}
                  <th className="th-totais">Pres.</th>
                  <th className="th-totais">Faltas</th>
                  <th className="th-totais">% Freq.</th>
                </tr>
              </thead>
              <tbody>
                {todosAlunosTurma.map((aluno, idx) => {
                  const mapaAluno = presencas[aluno.Código] || {};
                  const isTransf = aluno.Situação === 'TRANSFERIDO';
                  let presencasCount = 0;
                  let faltasCount = 0;
                  let faltasJustifCount = 0;

                  diasDoMes.forEach(d => {
                    const st = mapaAluno[d] || 'C';
                    if (st === 'C') presencasCount++;
                    else if (st === 'F') faltasCount++;
                    else if (st === 'FJ') faltasJustifCount++;
                  });

                  const totalDias = diasDoMes.length;
                  const percFreq = totalDias > 0 ? (((presencasCount + faltasJustifCount) / totalDias) * 100).toFixed(0) : '100';
                  const emAlerta = Number(percFreq) < 75 && !isTransf;

                  return (
                    <tr key={aluno.Código} className={`${isTransf ? 'linha-transferido' : ''} ${emAlerta ? 'linha-alerta' : ''}`}>
                      <td className="td-aluno-nome">
                        <span className="aluno-ordem">{String(idx + 1).padStart(2, '0')}.</span>
                        <div>
                          <strong className="nome-aluno-chamada">{aluno.Nome}</strong>
                          <span className="sub-matricula">Matr. {aluno.Código}</span>
                        </div>
                      </td>

                      <td>
                        <span className={`badge-sit-diario sit-${aluno.Situação.toLowerCase()}`}>
                          {aluno.Situação}
                        </span>
                      </td>

                      {/* Células de cada dia do mês */}
                      {diasDoMes.map(dia => {
                        const status = mapaAluno[dia] || 'C';
                        return (
                          <td
                            key={dia}
                            className={`td-dia-cell status-${status.toLowerCase()}`}
                            onClick={() => alternarPresenca(aluno.Código, dia)}
                            title={`Clique para alterar (C -> F -> FJ)`}
                          >
                            <span className="celula-status-texto">{status}</span>
                          </td>
                        );
                      })}

                      <td className="td-totais-val td-pres">{presencasCount}</td>
                      <td className={`td-totais-val ${faltasCount > 5 ? 'td-falta-alta' : ''}`}>
                        {faltasCount}
                      </td>
                      <td className="td-totais-val">
                        <span className={`badge-freq ${Number(percFreq) >= 75 ? 'freq-boa' : 'freq-baixa'}`}>
                          {percFreq}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="diario-legenda-inferior no-print">
            <p>
              &bull; <strong>Regra de Infrequência (LDB art. 24, VI):</strong> Estudantes com frequência inferior a 75% entram em status de risco pedagógico e notificação ao Conselho Tutelar.
            </p>
            {alunosTransferidos.length > 0 && (
              <p>
                &bull; <strong>Alunos Transferidos ({alunosTransferidos.length}):</strong> O estudante com situação "TRANSFERIDO" permanece documentado para conferência histórica, mas não compromete o cômputo da turma ativa.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ABA 2: REGISTRO DE CONTEÚDOS MINISTRADOS */}
      {abaAtiva === 'conteudo' && (
        <div className="diario-conteudo-wrapper">
          <div className="conteudo-topo-row no-print">
            <div>
              <h3>Plano de Aulas e Registro Diário de Conteúdos</h3>
              <p>Registre as habilidades da BNCC e o detalhamento das aulas ministradas.</p>
            </div>
            <button
              type="button"
              className="btn-primario"
              onClick={() => setModalNovoConteudo(true)}
            >
              <Plus size={16} /> Novo Registro de Aula
            </button>
          </div>

          <div className="conteudos-lista">
            {conteudos.length === 0 ? (
              <div className="sem-conteudos">
                <BookOpen size={48} color="#94a3b8" />
                <p>Nenhuma aula registrada para este componente curricular neste mês.</p>
                <button
                  type="button"
                  className="btn-secundario"
                  onClick={() => setModalNovoConteudo(true)}
                >
                  Registrar Primeira Aula
                </button>
              </div>
            ) : (
              conteudos.map((item, idx) => (
                <div key={item.id} className="conteudo-card">
                  <div className="conteudo-card-header">
                    <div className="conteudo-meta">
                      <span className="badge-aula-num">Aula #{idx + 1}</span>
                      <span className="conteudo-data">
                        <Calendar size={14} /> {item.data.split('-').reverse().join('/')}
                      </span>
                      <span className="conteudo-aulas-qtd">
                        <Clock size={14} /> {item.aulas} {item.aulas === 1 ? 'Hora/Aula' : 'Horas/Aulas'}
                      </span>
                      <span className="conteudo-habilidade">
                        <strong>Habilidade:</strong> {item.habilidade}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="btn-remover-conteudo no-print"
                      onClick={() => removerConteudo(item.id)}
                      title="Excluir este registro de aula"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="conteudo-corpo">
                    <h4>{item.objetoConhecimento}</h4>
                    <p>{item.descricaoAtividade}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Assinaturas Oficiais para Impressão */}
      <div className="diario-assinaturas-print only-print">
        <div className="assinatura-box">
          <div className="linha-assinatura"></div>
          <p>Professor(a) Regente do Componente Curricular</p>
          <span>Assinatura do Docente</span>
        </div>
        <div className="assinatura-box">
          <div className="linha-assinatura"></div>
          <p>Especialista da Educação Básica (Supervisão)</p>
          <span>Visto da Coordenação Pedagógica</span>
        </div>
      </div>

      {/* Modal Novo Conteúdo */}
      {modalNovoConteudo && (
        <div className="modal-overlay" onClick={() => setModalNovoConteudo(false)}>
          <div className="modal-conteudo-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Registrar Aula Ministrada &bull; {disciplinaSelecionada}</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setModalNovoConteudo(false)}
              >
                &times;
              </button>
            </div>

            <div className="modal-body">
              <div className="modal-form-grid">
                <div className="form-group">
                  <label htmlFor="data-aula">Data da Aula:</label>
                  <input
                    id="data-aula"
                    type="date"
                    value={novoRegistro.data}
                    onChange={(e) => setNovoRegistro(prev => ({ ...prev, data: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="qtd-aulas">Quantidade de Aulas:</label>
                  <input
                    id="qtd-aulas"
                    type="number"
                    min="1"
                    max="5"
                    value={novoRegistro.aulas}
                    onChange={(e) => setNovoRegistro(prev => ({ ...prev, aulas: Number(e.target.value) }))}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="hab-bncc">Código da Habilidade (BNCC):</label>
                <input
                  id="hab-bncc"
                  type="text"
                  placeholder="Ex: EF06LP01 ou EF01MA02"
                  value={novoRegistro.habilidade}
                  onChange={(e) => setNovoRegistro(prev => ({ ...prev, habilidade: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label htmlFor="objeto-conhecimento">Objeto de Conhecimento / Eixo Temático:</label>
                <input
                  id="objeto-conhecimento"
                  type="text"
                  placeholder="Ex: Gênero Textual Notícia e Morfossintaxe"
                  value={novoRegistro.objetoConhecimento}
                  onChange={(e) => setNovoRegistro(prev => ({ ...prev, objetoConhecimento: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label htmlFor="desc-atividade">Metodologia e Atividades Desenvolvidas:</label>
                <textarea
                  id="desc-atividade"
                  rows={4}
                  placeholder="Descreva as atividades, leitura, exercícios e recursos utilizados..."
                  value={novoRegistro.descricaoAtividade}
                  onChange={(e) => setNovoRegistro(prev => ({ ...prev, descricaoAtividade: e.target.value }))}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-cancelar"
                onClick={() => setModalNovoConteudo(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-confirmar"
                onClick={adicionarConteudo}
              >
                Salvar Aula
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DiarioClasse;
