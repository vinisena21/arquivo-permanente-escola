import React, { useState, useMemo } from 'react';
import {
  Search,
  Printer,
  AlertTriangle
} from 'lucide-react';
import matriculasData from '../data/matriculas.json';
import turmasData from '../data/turmas.json';
import { DISCIPLINAS_BOLETIM } from './BoletimEscolar';

interface FichaIndividualAlunoProps {
  onToast?: (toast: { message: string; type: 'success' | 'error' }) => void;
}

export const FichaIndividualAluno: React.FC<FichaIndividualAlunoProps> = ({ onToast: _onToast }) => {
  const [busca, setBusca] = useState('');
  const [alunoSelecionadoCod, setAlunoSelecionadoCod] = useState<string>(() => {
    return matriculasData[0]?.Código || '';
  });

  const [parecerDescritivo, setParecerDescritivo] = useState(
    'O(A) estudante demonstrou pleno desenvolvimento das competências e habilidades propostas pela Base Nacional Comum Curricular (BNCC) para o respectivo ano de escolaridade, mantendo postura participativa, colaborativa e assídua nas atividades individuais e em equipe ao longo dos três trimestres letivos.'
  );

  const alunosFiltrados = useMemo(() => {
    if (!busca.trim()) return matriculasData.slice(0, 100);
    const termo = busca.toLowerCase();
    return matriculasData
      .filter(
        a =>
          a.Nome.toLowerCase().includes(termo) ||
          a.Código.includes(termo) ||
          (a.Turma || '').toLowerCase().includes(termo)
      )
      .slice(0, 100);
  }, [busca]);

  const aluno = useMemo(() => {
    return matriculasData.find(a => a.Código === alunoSelecionadoCod) || matriculasData[0];
  }, [alunoSelecionadoCod]);

  const turmaObj = useMemo(() => {
    return turmasData.find(t => t.Turma === aluno?.Turma) || {
      Período: aluno?.Período || 'Ensino Fundamental',
      Turno: aluno?.Turno || 'MATUTINO',
      'Carga horária': '0800:00'
    };
  }, [aluno]);

  // Cálculo de notas e faltas determinísticas para a ficha
  const notasFicha = useMemo(() => {
    const seed = parseInt(aluno?.Código || '12345', 10);
    const isTransf = aluno?.Situação === 'TRANSFERIDO';

    return DISCIPLINAS_BOLETIM.map((disc, idx) => {
      const varSeed = (seed * 19 + idx * 29) % 100;
      const t1 = Math.min(30, Math.max(18, Math.round(18 + (varSeed % 12))));
      const t2 = Math.min(30, Math.max(18, Math.round(18 + ((varSeed + 4) % 12))));
      const t3 = isTransf ? null : Math.min(40, Math.max(24, Math.round(25 + ((varSeed + 8) % 15))));
      const faltas = isTransf ? 6 : (varSeed % 7);
      const total = (t1) + (t2) + (t3 ?? 0);
      return {
        disciplina: disc,
        trimestre1: t1,
        trimestre2: t2,
        trimestre3: t3,
        total: total,
        faltas: faltas,
        resultado: isTransf ? 'TRANSF.' : (total >= 60 ? 'APROVADO' : 'RECUPERAÇÃO')
      };
    });
  }, [aluno]);

  const totalPontosGlobal = useMemo(() => {
    return notasFicha.reduce((acc, curr) => acc + curr.total, 0);
  }, [notasFicha]);

  const totalFaltasGlobal = useMemo(() => {
    return notasFicha.reduce((acc, curr) => acc + curr.faltas, 0);
  }, [notasFicha]);

  const mediaGlobal = (totalPontosGlobal / (notasFicha.length || 1)).toFixed(1);
  const frequenciaGeral = Math.max(0, Math.min(100, (((1000 - totalFaltasGlobal) / 1000) * 100))).toFixed(1);

  const isTransferido = aluno?.Situação === 'TRANSFERIDO';
  const resultadoFinal = isTransferido
    ? 'TRANSFERIDO NO DECORRER DO ANO LETIVO'
    : (parseFloat(mediaGlobal) >= 60 && parseFloat(frequenciaGeral) >= 75
        ? 'APROVADO PARA O ANO SUBSEQUENTE'
        : 'EM RECUPERAÇÃO / CONSELHO DE CLASSE');

  function imprimir() {
    window.print();
  }

  return (
    <div className="ficha-individual-container">
      {/* Barra Superior de Seleção */}
      <div className="ficha-selecao-bar no-print">
        <div className="busca-aluno-box">
          <Search size={16} />
          <input
            type="text"
            placeholder="Buscar por nome, matrícula ou turma..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>

        <div className="select-aluno-box">
          <select
            value={alunoSelecionadoCod}
            onChange={(e) => setAlunoSelecionadoCod(e.target.value)}
          >
            {alunosFiltrados.map((a) => (
              <option key={a.Código} value={a.Código}>
                {a.Nome} &bull; Matr. {a.Código} &bull; Turma {a.Turma} ({a.Situação})
              </option>
            ))}
          </select>
        </div>

        <button type="button" className="btn-print" onClick={imprimir}>
          <Printer size={16} /> Imprimir Ficha Individual
        </button>
      </div>

      {isTransferido && (
        <div className="alerta-transferido-banner no-print">
          <AlertTriangle size={20} />
          <div>
            <strong>Estudante com Registro de Transferência</strong>
            <p>
              O estudante possui situação "TRANSFERIDO" no sistema da Secretaria Municipal.
              A Ficha Individual reflete o aproveitamento registrado até a data da movimentação escolar.
            </p>
          </div>
        </div>
      )}

      {/* FOLHA DA FICHA INDIVIDUAL (Padrão Oficial Secretaria de Estado de Educação de MG) */}
      <div className="ficha-folha-documento">
        {/* Cabeçalho */}
        <div className="ficha-cabecalho-oficial">
          <div className="ficha-brasao-mg">MG</div>
          <div className="ficha-titulos">
            <h3>GOVERNO DO ESTADO DE MINAS GERAIS &bull; PREFEITURA DE PONTO DOS VOLANTES</h3>
            <h4>SECRETARIA MUNICIPAL DE EDUCAÇÃO</h4>
            <h2>ESCOLA MUNICIPAL MARIA GERALDA MIRANDA BRITO SALOMÃO</h2>
            <p>ENSINO FUNDAMENTAL REGULAR DE 9 ANOS &bull; CÓDIGO INEP: 31054366</p>
            <div className="faixa-doc-nome">
              FICHA INDIVIDUAL DO ESTUDANTE &bull; ANO LETIVO 2026
            </div>
          </div>
        </div>

        {/* Quadro I: Identificação do Aluno */}
        <div className="secao-quadro">
          <div className="secao-titulo">I &bull; DADOS DE IDENTIFICAÇÃO DO ESTUDANTE</div>
          <div className="grid-identificacao">
            <div className="grid-item span-3">
              <span className="label">Nome Completo:</span>
              <span className="valor valor-destaque">{aluno.Nome}</span>
            </div>
            <div className="grid-item">
              <span className="label">Código SIGP / Matrícula:</span>
              <span className="valor">{aluno.Código}</span>
            </div>

            <div className="grid-item">
              <span className="label">Data de Nascimento:</span>
              <span className="valor">{aluno['Data de Nascimento'] || '—'}</span>
            </div>
            <div className="grid-item">
              <span className="label">Naturalidade / UF:</span>
              <span className="valor">{aluno.Naturalidade || 'PONTO DOS VOLANTES - MG'}</span>
            </div>
            <div className="grid-item">
              <span className="label">Nacionalidade:</span>
              <span className="valor">{aluno.Nacionalidade || 'Brasileira'}</span>
            </div>
            <div className="grid-item">
              <span className="label">Sexo / Cor:</span>
              <span className="valor">{aluno.Sexo || '—'} / {aluno.Cor || '—'}</span>
            </div>

            <div className="grid-item span-2">
              <span className="label">Filiação 1 (Mãe):</span>
              <span className="valor">{aluno['Filiação 1'] || 'Não declarada'}</span>
            </div>
            <div className="grid-item span-2">
              <span className="label">Filiação 2 (Pai):</span>
              <span className="valor">{aluno['Filiação 2'] || 'Não declarada'}</span>
            </div>

            <div className="grid-item span-2">
              <span className="label">Certidão de Nascimento (Termo/Matrícula):</span>
              <span className="valor">{aluno['Número da certidão'] || 'Conforme Prontuário Escolar'}</span>
            </div>
            <div className="grid-item">
              <span className="label">Cartão do SUS:</span>
              <span className="valor">{aluno['Nº do Cartão Nacional do SUS'] || '—'}</span>
            </div>
            <div className="grid-item">
              <span className="label">CPF do Aluno:</span>
              <span className="valor">{aluno.CPF || '—'}</span>
            </div>
          </div>
        </div>

        {/* Quadro II: Dados da Turma e Escolaridade */}
        <div className="secao-quadro">
          <div className="secao-titulo">II &bull; DADOS DO ANO DE ESCOLARIDADE</div>
          <div className="grid-turma-dados">
            <div><strong>Ano de Escolaridade:</strong> {aluno.Período || turmaObj?.Período}</div>
            <div><strong>Turma:</strong> {aluno.Turma}</div>
            <div><strong>Turno:</strong> {aluno.Turno}</div>
            <div><strong>Dias Letivos:</strong> 200 Dias</div>
            <div><strong>Carga Horária Curricular:</strong> {turmaObj?.['Carga horária'] || '0800:00'} Horas</div>
            <div><strong>Situação Cadastral:</strong> <span className={`badge-sit-${aluno.Situação.toLowerCase()}`}>{aluno.Situação}</span></div>
          </div>
        </div>

        {/* Quadro III: Quadro Curricular e Aproveitamento Trimestral */}
        <div className="secao-quadro">
          <div className="secao-titulo">III &bull; APROVEITAMENTO E FREQUÊNCIA TRIMESTRAL</div>
          <table className="tabela-ficha-notas">
            <thead>
              <tr>
                <th rowSpan={2} className="th-alinhado-esq">Componentes Curriculares da Base Nacional Comum</th>
                <th colSpan={3}>Aproveitamento por Trimestre</th>
                <th rowSpan={2}>Total Pontos (100)</th>
                <th rowSpan={2}>Faltas (h/a)</th>
                <th rowSpan={2}>Resultado da Disciplina</th>
              </tr>
              <tr>
                <th>1º Trim. (30)</th>
                <th>2º Trim. (30)</th>
                <th>3º Trim. (40)</th>
              </tr>
            </thead>
            <tbody>
              {notasFicha.map((n) => (
                <tr key={n.disciplina}>
                  <td className="td-alinhado-esq">{n.disciplina}</td>
                  <td>{n.trimestre1.toFixed(1)}</td>
                  <td>{n.trimestre2.toFixed(1)}</td>
                  <td>{n.trimestre3 !== null ? n.trimestre3.toFixed(1) : '—'}</td>
                  <td className="td-destaque-total">
                    <strong>{n.total.toFixed(1)}</strong>
                  </td>
                  <td>{n.faltas}</td>
                  <td className={n.resultado === 'APROVADO' ? 'txt-aprov' : 'txt-aviso'}>
                    {n.resultado}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="tr-totais-ficha">
                <td className="td-alinhado-esq">
                  <strong>TOTAIS / MÉDIA GLOBAL</strong>
                </td>
                <td colSpan={3} className="td-frequencia-resumo">
                  Frequência Letiva: <strong>{frequenciaGeral}%</strong>
                </td>
                <td>
                  <strong>{totalPontosGlobal.toFixed(1)}</strong>
                </td>
                <td>
                  <strong>{totalFaltasGlobal}</strong>
                </td>
                <td className="td-situacao-final-ficha">
                  <strong>{isTransferido ? 'TRANSFERIDO' : 'APTO'}</strong>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Quadro IV: Parecer Pedagógico Descritivo */}
        <div className="secao-quadro">
          <div className="secao-titulo">IV &bull; PARECER DESCRITIVO E APRECIAÇÃO PEDAGÓGICA</div>
          <div className="parecer-area">
            <textarea
              rows={3}
              value={parecerDescritivo}
              onChange={(e) => setParecerDescritivo(e.target.value)}
              className="textarea-parecer"
            />
          </div>
        </div>

        {/* Quadro V: Decisão Final e Autenticação */}
        <div className="secao-quadro quadro-resultado">
          <div className="resultado-final-box">
            <span>RESULTADO FINAL DO ANO LETIVO DE 2026:</span>
            <div className="faixa-resultado-destaque">
              {resultadoFinal}
            </div>
          </div>
        </div>

        {/* Assinaturas Legais Oficiais */}
        <div className="ficha-assinaturas-grid">
          <div className="assinatura-col">
            <div className="traco-assinatura"></div>
            <p>Secretário(a) Escolar</p>
            <span>Registro / Portaria de Designação</span>
          </div>
          <div className="assinatura-col">
            <div className="traco-assinatura"></div>
            <p>Especialista da Educação Básica</p>
            <span>Coordenação Pedagógica</span>
          </div>
          <div className="assinatura-col">
            <div className="traco-assinatura"></div>
            <p>Diretor(a) Escolar</p>
            <span>E.M. Maria Geralda M. B. Salomão</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FichaIndividualAluno;
