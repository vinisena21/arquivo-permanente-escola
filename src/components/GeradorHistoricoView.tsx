import React from 'react';
import type { AlunoSecretariaResumo } from '../lib/alunosSecretaria';
import type { AlunoParaHistorico } from '../lib/importacaoSecretaria';
import { isoParaDataBR } from '../lib/importacaoSecretaria';
import type { ModeloHistorico } from './GeradorHistorico';

export interface AlunoOpcao {
  id: number;
  nome: string;
  dataNascimento: string;
}

export interface PreenchimentoPendente {
  nomeAluno: string;
  campos: Record<string, string>;
  conflitos: string[];
}

export interface GeradorHistoricoViewProps {
  dados: Record<string, string>;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  gerarDocumento: (e: React.FormEvent) => void;
  limparFormulario: () => void;
  salvarNoBanco: () => void;
  salvandoHistorico: boolean;
  rascunhoSalvo: boolean;
  progresso: { identificacao: number; identificacaoTotal: number; anos: number; anosTotal: number };
  errosValidacao: string[];
  msgSalvo: string;
  avisoPreenchimento: string;
  preenchimentoPendente: PreenchimentoPendente | null;
  confirmarPreenchimento: (substituir: boolean) => void;
  alunosSecretaria: AlunoSecretariaResumo[];
  buscaSecretaria: string;
  setBuscaSecretaria: (v: string) => void;
  alunosSecretariaFiltrados: AlunoSecretariaResumo[];
  selecionarAlunoSecretaria: (a: AlunoParaHistorico) => void;
  alunos: AlunoOpcao[];
  buscaAluno: string;
  setBuscaAluno: (v: string) => void;
  alunosFiltrados: AlunoOpcao[];
  preencherComAluno: (a: AlunoOpcao) => void;
  ANOS_CONFIG: Array<{
    num: string;
    titulo: string;
    temIngles: boolean;
    temCHSeparada: boolean;
    keyCHAnual: string;
    keyFaltasMeio: string;
    exibirFaltasMeio: boolean;
  }>;
  modelo: ModeloHistorico;
  onMudarModelo: (m: ModeloHistorico) => void;
}

export default function GeradorHistoricoView(props: GeradorHistoricoViewProps) {
  const {
    dados, handleChange, gerarDocumento, limparFormulario, salvarNoBanco, salvandoHistorico,
    rascunhoSalvo, progresso, errosValidacao, msgSalvo, avisoPreenchimento,
    preenchimentoPendente, confirmarPreenchimento,
    alunosSecretaria, buscaSecretaria, setBuscaSecretaria, alunosSecretariaFiltrados, selecionarAlunoSecretaria,
    alunos, buscaAluno, setBuscaAluno, alunosFiltrados, preencherComAluno,
    ANOS_CONFIG,
    modelo, onMudarModelo,
  } = props;

  const cssCaixa = {
    border: '1px solid #cbd5e1',
    borderRadius: '12px',
    padding: '22px',
    marginBottom: '18px',
    backgroundColor: '#ffffff',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
  };
  const cssTitulo = {
    fontWeight: '700' as const,
    fontSize: '16px',
    cursor: 'pointer',
    outline: 'none',
    paddingBottom: '6px',
    color: '#1e3a8a',
  };
  const cssInput = {
    width: '100%',
    padding: '10px 12px',
    marginTop: '6px',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    fontSize: '14px',
    boxSizing: 'border-box' as const,
    outline: 'none',
    backgroundColor: '#f8fafc',
  };
  const cssGrid2 = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '18px',
    marginTop: '14px',
  };
  const cssGrid4 = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '14px',
    marginTop: '14px',
  };

  return (
    <div style={{ padding: '10px 0 100px 0' }}>
      <div style={{ backgroundColor: '#1e3a8a', color: '#fff', padding: '20px 24px', borderRadius: '16px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', borderBottom: '4px solid #3b82f6' }}>
        <div>
          <span style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase', color: '#93c5fd' }}>E.M. MARIA GERALDA MIRANDA BRITO SALOMAO</span>
          <h2 style={{ margin: '4px 0 0 0', fontSize: '20px', fontWeight: 900 }}>Gerador Oficial de Historico Escolar</h2>
        </div>
        <div style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: '8px 14px', borderRadius: '10px', fontSize: '13px', fontWeight: 600 }}>Ponto dos Volantes - MG</div>
      </div>

      <div style={{ ...cssCaixa, borderColor: modelo === '9ano2026' ? '#22c55e' : '#cbd5e1', background: modelo === '9ano2026' ? '#f0fdf4' : '#fff' }}>
        <label style={{ fontSize: '14px', fontWeight: 800, color: '#1e3a8a', display: 'block', marginBottom: 10 }}>
          Modelo do histórico
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <button
            type="button"
            onClick={() => onMudarModelo('padrao')}
            style={{
              padding: '10px 18px',
              borderRadius: 10,
              border: modelo === 'padrao' ? '2px solid #1e3a8a' : '1px solid #cbd5e1',
              background: modelo === 'padrao' ? '#1e3a8a' : '#fff',
              color: modelo === 'padrao' ? '#fff' : '#334155',
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            Modelo padrão (em branco)
          </button>
          <button
            type="button"
            onClick={() => onMudarModelo('9ano2026')}
            style={{
              padding: '10px 18px',
              borderRadius: 10,
              border: modelo === '9ano2026' ? '2px solid #16a34a' : '1px solid #cbd5e1',
              background: modelo === '9ano2026' ? '#16a34a' : '#fff',
              color: modelo === '9ano2026' ? '#fff' : '#334155',
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            Modelo 9º Ano 2026 (pré-preenchido)
          </button>
        </div>
        <p style={{ margin: '10px 0 0', fontSize: 13, color: '#64748b' }}>
          {modelo === '9ano2026'
            ? 'Escola, município, cargas horárias, anos letivos e data (1 de dezembro de 2026) já vêm preenchidos. Você só completa aluno e notas.'
            : 'Formulário em branco — preencha todos os campos manualmente.'}
        </p>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px 18px', marginBottom: '18px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '13px', color: '#475569' }}>
          <span><strong style={{ color: '#1e3a8a' }}>Identificacao:</strong> {progresso.identificacao}/{progresso.identificacaoTotal}</span>
          <span><strong style={{ color: '#1e3a8a' }}>Anos preenchidos:</strong> {progresso.anos}/{progresso.anosTotal}</span>
        </div>
        <div style={{ fontSize: '12px', color: rascunhoSalvo ? '#059669' : '#94a3b8' }}>{rascunhoSalvo ? 'Rascunho salvo' : 'Salvando rascunho...'}</div>
      </div>

      {errosValidacao.length > 0 && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '14px 18px', marginBottom: '18px', color: '#991b1b' }}>
          <strong style={{ display: 'block', marginBottom: '8px' }}>Corrija os seguintes pontos antes de gerar:</strong>
          <ul style={{ margin: 0, paddingLeft: '20px' }}>
            {errosValidacao.map((msg) => (
              <li key={msg} style={{ marginBottom: '4px', fontSize: '13px' }}>{msg}</li>
            ))}
          </ul>
        </div>
      )}

      {msgSalvo && (
        <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '12px', padding: '14px 18px', marginBottom: '18px', color: '#065f46', fontWeight: 600 }}>{msgSalvo}</div>
      )}

      <form onSubmit={gerarDocumento} style={{ display: 'flex', flexDirection: 'column' }}>
        {(alunosSecretaria.length > 0 || preenchimentoPendente) && (
          <div style={{ ...cssCaixa, padding: '16px 20px', borderColor: '#a5b4fc' }}>
            <label style={{ fontSize: '13px', fontWeight: 700, color: '#3730a3' }}>Buscar aluno da secretaria</label>
            <input type="text" value={buscaSecretaria} onChange={(e) => setBuscaSecretaria(e.target.value)} placeholder="Digite ao menos 2 letras do nome..." style={{ ...cssInput, marginTop: '8px' }} />
            {alunosSecretariaFiltrados.length > 0 && (
              <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, border: '1px solid #e2e8f0', borderRadius: '8px', maxHeight: '260px', overflowY: 'auto', background: '#fff' }}>
                {alunosSecretariaFiltrados.map((aluno) => (
                  <li key={aluno.id}>
                    <button type="button" onClick={() => selecionarAlunoSecretaria(aluno)} style={{ width: '100%', textAlign: 'left', padding: '10px 14px', border: 'none', borderBottom: '1px solid #f1f5f9', background: 'transparent', cursor: 'pointer', fontSize: '14px' }}>
                      <strong>{aluno.nome}</strong>
                      {aluno.data_nascimento && <span style={{ color: '#64748b', marginLeft: '8px' }}>- {isoParaDataBR(aluno.data_nascimento)}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {preenchimentoPendente && (
              <div style={{ marginTop: '12px', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '10px', padding: '12px 14px', color: '#78350f' }}>
                <strong>O formulário já tem dados. Preencher com {preenchimentoPendente.nomeAluno}?</strong>
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button type="button" onClick={() => confirmarPreenchimento(true)} style={{ padding: '8px 12px', background: '#d97706', color: '#fff', border: 'none', borderRadius: 8 }}>Substituir tudo</button>
                  <button type="button" onClick={() => confirmarPreenchimento(false)} style={{ padding: '8px 12px', background: '#fff', border: '1px solid #fcd34d', borderRadius: 8 }}>Só vazios</button>
                </div>
              </div>
            )}
          </div>
        )}

        {alunos.length > 0 && (
          <div style={{ ...cssCaixa, padding: '16px 20px' }}>
            <label style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>Buscar aluno (arquivo permanente)</label>
            <input type="text" value={buscaAluno} onChange={(e) => setBuscaAluno(e.target.value)} placeholder="Nome do aluno..." style={{ ...cssInput, marginTop: '8px' }} />
            {alunosFiltrados.length > 0 && (
              <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, border: '1px solid #e2e8f0', borderRadius: 8 }}>
                {alunosFiltrados.map((a) => (
                  <li key={a.id}>
                    <button type="button" onClick={() => preencherComAluno(a)} style={{ width: '100%', textAlign: 'left', padding: '10px 12px', background: '#fff', border: 'none', borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}>{a.nome}</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {avisoPreenchimento && (
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: 14, marginBottom: 16, color: '#1e40af', fontSize: 13 }}>{avisoPreenchimento}</div>
        )}

        <details open style={cssCaixa}>
          <summary style={cssTitulo}>Identificação do Aluno e Configurações</summary>
          <div style={cssGrid2}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: '13px', fontWeight: 800, color: '#be123c' }}>Título do Documento:</label>
              <select name="historico_escolar" value={dados.historico_escolar} onChange={handleChange} style={{ ...cssInput, border: '1px solid #fda4af', backgroundColor: '#fff1f2' }} required>
                <option value="">Selecione...</option>
                <option value="HISTÓRICO ESCOLAR - TRANSFERÊNCIA">HISTÓRICO ESCOLAR - TRANSFERÊNCIA</option>
                <option value="CERTIFICADO DE CONCLUSÃO DA EDUCAÇÃO BÁSICA">CERTIFICADO DE CONCLUSÃO DA EDUCAÇÃO BÁSICA</option>
                <option value="HISTÓRICO ESCOLAR - ENSINO FUNDAMENTAL">HISTÓRICO ESCOLAR - ENSINO FUNDAMENTAL</option>
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: '13px', fontWeight: 800, color: '#1e3a8a' }}>Fundamentação Legal:</label>
              <textarea name="fundamentacao_legal" value={dados.fundamentacao_legal} onChange={handleChange} rows={2} style={{ ...cssInput, border: '1px solid #bfdbfe', backgroundColor: '#eff6ff' }} required />
            </div>
            <div><label style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>Nome do Aluno:</label><input name="nome_aluno" value={dados.nome_aluno} onChange={handleChange} style={cssInput} required /></div>
            <div><label style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>Data de Nascimento:</label><input name="data_nascimento" value={dados.data_nascimento} onChange={handleChange} placeholder="DD/MM/AAAA" style={cssInput} required /></div>
            <div><label style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>Nome da Mãe:</label><input name="nome_mae" value={dados.nome_mae} onChange={handleChange} style={cssInput} required /></div>
            <div><label style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>Nome do Pai:</label><input name="nome_pai" value={dados.nome_pai} onChange={handleChange} style={cssInput} /></div>
            <div><label style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>Naturalidade:</label><input name="naturalidade" value={dados.naturalidade} onChange={handleChange} style={cssInput} /></div>
            <div><label style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>UF:</label><input name="uf" value={dados.uf} onChange={handleChange} style={cssInput} /></div>
            <div><label style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>Nacionalidade:</label><input name="nacionalidade" value={dados.nacionalidade} onChange={handleChange} style={cssInput} /></div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>Sexo:</label>
              <select name="sexo" value={dados.sexo} onChange={handleChange} style={cssInput}>
                <option value="">Selecione...</option>
                <option value="MASCULINO">MASCULINO</option>
                <option value="FEMININO">FEMININO</option>
              </select>
            </div>
            <div><label style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>RG:</label><input name="rg" value={dados.rg} onChange={handleChange} style={cssInput} /></div>
            <div><label style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>Órgão Expedidor:</label><input name="orgao_rg" value={dados.orgao_rg} onChange={handleChange} style={cssInput} /></div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>Status Atual:</label>
              <select name="status_curso" value={dados.status_curso} onChange={handleChange} style={cssInput}>
                <option value="">Selecione...</option>
                <option value="CURSANDO">CURSANDO</option>
                <option value="CONCLUIU">CONCLUIU</option>
                <option value="TRANSFERIDO">TRANSFERIDO</option>
              </select>
            </div>
            <div><label style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>Série Atual:</label><input name="ano_curso" value={dados.ano_curso} onChange={handleChange} style={cssInput} /></div>
            <div><label style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>Data de Expedição:</label><input name="data_extenso" value={dados.data_extenso} onChange={handleChange} style={cssInput} /></div>
          </div>
        </details>

        {ANOS_CONFIG.map((ano) => {
          const n = ano.num;
          return (
            <details key={n} style={cssCaixa}>
              <summary style={cssTitulo}>{ano.titulo}</summary>
              <div style={cssGrid4}>
                <div><label style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>Ano Letivo:</label><input name={`ano_letivo_${n}ano`} value={dados[`ano_letivo_${n}ano`] || ''} onChange={handleChange} style={cssInput} /></div>
                <div style={{ gridColumn: 'span 2' }}><label style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>Escola:</label><input name={`escola_${n}ano`} value={dados[`escola_${n}ano`] || ''} onChange={handleChange} style={cssInput} /></div>
                <div><label style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>Município/Estado:</label><input name={`municipio_estado_${n}ano`} value={dados[`municipio_estado_${n}ano`] || ''} onChange={handleChange} style={cssInput} /></div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>Situação:</label>
                  <select name={`situacao_${n}ano`} value={dados[`situacao_${n}ano`] || ''} onChange={handleChange} style={cssInput}>
                    <option value="">Selecione...</option>
                    <option value="APROVADO">APROVADO</option>
                    <option value="EM CURSO">EM CURSO</option>
                    <option value="REPROVADO">REPROVADO</option>
                    <option value="TRANSFERIDO">TRANSFERIDO</option>
                  </select>
                </div>
                <div><label style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>Dias Letivos:</label><input name={`dias_letivos_${n}ano`} value={dados[`dias_letivos_${n}ano`] || ''} onChange={handleChange} style={cssInput} /></div>
                <div><label style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>Mín. Promoção:</label><input name={`minimo_promocao_${n}ano`} value={dados[`minimo_promocao_${n}ano`] || ''} onChange={handleChange} style={cssInput} /></div>
                {ano.exibirFaltasMeio && (
                  <div style={{ backgroundColor: '#fff1f2', padding: 6, borderRadius: 6, border: '1px solid #fecdd3' }}>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#be123c' }}>Faltas/Horas (Meio):</label>
                    <input name={ano.keyFaltasMeio} value={dados[ano.keyFaltasMeio] || ''} onChange={handleChange} style={{ ...cssInput, backgroundColor: '#fff' }} />
                  </div>
                )}
                <div style={{ backgroundColor: '#fff1f2', padding: 6, borderRadius: 6, border: '1px solid #fecdd3' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#be123c' }}>CH Anual (Rodapé):</label>
                  <input name={ano.keyCHAnual} value={dados[ano.keyCHAnual] || ''} onChange={handleChange} style={{ ...cssInput, backgroundColor: '#fff' }} />
                </div>
                <div style={{ backgroundColor: '#eff6ff', padding: 6, borderRadius: 6, border: '1px solid #bfdbfe' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#1d4ed8' }}>CH Total:</label>
                  <input name={`ch_total_${n}ano`} value={dados[`ch_total_${n}ano`] || ''} onChange={handleChange} style={{ ...cssInput, backgroundColor: '#fff' }} />
                </div>
                <div style={{ backgroundColor: '#eff6ff', padding: 6, borderRadius: 6, border: '1px solid #bfdbfe' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#1d4ed8' }}>Faltas Totais:</label>
                  <input name={`faltas_totais_${n}ano`} value={dados[`faltas_totais_${n}ano`] || ''} onChange={handleChange} style={{ ...cssInput, backgroundColor: '#fff' }} />
                </div>
                <div style={{ gridColumn: 'span 4', borderTop: '1px dashed #cbd5e1', paddingTop: 12, marginTop: 8 }}>
                  <strong style={{ color: '#1e3a8a', fontSize: 14 }}>Disciplinas e Aproveitamento</strong>
                </div>
                <div><label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Nota L. Portuguesa:</label><input name={`nota_lp_${n}ano`} value={dados[`nota_lp_${n}ano`] || ''} onChange={handleChange} style={cssInput} /></div>
                {ano.temCHSeparada && <div><label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>CH L. Portuguesa:</label><input name={`ch_lp_${n}ano`} value={dados[`ch_lp_${n}ano`] || ''} onChange={handleChange} style={cssInput} /></div>}
                {ano.temIngles && (
                  <>
                    <div><label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Nota Inglês:</label><input name={`nota_ing_${n}ano`} value={dados[`nota_ing_${n}ano`] || ''} onChange={handleChange} style={cssInput} /></div>
                    {ano.temCHSeparada && <div><label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>CH Inglês:</label><input name={`ch_ing_${n}ano`} value={dados[`ch_ing_${n}ano`] || ''} onChange={handleChange} style={cssInput} /></div>}
                  </>
                )}
                <div><label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Nota Arte:</label><input name={`nota_Arte_${n}ano`} value={dados[`nota_Arte_${n}ano`] || ''} onChange={handleChange} style={cssInput} /></div>
                {ano.temCHSeparada && <div><label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>CH Arte:</label><input name={`ch_arte_${n}ano`} value={dados[`ch_arte_${n}ano`] || ''} onChange={handleChange} style={cssInput} /></div>}
                <div><label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Nota Ed. Física:</label><input name={`nota_edf_${n}ano`} value={dados[`nota_edf_${n}ano`] || ''} onChange={handleChange} style={cssInput} /></div>
                {ano.temCHSeparada && <div><label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>CH Ed. Física:</label><input name={`ch_edf_${n}ano`} value={dados[`ch_edf_${n}ano`] || ''} onChange={handleChange} style={cssInput} /></div>}
                <div><label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Nota Matemática:</label><input name={`nota_mat_${n}ano`} value={dados[`nota_mat_${n}ano`] || ''} onChange={handleChange} style={cssInput} /></div>
                {ano.temCHSeparada && <div><label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>CH Matemática:</label><input name={`ch_mat_${n}ano`} value={dados[`ch_mat_${n}ano`] || ''} onChange={handleChange} style={cssInput} /></div>}
                <div><label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Nota Ciências:</label><input name={`nota_cie_${n}ano`} value={dados[`nota_cie_${n}ano`] || ''} onChange={handleChange} style={cssInput} /></div>
                {ano.temCHSeparada && <div><label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>CH Ciências:</label><input name={`ch_cie_${n}ano`} value={dados[`ch_cie_${n}ano`] || ''} onChange={handleChange} style={cssInput} /></div>}
                <div><label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Nota História:</label><input name={`nota_hist_${n}ano`} value={dados[`nota_hist_${n}ano`] || ''} onChange={handleChange} style={cssInput} /></div>
                {ano.temCHSeparada && <div><label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>CH História:</label><input name={`ch_hist_${n}ano`} value={dados[`ch_hist_${n}ano`] || ''} onChange={handleChange} style={cssInput} /></div>}
                <div><label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Nota Geografia:</label><input name={`nota_geo_${n}ano`} value={dados[`nota_geo_${n}ano`] || ''} onChange={handleChange} style={cssInput} /></div>
                {ano.temCHSeparada && <div><label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>CH Geografia:</label><input name={`ch_geo_${n}ano`} value={dados[`ch_geo_${n}ano`] || ''} onChange={handleChange} style={cssInput} /></div>}
                <div><label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Nota Ens. Religioso:</label><input name={`nota_ensr_${n}ano`} value={dados[`nota_ensr_${n}ano`] || ''} onChange={handleChange} style={cssInput} /></div>
                {ano.temCHSeparada && <div><label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>CH Ens. Religioso:</label><input name={`ch_ensr_${n}ano`} value={dados[`ch_ensr_${n}ano`] || ''} onChange={handleChange} style={cssInput} /></div>}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>Observações do ano:</label>
                  <input name={`obs_${n}ano`} value={dados[`obs_${n}ano`] || ''} onChange={handleChange} style={cssInput} />
                </div>
              </div>
            </details>
          );
        })}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 8, position: 'sticky', bottom: 0, background: '#f8fafc', padding: '16px 0', borderTop: '1px solid #e2e8f0' }}>
          <button type="submit" style={{ padding: '12px 24px', background: '#1e3a8a', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 15, cursor: 'pointer' }}>
            Gerar Histórico (.docx)
          </button>
          <button type="button" onClick={salvarNoBanco} disabled={salvandoHistorico} style={{ padding: '12px 20px', background: '#0f766e', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>
            {salvandoHistorico ? 'Salvando...' : 'Salvar no banco'}
          </button>
          <button type="button" onClick={limparFormulario} style={{ padding: '12px 20px', background: '#fff', color: '#991b1b', border: '1px solid #fecaca', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>
            Limpar formulário
          </button>
        </div>
      </form>
    </div>
  );
}
