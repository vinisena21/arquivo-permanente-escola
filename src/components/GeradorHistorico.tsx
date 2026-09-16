import React, { useState } from 'react';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { saveAs } from 'file-saver';

const ANOS_CONFIG = [
  { num: '1', titulo: '✏️ 1º Ano (Ciclo da Alfabetização)', temIngles: false, temCHSeparada: false, keyCHAnual: 'ch_a_1ano', keyFaltasMeio: 'faltas_1ano', exibirFaltasMeio: false },
  { num: '2', titulo: '✏️ 2º Ano (Ciclo da Alfabetização)', temIngles: false, temCHSeparada: false, keyCHAnual: 'ch_a_2ano', keyFaltasMeio: 'faltas_2ano', exibirFaltasMeio: false },
  { num: '3', titulo: '✏️ 3º Ano (Ciclo da Alfabetização)', temIngles: false, temCHSeparada: false, keyCHAnual: 'ch_a_3ano', keyFaltasMeio: 'faltas_3ano', exibirFaltasMeio: false },
  { num: '4', titulo: '📘 4º Ano (Ciclo Complementar)', temIngles: false, temCHSeparada: false, keyCHAnual: 'ch_a_4ano', keyFaltasMeio: 'faltas_4ano', exibirFaltasMeio: false },
  { num: '5', titulo: '📘 5º Ano (Ciclo Complementar)', temIngles: false, temCHSeparada: false, keyCHAnual: 'ch_a_5ano', keyFaltasMeio: 'faltas_5ano', exibirFaltasMeio: false },
  { num: '6', titulo: '📚 6º Ano (Ciclo Intermediário)', temIngles: true, temCHSeparada: true, keyCHAnual: 'ch_a_6ano', keyFaltasMeio: 'faltas_6ano', exibirFaltasMeio: true },
  { num: '7', titulo: '📚 7º Ano (Ciclo Intermediário)', temIngles: true, temCHSeparada: true, keyCHAnual: 'ch_a_7ano', keyFaltasMeio: 'faltas_7ano', exibirFaltasMeio: true },
  { num: '8', titulo: '🎓 8º Ano (Ciclo da Consolidação)', temIngles: true, temCHSeparada: true, keyCHAnual: 'ch_a_8ano', keyFaltasMeio: 'faltas_8ano', exibirFaltasMeio: true },
  { num: '9', titulo: '🎓 9º Ano (Ciclo da Consolidação)', temIngles: true, temCHSeparada: true, keyCHAnual: 'ch_a_9ano', keyFaltasMeio: 'faltas_9ano', exibirFaltasMeio: true },
];

const estadoInicial: Record<string, string> = {
  nome_aluno: '', naturalidade: '', uf: '', nacionalidade: '',
  sexo: '', data_nascimento: '', nome_pai: '', nome_mae: '',
  rg: '', orgao_rg: '', status_curso: '', ano_curso: '',
  data_extenso: '16 de setembro de 2026',
  historico_escolar: '', 
  fundamentacao_legal: 'Lei Federal nº 9.394/1996 (LDBEN); Resolução CNE/CP nº 02/2017 (BNCC); Resolução CEE/MG nº 481/2021; Currículo Referência de Minas Gerais (CRMG). Instituição registrada sob o Código INEP nº 31353426.',
};

ANOS_CONFIG.forEach((ano) => {
  const n = ano.num;
  estadoInicial[`ano_letivo_${n}ano`] = '';
  estadoInicial[`escola_${n}ano`] = '';
  estadoInicial[`municipio_estado_${n}ano`] = '';
  estadoInicial[`dias_letivos_${n}ano`] = '';
  estadoInicial[`minimo_promocao_${n}ano`] = '';
  estadoInicial[`situacao_${n}ano`] = '';
  estadoInicial[`obs_${n}ano`] = '';

  estadoInicial[ano.keyCHAnual] = '';      
  estadoInicial[ano.keyFaltasMeio] = '';   
  estadoInicial[`ch_total_${n}ano`] = '';   
  estadoInicial[`faltas_totais_${n}ano`] = ''; 

  estadoInicial[`nota_lp_${n}ano`] = '';
  if (ano.temIngles) estadoInicial[`nota_ing_${n}ano`] = '';
  estadoInicial[`nota_Arte_${n}ano`] = '';
  estadoInicial[`nota_edf_${n}ano`] = '';
  estadoInicial[`nota_mat_${n}ano`] = '';
  estadoInicial[`nota_cie_${n}ano`] = '';
  estadoInicial[`nota_hist_${n}ano`] = '';
  estadoInicial[`nota_geo_${n}ano`] = '';
  estadoInicial[`nota_ensr_${n}ano`] = '';

  if (ano.temCHSeparada) {
    estadoInicial[`ch_lp_${n}ano`] = '';
    estadoInicial[`ch_ing_${n}ano`] = '';
    estadoInicial[`ch_arte_${n}ano`] = '';
    estadoInicial[`ch_edf_${n}ano`] = '';
    estadoInicial[`ch_mat_${n}ano`] = '';
    estadoInicial[`ch_cie_${n}ano`] = '';
    estadoInicial[`ch_hist_${n}ano`] = '';
    estadoInicial[`ch_geo_${n}ano`] = '';
    estadoInicial[`ch_ensr_${n}ano`] = '';
  }
});

export default function GeradorHistorico() {
  const [dados, setDados] = useState<Record<string, string>>(estadoInicial);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setDados({ ...dados, [e.target.name]: e.target.value });
  };

  const gerarDocumento = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/modelo_historico.docx');
      if (!response.ok) throw new Error('Arquivo modelo_historico.docx não encontrado.');
      
      const blob = await response.blob();
      const reader = new FileReader();

      reader.onload = (evento) => {
        const content = evento.target?.result as ArrayBuffer;
        const zip = new PizZip(content);
        const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true, nullGetter: () => "" });

        // Envia todos os dados preenchidos (incluindo o título e as leis)
        doc.render(dados);

        const out = doc.getZip().generate({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
        const nomeArquivo = dados.nome_aluno ? dados.nome_aluno.replace(/\s+/g, '_') : 'Aluno';
        saveAs(out, `Historico_${nomeArquivo}.docx`);
      };

      reader.readAsArrayBuffer(blob);
    } catch (error) {
      console.error(error);
      alert('Erro ao gerar documento.');
    }
  };

  const cssCaixa = { 
    border: '1px solid #cbd5e1', 
    borderRadius: '12px', 
    padding: '20px', 
    marginBottom: '20px', 
    backgroundColor: '#ffffff',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)'
  };
  const cssTitulo = { fontWeight: '700', fontSize: '16px', cursor: 'pointer', outline: 'none', paddingBottom: '4px', color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: '8px' };
  const cssInput = { width: '100%', padding: '8px 12px', marginTop: '6px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' as const, outline: 'none', backgroundColor: '#f8fafc' };
  const cssGrid2 = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginTop: '12px' };
  const cssGrid4 = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginTop: '12px' };

  return (
    <div style={{ padding: '10px 0' }}>
      <div style={{ backgroundColor: '#1e3a8a', color: '#ffffff', padding: '20px 24px', borderRadius: '16px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', borderBottom: '4px solid #3b82f6' }}>
        <div>
          <span style={{ fontSize: '12px', fontWeight: '800', letterSpacing: '1px', textTransform: 'uppercase', color: '#93c5fd' }}>
            E.M. MARIA GERALDA MIRANDA BRITO SALOMÃO
          </span>
          <h2 style={{ margin: '4px 0 0 0', fontSize: '20px', fontWeight: '900' }}>
            Gerador Oficial de Histórico Escolar
          </h2>
        </div>
        <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', padding: '8px 14px', borderRadius: '10px', fontSize: '13px', fontWeight: '600' }}>
          🏛️ Ponto dos Volantes — MG
        </div>
      </div>

      <form onSubmit={gerarDocumento} style={{ display: 'flex', flexDirection: 'column' }}>
        <details open style={cssCaixa}>
          <summary style={cssTitulo}>👤 Identificação do Aluno e Configurações</summary>
          <div style={cssGrid2}>
            
            {/* CAMPO DO TÍTULO */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: '13px', fontWeight: '800', color: '#be123c' }}>Título do Documento (Cabeçalho):</label>
              <select name="historico_escolar" value={dados.historico_escolar} onChange={handleChange} style={{ ...cssInput, border: '1px solid #fda4af', backgroundColor: '#fff1f2' }} required>
                <option value="">Selecione o título que vai sair no documento...</option>
                <option value="HISTÓRICO ESCOLAR - TRANSFERÊNCIA">HISTÓRICO ESCOLAR - TRANSFERÊNCIA</option>
                <option value="CERTIFICADO DE CONCLUSÃO DA EDUCAÇÃO BÁSICA">CERTIFICADO DE CONCLUSÃO DA EDUCAÇÃO BÁSICA</option>
                <option value="HISTÓRICO ESCOLAR - ENSINO FUNDAMENTAL">HISTÓRICO ESCOLAR - ENSINO FUNDAMENTAL</option>
              </select>
            </div>

            {/* CAMPO DA FUNDAMENTAÇÃO LEGAL (LEIS) */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: '13px', fontWeight: '800', color: '#1e3a8a' }}>Fundamentação Legal (Leis do Cabeçalho):</label>
              <textarea name="fundamentacao_legal" value={dados.fundamentacao_legal} onChange={handleChange} rows={2} style={{ ...cssInput, border: '1px solid #bfdbfe', backgroundColor: '#eff6ff' }} required />
            </div>
            
            <div><label style={{ fontSize: '13px', fontWeight: '700', color: '#334155' }}>Nome do Aluno:</label><input name="nome_aluno" value={dados.nome_aluno} onChange={handleChange} style={cssInput} required /></div>
            <div><label style={{ fontSize: '13px', fontWeight: '700', color: '#334155' }}>Data de Nascimento:</label><input name="data_nascimento" value={dados.data_nascimento} onChange={handleChange} placeholder="DD/MM/AAAA" style={cssInput} required /></div>
            <div><label style={{ fontSize: '13px', fontWeight: '700', color: '#334155' }}>Nome da Mãe:</label><input name="nome_mae" value={dados.nome_mae} onChange={handleChange} style={cssInput} required /></div>
            <div><label style={{ fontSize: '13px', fontWeight: '700', color: '#334155' }}>Nome do Pai:</label><input name="nome_pai" value={dados.nome_pai} onChange={handleChange} style={cssInput} /></div>
            <div><label style={{ fontSize: '13px', fontWeight: '700', color: '#334155' }}>Naturalidade:</label><input name="naturalidade" value={dados.naturalidade} onChange={handleChange} placeholder="Ex: PONTO DOS VOLANTES" style={cssInput} /></div>
            <div><label style={{ fontSize: '13px', fontWeight: '700', color: '#334155' }}>UF:</label><input name="uf" value={dados.uf} onChange={handleChange} placeholder="Ex: MG" style={cssInput} /></div>
            <div><label style={{ fontSize: '13px', fontWeight: '700', color: '#334155' }}>Nacionalidade:</label><input name="nacionalidade" value={dados.nacionalidade} onChange={handleChange} placeholder="Ex: BRASILEIRA" style={cssInput} /></div>
            
            <div>
              <label style={{ fontSize: '13px', fontWeight: '700', color: '#334155' }}>Sexo:</label>
              <select name="sexo" value={dados.sexo} onChange={handleChange} style={cssInput}>
                <option value="">Selecione...</option>
                <option value="MASCULINO">MASCULINO</option>
                <option value="FEMININO">FEMININO</option>
              </select>
            </div>

            <div><label style={{ fontSize: '13px', fontWeight: '700', color: '#334155' }}>RG:</label><input name="rg" value={dados.rg} onChange={handleChange} placeholder="Ex: ---" style={cssInput} /></div>
            <div><label style={{ fontSize: '13px', fontWeight: '700', color: '#334155' }}>Órgão Expedidor:</label><input name="orgao_rg" value={dados.orgao_rg} onChange={handleChange} placeholder="Ex: ---" style={cssInput} /></div>
            
            <div>
              <label style={{ fontSize: '13px', fontWeight: '700', color: '#334155' }}>Status Atual:</label>
              <select name="status_curso" value={dados.status_curso} onChange={handleChange} style={cssInput}>
                <option value="">Selecione...</option>
                <option value="CURSANDO">CURSANDO</option>
                <option value="CONCLUIU">CONCLUIU</option>
                <option value="TRANSFERIDO">TRANSFERIDO</option>
              </select>
            </div>
            
            <div><label style={{ fontSize: '13px', fontWeight: '700', color: '#334155' }}>Série Atual (Ex: O 1º ANO):</label><input name="ano_curso" value={dados.ano_curso} onChange={handleChange} style={cssInput} /></div>
            <div><label style={{ fontSize: '13px', fontWeight: '700', color: '#334155' }}>Data de Expedição (Extenso):</label><input name="data_extenso" value={dados.data_extenso} onChange={handleChange} placeholder="Ex: 16 de setembro de 2026" style={cssInput} /></div>
          </div>
        </details>

        {ANOS_CONFIG.map((ano) => {
          const n = ano.num;
          return (
            <details key={n} style={cssCaixa}>
              <summary style={cssTitulo}>{ano.titulo}</summary>
              <div style={cssGrid4}>
                <div><label style={{ fontSize: '12px', fontWeight: '700', color: '#475569' }}>Ano Letivo:</label><input name={`ano_letivo_${n}ano`} value={dados[`ano_letivo_${n}ano`]} onChange={handleChange} placeholder="Ex: 2026" style={cssInput} /></div>
                <div style={{ gridColumn: 'span 2' }}><label style={{ fontSize: '12px', fontWeight: '700', color: '#475569' }}>Escola:</label><input name={`escola_${n}ano`} value={dados[`escola_${n}ano`]} onChange={handleChange} style={cssInput} /></div>
                <div><label style={{ fontSize: '12px', fontWeight: '700', color: '#475569' }}>Município/Estado:</label><input name={`municipio_estado_${n}ano`} value={dados[`municipio_estado_${n}ano`]} onChange={handleChange} style={cssInput} /></div>
                
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569' }}>Situação:</label>
                  <select name={`situacao_${n}ano`} value={dados[`situacao_${n}ano`]} onChange={handleChange} style={cssInput}>
                    <option value="">Selecione...</option>
                    <option value="APROVADO">APROVADO</option>
                    <option value="EM CURSO">EM CURSO</option>
                    <option value="REPROVADO">REPROVADO</option>
                    <option value="TRANSFERIDO">TRANSFERIDO</option>
                  </select>
                </div>

                <div><label style={{ fontSize: '12px', fontWeight: '700', color: '#475569' }}>Dias Letivos:</label><input name={`dias_letivos_${n}ano`} value={dados[`dias_letivos_${n}ano`]} onChange={handleChange} placeholder="Ex: 200" style={cssInput} /></div>
                <div><label style={{ fontSize: '12px', fontWeight: '700', color: '#475569' }}>Mín. Promoção:</label><input name={`minimo_promocao_${n}ano`} value={dados[`minimo_promocao_${n}ano`]} onChange={handleChange} placeholder="Ex: 60%" style={cssInput} /></div>
                
                {ano.exibirFaltasMeio && (
                  <div style={{ backgroundColor: '#fff1f2', padding: '6px', borderRadius: '6px', border: '1px solid #fecdd3' }}>
                    <label style={{ fontSize: '12px', fontWeight: '700', color: '#be123c' }}>Faltas/Horas (Meio):</label>
                    <input name={ano.keyFaltasMeio} value={dados[ano.keyFaltasMeio]} onChange={handleChange} style={{ ...cssInput, backgroundColor: '#ffffff' }} />
                  </div>
                )}

                <div style={{ backgroundColor: '#fff1f2', padding: '6px', borderRadius: '6px', border: '1px solid #fecdd3' }}>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#be123c' }}>CH Anual (Rodapé):</label>
                  <input name={ano.keyCHAnual} value={dados[ano.keyCHAnual]} onChange={handleChange} style={{ ...cssInput, backgroundColor: '#ffffff' }} />
                </div>

                <div style={{ backgroundColor: '#eff6ff', padding: '6px', borderRadius: '6px', border: '1px solid #bfdbfe' }}>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#1d4ed8' }}>CH Total (Canto Dir):</label><input name={`ch_total_${n}ano`} value={dados[`ch_total_${n}ano`]} onChange={handleChange} style={{ ...cssInput, backgroundColor: '#ffffff' }} />
                </div>
                <div style={{ backgroundColor: '#eff6ff', padding: '6px', borderRadius: '6px', border: '1px solid #bfdbfe' }}>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#1d4ed8' }}>Faltas Totais:</label><input name={`faltas_totais_${n}ano`} value={dados[`faltas_totais_${n}ano`]} onChange={handleChange} style={{ ...cssInput, backgroundColor: '#ffffff' }} />
                </div>

                <div style={{ gridColumn: 'span 4', borderTop: '1px dashed #cbd5e1', paddingTop: '12px', marginTop: '8px' }}>
                  <strong style={{ color: '#1e3a8a', fontSize: '14px' }}>Disciplinas e Aproveitamento</strong>
                </div>

                <div><label style={{ fontSize: '12px', fontWeight: '600', color: '#475569' }}>Nota L. Portuguesa:</label><input name={`nota_lp_${n}ano`} value={dados[`nota_lp_${n}ano`]} onChange={handleChange} style={cssInput} /></div>
                {ano.temCHSeparada && <div><label style={{ fontSize: '12px', fontWeight: '600', color: '#475569' }}>CH L. Portuguesa:</label><input name={`ch_lp_${n}ano`} value={dados[`ch_lp_${n}ano`]} onChange={handleChange} style={cssInput} /></div>}

                {ano.temIngles && <>
                  <div><label style={{ fontSize: '12px', fontWeight: '600', color: '#475569' }}>Nota Inglês:</label><input name={`nota_ing_${n}ano`} value={dados[`nota_ing_${n}ano`]} onChange={handleChange} style={cssInput} /></div>
                  {ano.temCHSeparada && <div><label style={{ fontSize: '12px', fontWeight: '600', color: '#475569' }}>CH Inglês:</label><input name={`ch_ing_${n}ano`} value={dados[`ch_ing_${n}ano`]} onChange={handleChange} style={cssInput} /></div>}
                </>}

                <div><label style={{ fontSize: '12px', fontWeight: '600', color: '#475569' }}>Nota Arte:</label><input name={`nota_Arte_${n}ano`} value={dados[`nota_Arte_${n}ano`]} onChange={handleChange} style={cssInput} /></div>
                {ano.temCHSeparada && <div><label style={{ fontSize: '12px', fontWeight: '600', color: '#475569' }}>CH Arte:</label><input name={`ch_arte_${n}ano`} value={dados[`ch_arte_${n}ano`]} onChange={handleChange} style={cssInput} /></div>}

                <div><label style={{ fontSize: '12px', fontWeight: '600', color: '#475569' }}>Nota Ed. Física:</label><input name={`nota_edf_${n}ano`} value={dados[`nota_edf_${n}ano`]} onChange={handleChange} style={cssInput} /></div>
                {ano.temCHSeparada && <div><label style={{ fontSize: '12px', fontWeight: '600', color: '#475569' }}>CH Ed. Física:</label><input name={`ch_edf_${n}ano`} value={dados[`ch_edf_${n}ano`]} onChange={handleChange} style={cssInput} /></div>}

                <div><label style={{ fontSize: '12px', fontWeight: '600', color: '#475569' }}>Nota Matemática:</label><input name={`nota_mat_${n}ano`} value={dados[`nota_mat_${n}ano`]} onChange={handleChange} style={cssInput} /></div>
                {ano.temCHSeparada && <div><label style={{ fontSize: '12px', fontWeight: '600', color: '#475569' }}>CH Matemática:</label><input name={`ch_mat_${n}ano`} value={dados[`ch_mat_${n}ano`]} onChange={handleChange} style={cssInput} /></div>}

                <div><label style={{ fontSize: '12px', fontWeight: '600', color: '#475569' }}>Nota Ciências:</label><input name={`nota_cie_${n}ano`} value={dados[`nota_cie_${n}ano`]} onChange={handleChange} style={cssInput} /></div>
                {ano.temCHSeparada && <div><label style={{ fontSize: '12px', fontWeight: '600', color: '#475569' }}>CH Ciências:</label><input name={`ch_cie_${n}ano`} value={dados[`ch_cie_${n}ano`]} onChange={handleChange} style={cssInput} /></div>}

                <div><label style={{ fontSize: '12px', fontWeight: '600', color: '#475569' }}>Nota História:</label><input name={`nota_hist_${n}ano`} value={dados[`nota_hist_${n}ano`]} onChange={handleChange} style={cssInput} /></div>
                {ano.temCHSeparada && <div><label style={{ fontSize: '12px', fontWeight: '600', color: '#475569' }}>CH História:</label><input name={`ch_hist_${n}ano`} value={dados[`ch_hist_${n}ano`]} onChange={handleChange} style={cssInput} /></div>}

                <div><label style={{ fontSize: '12px', fontWeight: '600', color: '#475569' }}>Nota Geografia:</label><input name={`nota_geo_${n}ano`} value={dados[`nota_geo_${n}ano`]} onChange={handleChange} style={cssInput} /></div>
                {ano.temCHSeparada && <div><label style={{ fontSize: '12px', fontWeight: '600', color: '#475569' }}>CH Geografia:</label><input name={`ch_geo_${n}ano`} value={dados[`ch_geo_${n}ano`]} onChange={handleChange} style={cssInput} /></div>}

                <div><label style={{ fontSize: '12px', fontWeight: '600', color: '#475569' }}>Nota Ens. Religioso:</label><input name={`nota_ensr_${n}ano`} value={dados[`nota_ensr_${n}ano`]} onChange={handleChange} style={cssInput} /></div>
                {ano.temCHSeparada && <div><label style={{ fontSize: '12px', fontWeight: '600', color: '#475569' }}>CH Ens. Religioso:</label><input name={`ch_ensr_${n}ano`} value={dados[`ch_ensr_${n}ano`]} onChange={handleChange} style={cssInput} /></div>}

                <div style={{ gridColumn: 'span 4', marginTop: '8px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569' }}>Observações do Ano:</label>
                  <input name={`obs_${n}ano`} value={dados[`obs_${n}ano`]} onChange={handleChange} style={cssInput} placeholder="Ex: SEGUE EM ANEXO A FICHA INDIVIDUAL" />
                </div>
              </div>
            </details>
          );
        })}

        <button 
          type="submit" 
          style={{ 
            backgroundColor: '#1e3a8a', 
            color: 'white', 
            border: 'none', 
            padding: '18px', 
            fontSize: '16px', 
            fontWeight: '800', 
            borderRadius: '12px', 
            cursor: 'pointer', 
            marginTop: '10px', 
            marginBottom: '40px',
            boxShadow: '0 10px 15px -3px rgba(30, 58, 138, 0.3)'
          }}
        >
          📄 Gerar Histórico Preenchido (.DOCX)
        </button>
      </form>
    </div>
  );
}