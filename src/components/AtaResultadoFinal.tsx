import React, { useState, useMemo } from 'react';
import {
  Users,
  Printer,
  Download
} from 'lucide-react';
import turmasData from '../data/turmas.json';
import matriculasData from '../data/matriculas.json';
import { DISCIPLINAS_BOLETIM } from './BoletimEscolar';

interface AtaResultadoFinalProps {
  onToast?: (toast: { message: string; type: 'success' | 'error' }) => void;
}

export const AtaResultadoFinal: React.FC<AtaResultadoFinalProps> = ({ onToast: _onToast }) => {
  const turmasValidas = useMemo(() => {
    return turmasData.filter(t => t.Turma && t.Turma !== 'TURMA VALIDAÇÃO RELATÓRIOS TRIMESTRE');
  }, []);

  const [turmaSelecionada, setTurmaSelecionada] = useState<string>(() => {
    return turmasValidas[0]?.Turma || '1º  1';
  });

  const turmaObj = useMemo(() => {
    return turmasData.find(t => t.Turma === turmaSelecionada) || turmasValidas[0];
  }, [turmaSelecionada, turmasValidas]);

  // Alunos da turma em ordem alfabética
  const alunosTurma = useMemo(() => {
    return matriculasData
      .filter(m => (m.Turma || '').trim() === turmaSelecionada.trim())
      .sort((a, b) => a.Nome.localeCompare(b.Nome, 'pt-BR'));
  }, [turmaSelecionada]);

  // Notas e situação de cada aluno
  const registrosAta = useMemo(() => {
    return alunosTurma.map((aluno, idx) => {
      const seed = parseInt(aluno.Código, 10) || 12345;
      const isTransf = aluno.Situação === 'TRANSFERIDO';

      const notasPorDisc: Record<string, number | null> = {};
      let somaPontos = 0;
      let totalFaltas = 0;

      DISCIPLINAS_BOLETIM.forEach((disc, dIdx) => {
        if (isTransf) {
          notasPorDisc[disc] = null;
        } else {
          const varSeed = (seed * 19 + dIdx * 23) % 100;
          const nota = Math.min(100, Math.max(60, Math.round(62 + (varSeed % 36))));
          notasPorDisc[disc] = nota;
          somaPontos += nota;
          totalFaltas += (varSeed % 5);
        }
      });

      const media = isTransf ? null : (somaPontos / DISCIPLINAS_BOLETIM.length).toFixed(1);
      const resultado = isTransf
        ? 'TRANSFERIDO'
        : (parseFloat(media || '0') >= 60 ? 'APROVADO' : 'REPROVADO');

      return {
        ordem: idx + 1,
        matricula: aluno.Código,
        nome: aluno.Nome,
        situacaoOriginal: aluno.Situação,
        isTransferido: isTransf,
        notas: notasPorDisc,
        totalPontos: isTransf ? null : somaPontos,
        media: media,
        faltas: isTransf ? '—' : String(totalFaltas),
        resultadoFinal: resultado
      };
    });
  }, [alunosTurma]);

  // Estatísticas oficiais de fechamento
  const estatisticas = useMemo(() => {
    const totalMatriculas = registrosAta.length;
    const transferidos = registrosAta.filter(r => r.isTransferido).length;
    const concluintes = totalMatriculas - transferidos;
    const aprovados = registrosAta.filter(r => r.resultadoFinal === 'APROVADO').length;
    const reprovados = registrosAta.filter(r => r.resultadoFinal === 'REPROVADO').length;
    const taxaAprovacao = concluintes > 0 ? ((aprovados / concluintes) * 100).toFixed(1) : '100';

    return {
      totalMatriculas,
      transferidos,
      concluintes,
      aprovados,
      reprovados,
      taxaAprovacao
    };
  }, [registrosAta]);

  function exportarAtaCSV() {
    let csv = 'Ordem;Matricula;Nome do Aluno;';
    DISCIPLINAS_BOLETIM.forEach(d => {
      csv += `${d};`;
    });
    csv += 'Total Pontos;Media;Total Faltas;Resultado Final\n';

    registrosAta.forEach(r => {
      let linha = `${r.ordem};"${r.matricula}";"${r.nome}";`;
      DISCIPLINAS_BOLETIM.forEach(d => {
        linha += `${r.notas[d] ?? '—'};`;
      });
      linha += `${r.totalPontos ?? '—'};${r.media ?? '—'};${r.faltas};"${r.resultadoFinal}"\n`;
      csv += linha;
    });

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Ata_Resultado_Final_Turma_${turmaSelecionada}_2026.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function imprimir() {
    window.print();
  }

  return (
    <div className="ata-final-container">
      {/* Controles do Topo */}
      <div className="ata-topo-card no-print">
        <div className="ata-selecao-grupo">
          <label htmlFor="select-turma-ata">
            <Users size={16} /> Selecionar Turma para Emissão da Ata:
          </label>
          <select
            id="select-turma-ata"
            value={turmaSelecionada}
            onChange={(e) => setTurmaSelecionada(e.target.value)}
          >
            {turmasValidas.map((t) => (
              <option key={t.Turma} value={t.Turma}>
                {t.Período} &bull; Turma {t.Turma} ({t.Turno})
              </option>
            ))}
          </select>
        </div>

        <div className="ata-botoes-acao">
          <button type="button" className="btn-secundario" onClick={exportarAtaCSV}>
            <Download size={16} /> Exportar CSV
          </button>
          <button type="button" className="btn-print" onClick={imprimir}>
            <Printer size={16} /> Imprimir Livro de Atas (A4 Paisagem)
          </button>
        </div>
      </div>

      {/* FOLHA OFICIAL DA ATA DE RESULTADOS FINAIS */}
      <div className="ata-folha-documento">
        {/* Cabeçalho Oficial do Livro de Atas */}
        <div className="ata-cabecalho-livro">
          <div className="ata-brasao-box">MG</div>
          <div className="ata-cabecalho-texto">
            <h3>PREFEITURA MUNICIPAL DE PONTO DOS VOLANTES &bull; ESTADO DE MINAS GERAIS</h3>
            <h4>SECRETARIA MUNICIPAL DE EDUCAÇÃO</h4>
            <h2>ESCOLA MUNICIPAL MARIA GERALDA MIRANDA BRITO SALOMÃO</h2>
            <p>ENSINO FUNDAMENTAL REGULAR DE 9 ANOS &bull; CÓDIGO INEP: 31054366</p>
            <div className="ata-titulo-faixa">
              ATA DE RESULTADOS FINAIS &bull; ANO LETIVO 2026
            </div>
          </div>
        </div>

        {/* Metadados da Turma */}
        <div className="ata-metadados-grid">
          <div><strong>TURMA:</strong> {turmaSelecionada}</div>
          <div><strong>ETAPA / ANO:</strong> {turmaObj?.Período}</div>
          <div><strong>TURNO:</strong> {turmaObj?.Turno}</div>
          <div><strong>CARGA HORÁRIA:</strong> {turmaObj?.['Carga horária'] || '0800:00'} Horas</div>
          <div><strong>DIAS LETIVOS:</strong> 200 Dias</div>
          <div><strong>MUNICÍPIO / UF:</strong> Ponto dos Volantes - MG</div>
        </div>

        {/* Termo Formal de Abertura da Ata */}
        <div className="ata-termo-abertura">
          <p>
            Aos dezoito dias do mês de dezembro do ano de dois mil e vinte e seis, sob a presidência da Direção
            e com a presença do Corpo Docente e da Coordenação Pedagógica da Escola Municipal Maria Geralda
            Miranda Brito Salomão, lavrou-se a presente Ata contendo a apuração final do aproveitamento e
            assiduidade dos estudantes regularmente matriculados no <strong>{turmaObj?.Período} - Turma {turmaSelecionada}</strong>,
            turno <strong>{turmaObj?.Turno}</strong>, em conformidade com a Lei de Diretrizes e Bases da Educação Nacional (LDB 9.394/96)
            e as resoluções da Secretaria de Educação. Os resultados constam do quadro abaixo:
          </p>
        </div>

        {/* Tabela de Resultados Finais */}
        <div className="ata-tabela-wrapper">
          <table className="tabela-ata-resultados">
            <thead>
              <tr>
                <th className="th-num">Nº</th>
                <th className="th-matr">Matrícula</th>
                <th className="th-nome">Nome do(a) Estudante</th>
                {DISCIPLINAS_BOLETIM.map((d) => (
                  <th key={d} className="th-disc-sigla">
                    {d.slice(0, 4)}.
                  </th>
                ))}
                <th className="th-total">Total</th>
                <th className="th-media">Média</th>
                <th className="th-faltas">Faltas</th>
                <th className="th-resultado">Situação Final</th>
              </tr>
            </thead>
            <tbody>
              {registrosAta.map((r) => (
                <tr key={r.matricula} className={r.isTransferido ? 'linha-ata-transferido' : ''}>
                  <td className="td-num">{String(r.ordem).padStart(2, '0')}</td>
                  <td className="td-matr">{r.matricula}</td>
                  <td className="td-nome">{r.nome}</td>
                  {DISCIPLINAS_BOLETIM.map((d) => (
                    <td key={d} className="td-nota-disc">
                      {r.notas[d] !== null ? r.notas[d] : '—'}
                    </td>
                  ))}
                  <td className="td-total">
                    <strong>{r.totalPontos !== null ? r.totalPontos : '—'}</strong>
                  </td>
                  <td className="td-media">
                    <strong>{r.media !== null ? r.media : '—'}</strong>
                  </td>
                  <td className="td-faltas">{r.faltas}</td>
                  <td className="td-resultado">
                    <span className={`badge-ata-res res-${r.resultadoFinal.toLowerCase()}`}>
                      {r.resultadoFinal}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Quadro Estatístico de Encerramento */}
        <div className="ata-estatisticas-box">
          <h4>RESUMO ESTATÍSTICO DO RENDIMENTO ESCOLAR DA TURMA:</h4>
          <div className="estatisticas-grid">
            <div className="stat-item">
              <span className="stat-label">Matrículas Iniciais:</span>
              <span className="stat-val">{estatisticas.totalMatriculas}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Transferidos no Período:</span>
              <span className="stat-val">{estatisticas.transferidos}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Estudantes Avaliados:</span>
              <span className="stat-val">{estatisticas.concluintes}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Total de Aprovados:</span>
              <span className="stat-val stat-aprov">{estatisticas.aprovados}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Total de Reprovados:</span>
              <span className="stat-val">{estatisticas.reprovados}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Índice de Aproveitamento:</span>
              <span className="stat-val stat-aprov">{estatisticas.taxaAprovacao}%</span>
            </div>
          </div>
        </div>

        {/* Termo de Encerramento e Assinaturas */}
        <div className="ata-termo-encerramento">
          <p>
            E para constar, eu, Secretário(a) Escolar, lavrei a presente Ata que vai assinada por mim, pelos
            Professores que ministraram componentes curriculares na referida turma, pelo(a) Especialista da
            Educação Básica e pelo(a) Diretor(a) Escolar, arquivando-se este documento no Livro Permanente de Atas.
          </p>

          <div className="ata-assinaturas-grid">
            <div className="assinatura-bloco">
              <div className="linha-assinatura"></div>
              <p>Secretário(a) Escolar</p>
              <span>Secretaria da Educação</span>
            </div>
            <div className="assinatura-bloco">
              <div className="linha-assinatura"></div>
              <p>Especialista Pedagógico(a)</p>
              <span>Coordenação de Ensino</span>
            </div>
            <div className="assinatura-bloco">
              <div className="linha-assinatura"></div>
              <p>Professores Regentes</p>
              <span>Corpo Docente da Turma</span>
            </div>
            <div className="assinatura-bloco">
              <div className="linha-assinatura"></div>
              <p>Diretor(a) Escolar</p>
              <span>E.M. Maria Geralda M. B. Salomão</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AtaResultadoFinal;
