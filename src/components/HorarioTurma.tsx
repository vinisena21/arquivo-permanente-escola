import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Clock,
  Printer,
  RotateCcw,
  Save,
  Users,
  BookOpen
} from 'lucide-react';
import turmasData from '../data/turmas.json';
import profissionaisData from '../data/profissionais.json';
import './HorarioTurma.css';

interface HorarioTurmaProps {
  onToast?: (toast: { message: string; type: 'success' | 'error' }) => void;
}

export interface AulaSlot {
  disciplina: string;
  professor: string;
  sala?: string;
}

// Dias da semana: Segunda (0) a Sexta (4)
// Aulas diárias: 5 aulas (0 a 4)
export type GradeHoraria = Record<number, Record<number, AulaSlot>>;

export const DISCIPLINAS_PADRAO = [
  { nome: 'Língua Portuguesa', cor: '#1e40af', abreviacao: 'PORT' },
  { nome: 'Matemática', cor: '#4338ca', abreviacao: 'MAT' },
  { nome: 'Ciências', cor: '#059669', abreviacao: 'CIÊN' },
  { nome: 'História', cor: '#b45309', abreviacao: 'HIST' },
  { nome: 'Geografia', cor: '#0d9488', abreviacao: 'GEOG' },
  { nome: 'Arte', cor: '#7c3aed', abreviacao: 'ARTE' },
  { nome: 'Educação Física', cor: '#d97706', abreviacao: 'ED.FÍS' },
  { nome: 'Língua Inglesa', cor: '#2563eb', abreviacao: 'ING' },
  { nome: 'Ensino Religioso', cor: '#4b5563', abreviacao: 'REL' },
  { nome: 'Projeto de Leitura / Redação', cor: '#0284c7', abreviacao: 'LEIT' }
];

const DIAS_SEMANA_NOMES = [
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira'
];

const HORARIOS_MATUTINO = [
  { aula: '1ª Aula', horario: '07:00 às 07:50' },
  { aula: '2ª Aula', horario: '07:50 às 08:40' },
  { aula: '3ª Aula', horario: '08:40 às 09:30' },
  { aula: 'Intervalo', horario: '09:30 às 09:50', isIntervalo: true },
  { aula: '4ª Aula', horario: '09:50 às 10:40' },
  { aula: '5ª Aula', horario: '10:40 às 11:30' }
];

const HORARIOS_VESPERTINO = [
  { aula: '1ª Aula', horario: '12:30 às 13:20' },
  { aula: '2ª Aula', horario: '13:20 às 14:10' },
  { aula: '3ª Aula', horario: '14:10 às 15:00' },
  { aula: 'Intervalo', horario: '15:00 às 15:20', isIntervalo: true },
  { aula: '4ª Aula', horario: '15:20 às 16:10' },
  { aula: '5ª Aula', horario: '16:10 às 17:00' }
];

// Grade padrão inteligente para preenchimento rápido
function gerarGradePadrao(isAnosIniciais: boolean, turmaNome: string): GradeHoraria {
  const grade: GradeHoraria = {
    0: {}, 1: {}, 2: {}, 3: {}, 4: {}
  };

  const profs = profissionaisData;
  const profRegente = profs.find(p => p['Curso superior']?.toLowerCase().includes('pedagogia'))?.Nome || 'Prof. Regente';
  const profMat = profs.find(p => p['Curso superior']?.toLowerCase().includes('matemática'))?.Nome || 'Prof. de Matemática';
  const profPort = profs.find(p => p['Curso superior']?.toLowerCase().includes('letras'))?.Nome || 'Prof. de Língua Portuguesa';
  const profEdFis = profs.find(p => p['Curso superior']?.toLowerCase().includes('educação física'))?.Nome || 'Prof. de Educação Física';
  const profHist = profs.find(p => p['Curso superior']?.toLowerCase().includes('história'))?.Nome || 'Prof. de História';
  const profGeo = profs.find(p => p['Curso superior']?.toLowerCase().includes('geografia'))?.Nome || 'Prof. de Geografia';
  const profCien = profs.find(p => p['Curso superior']?.toLowerCase().includes('biologia') || p['Curso superior']?.toLowerCase().includes('ciências'))?.Nome || 'Prof. de Ciências';
  const profIng = profs.find(p => p['Curso superior']?.toLowerCase().includes('inglês'))?.Nome || 'Prof. de Inglês';

  if (isAnosIniciais) {
    // 1º ao 5º Ano: Majoritariamente regência de classe com Arte e Ed Física especializadas
    const matrizSemana: { disc: string; prof: string }[][] = [
      // Segunda
      [
        { disc: 'Língua Portuguesa', prof: profRegente },
        { disc: 'Língua Portuguesa', prof: profRegente },
        { disc: 'Matemática', prof: profRegente },
        { disc: 'Matemática', prof: profRegente },
        { disc: 'Ensino Religioso', prof: profRegente }
      ],
      // Terça
      [
        { disc: 'Matemática', prof: profRegente },
        { disc: 'Matemática', prof: profRegente },
        { disc: 'Ciências', prof: profRegente },
        { disc: 'Ciências', prof: profRegente },
        { disc: 'Educação Física', prof: profEdFis }
      ],
      // Quarta
      [
        { disc: 'Língua Portuguesa', prof: profRegente },
        { disc: 'Língua Portuguesa', prof: profRegente },
        { disc: 'História', prof: profRegente },
        { disc: 'História', prof: profRegente },
        { disc: 'Arte', prof: profRegente }
      ],
      // Quinta
      [
        { disc: 'Geografia', prof: profRegente },
        { disc: 'Geografia', prof: profRegente },
        { disc: 'Matemática', prof: profRegente },
        { disc: 'Língua Portuguesa', prof: profRegente },
        { disc: 'Educação Física', prof: profEdFis }
      ],
      // Sexta
      [
        { disc: 'Língua Portuguesa', prof: profRegente },
        { disc: 'Projeto de Leitura / Redação', prof: profRegente },
        { disc: 'Ciências', prof: profRegente },
        { disc: 'Arte', prof: profRegente },
        { disc: 'Língua Inglesa', prof: profIng }
      ]
    ];

    matrizSemana.forEach((diaAulas, diaIdx) => {
      diaAulas.forEach((aula, aulaIdx) => {
        grade[diaIdx][aulaIdx] = {
          disciplina: aula.disc,
          professor: aula.prof,
          sala: `Sala ${turmaNome}`
        };
      });
    });
  } else {
    // 6º ao 9º Ano: Polidocência por disciplina
    const matrizSemana: { disc: string; prof: string }[][] = [
      // Segunda
      [
        { disc: 'Língua Portuguesa', prof: profPort },
        { disc: 'Língua Portuguesa', prof: profPort },
        { disc: 'Matemática', prof: profMat },
        { disc: 'Matemática', prof: profMat },
        { disc: 'História', prof: profHist }
      ],
      // Terça
      [
        { disc: 'Ciências', prof: profCien },
        { disc: 'Ciências', prof: profCien },
        { disc: 'Geografia', prof: profGeo },
        { disc: 'Educação Física', prof: profEdFis },
        { disc: 'Educação Física', prof: profEdFis }
      ],
      // Quarta
      [
        { disc: 'Matemática', prof: profMat },
        { disc: 'Matemática', prof: profMat },
        { disc: 'Língua Portuguesa', prof: profPort },
        { disc: 'Língua Inglesa', prof: profIng },
        { disc: 'Arte', prof: profPort }
      ],
      // Quinta
      [
        { disc: 'História', prof: profHist },
        { disc: 'História', prof: profHist },
        { disc: 'Geografia', prof: profGeo },
        { disc: 'Geografia', prof: profGeo },
        { disc: 'Ensino Religioso', prof: profHist }
      ],
      // Sexta
      [
        { disc: 'Língua Portuguesa', prof: profPort },
        { disc: 'Língua Portuguesa', prof: profPort },
        { disc: 'Matemática', prof: profMat },
        { disc: 'Ciências', prof: profCien },
        { disc: 'Língua Inglesa', prof: profIng }
      ]
    ];

    matrizSemana.forEach((diaAulas, diaIdx) => {
      diaAulas.forEach((aula, aulaIdx) => {
        grade[diaIdx][aulaIdx] = {
          disciplina: aula.disc,
          professor: aula.prof,
          sala: `Sala ${turmaNome}`
        };
      });
    });
  }

  return grade;
}

export const HorarioTurma: React.FC<HorarioTurmaProps> = ({ onToast }) => {
  // Lista de turmas oficiais ordenadas
  const turmasValidas = useMemo(() => {
    return turmasData.filter(t => t.Turma && t.Turma !== 'TURMA VALIDAÇÃO RELATÓRIOS TRIMESTRE');
  }, []);

  const [turmaSelecionada, setTurmaSelecionada] = useState<string>(() => {
    return turmasValidas[0]?.Turma || '1º  1';
  });

  const turmaObj = useMemo(() => {
    return turmasData.find(t => t.Turma === turmaSelecionada) || turmasValidas[0];
  }, [turmaSelecionada, turmasValidas]);

  const isAnosIniciais = useMemo(() => {
    const p = turmaObj?.Período?.toUpperCase() || '';
    return p.includes('1º') || p.includes('2º') || p.includes('3º') || p.includes('4º') || p.includes('5º');
  }, [turmaObj]);

  const turno = turmaObj?.Turno || 'MATUTINO';
  const horariosGrade = turno === 'VESPERTINO' ? HORARIOS_VESPERTINO : HORARIOS_MATUTINO;

  // Grade atual
  const [grade, setGrade] = useState<GradeHoraria>(() => {
    const salvo = localStorage.getItem(`guia_escolar_grade_${turmaSelecionada}`);
    if (salvo) {
      try {
        return JSON.parse(salvo);
      } catch {
        // fallback
      }
    }
    return gerarGradePadrao(isAnosIniciais, turmaSelecionada);
  });

  // Modal para editar um slot
  const [slotEditando, setSlotEditando] = useState<{
    dia: number;
    aulaIdx: number;
    slot: AulaSlot;
  } | null>(null);

  // Quando troca a turma, recarrega a grade correspondente
  useEffect(() => {
    const salvo = localStorage.getItem(`guia_escolar_grade_${turmaSelecionada}`);
    if (salvo) {
      try {
        setGrade(JSON.parse(salvo));
        return;
      } catch {
        // fallback
      }
    }
    setGrade(gerarGradePadrao(isAnosIniciais, turmaSelecionada));
  }, [turmaSelecionada, isAnosIniciais]);

  function salvarGrade() {
    localStorage.setItem(`guia_escolar_grade_${turmaSelecionada}`, JSON.stringify(grade));
    if (onToast) {
      onToast({
        message: `Quadro de horários da Turma ${turmaSelecionada} salvo com sucesso!`,
        type: 'success'
      });
    }
  }

  function restaurarPadrao() {
    const padrao = gerarGradePadrao(isAnosIniciais, turmaSelecionada);
    setGrade(padrao);
    localStorage.setItem(`guia_escolar_grade_${turmaSelecionada}`, JSON.stringify(padrao));
    if (onToast) {
      onToast({
        message: `Horário padrão da Turma ${turmaSelecionada} restaurado com sucesso!`,
        type: 'success'
      });
    }
  }

  function handleSalvarSlot(novaDisciplina: string, novoProfessor: string) {
    if (!slotEditando) return;
    const { dia, aulaIdx } = slotEditando;
    setGrade(prev => {
      const nova = { ...prev };
      nova[dia] = { ...nova[dia] };
      nova[dia][aulaIdx] = {
        disciplina: novaDisciplina,
        professor: novoProfessor,
        sala: `Sala ${turmaSelecionada}`
      };
      return nova;
    });
    setSlotEditando(null);
  }

  // Estatísticas semanais de aulas por disciplina
  const aulasPorDisciplina = useMemo(() => {
    const contagem: Record<string, number> = {};
    for (let dia = 0; dia < 5; dia++) {
      for (let aula = 0; aula < 5; aula++) {
        const slot = grade[dia]?.[aula];
        if (slot?.disciplina) {
          contagem[slot.disciplina] = (contagem[slot.disciplina] || 0) + 1;
        }
      }
    }
    return contagem;
  }, [grade]);

  const totalAulasSemanais = useMemo(() => {
    return Object.values(aulasPorDisciplina).reduce((acc, curr) => acc + curr, 0);
  }, [aulasPorDisciplina]);

  function imprimir() {
    window.print();
  }

  return (
    <div className="horario-container">
      {/* Cabeçalho do Módulo */}
      <div className="horario-header">
        <div className="horario-header-title">
          <Calendar className="icon-header" size={28} />
          <div>
            <h2>Quadro de Horários das Turmas (SIGP Educação)</h2>
            <p>E.M. MARIA GERALDA MIRANDA BRITO SALOMÃO &bull; Ano Letivo 2026 &bull; 200 Dias Letivos</p>
          </div>
        </div>

        <div className="horario-actions no-print">
          <button
            type="button"
            className="btn-secundario"
            onClick={restaurarPadrao}
            title="Restaurar matriz curricular padrão"
          >
            <RotateCcw size={16} /> Restaurar Padrão
          </button>
          <button
            type="button"
            className="btn-primario"
            onClick={salvarGrade}
            title="Salvar alterações na grade desta turma"
          >
            <Save size={16} /> Salvar Grade
          </button>
          <button
            type="button"
            className="btn-print"
            onClick={imprimir}
            title="Imprimir quadro de horários oficial"
          >
            <Printer size={16} /> Imprimir Mural
          </button>
        </div>
      </div>

      {/* Barra de Filtros e Seleção da Turma */}
      <div className="horario-selector-card no-print">
        <div className="selector-group">
          <label htmlFor="select-turma">
            <Users size={16} /> Selecionar Turma:
          </label>
          <select
            id="select-turma"
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

        <div className="turma-badges">
          <span className="badge-info">
            <strong>Etapa:</strong> {turmaObj?.Período || 'Ensino Fundamental'}
          </span>
          <span className="badge-info">
            <strong>Turno:</strong> {turno}
          </span>
          <span className="badge-info">
            <strong>Carga Horária:</strong> {turmaObj?.['Carga horária'] || '800:00'}h
          </span>
          <span className="badge-info">
            <strong>Aulas Semanais:</strong> {totalAulasSemanais}/25 aulas
          </span>
        </div>
      </div>

      {/* CABEÇALHO OFICIAL DE IMPRESSÃO (Visível apenas na impressão) */}
      <div className="cabecalho-impressao-oficial only-print">
        <div className="print-topo">
          <h3>ESTADO DE MINAS GERAIS &bull; PREFEITURA MUNICIPAL DE PONTO DOS VOLANTES</h3>
          <h4>SECRETARIA MUNICIPAL DE EDUCAÇÃO</h4>
          <h2>ESCOLA MUNICIPAL MARIA GERALDA MIRANDA BRITO SALOMÃO</h2>
          <p className="print-sub">CÓDIGO INEP: 31054366 &bull; RECONHECIMENTO: PORTARIA SEE/MG</p>
        </div>
        <div className="print-dados-turma">
          <div><strong>TURMA:</strong> {turmaSelecionada} ({turmaObj?.Período})</div>
          <div><strong>TURNO:</strong> {turno}</div>
          <div><strong>ANO LETIVO:</strong> 2026</div>
          <div><strong>DIAS LETIVOS:</strong> 200 DIAS (800H ANUAIS)</div>
        </div>
      </div>

      {/* Grade Semanal Interativa */}
      <div className="grade-wrapper">
        <table className="grade-tabela">
          <thead>
            <tr>
              <th className="th-horario">
                <Clock size={16} /> Horário
              </th>
              {DIAS_SEMANA_NOMES.map((diaNome, idx) => (
                <th key={idx} className="th-dia">
                  {diaNome}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Aula 1 (índice 0) */}
            <tr>
              <td className="td-horario">
                <span className="aula-label">{horariosGrade[0].aula}</span>
                <span className="aula-hora">{horariosGrade[0].horario}</span>
              </td>
              {[0, 1, 2, 3, 4].map((dia) => renderCelula(dia, 0))}
            </tr>

            {/* Aula 2 (índice 1) */}
            <tr>
              <td className="td-horario">
                <span className="aula-label">{horariosGrade[1].aula}</span>
                <span className="aula-hora">{horariosGrade[1].horario}</span>
              </td>
              {[0, 1, 2, 3, 4].map((dia) => renderCelula(dia, 1))}
            </tr>

            {/* Aula 3 (índice 2) */}
            <tr>
              <td className="td-horario">
                <span className="aula-label">{horariosGrade[2].aula}</span>
                <span className="aula-hora">{horariosGrade[2].horario}</span>
              </td>
              {[0, 1, 2, 3, 4].map((dia) => renderCelula(dia, 2))}
            </tr>

            {/* Intervalo / Recreio */}
            <tr className="linha-intervalo">
              <td className="td-horario intervalo-horario">
                <span className="aula-label">INTERVALO</span>
                <span className="aula-hora">{horariosGrade[3].horario}</span>
              </td>
              <td colSpan={5} className="td-intervalo">
                &bull; RECREIO PEDAGÓGICO / MERENDA ESCOLAR &bull;
              </td>
            </tr>

            {/* Aula 4 (índice 3 na grade lógica) */}
            <tr>
              <td className="td-horario">
                <span className="aula-label">{horariosGrade[4].aula}</span>
                <span className="aula-hora">{horariosGrade[4].horario}</span>
              </td>
              {[0, 1, 2, 3, 4].map((dia) => renderCelula(dia, 3))}
            </tr>

            {/* Aula 5 (índice 4 na grade lógica) */}
            <tr>
              <td className="td-horario">
                <span className="aula-label">{horariosGrade[5].aula}</span>
                <span className="aula-hora">{horariosGrade[5].horario}</span>
              </td>
              {[0, 1, 2, 3, 4].map((dia) => renderCelula(dia, 4))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Resumo da Matriz Curricular Semanal */}
      <div className="horario-footer-resumo no-print">
        <h3>
          <BookOpen size={18} /> Carga Horária Semanal por Componente Curricular:
        </h3>
        <div className="resumo-grid">
          {DISCIPLINAS_PADRAO.map((disc) => {
            const qtd = aulasPorDisciplina[disc.nome] || 0;
            if (qtd === 0) return null;
            return (
              <div key={disc.nome} className="resumo-card" style={{ borderLeftColor: disc.cor }}>
                <span className="resumo-disc">{disc.nome}</span>
                <span className="resumo-qtd">{qtd} h/a ({qtd * 50} min)</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Termo de Assinatura Oficial (Apenas Impressão) */}
      <div className="print-assinaturas only-print">
        <div className="assinatura-box">
          <div className="linha-assinatura"></div>
          <p>Especialista em Educação Básica (Coordenação)</p>
          <span>MASP: 1.094.218-4</span>
        </div>
        <div className="assinatura-box">
          <div className="linha-assinatura"></div>
          <p>Direção Escolar</p>
          <span>E.M. Maria Geralda M. B. Salomão</span>
        </div>
      </div>

      {/* Modal de Edição de Slot */}
      {slotEditando && (
        <ModalEdicaoSlot
          slot={slotEditando.slot}
          diaNome={DIAS_SEMANA_NOMES[slotEditando.dia]}
          aulaNumero={slotEditando.aulaIdx + 1}
          aoSalvar={handleSalvarSlot}
          aoFechar={() => setSlotEditando(null)}
        />
      )}
    </div>
  );

  function renderCelula(dia: number, aulaIdx: number) {
    const slot = grade[dia]?.[aulaIdx] || { disciplina: '', professor: '' };
    const discInfo = DISCIPLINAS_PADRAO.find(d => d.nome === slot.disciplina);

    return (
      <td
        key={dia}
        className="td-slot"
        onClick={() => setSlotEditando({ dia, aulaIdx, slot })}
        title="Clique para alterar a disciplina ou professor deste horário"
      >
        {slot.disciplina ? (
          <div className="slot-card" style={{ borderLeftColor: discInfo?.cor || '#2563eb' }}>
            <span className="slot-disciplina" style={{ color: discInfo?.cor || '#1e3a8a' }}>
              {slot.disciplina}
            </span>
            <span className="slot-professor" title={slot.professor}>
              {slot.professor || 'Prof. a definir'}
            </span>
          </div>
        ) : (
          <div className="slot-vazio">
            <span>+ Definir Aula</span>
          </div>
        )}
      </td>
    );
  }
};

interface ModalEdicaoSlotProps {
  slot: AulaSlot;
  diaNome: string;
  aulaNumero: number;
  aoSalvar: (disciplina: string, professor: string) => void;
  aoFechar: () => void;
}

const ModalEdicaoSlot: React.FC<ModalEdicaoSlotProps> = ({
  slot,
  diaNome,
  aulaNumero,
  aoSalvar,
  aoFechar
}) => {
  const [disciplina, setDisciplina] = useState(slot.disciplina || DISCIPLINAS_PADRAO[0].nome);
  const [professor, setProfessor] = useState(slot.professor || '');

  return (
    <div className="modal-overlay" onClick={aoFechar}>
      <div className="modal-horario-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>
            Editar Aula: {aulaNumero}ª Aula &bull; {diaNome}
          </h3>
          <button type="button" className="modal-close-btn" onClick={aoFechar}>
            &times;
          </button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label htmlFor="slot-disciplina">Componente Curricular / Disciplina:</label>
            <select
              id="slot-disciplina"
              value={disciplina}
              onChange={(e) => setDisciplina(e.target.value)}
            >
              {DISCIPLINAS_PADRAO.map((d) => (
                <option key={d.nome} value={d.nome}>
                  {d.nome} ({d.abreviacao})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="slot-professor">Professor Regente / Docente:</label>
            <input
              id="slot-professor"
              type="text"
              list="lista-professores-datalist"
              value={professor}
              onChange={(e) => setProfessor(e.target.value)}
              placeholder="Selecione ou digite o nome do professor"
            />
            <datalist id="lista-professores-datalist">
              {profissionaisData.map((p) => (
                <option key={p.Código} value={p.Nome}>
                  {p.Nome} - {p['Curso superior'] || 'Docente'}
                </option>
              ))}
            </datalist>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-cancelar" onClick={aoFechar}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn-confirmar"
            onClick={() => aoSalvar(disciplina, professor)}
          >
            Confirmar Alteração
          </button>
        </div>
      </div>
    </div>
  );
};

export default HorarioTurma;
