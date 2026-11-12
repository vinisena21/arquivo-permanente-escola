import React, { useState, useId, useMemo } from 'react';
import {
  FileText,
  Printer,
  X,
  Search,
  Sparkles,
  Edit3,
  User,
  ShieldCheck,
  Eye
} from 'lucide-react';
import type { AlunoArquivo } from '../types/database';
import matriculasData from '../data/matriculas.json';
import './DeclaracoesModal.css';

export type TipoDeclaracao =
  | 'matricula'
  | 'transferencia'
  | 'escolaridade'
  | 'comparecimento'
  | 'conclusao'
  | 'transporte'
  | 'personalizada';

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
  
  // Dados do Estudante selecionado ou preenchido
  const [nomeAluno, setNomeAluno] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [filiacao, setFiliacao] = useState('');
  const [matriculaCodigo, setMatriculaCodigo] = useState('');
  const [pastaArquivo, setPastaArquivo] = useState('');
  const [prontuarioNum, setProntuarioNum] = useState('');
  const [anoSerie, setAnoSerie] = useState('9º Ano do Ensino Fundamental');
  const [turma, setTurma] = useState('901');
  const [turno, setTurno] = useState('Matutino');
  const [anoLetivo, setAnoLetivo] = useState('2026');
  
  // Campos específicos
  const [finalidade, setFinalidade] = useState('fins de comprovação junto a órgãos públicos e programas sociais');
  const [responsavelComparecimento, setResponsavelComparecimento] = useState('');
  const [horarioComparecimento, setHorarioComparecimento] = useState('das 08:00 às 11:30 horas');
  const [escolaDestinoTransf, setEscolaDestinoTransf] = useState('');
  const [municipioDestinoTransf, setMunicipioDestinoTransf] = useState('');
  const [comunidadeRural, setComunidadeRural] = useState('');
  
  // Modo de texto customizado / editável
  const [modoTextoManual, setModoTextoManual] = useState(false);
  const [textoPersonalizado, setTextoPersonalizado] = useState('');
  const [visualizandoImpressao, setVisualizandoImpressao] = useState(false);

  const selectTipoId = useId();
  const inputBuscaId = useId();

  // Autocomplete combinando Alunos do Arquivo Permanente + Alunos Ativos do SIGP (matriculas.json)
  const sugestoesAlunos = useMemo(() => {
    if (!buscaAluno.trim()) return [];
    const termo = buscaAluno.toLowerCase().trim();

    // 1. Busca nas matrículas ativas da escola
    const resultadosMatriculas = matriculasData
      .filter(m => m.Nome.toLowerCase().includes(termo))
      .slice(0, 6)
      .map(m => ({
        id: `matr-${m.Código}`,
        nome: m.Nome,
        dataNasc: m['Data de Nascimento'] || '',
        filiacao: [m['Filiação 1'], m['Filiação 2']].filter(Boolean).join(' e '),
        turma: m.Turma || '',
        periodo: m.Período || '',
        turno: m.Turno || 'Matutino',
        matricula: m.Código,
        origem: 'Secretaria (Ativo)' as const,
        pasta: '',
        numero: ''
      }));

    // 2. Busca no arquivo permanente se couber
    const resultadosArquivo = alunos
      .filter(a => a.nome.toLowerCase().includes(termo))
      .slice(0, 4)
      .map(a => ({
        id: `arq-${a.id}`,
        nome: a.nome,
        dataNasc: a.dataNascimento || '',
        filiacao: '',
        turma: '',
        periodo: '',
        turno: 'Matutino',
        matricula: '',
        origem: 'Arquivo Permanente' as const,
        pasta: a.codigoPasta,
        numero: String(a.numero).padStart(2, '0')
      }));

    return [...resultadosMatriculas, ...resultadosArquivo];
  }, [buscaAluno, alunos]);

  function selecionarSugestao(item: (typeof sugestoesAlunos)[0]) {
    setNomeAluno(item.nome);
    setDataNascimento(item.dataNasc);
    setFiliacao(item.filiacao);
    setMatriculaCodigo(item.matricula);
    setPastaArquivo(item.pasta);
    setProntuarioNum(item.numero);
    if (item.turma) setTurma(item.turma);
    if (item.periodo) setAnoSerie(item.periodo);
    if (item.turno) setTurno(item.turno.charAt(0).toUpperCase() + item.turno.slice(1).toLowerCase());
    setBuscaAluno(item.nome);
    setModoTextoManual(false);
  }

  const dataExtenso = useMemo(() => {
    return new Intl.DateTimeFormat('pt-BR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(new Date());
  }, []);

  // Gera o texto padrão formal para cada tipo de modelo de declaração
  const textoPadraoGerado = useMemo(() => {
    const nome = nomeAluno ? nomeAluno.toUpperCase() : 'NOME DO(A) ESTUDANTE';
    const nasc = dataNascimento || '___/___/______';
    const fil = filiacao ? `, filho(a) de ${filiacao}` : '';
    const identMatr = matriculaCodigo ? `, matrícula nº ${matriculaCodigo}` : '';
    const identPasta = pastaArquivo ? `, registrado(a) sob a Pasta ${pastaArquivo}${prontuarioNum ? `, Prontuário nº ${prontuarioNum}` : ''}` : '';
    const serie = anoSerie || '9º Ano do Ensino Fundamental';
    const t = turma ? ` - Turma ${turma}` : '';
    const tur = turno || 'Matutino';
    const letivo = anoLetivo || '2026';

    switch (tipo) {
      case 'matricula':
        return `Declaramos, para os devidos fins de direito a que se fizer necessário ou a pedido da parte interessada, que o(a) estudante ${nome}, nascido(a) em ${nasc}${fil}${identMatr}${identPasta}, encontra-se regularmente MATRICULADO(A) e com frequência ativa nesta unidade escolar no ${serie}${t}, turno ${tur}, durante o Ano Letivo de ${letivo}, cumprindo a carga horária curricular prevista na legislação vigente.`;

      case 'transferencia': {
        const destEscola = escolaDestinoTransf ? ` para a instituição ${escolaDestinoTransf.toUpperCase()}` : '';
        const destMun = municipioDestinoTransf ? ` no município de ${municipioDestinoTransf.toUpperCase()}` : '';
        return `Declaramos, a pedido da parte interessada e para fins de matrícula por transferência, que o(a) estudante ${nome}, nascido(a) em ${nasc}${fil}${identMatr}, esteve regularmente matriculado(a) e com frequência ativa nesta escola no ${serie}${t}, turno ${tur}, durante o Ano Letivo de ${letivo}, tendo solicitado transferência em ${new Date().toLocaleDateString('pt-BR')}${destEscola}${destMun}. Declaramos ainda que o Histórico Escolar definitivo e a documentação pertinente serão expedidos dentro do prazo regulamentar de até 30 (trinta) dias.`;
      }

      case 'escolaridade':
        return `Declaramos, para os devidos fins de comprovação de escolaridade, que o(a) estudante ${nome}, nascido(a) em ${nasc}${fil}${identMatr}${identPasta}, cursou e obteve aproveitamento escolar correspondente ao ${serie}${t}, no turno ${tur}, na Escola Municipal Maria Geralda Miranda Brito Salomão, no Ano Letivo de ${letivo}, estando apto(a) a prosseguir seus estudos na etapa subsequente, conforme registros do arquivo escolar.`;

      case 'conclusao':
        return `Declaramos, para os devidos fins a que se fizerem necessários, que o(a) educando(a) ${nome}, nascido(a) em ${nasc}${fil}${identMatr}, CONCLUIU com aproveitamento satisfatório o 9º Ano do Ensino Fundamental Regular nesta instituição de ensino no Ano Letivo de ${letivo}, cumprindo 200 dias letivos e carga horária superior a 800 horas, nos termos da Lei de Diretrizes e Bases da Educação Nacional (LDB 9.394/96).`;

      case 'comparecimento': {
        const resp = responsavelComparecimento ? responsavelComparecimento.toUpperCase() : 'PAI / MÃE / RESPONSÁVEL LEGAL';
        return `Declaramos, para os devidos fins e comprovação junto ao trabalho ou órgão solicitante, que o(a) Sr.(a) ${resp}, responsável pelo(a) estudante ${nome}, regularmente matriculado(a) no ${serie}${t}, compareceu a esta instituição de ensino na data de hoje, no horário ${horarioComparecimento}, a fim de tratar de assuntos pedagógicos e administrativos de interesse escolar do(a) discente.`;
      }

      case 'transporte': {
        const com = comunidadeRural ? `residente na comunidade de ${comunidadeRural.toUpperCase()}` : 'residente em Zona Rural';
        return `Declaramos, para os devidos fins de acesso e garantia do Programa Municipal de Transporte Escolar, que o(a) estudante ${nome}, nascido(a) em ${nasc}${fil}, ${com}, município de Ponto dos Volantes - MG, encontra-se devidamente matriculado(a) no ${serie}${t}, turno ${tur}, dependendo diariamente de linha de transporte escolar rural para o deslocamento até o estabelecimento de ensino.`;
      }

      case 'personalizada':
      default:
        return textoPersonalizado || `Declaramos, para os devidos fins a que se fizer necessário, que o(a) estudante ${nome}, nascido(a) em ${nasc}${fil}, encontra-se com situação regular nesta instituição de ensino para o Ano Letivo de ${letivo}.`;
    }
  }, [
    tipo,
    nomeAluno,
    dataNascimento,
    filiacao,
    matriculaCodigo,
    pastaArquivo,
    anoSerie,
    turma,
    turno,
    anoLetivo,
    escolaDestinoTransf,
    municipioDestinoTransf,
    responsavelComparecimento,
    horarioComparecimento,
    comunidadeRural,
    textoPersonalizado
  ]);

  // Texto atualmente ativo para o documento
  const textoFinalDocumento = modoTextoManual ? textoPersonalizado : textoPadraoGerado;

  const tituloDocumento = useMemo(() => {
    switch (tipo) {
      case 'matricula':
        return 'DECLARAÇÃO DE MATRÍCULA E FREQUÊNCIA';
      case 'transferencia':
        return 'DECLARAÇÃO DE TRANSFERÊNCIA PROVISÓRIA';
      case 'escolaridade':
        return 'DECLARAÇÃO DE ESCOLARIDADE';
      case 'conclusao':
        return 'DECLARAÇÃO DE CONCLUSÃO DO ENSINO FUNDAMENTAL';
      case 'comparecimento':
        return 'DECLARAÇÃO DE COMPARECIMENTO';
      case 'transporte':
        return 'DECLARAÇÃO DE TRANSPORTE ESCOLAR RURAL';
      case 'personalizada':
      default:
        return 'DECLARAÇÃO ESCOLAR OFICIAL';
    }
  }, [tipo]);

  function handleImprimir() {
    window.print();
  }

  if (!isOpen) return null;

  return (
    <div className="declaracoes-overlay">
      <div className={`declaracoes-modal ${visualizandoImpressao ? 'modo-impressao-preview' : ''}`}>
        
        {/* Header do Modal */}
        <div className="declaracoes-modal-header no-print">
          <div className="declaracoes-modal-titulo">
            <div className="modal-icon-badge">
              <FileText size={22} color="#2563eb" />
            </div>
            <div>
              <h3>Emissor Oficial de Modelos de Declaração</h3>
              <p>E.M. MARIA GERALDA MIRANDA BRITO SALOMÃO &bull; Ponto dos Volantes - MG</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="declaracoes-btn-fechar" title="Fechar janela">
            <X size={20} />
          </button>
        </div>

        {/* ========================================================
            ETAPA 1: CONFIGURAÇÃO DO MODELO DE DECLARAÇÃO
            ======================================================== */}
        {!visualizandoImpressao ? (
          <div className="declaracoes-form-body">
            
            {/* Escolha do Modelo Oficial */}
            <div className="decl-campo-grupo">
              <label htmlFor={selectTipoId}>
                <Sparkles size={16} color="#2563eb" /> Selecione o Modelo Oficial de Declaração:
              </label>
              <select
                id={selectTipoId}
                value={tipo}
                onChange={(e) => {
                  setTipo(e.target.value as TipoDeclaracao);
                  setModoTextoManual(false);
                }}
                className="decl-select-tipo"
              >
                <option value="matricula">1. Declaração de Matrícula e Frequência Regular (Bolsa Família / INSS)</option>
                <option value="transferencia">2. Declaração de Transferência Provisória (Validade de 30 dias)</option>
                <option value="escolaridade">3. Declaração de Escolaridade e Cursamento</option>
                <option value="conclusao">4. Declaração de Conclusão do 9º Ano (Ensino Fundamental)</option>
                <option value="comparecimento">5. Declaração de Comparecimento de Pai / Mãe / Responsável</option>
                <option value="transporte">6. Declaração de Transporte Escolar / Zona Rural</option>
                <option value="personalizada">7. Modelo Livre / Texto Personalizado pela Secretaria</option>
              </select>
            </div>

            {/* Busca Rápida Unificada */}
            <div className="decl-campo-grupo">
              <label htmlFor={inputBuscaId}>
                <Search size={15} /> Localizar Estudante (Matrícula Ativa ou Arquivo Permanente):
              </label>
              <div className="decl-input-com-icone">
                <Search size={16} />
                <input
                  id={inputBuscaId}
                  type="text"
                  placeholder="Digite o nome do estudante para auto-preencher todos os dados..."
                  value={buscaAluno}
                  onChange={(e) => setBuscaAluno(e.target.value)}
                />
              </div>

              {sugestoesAlunos.length > 0 && (
                <div className="decl-autocomplete-lista">
                  {sugestoesAlunos.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      className="decl-autocomplete-item"
                      onClick={() => selecionarSugestao(item)}
                    >
                      <User size={16} color="#2563eb" />
                      <div className="sugestao-info">
                        <strong>{item.nome}</strong>
                        <span>
                          {item.origem} {item.matricula ? `&bull; Matr. ${item.matricula}` : ''}{' '}
                          {item.turma ? `&bull; Turma ${item.turma}` : ''}{' '}
                          {item.pasta ? `&bull; Pasta ${item.pasta} (Nº ${item.numero})` : ''}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Grid com Dados do Estudante */}
            <div className="decl-grid-campos">
              <div className="decl-campo-grupo span-2">
                <label>Nome Completo do Estudante:</label>
                <input
                  type="text"
                  value={nomeAluno}
                  onChange={(e) => setNomeAluno(e.target.value)}
                  placeholder="Nome do aluno..."
                />
              </div>

              <div className="decl-campo-grupo">
                <label>Data de Nascimento:</label>
                <input
                  type="text"
                  value={dataNascimento}
                  onChange={(e) => setDataNascimento(e.target.value)}
                  placeholder="DD/MM/AAAA"
                />
              </div>

              <div className="decl-campo-grupo">
                <label>Matrícula / SIGP:</label>
                <input
                  type="text"
                  value={matriculaCodigo}
                  onChange={(e) => setMatriculaCodigo(e.target.value)}
                  placeholder="Ex: 35683"
                />
              </div>

              <div className="decl-campo-grupo span-2">
                <label>Filiação (Mãe / Pai):</label>
                <input
                  type="text"
                  value={filiacao}
                  onChange={(e) => setFiliacao(e.target.value)}
                  placeholder="Nome dos genitores..."
                />
              </div>

              <div className="decl-campo-grupo">
                <label>Ano / Etapa de Ensino:</label>
                <input
                  type="text"
                  value={anoSerie}
                  onChange={(e) => setAnoSerie(e.target.value)}
                  placeholder="Ex: 9º Ano do Ensino Fundamental"
                />
              </div>

              <div className="decl-campo-grupo">
                <label>Turma & Turno:</label>
                <div className="mini-dupla">
                  <input
                    type="text"
                    value={turma}
                    onChange={(e) => setTurma(e.target.value)}
                    placeholder="Turma (ex: 901)"
                  />
                  <select value={turno} onChange={(e) => setTurno(e.target.value)}>
                    <option value="Matutino">Matutino</option>
                    <option value="Vespertino">Vespertino</option>
                    <option value="Integral">Integral</option>
                  </select>
                </div>
              </div>

              <div className="decl-campo-grupo">
                <label>Ano Letivo:</label>
                <input
                  type="text"
                  value={anoLetivo}
                  onChange={(e) => setAnoLetivo(e.target.value)}
                  placeholder="2026"
                />
              </div>
            </div>

            {/* Campos Específicos por Tipo */}
            {tipo === 'transferencia' && (
              <div className="decl-box-destaque">
                <div className="decl-grid-campos">
                  <div className="decl-campo-grupo">
                    <label>Escola de Destino:</label>
                    <input
                      type="text"
                      value={escolaDestinoTransf}
                      onChange={(e) => setEscolaDestinoTransf(e.target.value)}
                      placeholder="Ex: Escola Estadual..."
                    />
                  </div>
                  <div className="decl-campo-grupo">
                    <label>Município de Destino:</label>
                    <input
                      type="text"
                      value={municipioDestinoTransf}
                      onChange={(e) => setMunicipioDestinoTransf(e.target.value)}
                      placeholder="Ex: Jequitinhonha, Itinga, Medina..."
                    />
                  </div>
                </div>
              </div>
            )}

            {tipo === 'comparecimento' && (
              <div className="decl-box-destaque">
                <div className="decl-grid-campos">
                  <div className="decl-campo-grupo">
                    <label>Nome do Responsável / Comparecente:</label>
                    <input
                      type="text"
                      value={responsavelComparecimento}
                      onChange={(e) => setResponsavelComparecimento(e.target.value)}
                      placeholder="Nome de quem compareceu à escola..."
                    />
                  </div>
                  <div className="decl-campo-grupo">
                    <label>Horário do Comparecimento:</label>
                    <input
                      type="text"
                      value={horarioComparecimento}
                      onChange={(e) => setHorarioComparecimento(e.target.value)}
                      placeholder="Ex: das 08:00 às 11:30 horas"
                    />
                  </div>
                </div>
              </div>
            )}

            {tipo === 'transporte' && (
              <div className="decl-box-destaque">
                <div className="decl-campo-grupo">
                  <label>Comunidade Rural / Distrito de Residência:</label>
                  <input
                    type="text"
                    value={comunidadeRural}
                    onChange={(e) => setComunidadeRural(e.target.value)}
                    placeholder="Ex: Córrego do Ouro, Santana, etc."
                  />
                </div>
              </div>
            )}

            <div className="decl-campo-grupo">
              <label>Finalidade da Declaração:</label>
              <input
                type="text"
                value={finalidade}
                onChange={(e) => setFinalidade(e.target.value)}
                placeholder="Ex: fins de solicitação de benefício / trabalho / comprovação..."
              />
            </div>

            {/* Opção para Editar o Texto Diretamente */}
            <div className="decl-editor-toggle-row">
              <button
                type="button"
                className="btn-toggle-editor"
                onClick={() => {
                  if (!modoTextoManual) {
                    setTextoPersonalizado(textoPadraoGerado);
                  }
                  setModoTextoManual(!modoTextoManual);
                }}
              >
                <Edit3 size={15} />
                {modoTextoManual ? 'Voltar ao Texto Gerado Automaticamente' : 'Personalizar Texto da Declaração'}
              </button>
            </div>

            {modoTextoManual && (
              <div className="decl-campo-grupo">
                <label>Edição Livre do Conteúdo da Declaração:</label>
                <textarea
                  rows={4}
                  value={textoPersonalizado}
                  onChange={(e) => setTextoPersonalizado(e.target.value)}
                  className="textarea-personalizado"
                />
              </div>
            )}

            {/* Ações do Formulário */}
            <div className="decl-modal-actions no-print">
              <button type="button" onClick={onClose} className="decl-btn-secundario">
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => setVisualizandoImpressao(true)}
                className="decl-btn-primario"
              >
                <Eye size={18} />
                Visualizar Declaração em Folha A4
              </button>
            </div>
          </div>
        ) : (
          /* ========================================================
             ETAPA 2: PRÉ-VISUALIZAÇÃO DA FOLHA A4 TIMBRADA OFICIAL
             (CALIBRADA EXATAMENTE PARA 1 PÁGINA)
             ======================================================== */
          <div className="declaracoes-preview-wrapper">
            <div className="declaracoes-preview-barra no-print">
              <button
                type="button"
                onClick={() => setVisualizandoImpressao(false)}
                className="decl-btn-secundario"
              >
                &larr; Voltar e Alterar Dados
              </button>
              <div className="preview-aviso-1folha">
                <ShieldCheck size={16} color="#15803d" />
                <span>Formato calibrado: Impressão exata em 1 página A4</span>
              </div>
              <button
                type="button"
                onClick={handleImprimir}
                className="decl-btn-primario"
              >
                <Printer size={18} />
                Imprimir Declaração (1 Folha)
              </button>
            </div>

            {/* FOLHA TIMBRADA A4 OFICIAL */}
            <div className="folha-timbrada-a4">
              
              {/* CABEÇALHO OFICIAL DO ESTADO E MUNICÍPIO */}
              <div className="timbre-cabecalho">
                <div className="timbre-brasao-box">
                  <div className="brasao-triangulo-mg">MG</div>
                </div>
                <div className="timbre-titulos">
                  <h2>ESTADO DE MINAS GERAIS</h2>
                  <h3>PREFEITURA MUNICIPAL DE PONTO DOS VOLANTES</h3>
                  <h4>SECRETARIA MUNICIPAL DE EDUCAÇÃO</h4>
                  <h1>ESCOLA MUNICIPAL MARIA GERALDA MIRANDA BRITO SALOMÃO</h1>
                  <p className="timbre-codigo">
                    CÓDIGO INEP: 31054366 &bull; RECONHECIMENTO: PORTARIA SEE/MG &bull; ENSINO FUNDAMENTAL
                  </p>
                  <p className="timbre-endereco">
                    Praça Central, S/N &bull; Ponto dos Volantes — MG &bull; CEP: 39.615-000
                  </p>
                </div>
              </div>

              {/* TÍTULO DO DOCUMENTO */}
              <div className="timbre-doc-titulo-box">
                <div className="timbre-doc-titulo">{tituloDocumento}</div>
              </div>

              {/* CORPO FORMAL DO TEXTO DA DECLARAÇÃO */}
              <div className="timbre-corpo-texto">
                <p className="paragrafo-declaracao">
                  {textoFinalDocumento}
                </p>

                <p className="paragrafo-finalidade">
                  A presente declaração é expedida para <strong>{finalidade}</strong>, tendo validade jurídica de 30 (trinta) dias a contar da data de sua emissão oficial.
                </p>
              </div>

              {/* LOCAL E DATA */}
              <div className="timbre-data-local">
                Ponto dos Volantes — MG, {dataExtenso}.
              </div>

              {/* ASSINATURAS LEGAIS */}
              <div className="timbre-assinaturas-row">
                <div className="assinatura-box">
                  <div className="linha-assinatura"></div>
                  <strong>Secretaria Escolar</strong>
                  <span>E.M. Maria Geralda M. B. Salomão</span>
                  <small>Registro Escolar</small>
                </div>

                <div className="assinatura-box">
                  <div className="linha-assinatura"></div>
                  <strong>Direção Escolar</strong>
                  <span>E.M. Maria Geralda M. B. Salomão</span>
                  <small>Ato de Designação</small>
                </div>
              </div>

              {/* RODAPÉ INSTITUCIONAL */}
              <div className="timbre-rodape">
                <p>
                  Documento emitido eletronicamente pelo Sistema Oficial Guia Escolar &bull; Autenticidade verificável nos assentamentos do Arquivo Permanente
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DeclaracoesModal;
