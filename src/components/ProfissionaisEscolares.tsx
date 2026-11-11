import { useState, useMemo } from 'react';
import {
  Search,
  Download,
  GraduationCap,
  Phone,
  CheckCircle2,
  XCircle,
  Eye,
  X,
  Award,
  Sparkles,
  LoaderCircle,
  Filter
} from 'lucide-react';
import profissionaisData from '../data/profissionais.json';
import * as XLSX from 'xlsx';
import './ProfissionaisEscolares.css';
import { supabase } from '../lib/supabase';
import type { ToastData } from './Toast';

interface Props {
  onToast?: (t: ToastData) => void;
}

export default function ProfissionaisEscolares({ onToast }: Props) {
  const [busca, setBusca] = useState('');
  const [filtroFormacao, setFiltroFormacao] = useState('todos');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [profissionalModal, setProfissionalModal] = useState<any | null>(null);
  const [sincronizando, setSincronizando] = useState(false);

  const formacoesDisponiveis = useMemo(() => {
    const set = new Set<string>();
    profissionaisData.forEach((p: any) => {
      const c = (p['Curso superior'] || '').trim();
      if (c) {
        c.split('\n').forEach((linha: string) => {
          const limpo = linha.trim();
          if (limpo && limpo.length > 3) set.add(limpo);
        });
      }
    });
    return Array.from(set).sort();
  }, []);

  const profissionaisFiltrados = useMemo(() => {
    const b = busca.toLowerCase().trim();
    return profissionaisData.filter((p: any) => {
      const matchBusca =
        !b ||
        (p['Nome'] || '').toLowerCase().includes(b) ||
        (p['CPF'] || '').toLowerCase().includes(b) ||
        (p['Curso superior'] || '').toLowerCase().includes(b) ||
        (p['Contato 1'] || '').toLowerCase().includes(b) ||
        (p['Município'] || '').toLowerCase().includes(b);

      const matchFormacao =
        filtroFormacao === 'todos' ||
        (p['Curso superior'] || '').toLowerCase().includes(filtroFormacao.toLowerCase());

      const matchStatus =
        filtroStatus === 'todos' ||
        (filtroStatus === 'ativo' && (p['Ativo'] || '').toLowerCase().includes('sim')) ||
        (filtroStatus === 'inativo' && !(p['Ativo'] || '').toLowerCase().includes('sim'));

      return matchBusca && matchFormacao && matchStatus;
    });
  }, [busca, filtroFormacao, filtroStatus]);

  async function sincronizarComSupabase() {
    setSincronizando(true);
    try {
      const registros = profissionaisData.map((p: any) => ({
        codigo: String(p['Código'] || '').trim(),
        nome: String(p['Nome'] || '').trim().toUpperCase(),
        cpf: p['CPF'] || null,
        data_nascimento: p['Data de Nascimento']
          ? p['Data de Nascimento'].split('/').reverse().join('-')
          : null,
        idade: p['Idade'] ? parseInt(p['Idade'], 10) || null : null,
        sexo: p['Sexo'] || null,
        cor: p['Cor'] || null,
        contato: p['Contato 1'] || null,
        email: p['E-mail'] || null,
        municipio: p['Município'] || 'PONTO DOS VOLANTES',
        escolaridade: p['Escolaridade'] || 'Educação Superior',
        curso_superior: p['Curso superior'] || null,
        instituicao: p['Instituição'] || null,
        ativo: p['Ativo'] || 'Sim',
        dados: p
      }));

      const { error } = await supabase.from('profissionais').upsert(registros, {
        onConflict: 'codigo'
      });

      if (error) {
        if (error.message.includes('relation "public.profissionais" does not exist') || error.message.includes('schema cache')) {
          onToast?.({
            message: 'Tabela public.profissionais precisa ser criada no Supabase via script SQL.',
            type: 'error'
          });
        } else {
          throw error;
        }
      } else {
        onToast?.({
          message: `${registros.length} profissionais sincronizados no Supabase com sucesso!`,
          type: 'success'
        });
      }
    } catch (err: any) {
      console.error(err);
      onToast?.({
        message: err.message || 'Erro ao sincronizar profissionais.',
        type: 'error'
      });
    } finally {
      setSincronizando(false);
    }
  }

  function exportarExcel() {
    const ws = XLSX.utils.json_to_sheet(profissionaisFiltrados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Profissionais');
    XLSX.writeFile(wb, 'Profissionais_Escolares_2026.xlsx');
    onToast?.({
      message: 'Planilha de profissionais exportada com sucesso!',
      type: 'success'
    });
  }

  return (
    <div className="profissionais-container">
      {/* Header Institucional */}
      <div className="profissionais-hero">
        <div className="profissionais-hero-info">
          <div className="profissionais-tag">
            <GraduationCap size={16} /> Corpo Docente & Profissionais da Educação
          </div>
          <h2>Profissionais Escolares</h2>
          <p>
            E.M. MARIA GERALDA MIRANDA BRITO SALOMÃO &bull; Ponto dos Volantes - MG
          </p>
        </div>
        <div className="profissionais-hero-stats">
          <div className="stat-pill">
            <span className="stat-num">{profissionaisData.length}</span>
            <span className="stat-desc">Profissionais</span>
          </div>
          <div className="stat-pill">
            <span className="stat-num">
              {profissionaisData.filter((p: any) => (p['Ativo'] || '').toLowerCase().includes('sim')).length}
            </span>
            <span className="stat-desc">Ativos</span>
          </div>
        </div>
      </div>

      {/* Barra de Filtros e Ações */}
      <div className="profissionais-bar">
        <div className="profissionais-search-box">
          <Search size={18} className="search-icon-prof" />
          <input
            type="text"
            placeholder="Buscar por professor, CPF, curso ou contato..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          {busca && (
            <button
              type="button"
              className="clear-search-btn"
              onClick={() => setBusca('')}
            >
              ✕
            </button>
          )}
        </div>

        <div className="profissionais-filtros">
          <div className="filtro-item">
            <Filter size={16} />
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="select-filtro"
            >
              <option value="todos">Todos os Status</option>
              <option value="ativo">Somente Ativos</option>
              <option value="inativo">Inativos</option>
            </select>
          </div>

          <div className="filtro-item">
            <Award size={16} />
            <select
              value={filtroFormacao}
              onChange={(e) => setFiltroFormacao(e.target.value)}
              className="select-filtro select-formacao"
            >
              <option value="todos">Todas as Formações</option>
              {formacoesDisponiveis.map((f) => (
                <option key={f} value={f}>
                  {f.length > 40 ? f.slice(0, 40) + '...' : f}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="profissionais-actions">
          <button
            type="button"
            className="btn-prof btn-sync"
            onClick={sincronizarComSupabase}
            disabled={sincronizando}
            title="Sincronizar registros com a tabela do Supabase"
          >
            {sincronizando ? (
              <>
                <LoaderCircle className="animate-spin" size={16} /> Sincronizando...
              </>
            ) : (
              <>
                <Sparkles size={16} /> Sincronizar Supabase
              </>
            )}
          </button>

          <button
            type="button"
            className="btn-prof btn-excel"
            onClick={exportarExcel}
            title="Exportar para arquivo Excel"
          >
            <Download size={16} /> Excel
          </button>
        </div>
      </div>

      {/* Listagem em Tabela Moderna */}
      <div className="profissionais-table-card">
        <div className="table-header-info">
          <h3>Listagem de Professores & Equipe</h3>
          <span>
            Mostrando {profissionaisFiltrados.length} de {profissionaisData.length} registros
          </span>
        </div>

        <div className="table-responsive">
          <table className="custom-prof-table">
            <thead>
              <tr>
                <th>Nome do Profissional</th>
                <th>CPF</th>
                <th>Curso Superior / Formação</th>
                <th>Contato</th>
                <th>Município</th>
                <th>Status</th>
                <th style={{ textAlign: 'center' }}>Ficha</th>
              </tr>
            </thead>
            <tbody>
              {profissionaisFiltrados.map((prof: any) => {
                const isAtivo = (prof['Ativo'] || '').toLowerCase().includes('sim');
                return (
                  <tr key={prof['Código'] || prof['Nome']}>
                    <td>
                      <div className="prof-cell-nome">
                        <div className="prof-avatar">
                          {prof['Nome'] ? prof['Nome'].charAt(0) : 'P'}
                        </div>
                        <div>
                          <strong className="prof-nome-text">{prof['Nome']}</strong>
                          <span className="prof-codigo-sub">Cód. {prof['Código']}</span>
                        </div>
                      </div>
                    </td>
                    <td className="font-mono text-sm">{prof['CPF'] || '—'}</td>
                    <td>
                      <div className="prof-curso-cell">
                        <GraduationCap size={14} className="text-blue-600 flex-shrink-0" />
                        <span>{prof['Curso superior'] || 'Educação Superior'}</span>
                      </div>
                    </td>
                    <td>
                      <div className="prof-contato-cell">
                        {prof['Contato 1'] ? (
                          <>
                            <Phone size={13} className="text-gray-400" />
                            <span>{prof['Contato 1']}</span>
                          </>
                        ) : (
                          '—'
                        )}
                      </div>
                    </td>
                    <td>{prof['Município'] || 'PONTO DOS VOLANTES'}</td>
                    <td>
                      <span className={`status-badge-prof ${isAtivo ? 'ativo' : 'inativo'}`}>
                        {isAtivo ? (
                          <>
                            <CheckCircle2 size={12} /> Ativo
                          </>
                        ) : (
                          <>
                            <XCircle size={12} /> Inativo
                          </>
                        )}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        className="btn-ver-ficha"
                        onClick={() => setProfissionalModal(prof)}
                        title="Visualizar ficha completa"
                      >
                        <Eye size={15} /> Detalhes
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Ficha Completa do Profissional */}
      {profissionalModal && (
        <div className="modal-overlay" onClick={() => setProfissionalModal(null)}>
          <div
            className="modal-content-prof"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header-prof">
              <div className="modal-header-title">
                <GraduationCap size={22} />
                <div>
                  <h3>{profissionalModal['Nome']}</h3>
                  <span>Código: {profissionalModal['Código']} &bull; CPF: {profissionalModal['CPF']}</span>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setProfissionalModal(null)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body-prof">
              <div className="ficha-grid">
                <div className="ficha-item">
                  <span className="ficha-label">Data de Nascimento</span>
                  <span className="ficha-val">{profissionalModal['Data de Nascimento'] || '—'} ({profissionalModal['Idade']} anos)</span>
                </div>
                <div className="ficha-item">
                  <span className="ficha-label">Sexo / Cor</span>
                  <span className="ficha-val">{profissionalModal['Sexo'] || '—'} &bull; {profissionalModal['Cor'] || '—'}</span>
                </div>
                <div className="ficha-item">
                  <span className="ficha-label">Naturalidade / Estado</span>
                  <span className="ficha-val">{profissionalModal['Naturalidade'] || '—'} - {profissionalModal['Estado'] || 'MG'}</span>
                </div>
                <div className="ficha-item">
                  <span className="ficha-label">Contato Telefônico</span>
                  <span className="ficha-val">{profissionalModal['Contato 1'] || 'Não informado'}</span>
                </div>
                <div className="ficha-item">
                  <span className="ficha-label">Escolaridade</span>
                  <span className="ficha-val">{profissionalModal['Escolaridade'] || 'Educação Superior'}</span>
                </div>
                <div className="ficha-item full-width">
                  <span className="ficha-label">Curso Superior / Licenciatura</span>
                  <span className="ficha-val highlight">{profissionalModal['Curso superior'] || '—'}</span>
                </div>
                <div className="ficha-item full-width">
                  <span className="ficha-label">Instituição de Ensino Superior</span>
                  <span className="ficha-val">{profissionalModal['Instituição'] || '—'} ({profissionalModal['Tipo de instituição'] || 'PÚBLICA'})</span>
                </div>
                <div className="ficha-item full-width">
                  <span className="ficha-label">Pós-Graduação</span>
                  <span className="ficha-val">{profissionalModal['Tipo da pós graduação'] !== '-' ? `${profissionalModal['Tipo da pós graduação']} em ${profissionalModal['Área da pós graduação']}` : 'Nenhuma cadastrada'}</span>
                </div>
                <div className="ficha-item full-width">
                  <span className="ficha-label">Filiação</span>
                  <span className="ficha-val">
                    1: {profissionalModal['Filiação 1'] || '—'} <br />
                    2: {profissionalModal['Filiação 2'] || '—'}
                  </span>
                </div>
                <div className="ficha-item">
                  <span className="ficha-label">Município</span>
                  <span className="ficha-val">{profissionalModal['Município'] || 'Ponto dos Volantes'}</span>
                </div>
                <div className="ficha-item">
                  <span className="ficha-label">CEP</span>
                  <span className="ficha-val">{profissionalModal['Cep'] || '39.615-000'}</span>
                </div>
              </div>
            </div>

            <div className="modal-footer-prof">
              <button
                type="button"
                className="btn-fechar-modal"
                onClick={() => setProfissionalModal(null)}
              >
                Fechar Ficha
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
