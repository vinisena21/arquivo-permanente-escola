import React, { useState, useMemo } from 'react';
import {
  ArrowRightLeft,
  Building,
  CheckCircle2,
  GraduationCap,
  MapPin,
  Printer,
  Search,
  UserCheck,
  UserPlus,
  AlertTriangle,
  X
} from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import escolasData from '../data/escolas.json';
import matriculasData from '../data/matriculas.json';
import turmasData from '../data/turmas.json';
import { inserirAlunoSecretaria } from '../lib/alunosSecretaria';
import './ImportarAlunoMunicipal.css';

interface ImportarAlunoMunicipalProps {
  onSucesso?: (mensagem: string) => void;
  onFechar?: () => void;
  escolaDestinoPadrao?: string;
}

export const ImportarAlunoMunicipal: React.FC<ImportarAlunoMunicipalProps> = ({
  onSucesso,
  onFechar,
  escolaDestinoPadrao
}) => {
  const { escolaAtiva } = useSchool();

  const [escolaOrigem, setEscolaOrigem] = useState<string>('TODAS');
  const [buscaAluno, setBuscaAluno] = useState<string>('');
  const [alunoSelecionado, setAlunoSelecionado] = useState<any | null>(null);

  // Destino
  const [escolaDestino, setEscolaDestino] = useState<string>(
    escolaDestinoPadrao || escolaAtiva
  );
  const [turmaDestino, setTurmaDestino] = useState<string>('');
  const [turnoDestino, setTurnoDestino] = useState<string>('MATUTINO');
  const [dataMovimentacao, setDataMovimentacao] = useState<string>(
    new Date().toLocaleDateString('pt-BR')
  );
  const [motivo, setMotivo] = useState<string>('TRANSFERÊNCIA ENTRE ESCOLAS DO MUNICÍPIO');
  const [observacoes, setObservacoes] = useState<string>('');

  const [processando, setProcessando] = useState<boolean>(false);
  const [sucessoConcluido, setSucessoConcluido] = useState<any | null>(null);
  const [erroMsg, setErroMsg] = useState<string>('');

  // Turmas da escola destino selecionada
  const turmasDisponiveis = useMemo(() => {
    const nomeNorm = escolaDestino.trim().toUpperCase();
    return (turmasData as any[]).filter(
      (t) => (t['Escola'] || '').trim().toUpperCase() === nomeNorm
    );
  }, [escolaDestino]);

  // Lista de alunos filtrados da origem
  const alunosFiltrados = useMemo(() => {
    const termo = buscaAluno.trim().toLowerCase();
    if (!termo && escolaOrigem === 'TODAS') {
      return [];
    }

    const origemNorm = escolaOrigem.trim().toUpperCase();

    return (matriculasData as any[])
      .filter((m) => {
        const escAluno = (m['Escola'] || '').trim().toUpperCase();
        if (escolaOrigem !== 'TODAS' && escAluno !== origemNorm) {
          return false;
        }

        if (!termo) return true;

        const nome = (m['Nome'] || '').toLowerCase();
        const cpf = (m['CPF'] || '').toLowerCase();
        const ra = (m['Registro do estudante (RA)'] || '').toLowerCase();
        const cod = (m['Código'] || '').toLowerCase();
        const codEst = (m['Código do estudante'] || '').toLowerCase();

        return (
          nome.includes(termo) ||
          cpf.includes(termo) ||
          ra.includes(termo) ||
          cod.includes(termo) ||
          codEst.includes(termo)
        );
      })
      .slice(0, 30); // Limita em 30 para fluidez máxima
  }, [buscaAluno, escolaOrigem]);

  // Atualizar turno padrão quando selecionar turma
  const handleSelecionarTurma = (nomeTurma: string) => {
    setTurmaDestino(nomeTurma);
    const turmaObj = turmasDisponiveis.find((t) => t.Turma === nomeTurma);
    if (turmaObj && turmaObj.Turno) {
      setTurnoDestino(turmaObj.Turno);
    }
  };

  // Confirmar Importação e Transferência
  const handleConfirmarImportacao = async () => {
    if (!alunoSelecionado) {
      setErroMsg('Selecione o estudante que deseja importar.');
      return;
    }
    if (!turmaDestino) {
      setErroMsg('Selecione a turma de destino na escola escolhida.');
      return;
    }
    if (
      escolaDestino.trim().toUpperCase() ===
        (alunoSelecionado['Escola'] || '').trim().toUpperCase() &&
      turmaDestino === alunoSelecionado['Turma']
    ) {
      setErroMsg('O aluno já está matriculado nesta mesma turma e escola.');
      return;
    }

    setProcessando(true);
    setErroMsg('');

    try {
      const novoCodigoMatricula = `IMP${Date.now().toString().slice(-6)}`;
      const codigoEscolaDestinoObj = (escolasData as any[]).find(
        (e) => e.Escola.trim().toUpperCase() === escolaDestino.trim().toUpperCase()
      );
      const codEscolaDestino = codigoEscolaDestinoObj?.Código || '22';

      // 1. Criar novo registro de matrícula para a escola de destino
      const novaMatricula = {
        ...alunoSelecionado,
        Código: novoCodigoMatricula,
        Turma: turmaDestino,
        Turno: turnoDestino,
        Escola: escolaDestino,
        'Código Escola': codEscolaDestino,
        Situação: 'NORMAL',
        'Data da matrícula': dataMovimentacao,
        'Data da movimentação': '',
        'Ano que ingressou na escola': String(new Date().getFullYear()),
        Observação: observacoes
          ? `${observacoes} - Transferido de ${alunoSelecionado['Escola']}`
          : `Transferência originada de ${alunoSelecionado['Escola']}`
      };

      // 2. Registrar movimentação de entrada/transferência
      const novaMovimentacao = {
        Código: `MOV${Date.now().toString().slice(-5)}`,
        Estudante: alunoSelecionado['Nome'],
        'Período de Origem': alunoSelecionado['Período'] || '',
        'Turma origem': alunoSelecionado['Turma'] || '',
        'Escola destino': escolaDestino,
        'Período destino': alunoSelecionado['Período'] || '',
        'Turma destino': turmaDestino,
        'Município destino': 'PONTO DOS VOLANTES',
        'Data da Movimentação': dataMovimentacao,
        Motivo: motivo,
        Responsável:
          alunoSelecionado['Filiação 1'] ||
          alunoSelecionado['Responsável'] ||
          'Responsável Legal',
        Situação: 'TRANSFERIDO',
        tipoMovimentacao: 'TRANSFERENCIA',
        escola: alunoSelecionado['Escola'] || escolaDestino,
        escolaOrigem: alunoSelecionado['Escola'],
        escolaDestino: escolaDestino
      };

      // 3. Salvar no localStorage de movimentações
      const salvosMov = localStorage.getItem('guia_escolar_movimentacoes_custom');
      const listaMov = salvosMov ? JSON.parse(salvosMov) : [];
      listaMov.unshift(novaMovimentacao);
      localStorage.setItem(
        'guia_escolar_movimentacoes_custom',
        JSON.stringify(listaMov)
      );

      // 4. Salvar no localStorage de matrículas customizadas
      const salvosMat = localStorage.getItem('guia_escolar_matriculas_custom');
      const listaMat = salvosMat ? JSON.parse(salvosMat) : [];
      listaMat.unshift(novaMatricula);
      localStorage.setItem(
        'guia_escolar_matriculas_custom',
        JSON.stringify(listaMat)
      );

      // 5. Sincronizar com Supabase se disponível
      try {
        await inserirAlunoSecretaria({
          codigo_matricula: novoCodigoMatricula,
          nome: alunoSelecionado['Nome'],
          data_nascimento: alunoSelecionado['Data de Nascimento']
            ? alunoSelecionado['Data de Nascimento'].split('/').reverse().join('-')
            : null,
          codigo_estudante: alunoSelecionado['Código do estudante'] || null,
          periodo: alunoSelecionado['Período'] || null,
          turma: turmaDestino,
          turno: turnoDestino,
          situacao: 'NORMAL',
          filiacao_1: alunoSelecionado['Filiação 1'] || null,
          filiacao_2: alunoSelecionado['Filiação 2'] || null
        });
      } catch (errSupabase) {
        console.warn('Aviso: Sincronização Supabase remota:', errSupabase);
      }

      setSucessoConcluido({
        aluno: alunoSelecionado['Nome'],
        origem: alunoSelecionado['Escola'],
        destino: escolaDestino,
        turma: turmaDestino,
        matricula: novoCodigoMatricula,
        data: dataMovimentacao
      });

      if (onSucesso) {
        onSucesso(
          `Aluno ${alunoSelecionado['Nome']} transferido com sucesso para ${escolaDestino} (Turma ${turmaDestino})!`
        );
      }
    } catch (err: any) {
      console.error(err);
      setErroMsg(err.message || 'Erro ao processar transferência.');
    } finally {
      setProcessando(false);
    }
  };

  const imprimirComprovante = () => {
    window.print();
  };

  return (
    <div className="importar-municipal-container">
      {/* Cabeçalho */}
      <div className="importar-header">
        <div className="importar-header-info">
          <div className="importar-badge-icon">
            <ArrowRightLeft size={24} />
          </div>
          <div>
            <h3>Importar Aluno de Outra Escola Municipal</h3>
            <p>
              Transfira ou matricule alunos de qualquer escola da rede de Ponto dos Volantes para a unidade de sua escolha.
            </p>
          </div>
        </div>
        {onFechar && (
          <button type="button" className="btn-fechar-modal" onClick={onFechar}>
            <X size={20} />
          </button>
        )}
      </div>

      {erroMsg && (
        <div className="importar-alerta-erro">
          <AlertTriangle size={18} />
          <span>{erroMsg}</span>
        </div>
      )}

      {/* Tela de Sucesso */}
      {sucessoConcluido ? (
        <div className="importar-sucesso-card">
          <div className="sucesso-icone-circulo">
            <CheckCircle2 size={48} />
          </div>
          <h4>Transferência Realizada com Sucesso!</h4>
          <p>
            O estudante <strong>{sucessoConcluido.aluno}</strong> foi matriculado com sucesso na unidade{' '}
            <strong>{sucessoConcluido.destino}</strong>.
          </p>

          <div className="sucesso-detalhes-grid">
            <div className="sucesso-item">
              <span>Escola de Origem</span>
              <strong>{sucessoConcluido.origem}</strong>
            </div>
            <div className="sucesso-item">
              <span>Escola de Destino</span>
              <strong>{sucessoConcluido.destino}</strong>
            </div>
            <div className="sucesso-item">
              <span>Turma Atribuída</span>
              <strong>Turma {sucessoConcluido.turma}</strong>
            </div>
            <div className="sucesso-item">
              <span>Nova Matrícula</span>
              <strong>{sucessoConcluido.matricula}</strong>
            </div>
            <div className="sucesso-item">
              <span>Data da Movimentação</span>
              <strong>{sucessoConcluido.data}</strong>
            </div>
          </div>

          <div className="sucesso-botoes">
            <button
              type="button"
              className="btn-imprimir-guia"
              onClick={imprimirComprovante}
            >
              <Printer size={16} /> Imprimir Guia de Transferência
            </button>
            <button
              type="button"
              className="btn-novo-import"
              onClick={() => {
                setSucessoConcluido(null);
                setAlunoSelecionado(null);
                setBuscaAluno('');
              }}
            >
              <UserPlus size={16} /> Importar Outro Aluno
            </button>
          </div>
        </div>
      ) : (
        <div className="importar-grid-conteudo">
          {/* Coluna 1: Busca e Seleção do Aluno */}
          <div className="importar-coluna-origem">
            <div className="importar-secao-titulo">
              <span className="passo-numero">1</span>
              <div>
                <strong>Localizar Estudante na Rede Municipal</strong>
                <small>Selecione a escola de origem e busque pelo nome ou documento</small>
              </div>
            </div>

            <div className="campo-grupo">
              <label htmlFor="escola-origem-select">Escola de Origem:</label>
              <select
                id="escola-origem-select"
                className="select-customizado"
                value={escolaOrigem}
                onChange={(e) => {
                  setEscolaOrigem(e.target.value);
                  setAlunoSelecionado(null);
                }}
              >
                <option value="TODAS">-- Todas as Escolas Municipais --</option>
                {(escolasData as any[]).map((esc) => (
                  <option key={esc.Código} value={esc.Escola}>
                    {esc.Escola}
                  </option>
                ))}
              </select>
            </div>

            <div className="campo-grupo">
              <label htmlFor="busca-aluno-input">Buscar Aluno:</label>
              <div className="input-com-icone">
                <Search size={16} />
                <input
                  id="busca-aluno-input"
                  type="text"
                  placeholder="Nome, CPF, RA ou código da matrícula..."
                  value={buscaAluno}
                  onChange={(e) => setBuscaAluno(e.target.value)}
                />
              </div>
            </div>

            {/* Lista de Resultados */}
            <div className="lista-alunos-resultados">
              {alunosFiltrados.length === 0 ? (
                <div className="sem-resultados">
                  {buscaAluno
                    ? 'Nenhum estudante encontrado com esses critérios.'
                    : 'Digite o nome do aluno ou selecione uma escola acima.'}
                </div>
              ) : (
                alunosFiltrados.map((m) => {
                  const isSelected =
                    alunoSelecionado && alunoSelecionado.Código === m.Código;
                  return (
                    <div
                      key={m.Código}
                      className={`card-aluno-resultado ${isSelected ? 'selecionado' : ''}`}
                      onClick={() => setAlunoSelecionado(m)}
                    >
                      <div className="aluno-res-header">
                        <strong>{m.Nome}</strong>
                        <span className={`badge-situacao ${m.Situação === 'NORMAL' ? 'normal' : 'transf'}`}>
                          {m.Situação || 'NORMAL'}
                        </span>
                      </div>
                      <div className="aluno-res-detalhes">
                        <span>
                          <Building size={12} /> {m.Escola}
                        </span>
                        <span>Turma: {m.Turma || '-'}</span>
                        <span>Nasc: {m['Data de Nascimento'] || '-'}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Coluna 2: Dados do Aluno & Destino */}
          <div className="importar-coluna-destino">
            {alunoSelecionado ? (
              <>
                <div className="ficha-resumo-aluno">
                  <div className="ficha-resumo-topo">
                    <div className="ficha-avatar">
                      <GraduationCap size={24} />
                    </div>
                    <div>
                      <h4>{alunoSelecionado.Nome}</h4>
                      <p>
                        RA: {alunoSelecionado['Registro do estudante (RA)'] || '-'} &bull; Nasc:{' '}
                        {alunoSelecionado['Data de Nascimento'] || '-'}
                      </p>
                    </div>
                  </div>

                  <div className="ficha-grid-info">
                    <div>
                      <span>Mãe (Filiação 1):</span>
                      <strong>{alunoSelecionado['Filiação 1'] || 'Não informada'}</strong>
                    </div>
                    <div>
                      <span>Pai (Filiação 2):</span>
                      <strong>{alunoSelecionado['Filiação 2'] || 'Não informado'}</strong>
                    </div>
                    <div>
                      <span>CPF:</span>
                      <strong>{alunoSelecionado['CPF'] || 'Não informado'}</strong>
                    </div>
                    <div>
                      <span>Cartão SUS:</span>
                      <strong>{alunoSelecionado['Nº do Cartão Nacional do SUS'] || '-'}</strong>
                    </div>
                  </div>

                  {/* Endereço Completo */}
                  <div className="ficha-endereco-bloco">
                    <MapPin size={16} />
                    <div>
                      <strong>Endereço Cadastrado:</strong>
                      <p>
                        {alunoSelecionado['Tipo Logradouro'] || 'Rua'}{' '}
                        {alunoSelecionado['Logradouro'] || 'Zona Rural'}, Nº{' '}
                        {alunoSelecionado['Número'] || 'SN'} &bull; Bairro:{' '}
                        {alunoSelecionado['Bairro'] || 'Zona Rural'} &bull; CEP:{' '}
                        {alunoSelecionado['Cep'] || '39.615-000'} &bull;{' '}
                        {alunoSelecionado['Município'] || 'Ponto dos Volantes'} -{' '}
                        {alunoSelecionado['Estado'] || 'MG'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Configuração de Destino */}
                <div className="importar-secao-titulo">
                  <span className="passo-numero">2</span>
                  <div>
                    <strong>Definir Escola e Turma de Destino</strong>
                    <small>Escolha para qual escola e turma o aluno será matriculado</small>
                  </div>
                </div>

                <div className="form-grid-destino">
                  <div className="campo-grupo">
                    <label htmlFor="escola-destino-select">Escola de Destino:</label>
                    <select
                      id="escola-destino-select"
                      className="select-customizado"
                      value={escolaDestino}
                      onChange={(e) => {
                        setEscolaDestino(e.target.value);
                        setTurmaDestino('');
                      }}
                    >
                      {(escolasData as any[]).map((esc) => (
                        <option key={esc.Código} value={esc.Escola}>
                          {esc.Escola}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="campo-grupo">
                    <label htmlFor="turma-destino-select">Turma de Destino (*):</label>
                    <select
                      id="turma-destino-select"
                      className="select-customizado"
                      value={turmaDestino}
                      onChange={(e) => handleSelecionarTurma(e.target.value)}
                    >
                      <option value="">-- Selecione a Turma --</option>
                      {turmasDisponiveis.map((t, idx) => (
                        <option key={idx} value={t.Turma}>
                          {t.Turma} ({t.Turno || 'MATUTINO'}) - {t.Descrição || t.Turma}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="campo-grupo">
                    <label htmlFor="turno-destino-select">Turno:</label>
                    <select
                      id="turno-destino-select"
                      className="select-customizado"
                      value={turnoDestino}
                      onChange={(e) => setTurnoDestino(e.target.value)}
                    >
                      <option value="MATUTINO">Matutino</option>
                      <option value="VESPERTINO">Vespertino</option>
                      <option value="INTEGRAL">Integral</option>
                      <option value="NOTURNO">Noturno</option>
                    </select>
                  </div>

                  <div className="campo-grupo">
                    <label htmlFor="data-mov-input">Data da Matrícula/Transferência:</label>
                    <input
                      id="data-mov-input"
                      type="text"
                      className="input-customizado"
                      value={dataMovimentacao}
                      onChange={(e) => setDataMovimentacao(e.target.value)}
                    />
                  </div>
                </div>

                <div className="campo-grupo">
                  <label htmlFor="motivo-select">Motivo da Transferência:</label>
                  <select
                    id="motivo-select"
                    className="select-customizado"
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                  >
                    <option value="TRANSFERÊNCIA ENTRE ESCOLAS DO MUNICÍPIO">
                      Transferência entre escolas do município
                    </option>
                    <option value="MUDANÇA DE ENDEREÇO">Mudança de endereço</option>
                    <option value="SOLICITAÇÃO DOS PAIS OU RESPONSÁVEIS">
                      Solicitação dos pais ou responsáveis
                    </option>
                    <option value="REORGANIZAÇÃO DA REDE ESCOLAR">
                      Reorganização da rede escolar
                    </option>
                    <option value="PROXIMIDADE DA RESIDÊNCIA">
                      Proximidade da residência
                    </option>
                  </select>
                </div>

                <div className="campo-grupo">
                  <label htmlFor="obs-input">Observações adicionais:</label>
                  <input
                    id="obs-input"
                    type="text"
                    className="input-customizado"
                    placeholder="Ex: Documentos apresentados, transporte escolar solicitado..."
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                  />
                </div>

                <div className="acoes-importar">
                  <button
                    type="button"
                    className="btn-confirmar-transferencia"
                    disabled={processando || !turmaDestino}
                    onClick={handleConfirmarImportacao}
                  >
                    <UserCheck size={18} />
                    {processando
                      ? 'Processando Transferência...'
                      : `Matricular na Escola ${escolaDestino.split(' ')[1] || ''}`}
                  </button>
                </div>
              </>
            ) : (
              <div className="aviso-selecione-aluno">
                <UserPlus size={40} />
                <h4>Nenhum aluno selecionado</h4>
                <p>
                  Pesquise e clique em um aluno na lista ao lado para carregar sua ficha cadastral, endereço e definir a turma de destino.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ImportarAlunoMunicipal;
