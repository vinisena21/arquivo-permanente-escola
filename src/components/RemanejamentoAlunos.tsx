import React, { useState, useMemo } from 'react';
import {
  ArrowRightLeft,
  Users,
  Search,
  Plus,
  Printer,
  Download,
  Building,
  FileText,
  MapPin
} from 'lucide-react';
import movimentacoesData from '../data/movimentacoes.json';
import matriculasData from '../data/matriculas.json';
import turmasData from '../data/turmas.json';
import escolasData from '../data/escolas.json';
import './RemanejamentoAlunos.css';

interface RemanejamentoAlunosProps {
  onToast?: (toast: { message: string; type: 'success' | 'error' }) => void;
}

export interface MovimentacaoRegistro {
  Código: string;
  Estudante: string;
  'Período de Origem': string;
  'Turma origem': string;
  'Escola destino': string;
  'Período destino': string;
  'Turma destino': string;
  'Município destino': string;
  'Data da Movimentação': string;
  Motivo: string;
  Responsável: string;
  Situação: string;
  tipoMovimentacao?: 'TRANSFERENCIA' | 'REMANEJAMENTO';
}

export const RemanejamentoAlunos: React.FC<RemanejamentoAlunosProps> = ({ onToast }) => {
  const [busca, setBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'transferencia' | 'remanejamento'>('todos');
  const [modalNovo, setModalNovo] = useState(false);
  const [guiaSelecionada, setGuiaSelecionada] = useState<MovimentacaoRegistro | null>(null);

  // Carrega movimentações (iniciando com o JSON oficial + localStorage)
  const [movimentacoes, setMovimentacoes] = useState<MovimentacaoRegistro[]>(() => {
    const salvo = localStorage.getItem('guia_escolar_movimentacoes_custom');
    const custom: MovimentacaoRegistro[] = salvo ? JSON.parse(salvo) : [];
    // Mapeia os dados existentes
    const base: MovimentacaoRegistro[] = movimentacoesData.map(m => ({
      ...m,
      tipoMovimentacao: m['Turma destino'] ? 'REMANEJAMENTO' : 'TRANSFERENCIA'
    }));
    return [...custom, ...base];
  });

  // Salvar no localStorage quando novas movimentações forem criadas
  function salvarCustom(lista: MovimentacaoRegistro[]) {
    const apenasNovos = lista.filter(item => !movimentacoesData.some(orig => orig.Código === item.Código));
    localStorage.setItem('guia_escolar_movimentacoes_custom', JSON.stringify(apenasNovos));
  }

  // Filtragem
  const movimentacoesFiltradas = useMemo(() => {
    const termo = busca.toLowerCase().trim();
    return movimentacoes.filter(item => {
      const matchBusca =
        !termo ||
        item.Estudante.toLowerCase().includes(termo) ||
        item.Motivo.toLowerCase().includes(termo) ||
        (item.Responsável || '').toLowerCase().includes(termo) ||
        (item['Turma origem'] || '').toLowerCase().includes(termo) ||
        (item['Município destino'] || '').toLowerCase().includes(termo) ||
        (item['Escola destino'] || '').toLowerCase().includes(termo);

      if (!matchBusca) return false;

      if (filtroTipo === 'transferencia') {
        return item.tipoMovimentacao === 'TRANSFERENCIA' || !item['Turma destino'];
      }
      if (filtroTipo === 'remanejamento') {
        return item.tipoMovimentacao === 'REMANEJAMENTO' || Boolean(item['Turma destino']);
      }
      return true;
    });
  }, [movimentacoes, busca, filtroTipo]);

  // Métricas
  const metricas = useMemo(() => {
    const total = movimentacoes.length;
    const transferencias = movimentacoes.filter(m => !m['Turma destino']).length;
    const remanejamentos = total - transferencias;
    const destinosMunicipios = new Set(movimentacoes.map(m => m['Município destino']).filter(Boolean)).size;

    return {
      total,
      transferencias,
      remanejamentos,
      destinosMunicipios
    };
  }, [movimentacoes]);

  // Form State para Nova Movimentação
  const [novoForm, setNovoForm] = useState({
    alunoCodigo: '',
    alunoNome: '',
    tipo: 'TRANSFERENCIA' as 'TRANSFERENCIA' | 'REMANEJAMENTO',
    turmaOrigem: '',
    periodoOrigem: '',
    turmaDestino: '',
    escolaDestino: '',
    municipioDestino: '',
    dataMovimentacao: new Date().toLocaleDateString('pt-BR'),
    motivo: 'MUDANÇA DE ENDEREÇO',
    responsavel: ''
  });

  // Atualiza campos do formulário ao selecionar o aluno
  function handleSelectAluno(cod: string) {
    const aluno = matriculasData.find(m => m.Código === cod);
    if (aluno) {
      setNovoForm(prev => ({
        ...prev,
        alunoCodigo: aluno.Código,
        alunoNome: aluno.Nome,
        turmaOrigem: aluno.Turma || '',
        periodoOrigem: aluno.Período || '',
        responsavel: aluno['Filiação 1'] || ''
      }));
    }
  }

  function handleCriarMovimentacao() {
    if (!novoForm.alunoNome) {
      if (onToast) onToast({ message: 'Selecione um estudante para a movimentação.', type: 'error' });
      return;
    }

    const novoRegistro: MovimentacaoRegistro = {
      Código: String(Date.now()).slice(-5),
      Estudante: novoForm.alunoNome,
      'Período de Origem': novoForm.periodoOrigem,
      'Turma origem': novoForm.turmaOrigem,
      'Escola destino': novoForm.tipo === 'TRANSFERENCIA' ? (novoForm.escolaDestino || 'OUTRA UNIDADE DE ENSINO') : 'E.M. MARIA GERALDA M. B. SALOMÃO',
      'Período destino': novoForm.tipo === 'REMANEJAMENTO' ? novoForm.periodoOrigem : '',
      'Turma destino': novoForm.tipo === 'REMANEJAMENTO' ? novoForm.turmaDestino : '',
      'Município destino': novoForm.tipo === 'TRANSFERENCIA' ? (novoForm.municipioDestino || 'PONTO DOS VOLANTES') : 'PONTO DOS VOLANTES',
      'Data da Movimentação': novoForm.dataMovimentacao,
      Motivo: novoForm.motivo,
      Responsável: novoForm.responsavel || 'Responsável Legal',
      Situação: novoForm.tipo === 'TRANSFERENCIA' ? 'TRANSFERIDO' : 'REMANEJADO',
      tipoMovimentacao: novoForm.tipo
    };

    const atualizada = [novoRegistro, ...movimentacoes];
    setMovimentacoes(atualizada);
    salvarCustom(atualizada);
    setModalNovo(false);

    if (onToast) {
      onToast({
        message: `Movimentação de ${novoForm.alunoNome} registrada com sucesso!`,
        type: 'success'
      });
    }
  }

  function exportarCSV() {
    let csv = 'Codigo;Estudante;Tipo;Turma Origem;Periodo Origem;Destino;Municipio Destino;Data;Motivo;Responsavel;Situacao\n';
    movimentacoesFiltradas.forEach(m => {
      const destino = m['Turma destino'] ? `Turma ${m['Turma destino']}` : (m['Escola destino'] || 'Não inf.');
      csv += `"${m.Código}";"${m.Estudante}";"${m.tipoMovimentacao || 'TRANSFERENCIA'}";"${m['Turma origem']}";"${m['Período de Origem']}";"${destino}";"${m['Município destino'] || ''}";"${m['Data da Movimentação']}";"${m.Motivo}";"${m.Responsável}";"${m.Situação}"\n`;
    });

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Movimentacoes_Escolares_${new Date().getFullYear()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function imprimirGuia() {
    window.print();
  }

  return (
    <div className="remanejamento-container">
      {/* Cabeçalho do Módulo */}
      <div className="remanejamento-header no-print">
        <div className="remanejamento-header-title">
          <ArrowRightLeft className="icon-header" size={28} />
          <div>
            <h2>Remanejamento & Transferência de Alunos (SIGP)</h2>
            <p>E.M. MARIA GERALDA MIRANDA BRITO SALOMÃO &bull; Controle Oficial de Movimentações Escolares</p>
          </div>
        </div>

        <div className="remanejamento-actions">
          <button type="button" className="btn-secundario" onClick={exportarCSV}>
            <Download size={16} /> Exportar CSV
          </button>
          <button
            type="button"
            className="btn-primario"
            onClick={() => {
              setGuiaSelecionada(null);
              setModalNovo(true);
            }}
          >
            <Plus size={16} /> Nova Movimentação
          </button>
        </div>
      </div>

      {/* Cards de Métricas */}
      <div className="remanejamento-stats-grid no-print">
        <div className="rem-stat-card">
          <div className="stat-icone azul">
            <ArrowRightLeft size={22} />
          </div>
          <div>
            <span className="stat-titulo">Total de Movimentações</span>
            <strong className="stat-numero">{metricas.total}</strong>
          </div>
        </div>

        <div className="rem-stat-card">
          <div className="stat-icone ambar">
            <Building size={22} />
          </div>
          <div>
            <span className="stat-titulo">Transferências de Saída</span>
            <strong className="stat-numero">{metricas.transferencias}</strong>
          </div>
        </div>

        <div className="rem-stat-card">
          <div className="stat-icone verde">
            <Users size={22} />
          </div>
          <div>
            <span className="stat-titulo">Remanejamentos Internos</span>
            <strong className="stat-numero">{metricas.remanejamentos}</strong>
          </div>
        </div>

        <div className="rem-stat-card">
          <div className="stat-icone indigo">
            <MapPin size={22} />
          </div>
          <div>
            <span className="stat-titulo">Municípios de Destino</span>
            <strong className="stat-numero">{metricas.destinosMunicipios}</strong>
          </div>
        </div>
      </div>

      {/* Filtros e Busca */}
      <div className="remanejamento-filter-card no-print">
        <div className="busca-input-wrapper">
          <Search size={18} />
          <input
            type="text"
            placeholder="Buscar por estudante, motivo, responsável, turma ou município..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>

        <div className="tipo-filtro-botoes">
          <button
            type="button"
            className={filtroTipo === 'todos' ? 'btn-filtro active' : 'btn-filtro'}
            onClick={() => setFiltroTipo('todos')}
          >
            Todos ({metricas.total})
          </button>
          <button
            type="button"
            className={filtroTipo === 'transferencia' ? 'btn-filtro active' : 'btn-filtro'}
            onClick={() => setFiltroTipo('transferencia')}
          >
            Transferências ({metricas.transferencias})
          </button>
          <button
            type="button"
            className={filtroTipo === 'remanejamento' ? 'btn-filtro active' : 'btn-filtro'}
            onClick={() => setFiltroTipo('remanejamento')}
          >
            Remanejamentos ({metricas.remanejamentos})
          </button>
        </div>
      </div>

      {/* TABELA DE MOVIMENTAÇÕES */}
      <div className="remanejamento-tabela-card no-print">
        <div className="tabela-scroll">
          <table className="tabela-mov">
            <thead>
              <tr>
                <th>Código</th>
                <th>Data</th>
                <th>Estudante</th>
                <th>Tipo</th>
                <th>Origem</th>
                <th>Destino</th>
                <th>Motivo</th>
                <th>Responsável</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {movimentacoesFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={9} className="td-vazio">
                    Nenhuma movimentação escolar encontrada para o filtro atual.
                  </td>
                </tr>
              ) : (
                movimentacoesFiltradas.map((m) => {
                  const isRemanejamento = Boolean(m['Turma destino']);
                  return (
                    <tr key={m.Código}>
                      <td className="td-cod">#{m.Código}</td>
                      <td className="td-data">{m['Data da Movimentação']}</td>
                      <td className="td-estudante">
                        <strong>{m.Estudante}</strong>
                      </td>
                      <td>
                        <span className={`badge-tipo ${isRemanejamento ? 'tipo-rem' : 'tipo-transf'}`}>
                          {isRemanejamento ? 'Remanejamento' : 'Transferência'}
                        </span>
                      </td>
                      <td className="td-origem">
                        Turma {m['Turma origem']} ({m['Período de Origem']})
                      </td>
                      <td className="td-destino">
                        {isRemanejamento ? (
                          <span className="dest-remanejado">
                            &rarr; Turma {m['Turma destino']} (Interno)
                          </span>
                        ) : (
                          <span className="dest-transferido">
                            {m['Escola destino'] || 'Outra Unidade'}
                            {m['Município destino'] ? ` (${m['Município destino']})` : ''}
                          </span>
                        )}
                      </td>
                      <td className="td-motivo">{m.Motivo}</td>
                      <td className="td-resp">{m.Responsável || 'Não informado'}</td>
                      <td className="td-acoes">
                        <button
                          type="button"
                          className="btn-emitir-guia"
                          onClick={() => setGuiaSelecionada(m)}
                          title="Emitir Guia / Declaração Oficial de Transferência"
                        >
                          <FileText size={15} /> Guia
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DOCUMENTO OFICIAL: GUIA DE TRANSFERÊNCIA ESCOLAR (VISÍVEL NO MODAL OU IMPRESSÃO) */}
      {guiaSelecionada && (
        <div className="modal-overlay" onClick={() => setGuiaSelecionada(null)}>
          <div className="modal-guia-box" onClick={(e) => e.stopPropagation()}>
            <div className="guia-acoes-topo no-print">
              <h3>Visualização da Guia Oficial de Transferência</h3>
              <div className="guia-botoes">
                <button type="button" className="btn-print" onClick={imprimirGuia}>
                  <Printer size={16} /> Imprimir Documento Oficial
                </button>
                <button
                  type="button"
                  className="btn-fechar-modal"
                  onClick={() => setGuiaSelecionada(null)}
                >
                  &times;
                </button>
              </div>
            </div>

            {/* Folha Oficial da Guia */}
            <div className="guia-folha-impressao">
              <div className="guia-cabecalho">
                <div className="guia-brasao">MG</div>
                <div className="guia-header-texto">
                  <h3>ESTADO DE MINAS GERAIS &bull; PREFEITURA MUNICIPAL DE PONTO DOS VOLANTES</h3>
                  <h4>SECRETARIA MUNICIPAL DE EDUCAÇÃO</h4>
                  <h2>ESCOLA MUNICIPAL MARIA GERALDA MIRANDA BRITO SALOMÃO</h2>
                  <p>ENSINO FUNDAMENTAL &bull; CÓDIGO INEP: 31054366 &bull; AUTORIZAÇÃO DE FUNCIONAMENTO</p>
                  <div className="guia-faixa-titulo">
                    DECLARAÇÃO DE TRANSFERÊNCIA ESCOLAR &bull; GUIA OFICIAL Nº {guiaSelecionada.Código}/2026
                  </div>
                </div>
              </div>

              <div className="guia-corpo-declaracao">
                <p>
                  A Direção e a Secretaria da <strong>Escola Municipal Maria Geralda Miranda Brito Salomão</strong>,
                  no uso de suas atribuições legais e em cumprimento à Lei de Diretrizes e Bases da Educação Nacional
                  (Lei Federal nº 9.394/1996), declara, para os devidos fins de matrícula e comprovação de escolaridade,
                  que o(a) estudante:
                </p>

                <div className="guia-box-aluno">
                  <div className="guia-linha-dado">
                    <span className="guia-rotulo">Nome do(a) Estudante:</span>
                    <span className="guia-valor-destaque">{guiaSelecionada.Estudante}</span>
                  </div>
                  <div className="guia-linha-dado">
                    <span className="guia-rotulo">Ano / Período Cursado:</span>
                    <span className="guia-valor">{guiaSelecionada['Período de Origem']} &bull; Turma {guiaSelecionada['Turma origem']}</span>
                  </div>
                  <div className="guia-linha-dado">
                    <span className="guia-rotulo">Responsável Requerente:</span>
                    <span className="guia-valor">{guiaSelecionada.Responsável}</span>
                  </div>
                  <div className="guia-linha-dado">
                    <span className="guia-rotulo">Motivo Formal da Movimentação:</span>
                    <span className="guia-valor">{guiaSelecionada.Motivo}</span>
                  </div>
                  <div className="guia-linha-dado">
                    <span className="guia-rotulo">Destino Declarado:</span>
                    <span className="guia-valor">
                      {guiaSelecionada['Escola destino'] || 'Unidade Escolar Requerida'}
                      {guiaSelecionada['Município destino'] ? ` — ${guiaSelecionada['Município destino']}` : ''}
                    </span>
                  </div>
                </div>

                <p className="guia-paragrafo-legal">
                  Certificamos que o(a) referido(a) educando(a) esteve regularmente matriculado(a) nesta unidade escolar
                  no decorrer do ano letivo de 2026, com registro de frequência e aproveitamento formalizados até a data de{' '}
                  <strong>{guiaSelecionada['Data da Movimentação']}</strong>, estando desvinculado(a) da frequência regular
                  a partir desta data por motivo de transferência. O Histórico Escolar definitivo será expedido no prazo legal
                  de até 30 (trinta) dias.
                </p>

                <div className="guia-validade-aviso">
                  Esta declaração tem validade de 30 (trinta) dias a contar da data de sua expedição.
                </div>
              </div>

              <div className="guia-data-local">
                Ponto dos Volantes - MG, {guiaSelecionada['Data da Movimentação']}.
              </div>

              <div className="guia-assinaturas">
                <div className="guia-assinatura-bloco">
                  <div className="linha-assinatura"></div>
                  <p>Secretário(a) Escolar</p>
                  <span>Registro da Secretaria</span>
                </div>
                <div className="guia-assinatura-bloco">
                  <div className="linha-assinatura"></div>
                  <p>Diretor(a) Escolar</p>
                  <span>E.M. Maria Geralda M. B. Salomão</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL REGISTRAR NOVA MOVIMENTAÇÃO */}
      {modalNovo && (
        <div className="modal-overlay" onClick={() => setModalNovo(false)}>
          <div className="modal-remanejamento-form" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Registrar Nova Movimentação Escolar (SIGP)</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setModalNovo(false)}
              >
                &times;
              </button>
            </div>

            <div className="modal-body">
              {/* Seleção do Aluno */}
              <div className="form-group">
                <label htmlFor="select-aluno-mov">Selecionar Estudante Matriculado:</label>
                <select
                  id="select-aluno-mov"
                  value={novoForm.alunoCodigo}
                  onChange={(e) => handleSelectAluno(e.target.value)}
                >
                  <option value="">-- Selecione o aluno da lista --</option>
                  {matriculasData.map((m) => (
                    <option key={m.Código} value={m.Código}>
                      {m.Nome} &bull; Matr. {m.Código} &bull; Turma {m.Turma} ({m.Situação})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label htmlFor="select-tipo-mov">Tipo de Movimentação:</label>
                  <select
                    id="select-tipo-mov"
                    value={novoForm.tipo}
                    onChange={(e) =>
                      setNovoForm(prev => ({
                        ...prev,
                        tipo: e.target.value as 'TRANSFERENCIA' | 'REMANEJAMENTO'
                      }))
                    }
                  >
                    <option value="TRANSFERENCIA">Transferência de Saída (Outra Escola / Cidade)</option>
                    <option value="REMANEJAMENTO">Remanejamento Interno de Turma (Mesma Escola)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="data-mov">Data da Movimentação:</label>
                  <input
                    id="data-mov"
                    type="text"
                    value={novoForm.dataMovimentacao}
                    onChange={(e) => setNovoForm(prev => ({ ...prev, dataMovimentacao: e.target.value }))}
                    placeholder="DD/MM/AAAA"
                  />
                </div>
              </div>

              {/* Se for Remanejamento Interno */}
              {novoForm.tipo === 'REMANEJAMENTO' ? (
                <div className="form-grid-2 form-box-destaque">
                  <div className="form-group">
                    <label>Turma de Origem:</label>
                    <input type="text" value={`Turma ${novoForm.turmaOrigem || '—'}`} disabled />
                  </div>
                  <div className="form-group">
                    <label htmlFor="turma-destino">Turma de Destino (Nova Turma):</label>
                    <select
                      id="turma-destino"
                      value={novoForm.turmaDestino}
                      onChange={(e) => setNovoForm(prev => ({ ...prev, turmaDestino: e.target.value }))}
                    >
                      <option value="">-- Selecione a nova turma --</option>
                      {turmasData
                        .filter(t => t.Turma && t.Turma !== novoForm.turmaOrigem)
                        .map(t => (
                          <option key={t.Turma} value={t.Turma}>
                            {t.Período} &bull; Turma {t.Turma} ({t.Turno})
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              ) : (
                /* Se for Transferência Externa */
                <div className="form-grid-2 form-box-destaque">
                  <div className="form-group">
                    <label htmlFor="escola-destino">Escola de Destino:</label>
                    <input
                      id="escola-destino"
                      type="text"
                      list="escolas-municipais-list"
                      placeholder="Nome da escola de destino..."
                      value={novoForm.escolaDestino}
                      onChange={(e) => setNovoForm(prev => ({ ...prev, escolaDestino: e.target.value }))}
                    />
                    <datalist id="escolas-municipais-list">
                      {escolasData.map((e, idx) => (
                        <option key={idx} value={e.Escola} />
                      ))}
                    </datalist>
                  </div>

                  <div className="form-group">
                    <label htmlFor="municipio-destino">Município de Destino:</label>
                    <input
                      id="municipio-destino"
                      type="text"
                      placeholder="Ex: JEQUITINHONHA, ITINGA, MEDINA..."
                      value={novoForm.municipioDestino}
                      onChange={(e) => setNovoForm(prev => ({ ...prev, municipioDestino: e.target.value }))}
                    />
                  </div>
                </div>
              )}

              <div className="form-grid-2">
                <div className="form-group">
                  <label htmlFor="motivo-mov">Motivo Formal:</label>
                  <select
                    id="motivo-mov"
                    value={novoForm.motivo}
                    onChange={(e) => setNovoForm(prev => ({ ...prev, motivo: e.target.value }))}
                  >
                    <option value="MUDANÇA DE ENDEREÇO">MUDANÇA DE ENDEREÇO</option>
                    <option value="INTERESSE FAMILIAR">INTERESSE FAMILIAR</option>
                    <option value="TRANSPORTE ESCOLAR">TRANSPORTE ESCOLAR</option>
                    <option value="ADAPTAÇÃO PEDAGÓGICA">ADAPTAÇÃO PEDAGÓGICA</option>
                    <option value="HORÁRIO DE TRABALHO DOS PAIS">HORÁRIO DE TRABALHO DOS PAIS</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="resp-mov">Responsável Legal Requerente:</label>
                  <input
                    id="resp-mov"
                    type="text"
                    value={novoForm.responsavel}
                    onChange={(e) => setNovoForm(prev => ({ ...prev, responsavel: e.target.value }))}
                    placeholder="Nome do pai, mãe ou responsável"
                  />
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-cancelar"
                onClick={() => setModalNovo(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-confirmar"
                onClick={handleCriarMovimentacao}
              >
                Registrar Movimentação
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RemanejamentoAlunos;
