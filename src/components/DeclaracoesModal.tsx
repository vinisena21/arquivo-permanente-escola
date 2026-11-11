import React, { useState, useId } from 'react';
import { FileText, Printer, X, Check, Search, GraduationCap } from 'lucide-react';
import type { AlunoArquivo } from '../types/database';
import './DeclaracoesModal.css';

export type TipoDeclaracao =
  | 'matricula'
  | 'escolaridade'
  | 'comparecimento'
  | 'conclusao';

interface DeclaracoesModalProps {
  isOpen: boolean;
  onClose: () => void;
  alunos: AlunoArquivo[];
}

export const DeclaracoesModal: React.FC<DeclaracoesModalProps> = ({
  isOpen,
  onClose,
  alunos
}) => {
  const [tipo, setTipo] = useState<TipoDeclaracao>('matricula');
  const [buscaAluno, setBuscaAluno] = useState('');
  const [alunoSelecionado, setAlunoSelecionado] = useState<AlunoArquivo | null>(null);
  const [nomeAlunoManual, setNomeAlunoManual] = useState('');
  const [anoSerie, setAnoSerie] = useState('9º Ano do Ensino Fundamental');
  const [turno, setTurno] = useState('Matutino');
  const [anoLetivo, setAnoLetivo] = useState('2026');
  const [finalidade, setFinalidade] = useState('fins de comprovação junto a órgãos competentes');
  const [responsavelComparecimento, setResponsavelComparecimento] = useState('');
  const [horarioComparecimento, setHorarioComparecimento] = useState('das 08:00 às 11:30 horas');
  const [visualizandoImpressao, setVisualizandoImpressao] = useState(false);

  const selectTipoId = useId();
  const inputBuscaId = useId();
  const inputNomeManualId = useId();
  const inputAnoSerieId = useId();
  const inputTurnoId = useId();
  const inputAnoLetivoId = useId();
  const inputRespCompId = useId();
  const inputHorarioCompId = useId();
  const inputFinalidadeId = useId();

  if (!isOpen) return null;

  const alunosFiltrados = buscaAluno.trim()
    ? alunos.filter((a) =>
        a.nome.toLowerCase().includes(buscaAluno.toLowerCase().trim())
      ).slice(0, 5)
    : [];

  const nomeFinal = alunoSelecionado ? alunoSelecionado.nome : (nomeAlunoManual || 'NOME DO(A) ALUNO(A)');
  const dataNascFinal = alunoSelecionado?.dataNascimento || '___/___/______';
  const pastaFinal = alunoSelecionado?.codigoPasta || 'S/N';
  const prontuarioFinal = alunoSelecionado ? String(alunoSelecionado.numero).padStart(2, '0') : '--';

  const dataExtenso = new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(new Date());

  function handleImprimir() {
    window.print();
  }

  return (
    <div className="declaracoes-overlay">
      <div className={`declaracoes-modal ${visualizandoImpressao ? 'modo-impressao-preview' : ''}`}>
        {/* Header Modal */}
        <div className="declaracoes-modal-header no-print">
          <div className="declaracoes-modal-titulo">
            <FileText size={22} className="text-emerald-700" />
            <div>
              <h3>Emissor Oficial de Declarações Escolares</h3>
              <p>E.M. MARIA GERALDA MIRANDA BRITO SALOMÃO &bull; Ponto dos Volantes - MG</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="declaracoes-btn-fechar">
            <X size={20} />
          </button>
        </div>

        {/* Formulário de Configuração da Declaração */}
        {!visualizandoImpressao ? (
          <div className="declaracoes-form-body">
            <div className="decl-campo-grupo">
              <label htmlFor={selectTipoId}>Tipo de Declaração:</label>
              <select
                id={selectTipoId}
                value={tipo}
                onChange={(e) => setTipo(e.target.value as TipoDeclaracao)}
                className="decl-select-tipo"
              >
                <option value="matricula">Declaração de Matrícula e Frequência</option>
                <option value="escolaridade">Declaração de Escolaridade</option>
                <option value="comparecimento">Declaração de Comparecimento de Responsável</option>
                <option value="conclusao">Declaração de Conclusão de Ensino Fundamental</option>
              </select>
            </div>

            {/* Busca de Aluno */}
            <div className="decl-campo-grupo">
              <label htmlFor={inputBuscaId}>Buscar Aluno no Arquivo:</label>
              <div className="decl-input-com-icone">
                <Search size={16} />
                <input
                  id={inputBuscaId}
                  type="text"
                  placeholder="Digite o nome do aluno para preencher automaticamente..."
                  value={buscaAluno}
                  onChange={(e) => {
                    setBuscaAluno(e.target.value);
                    if (alunoSelecionado) setAlunoSelecionado(null);
                  }}
                />
              </div>

              {alunosFiltrados.length > 0 && !alunoSelecionado && (
                <div className="decl-autocomplete-lista">
                  {alunosFiltrados.map((a) => (
                    <button
                      type="button"
                      key={a.id}
                      className="decl-autocomplete-item"
                      onClick={() => {
                        setAlunoSelecionado(a);
                        setNomeAlunoManual(a.nome);
                        setBuscaAluno(a.nome);
                      }}
                    >
                      <GraduationCap size={16} className="text-emerald-600" />
                      <span>{a.nome}</span>
                      <small>Pasta {a.codigoPasta} &bull; Nº {String(a.numero).padStart(2, '0')}</small>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Ou preenchimento manual */}
            <div className="decl-grid-campos">
              <div className="decl-campo-grupo">
                <label htmlFor={inputNomeManualId}>Nome Completo do Aluno:</label>
                <input
                  id={inputNomeManualId}
                  type="text"
                  value={nomeAlunoManual}
                  onChange={(e) => {
                    setNomeAlunoManual(e.target.value);
                    if (alunoSelecionado) setAlunoSelecionado(null);
                  }}
                  placeholder="Nome do aluno..."
                />
              </div>

              <div className="decl-campo-grupo">
                <label htmlFor={inputAnoSerieId}>Ano / Turma:</label>
                <input
                  id={inputAnoSerieId}
                  type="text"
                  value={anoSerie}
                  onChange={(e) => setAnoSerie(e.target.value)}
                  placeholder="Ex: 9º Ano do Ensino Fundamental"
                />
              </div>

              <div className="decl-campo-grupo">
                <label htmlFor={inputTurnoId}>Turno:</label>
                <select
                  id={inputTurnoId}
                  value={turno}
                  onChange={(e) => setTurno(e.target.value)}
                >
                  <option value="Matutino">Matutino</option>
                  <option value="Vespertino">Vespertino</option>
                  <option value="Integral">Integral</option>
                  <option value="Noturno">Noturno / EJA</option>
                </select>
              </div>

              <div className="decl-campo-grupo">
                <label htmlFor={inputAnoLetivoId}>Ano Letivo:</label>
                <input
                  id={inputAnoLetivoId}
                  type="text"
                  value={anoLetivo}
                  onChange={(e) => setAnoLetivo(e.target.value)}
                />
              </div>
            </div>

            {tipo === 'comparecimento' && (
              <div className="decl-grid-campos">
                <div className="decl-campo-grupo">
                  <label htmlFor={inputRespCompId}>Nome do Responsável / Comparecente:</label>
                  <input
                    id={inputRespCompId}
                    type="text"
                    value={responsavelComparecimento}
                    onChange={(e) => setResponsavelComparecimento(e.target.value)}
                    placeholder="Nome de quem compareceu à escola..."
                  />
                </div>
                <div className="decl-campo-grupo">
                  <label htmlFor={inputHorarioCompId}>Horário do Comparecimento:</label>
                  <input
                    id={inputHorarioCompId}
                    type="text"
                    value={horarioComparecimento}
                    onChange={(e) => setHorarioComparecimento(e.target.value)}
                    placeholder="Ex: das 08:00 às 11:30 horas"
                  />
                </div>
              </div>
            )}

            <div className="decl-campo-grupo">
              <label htmlFor={inputFinalidadeId}>Finalidade da Declaração:</label>
              <input
                id={inputFinalidadeId}
                type="text"
                value={finalidade}
                onChange={(e) => setFinalidade(e.target.value)}
                placeholder="Ex: fins de solicitação de benefício / trabalho / comprovação..."
              />
            </div>

            {/* Ações */}
            <div className="decl-modal-actions no-print">
              <button type="button" onClick={onClose} className="decl-btn-secundario">
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => setVisualizandoImpressao(true)}
                className="decl-btn-primario"
              >
                <Check size={18} />
                Visualizar Declaração Timbrada
              </button>
            </div>
          </div>
        ) : (
          /* Pré-visualização da Folha Timbrada Oficial A4 */
          <div className="declaracoes-preview-wrapper">
            <div className="declaracoes-preview-barra no-print">
              <button
                type="button"
                onClick={() => setVisualizandoImpressao(false)}
                className="decl-btn-secundario"
              >
                &larr; Voltar e Editar Dados
              </button>
              <button
                type="button"
                onClick={handleImprimir}
                className="decl-btn-primario"
              >
                <Printer size={18} />
                Imprimir / Salvar em PDF
              </button>
            </div>

            <div className="folha-timbrada-a4">
              {/* Cabeçalho Oficial */}
              <div className="timbre-cabecalho">
                <div className="timbre-brasao">
                  <GraduationCap size={44} className="text-emerald-800" />
                </div>
                <div className="timbre-titulos">
                  <h2>ESTADO DE MINAS GERAIS</h2>
                  <h3>PREFEITURA MUNICIPAL DE PONTO DOS VOLANTES</h3>
                  <h4>SECRETARIA MUNICIPAL DE EDUCAÇÃO</h4>
                  <h1>ESCOLA MUNICIPAL MARIA GERALDA MIRANDA BRITO SALOMÃO</h1>
                  <p>Código INEP: 31057412 &bull; Autorização de Funcionamento: Portaria SEE/MG</p>
                  <p>Ponto dos Volantes — MG &bull; CEP: 39615-000</p>
                </div>
              </div>

              <div className="timbre-divisor"></div>

              {/* Título do Documento */}
              <div className="timbre-doc-titulo">
                {tipo === 'matricula' && 'DECLARAÇÃO DE MATRÍCULA E FREQUÊNCIA'}
                {tipo === 'escolaridade' && 'DECLARAÇÃO DE ESCOLARIDADE'}
                {tipo === 'comparecimento' && 'DECLARAÇÃO DE COMPARECIMENTO'}
                {tipo === 'conclusao' && 'DECLARAÇÃO DE CONCLUSÃO DE CURSO'}
              </div>

              {/* Corpo do Texto Formal */}
              <div className="timbre-corpo-texto">
                {tipo === 'matricula' && (
                  <p>
                    Declaramos, para os devidos fins a que se fizer necessário ou a pedido da parte
                    interessada, que o(a) aluno(a) <strong>{nomeFinal.toUpperCase()}</strong>,
                    nascido(a) em <strong>{dataNascFinal}</strong>, registrado(a) no Arquivo Permanente
                    desta instituição sob a <strong>Pasta {pastaFinal}</strong>, Prontuário nº{' '}
                    <strong>{prontuarioFinal}</strong>, encontra-se regularmente <strong>MATRICULADO(A)</strong>{' '}
                    e com frequência ativa no <strong>{anoSerie}</strong>, turno <strong>{turno}</strong>,
                    durante o Ano Letivo de <strong>{anoLetivo}</strong>.
                  </p>
                )}

                {tipo === 'escolaridade' && (
                  <p>
                    Declaramos, para os devidos fins de direito, que o(a) estudante{' '}
                    <strong>{nomeFinal.toUpperCase()}</strong>, data de nascimento{' '}
                    <strong>{dataNascFinal}</strong>, cursou e cumpriu as exigências curriculares e
                    pedagógicas correspondentes ao <strong>{anoSerie}</strong> nesta unidade escolar,
                    conforme assentamentos constantes no arquivo escolar e acervo permanente.
                  </p>
                )}

                {tipo === 'comparecimento' && (
                  <p>
                    Declaramos, para os devidos fins e comprovação de comparecimento, que o(a) Sr.(a){' '}
                    <strong>{(responsavelComparecimento || 'RESPONSÁVEL LEGAL').toUpperCase()}</strong>,
                    responsável pelo(a) aluno(a) <strong>{nomeFinal.toUpperCase()}</strong> ({anoSerie}),
                    compareceu a esta instituição de ensino na presente data, no período{' '}
                    <strong>{horarioComparecimento}</strong>, para tratar de assuntos pertinentes à vida
                    escolar e pedagógica do(a) discente.
                  </p>
                )}

                {tipo === 'conclusao' && (
                  <p>
                    Declaramos, para os devidos fins de direito, que <strong>{nomeFinal.toUpperCase()}</strong>,
                    nascido(a) em <strong>{dataNascFinal}</strong>, <strong>CONCLUIU</strong> com aproveitamento
                    o Ensino Fundamental nesta instituição de ensino no Ano Letivo de <strong>{anoLetivo}</strong>,
                    fazendo jus à emissão de seu Histórico Escolar definitivo nos termos da Lei de Diretrizes e Bases da Educação Nacional (LDB 9.394/96).
                  </p>
                )}

                <p className="timbre-finalidade">
                  A presente declaração é emitida para <strong>{finalidade}</strong>, tendo validade de 30 (trinta) dias a contar da data de sua expedição.
                </p>

                <p className="timbre-data-local">
                  Ponto dos Volantes — MG, {dataExtenso}.
                </p>
              </div>

              {/* Assinaturas */}
              <div className="timbre-assinaturas-row">
                <div className="assinatura-box">
                  <div className="linha-assinatura"></div>
                  <strong>Secretaria Escolar</strong>
                  <span>E.M. Maria Geralda Miranda Brito Salomão</span>
                </div>

                <div className="assinatura-box">
                  <div className="linha-assinatura"></div>
                  <strong>Direção Escolar</strong>
                  <span>MARCOS VINÍCIUS SENA SOUSA</span>
                </div>
              </div>

              {/* Rodapé institucional */}
              <div className="timbre-rodape">
                <p>Documento oficial emitido eletronicamente pelo Sistema Guia Escolar &bull; E.M. Maria Geralda Miranda Brito Salomão</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DeclaracoesModal;
