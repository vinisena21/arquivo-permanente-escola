import React, { useState, useMemo, useEffect } from 'react';
import {
  Award,
  Users,
  Search,
  Printer,
  Save,
  Download,
  AlertTriangle,
  FileSpreadsheet,
  FileText,
  Calendar
} from 'lucide-react';
import turmasData from '../data/turmas.json';
import matriculasData from '../data/matriculas.json';
import './BoletimEscolar.css';

interface BoletimEscolarProps {
  onToast?: (toast: { message: string; type: 'success' | 'error' }) => void;
}

export interface NotaDisciplina {
  disciplina: string;
  trimestre1: number | null; // Max 30
  faltas1: number;
  trimestre2: number | null; // Max 35
  faltas2: number;
  trimestre3: number | null; // Max 35
  faltas3: number;
  recuperacaoFinal?: number | null;
}

export interface BoletimAluno {
  matriculaCodigo: string;
  alunoNome: string;
  turma: string;
  turno: string;
  situacaoMatricula: string;
  notas: Record<string, NotaDisciplina>;
}

export const DISCIPLINAS_BOLETIM = [
  'Língua Portuguesa',
  'Arte',
  'Educação Física',
  'Língua Inglesa',
  'Matemática',
  'Ciências',
  'Geografia',
  'História',
  'Ensino Religioso'
];

// Gera notas determinísticas para simulação realista no SIGP
function gerarNotasIniciais(codMatricula: string, situacao: string): Record<string, NotaDisciplina> {
  const seed = parseInt(codMatricula, 10) || 12345;
  const notas: Record<string, NotaDisciplina> = {};

  DISCIPLINAS_BOLETIM.forEach((disc, idx) => {
    // Cálculo pseudo-aleatório determinístico baseado no código do aluno e disciplina
    const varSeed = (seed * 17 + idx * 31) % 100;
    
    // Se o aluno for transferido, pode ter apenas notas parciais do 1º e 2º trimestre
    const isTransf = situacao === 'TRANSFERIDO';
    
    // Trimestre 1 (máx 30): média entre 18 e 29
    const t1 = Math.min(30, Math.max(16, Math.round(18 + (varSeed % 12))));
    const f1 = (varSeed % 4);

    // Trimestre 2 (máx 35): média entre 22 e 34
    const t2 = Math.min(35, Math.max(20, Math.round(22 + ((varSeed + 5) % 13))));
    const f2 = ((varSeed + 1) % 5);

    // Trimestre 3 (máx 35): se transferido, null
    const t3 = isTransf ? null : Math.min(35, Math.max(21, Math.round(22 + ((varSeed + 9) % 14))));
    const f3 = isTransf ? 0 : ((varSeed + 2) % 4);

    notas[disc] = {
      disciplina: disc,
      trimestre1: t1,
      faltas1: f1,
      trimestre2: t2,
      faltas2: f2,
      trimestre3: t3,
      faltas3: f3,
      recuperacaoFinal: null
    };
  });

  return notas;
}

export const BoletimEscolar: React.FC<BoletimEscolarProps> = ({ onToast }) => {
  // Lista de turmas oficiais válidas
  const turmasValidas = useMemo(() => {
    return turmasData.filter(t => t.Turma && t.Turma !== 'TURMA VALIDAÇÃO RELATÓRIOS TRIMESTRE');
  }, []);

  const [turmaSelecionada, setTurmaSelecionada] = useState<string>(() => {
    return turmasValidas[0]?.Turma || '1º  1';
  });

  const [modoVisao, setModoVisao] = useState<'individual' | 'turma'>('individual');
  const [trimestreFiltro, setTrimestreFiltro] = useState<1 | 2 | 3>(1);

  // Alunos da turma atual
  const todosAlunosTurma = useMemo(() => {
    return matriculasData.filter(m => (m.Turma || '').trim() === turmaSelecionada.trim());
  }, [turmaSelecionada]);

  // Alunos ativos (respeitando que TRANSFERIDO não conta como aluno normal ativo)
  const alunosAtivosTurma = useMemo(() => {
    return todosAlunosTurma.filter(m => m.Situação !== 'TRANSFERIDO');
  }, [todosAlunosTurma]);

  // Alunos transferidos da turma
  const alunosTransferidosTurma = useMemo(() => {
    return todosAlunosTurma.filter(m => m.Situação === 'TRANSFERIDO');
  }, [todosAlunosTurma]);

  // Aluno atualmente selecionado para o Boletim Individual
  const [alunoSelecionadoCod, setAlunoSelecionadoCod] = useState<string>('');

  // Ao mudar de turma, seleciona o primeiro aluno ativo
  useEffect(() => {
    if (alunosAtivosTurma.length > 0) {
      setAlunoSelecionadoCod(alunosAtivosTurma[0].Código);
    } else if (todosAlunosTurma.length > 0) {
      setAlunoSelecionadoCod(todosAlunosTurma[0].Código);
    } else {
      setAlunoSelecionadoCod('');
    }
  }, [turmaSelecionada, alunosAtivosTurma, todosAlunosTurma]);

  // Estado das notas da turma (carrega do localStorage se houver)
  const [notasTurma, setNotasTurma] = useState<Record<string, Record<string, NotaDisciplina>>>(() => {
    const salvo = localStorage.getItem(`guia_escolar_notas_${turmaSelecionada}`);
    if (salvo) {
      try {
        return JSON.parse(salvo);
      } catch {
        // fallback
      }
    }
    const inicial: Record<string, Record<string, NotaDisciplina>> = {};
    todosAlunosTurma.forEach(aluno => {
      inicial[aluno.Código] = gerarNotasIniciais(aluno.Código, aluno.Situação);
    });
    return inicial;
  });

  // Atualiza notas ao trocar de turma
  useEffect(() => {
    const salvo = localStorage.getItem(`guia_escolar_notas_${turmaSelecionada}`);
    if (salvo) {
      try {
        setNotasTurma(JSON.parse(salvo));
        return;
      } catch {
        // fallback
      }
    }
    const inicial: Record<string, Record<string, NotaDisciplina>> = {};
    todosAlunosTurma.forEach(aluno => {
      inicial[aluno.Código] = gerarNotasIniciais(aluno.Código, aluno.Situação);
    });
    setNotasTurma(inicial);
  }, [turmaSelecionada, todosAlunosTurma]);

  // Objeto do aluno selecionado
  const alunoAtual = useMemo(() => {
    return todosAlunosTurma.find(a => a.Código === alunoSelecionadoCod) || alunosAtivosTurma[0];
  }, [todosAlunosTurma, alunoSelecionadoCod, alunosAtivosTurma]);

  // Notas do aluno atual
  const notasAlunoAtual = useMemo(() => {
    if (!alunoAtual) return {};
    return notasTurma[alunoAtual.Código] || gerarNotasIniciais(alunoAtual.Código, alunoAtual.Situação);
  }, [notasTurma, alunoAtual]);

  // Turma info
  const turmaObj = useMemo(() => {
    return turmasData.find(t => t.Turma === turmaSelecionada) || turmasValidas[0];
  }, [turmaSelecionada, turmasValidas]);

  // Função para salvar alterações no localStorage
  function salvarAlteracoes() {
    localStorage.setItem(`guia_escolar_notas_${turmaSelecionada}`, JSON.stringify(notasTurma));
    if (onToast) {
      onToast({
        message: `Lançamentos de notas da Turma ${turmaSelecionada} salvos com sucesso!`,
        type: 'success'
      });
    }
  }

  // Atualizar nota de uma disciplina para um aluno
  function handleNotaChange(
    codAluno: string,
    disc: string,
    campo: keyof NotaDisciplina,
    valor: string
  ) {
    const num = valor === '' ? null : Math.max(0, Number(valor));
    setNotasTurma(prev => {
      const alunoNotas = { ...(prev[codAluno] || gerarNotasIniciais(codAluno, 'NORMAL')) };
      const discNota = { ...(alunoNotas[disc] || {
        disciplina: disc,
        trimestre1: null,
        faltas1: 0,
        trimestre2: null,
        faltas2: 0,
        trimestre3: null,
        faltas3: 0
      }) };

      // Limites de validação:
      // Trimestre 1: máx 30
      // Trimestre 2: máx 35
      // Trimestre 3: máx 35
      let valFinal = num;
      if (campo === 'trimestre1' && valFinal !== null) valFinal = Math.min(30, valFinal);
      if (campo === 'trimestre2' && valFinal !== null) valFinal = Math.min(35, valFinal);
      if (campo === 'trimestre3' && valFinal !== null) valFinal = Math.min(35, valFinal);

      // @ts-ignore
      discNota[campo] = valFinal;
      alunoNotas[disc] = discNota;

      return {
        ...prev,
        [codAluno]: alunoNotas
      };
    });
  }

  // Cálculos consolidados para o boletim individual
  const resumoAluno = useMemo(() => {
    let somaPontos = 0;
    let totalFaltas = 0;
    let disciplinasComNota = 0;
    let totalPossivel = 0;

    DISCIPLINAS_BOLETIM.forEach(disc => {
      const n = notasAlunoAtual[disc];
      if (!n) return;
      const t1 = n.trimestre1 ?? 0;
      const t2 = n.trimestre2 ?? 0;
      const t3 = n.trimestre3 ?? 0;
      const totalDisc = t1 + t2 + t3;
      somaPontos += totalDisc;
      totalFaltas += (n.faltas1 || 0) + (n.faltas2 || 0) + (n.faltas3 || 0);
      disciplinasComNota++;
      totalPossivel += 100;
    });

    const mediaGeral = disciplinasComNota > 0 ? (somaPontos / disciplinasComNota).toFixed(1) : '0.0';
    // Carga horária total estimada: 800 horas (1000 horas/aula de 50 min = ~200 dias * 5 aulas = 1000 aulas)
    const totalAulasAnuais = 1000;
    const frequenciaPerc = Math.max(0, Math.min(100, (((totalAulasAnuais - totalFaltas) / totalAulasAnuais) * 100))).toFixed(1);

    const isTransferido = alunoAtual?.Situação === 'TRANSFERIDO';
    let resultadoFinal = 'APROVADO';

    if (isTransferido) {
      resultadoFinal = 'TRANSFERIDO';
    } else if (parseFloat(frequenciaPerc) < 75) {
      resultadoFinal = 'REPROVADO POR INFREQUÊNCIA';
    } else if (parseFloat(mediaGeral) < 60) {
      resultadoFinal = 'EM CONSELHO / RECUPERAÇÃO';
    }

    return {
      somaPontos,
      mediaGeral,
      totalFaltas,
      frequenciaPerc,
      resultadoFinal,
      isTransferido
    };
  }, [notasAlunoAtual, alunoAtual]);

  function exportarParaCSV() {
    let csv = 'Matricula;Aluno;Turma;Situacao;';
    DISCIPLINAS_BOLETIM.forEach(d => {
      csv += `${d} (Total);${d} (Faltas);`;
    });
    csv += 'Media Geral;Total Faltas;Resultado\n';

    todosAlunosTurma.forEach(aluno => {
      const notasAluno = notasTurma[aluno.Código] || {};
      let soma = 0;
      let faltas = 0;
      let discQtd = 0;

      let linha = `"${aluno.Código}";"${aluno.Nome}";"${aluno.Turma}";"${aluno.Situação}";`;
      DISCIPLINAS_BOLETIM.forEach(disc => {
        const n = notasAluno[disc];
        const tot = (n?.trimestre1 ?? 0) + (n?.trimestre2 ?? 0) + (n?.trimestre3 ?? 0);
        const f = (n?.faltas1 ?? 0) + (n?.faltas2 ?? 0) + (n?.faltas3 ?? 0);
        soma += tot;
        faltas += f;
        discQtd++;
        linha += `${tot};${f};`;
      });

      const media = discQtd > 0 ? (soma / discQtd).toFixed(1) : '0';
      const situacao = aluno.Situação === 'TRANSFERIDO' ? 'TRANSFERIDO' : (parseFloat(media) >= 60 ? 'APROVADO' : 'RECUPERAÇÃO');
      linha += `${media};${faltas};"${situacao}"\n`;
      csv += linha;
    });

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Mapa_Notas_Turma_${turmaSelecionada}_2026.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function imprimir() {
    window.print();
  }

  return (
    <div className="boletim-container">
      {/* Cabeçalho do Módulo */}
      <div className="boletim-header">
        <div className="boletim-header-title">
          <Award className="icon-header" size={28} />
          <div>
            <h2>Boletim Escolar & Lançamento de Notas (SIGP)</h2>
            <p>E.M. MARIA GERALDA MIRANDA BRITO SALOMÃO &bull; Sistema Trimestral (30 + 35 + 35 = 100 pts)</p>
          </div>
        </div>

        <div className="boletim-actions no-print">
          <div className="view-mode-toggle">
            <button
              type="button"
              className={modoVisao === 'individual' ? 'toggle-btn active' : 'toggle-btn'}
              onClick={() => setModoVisao('individual')}
            >
              <FileText size={16} /> Boletim Individual
            </button>
            <button
              type="button"
              className={modoVisao === 'turma' ? 'toggle-btn active' : 'toggle-btn'}
              onClick={() => setModoVisao('turma')}
            >
              <FileSpreadsheet size={16} /> Mapa da Turma
            </button>
          </div>

          <button
            type="button"
            className="btn-secundario"
            onClick={exportarParaCSV}
            title="Exportar notas da turma para planilha CSV"
          >
            <Download size={16} /> Exportar CSV
          </button>
          <button
            type="button"
            className="btn-primario"
            onClick={salvarAlteracoes}
            title="Salvar alterações de notas no banco"
          >
            <Save size={16} /> Salvar Notas
          </button>
          <button
            type="button"
            className="btn-print"
            onClick={imprimir}
            title="Imprimir documento oficial"
          >
            <Printer size={16} /> {modoVisao === 'individual' ? 'Imprimir Boletim' : 'Imprimir Mapa'}
          </button>
        </div>
      </div>

      {/* Barra de Filtros: Turma e Aluno */}
      <div className="boletim-filter-card no-print">
        <div className="filter-row">
          <div className="filter-item">
            <label htmlFor="select-turma-boletim">
              <Users size={16} /> Selecionar Turma:
            </label>
            <select
              id="select-turma-boletim"
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

          {modoVisao === 'individual' && (
            <div className="filter-item flex-grow">
              <label htmlFor="select-aluno-boletim">
                <Search size={16} /> Selecionar Aluno:
              </label>
              <select
                id="select-aluno-boletim"
                value={alunoSelecionadoCod}
                onChange={(e) => setAlunoSelecionadoCod(e.target.value)}
              >
                <optgroup label={`Alunos Ativos na Turma (${alunosAtivosTurma.length})`}>
                  {alunosAtivosTurma.map((a) => (
                    <option key={a.Código} value={a.Código}>
                      {a.Nome} (Matrícula: {a.Código})
                    </option>
                  ))}
                </optgroup>
                {alunosTransferidosTurma.length > 0 && (
                  <optgroup label={`Movimentados / Transferidos (${alunosTransferidosTurma.length})`}>
                    {alunosTransferidosTurma.map((a) => (
                      <option key={a.Código} value={a.Código}>
                        {a.Nome} [TRANSFERIDO]
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
          )}

          {modoVisao === 'turma' && (
            <div className="filter-item">
              <label htmlFor="select-trimestre-mapa">
                <Calendar size={16} /> Trimestre em Foco:
              </label>
              <select
                id="select-trimestre-mapa"
                value={trimestreFiltro}
                onChange={(e) => setTrimestreFiltro(Number(e.target.value) as 1 | 2 | 3)}
              >
                <option value={1}>1º Trimestre (Valor: 30 pts)</option>
                <option value={2}>2º Trimestre (Valor: 35 pts)</option>
                <option value={3}>3º Trimestre (Valor: 35 pts)</option>
              </select>
            </div>
          )}
        </div>

        <div className="turma-meta-badges">
          <span className="badge-meta">
            <strong>Alunos Normais / Ativos:</strong> {alunosAtivosTurma.length}
          </span>
          {alunosTransferidosTurma.length > 0 && (
            <span className="badge-meta badge-aviso">
              <strong>Transferidos / Histórico:</strong> {alunosTransferidosTurma.length}
            </span>
          )}
          <span className="badge-meta">
            <strong>Turno:</strong> {turmaObj?.Turno || 'MATUTINO'}
          </span>
          <span className="badge-meta">
            <strong>Média Mínima para Aprovação:</strong> 60,0 Pontos
          </span>
        </div>
      </div>

      {/* MODO 1: BOLETIM INDIVIDUAL DO ESTUDANTE */}
      {modoVisao === 'individual' && alunoAtual && (
        <div className="boletim-individual-wrapper">
          {/* Alerta caso seja aluno transferido */}
          {resumoAluno.isTransferido && (
            <div className="alerta-transferido-banner no-print">
              <AlertTriangle size={20} />
              <div>
                <strong>Atenção: Estudante Transferido</strong>
                <p>
                  Este registro refere-se a uma movimentação de transferência escolar. O estudante
                  não consta no cômputo da frequência regular ativa da turma.
                </p>
              </div>
            </div>
          )}

          {/* DOCUMENTO OFICIAL DO BOLETIM (Pronto para Impressão) */}
          <div className="boletim-folha-oficial">
            {/* Cabeçalho Oficial */}
            <div className="boletim-doc-header">
              <div className="doc-brasao-container">
                <div className="doc-brasao-circulo">MG</div>
              </div>
              <div className="doc-header-text">
                <h3>ESTADO DE MINAS GERAIS &bull; PREFEITURA MUNICIPAL DE PONTO DOS VOLANTES</h3>
                <h4>SECRETARIA MUNICIPAL DE EDUCAÇÃO &bull; SIGP EDUCAÇÃO</h4>
                <h2>ESCOLA MUNICIPAL MARIA GERALDA MIRANDA BRITO SALOMÃO</h2>
                <p>ENSINO FUNDAMENTAL &bull; CÓDIGO INEP: 31054366 &bull; RECONHECIMENTO LEGAL</p>
                <div className="doc-titulo-faixa">
                  BOLETIM ESCOLAR OFICIAL &bull; ANO LETIVO 2026
                </div>
              </div>
            </div>

            {/* Ficha de Identificação do Aluno */}
            <div className="boletim-dados-aluno-grid">
              <div className="dado-box">
                <span className="dado-rotulo">Nome do Estudante:</span>
                <span className="dado-valor aluno-nome-destaque">{alunoAtual.Nome}</span>
              </div>
              <div className="dado-box">
                <span className="dado-rotulo">Matrícula SIGP:</span>
                <span className="dado-valor">{alunoAtual.Código}</span>
              </div>
              <div className="dado-box">
                <span className="dado-rotulo">Turma:</span>
                <span className="dado-valor">{alunoAtual.Turma} ({turmaObj?.Período})</span>
              </div>
              <div className="dado-box">
                <span className="dado-rotulo">Turno:</span>
                <span className="dado-valor">{alunoAtual.Turno}</span>
              </div>
              <div className="dado-box">
                <span className="dado-rotulo">Data de Nascimento:</span>
                <span className="dado-valor">{alunoAtual['Data de Nascimento'] || '—'}</span>
              </div>
              <div className="dado-box">
                <span className="dado-rotulo">Situação da Matrícula:</span>
                <span className={`dado-valor situacao-${alunoAtual.Situação.toLowerCase()}`}>
                  {alunoAtual.Situação}
                </span>
              </div>
              <div className="dado-box span-2">
                <span className="dado-rotulo">Filiação:</span>
                <span className="dado-valor">
                  {[alunoAtual['Filiação 1'], alunoAtual['Filiação 2']].filter(Boolean).join(' e ') || 'Não declarada'}
                </span>
              </div>
              <div className="dado-box span-2">
                <span className="dado-rotulo">Responsável Legal:</span>
                <span className="dado-valor">{alunoAtual['Filiação 1'] || 'Responsável Cadastrado'}</span>
              </div>
            </div>

            {/* Tabela de Notas e Faltas Trimestrais */}
            <table className="boletim-tabela-notas">
              <thead>
                <tr>
                  <th rowSpan={2} className="th-disc">Componentes Curriculares (BNCC)</th>
                  <th colSpan={2} className="th-trimestre">1º Trimestre (30 pts)</th>
                  <th colSpan={2} className="th-trimestre">2º Trimestre (35 pts)</th>
                  <th colSpan={2} className="th-trimestre">3º Trimestre (35 pts)</th>
                  <th rowSpan={2} className="th-total">Total (100)</th>
                  <th rowSpan={2} className="th-rec">Recup.</th>
                  <th rowSpan={2} className="th-media">Média Final</th>
                  <th rowSpan={2} className="th-faltas">Faltas Totais</th>
                  <th rowSpan={2} className="th-sit">Resultado</th>
                </tr>
                <tr>
                  <th className="th-sub">Nota</th>
                  <th className="th-sub">Faltas</th>
                  <th className="th-sub">Nota</th>
                  <th className="th-sub">Faltas</th>
                  <th className="th-sub">Nota</th>
                  <th className="th-sub">Faltas</th>
                </tr>
              </thead>
              <tbody>
                {DISCIPLINAS_BOLETIM.map((disc) => {
                  const n = notasAlunoAtual[disc] || {
                    disciplina: disc,
                    trimestre1: null,
                    faltas1: 0,
                    trimestre2: null,
                    faltas2: 0,
                    trimestre3: null,
                    faltas3: 0
                  };

                  const t1 = n.trimestre1;
                  const t2 = n.trimestre2;
                  const t3 = n.trimestre3;
                  const total = (t1 ?? 0) + (t2 ?? 0) + (t3 ?? 0);
                  const faltasTotais = (n.faltas1 || 0) + (n.faltas2 || 0) + (n.faltas3 || 0);

                  const aprovadoDisc = total >= 60;

                  return (
                    <tr key={disc}>
                      <td className="td-disc-nome">{disc}</td>
                      <td className="td-num">{t1 !== null ? t1.toFixed(1) : '—'}</td>
                      <td className="td-num td-falta">{n.faltas1}</td>
                      <td className="td-num">{t2 !== null ? t2.toFixed(1) : '—'}</td>
                      <td className="td-num td-falta">{n.faltas2}</td>
                      <td className="td-num">{t3 !== null ? t3.toFixed(1) : '—'}</td>
                      <td className="td-num td-falta">{n.faltas3}</td>
                      <td className={`td-num td-total ${total < 60 ? 'nota-baixa' : 'nota-azul'}`}>
                        <strong>{total.toFixed(1)}</strong>
                      </td>
                      <td className="td-num td-rec">—</td>
                      <td className={`td-num td-media ${total < 60 ? 'nota-baixa' : 'nota-azul'}`}>
                        {total.toFixed(1)}
                      </td>
                      <td className="td-num">{faltasTotais} h/a</td>
                      <td className="td-sit-badge">
                        {alunoAtual.Situação === 'TRANSFERIDO' ? (
                          <span className="badge-transf">TRANSF.</span>
                        ) : aprovadoDisc ? (
                          <span className="badge-aprovado">Apto</span>
                        ) : (
                          <span className="badge-recuperacao">Recup.</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="tr-resumo-boletim">
                  <td className="td-disc-nome">
                    <strong>TOTAL GERAL &bull; MÉDIA GLOBAL</strong>
                  </td>
                  <td colSpan={6} className="td-espaco-resumo">
                    Frequência Global: <strong>{resumoAluno.frequenciaPerc}%</strong> &bull; Total de
                    Faltas: <strong>{resumoAluno.totalFaltas} h/a</strong>
                  </td>
                  <td className="td-num">
                    <strong>{resumoAluno.somaPontos.toFixed(1)}</strong>
                  </td>
                  <td className="td-num">—</td>
                  <td className="td-num">
                    <strong>{resumoAluno.mediaGeral}</strong>
                  </td>
                  <td className="td-num">{resumoAluno.totalFaltas}</td>
                  <td className="td-resultado-final">
                    <span className={`badge-resultado ${resumoAluno.resultadoFinal.toLowerCase().replace(/\s+/g, '-')}`}>
                      {resumoAluno.resultadoFinal}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>

            {/* Convenções e Parecer Pedagógico */}
            <div className="boletim-observacoes">
              <div className="obs-box">
                <h4>Observações Pedagógicas & Critérios de Avaliação:</h4>
                <p>
                  &bull; Sistema trimestral: 1º Trimestre (30 pontos) | 2º Trimestre (35 pontos) | 3º Trimestre (35 pontos).
                </p>
                <p>
                  &bull; Total Anual: 100 pontos. Mínimo para promoção direta: 60,0 pontos e 75% de frequência letiva (LDB 9.394/96).
                </p>
                <p>
                  &bull; Carga horária curricular oficial cumprida de acordo com o calendário escolar municipal de Ponto dos Volantes - MG.
                </p>
              </div>
            </div>

            {/* Assinaturas Legais */}
            <div className="boletim-assinaturas">
              <div className="assinatura-item">
                <div className="linha-assinatura"></div>
                <p>Diretor(a) Escolar</p>
                <span>E.M. Maria Geralda M. B. Salomão</span>
              </div>
              <div className="assinatura-item">
                <div className="linha-assinatura"></div>
                <p>Especialista da Educação Básica</p>
                <span>MASP / Matrícula Oficial</span>
              </div>
              <div className="assinatura-item">
                <div className="linha-assinatura"></div>
                <p>Responsável pelo Estudante</p>
                <span>Ciente em: ____/____/2026</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODO 2: MAPA DA TURMA (VISÃO GERAL / LANÇAMENTO RÁPIDO) */}
      {modoVisao === 'turma' && (
        <div className="mapa-turma-wrapper">
          <div className="mapa-info-header">
            <h3>
              Lançamento e Consulta de Notas &bull; Turma {turmaSelecionada} ({turmaObj?.Período}) &bull;{' '}
              {trimestreFiltro}º Trimestre (Máx: {trimestreFiltro === 1 ? '30 pts' : '35 pts'})
            </h3>
            <span className="mapa-dica no-print">
              * Clique em qualquer nota para editar. Pressione "Salvar Notas" no topo para fixar as alterações.
            </span>
          </div>

          <div className="mapa-tabela-scroll">
            <table className="mapa-tabela">
              <thead>
                <tr>
                  <th className="th-aluno-fixo">Estudante</th>
                  <th className="th-sit-curta">Situação</th>
                  {DISCIPLINAS_BOLETIM.map((d) => (
                    <th key={d} className="th-disc-col">
                      {d.slice(0, 8)}.
                    </th>
                  ))}
                  <th className="th-media-col">Média {trimestreFiltro}º Trim</th>
                  <th className="th-faltas-col">Faltas {trimestreFiltro}º Trim</th>
                </tr>
              </thead>
              <tbody>
                {todosAlunosTurma.map((aluno) => {
                  const notas = notasTurma[aluno.Código] || {};
                  const isTransf = aluno.Situação === 'TRANSFERIDO';
                  let somaTrim = 0;
                  let faltasTrim = 0;
                  let contagem = 0;

                  return (
                    <tr key={aluno.Código} className={isTransf ? 'linha-transferido' : ''}>
                      <td className="td-aluno-nome">
                        <span className="nome-texto">{aluno.Nome}</span>
                        <span className="matr-texto">Matr. {aluno.Código}</span>
                      </td>
                      <td>
                        <span className={`badge-mini sit-${aluno.Situação.toLowerCase()}`}>
                          {aluno.Situação}
                        </span>
                      </td>

                      {DISCIPLINAS_BOLETIM.map((disc) => {
                        const n = notas[disc];
                        const campoNota = `trimestre${trimestreFiltro}` as keyof NotaDisciplina;
                        const notaVal = n ? (n[campoNota] as number | null) : null;
                        if (notaVal !== null) {
                          somaTrim += notaVal;
                          contagem++;
                        }
                        const campoFalta = `faltas${trimestreFiltro}` as keyof NotaDisciplina;
                        const faltasVal = n ? (n[campoFalta] as number) : 0;
                        faltasTrim += faltasVal;

                        return (
                          <td key={disc} className="td-input-nota">
                            <input
                              type="number"
                              step="0.5"
                              min="0"
                              max={trimestreFiltro === 1 ? 30 : 35}
                              value={notaVal !== null && notaVal !== undefined ? notaVal : ''}
                              onChange={(e) =>
                                handleNotaChange(aluno.Código, disc, campoNota, e.target.value)
                              }
                              placeholder="—"
                              disabled={isTransf && trimestreFiltro === 3}
                              className={notaVal !== null && notaVal < (trimestreFiltro === 1 ? 18 : 21) ? 'input-baixo' : ''}
                            />
                          </td>
                        );
                      })}

                      <td className="td-media-valor">
                        <strong>{contagem > 0 ? (somaTrim / contagem).toFixed(1) : '—'}</strong>
                      </td>
                      <td className="td-faltas-valor">{faltasTrim} h/a</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default BoletimEscolar;
