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

/* Classes reutilizáveis do Design System */
const labelClass = 'block text-xs font-bold text-gray-600 mb-1';
const labelHighlight = 'block text-xs font-extrabold text-primary-800 mb-1';
const labelDanger = 'block text-xs font-extrabold text-danger-700 mb-1';
const inputClass =
  'w-full px-3 py-2 mt-0.5 rounded-md border border-gray-300 bg-gray-50 text-sm outline-none transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-100';
const inputDanger =
  'w-full px-3 py-2 mt-0.5 rounded-md border border-red-300 bg-red-50 text-sm outline-none transition-colors focus:border-red-400 focus:ring-2 focus:ring-red-100';
const inputPrimary =
  'w-full px-3 py-2 mt-0.5 rounded-md border border-primary-200 bg-primary-50 text-sm outline-none transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-100';
const highlightBoxDanger =
  'bg-red-50 p-1.5 rounded-md border border-red-200';
const highlightBoxPrimary =
  'bg-primary-50 p-1.5 rounded-md border border-primary-200';

export default function GeradorHistorico() {
  const [dados, setDados] = useState<Record<string, string>>(estadoInicial);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
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
        const doc = new Docxtemplater(zip, {
          paragraphLoop: true,
          linebreaks: true,
          nullGetter: () => '',
        });

        doc.render(dados);

        const out = doc.getZip().generate({
          type: 'blob',
          mimeType:
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        });
        const nomeArquivo = dados.nome_aluno
          ? dados.nome_aluno.replace(/\s+/g, '_')
          : 'Aluno';
        saveAs(out, `Historico_${nomeArquivo}.docx`);
      };

      reader.readAsArrayBuffer(blob);
    } catch (error) {
      console.error(error);
      alert('Erro ao gerar documento.');
    }
  };

  return (
    <div className="py-2 animate-fade-in">
      {/* Cabeçalho */}
      <div className="bg-primary-800 text-white px-6 py-5 rounded-xl mb-6 flex flex-wrap items-center justify-between gap-4 border-b-4 border-primary-500 shadow-md">
        <div>
          <span className="text-xs font-extrabold tracking-wider uppercase text-primary-300">
            E.M. MARIA GERALDA MIRANDA BRITO SALOMÃO
          </span>
          <h2 className="mt-1 text-xl font-black">
            Gerador Oficial de Histórico Escolar
          </h2>
        </div>
        <div className="bg-white/10 px-3.5 py-2 rounded-lg text-sm font-semibold">
          🏛️ Ponto dos Volantes — MG
        </div>
      </div>

      <form onSubmit={gerarDocumento} className="flex flex-col gap-5">
        {/* Identificação */}
        <details
          open
          className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm animate-slide-up"
        >
          <summary className="font-bold text-base text-primary-800 cursor-pointer outline-none flex items-center gap-2 list-none">
            👤 Identificação do Aluno e Configurações
          </summary>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {/* Título do documento */}
            <div className="md:col-span-2">
              <label className={labelDanger}>
                Título do Documento (Cabeçalho):
              </label>
              <select
                name="historico_escolar"
                value={dados.historico_escolar}
                onChange={handleChange}
                className={inputDanger}
                required
              >
                <option value="">
                  Selecione o título que vai sair no documento...
                </option>
                <option value="HISTÓRICO ESCOLAR - TRANSFERÊNCIA">
                  HISTÓRICO ESCOLAR - TRANSFERÊNCIA
                </option>
                <option value="CERTIFICADO DE CONCLUSÃO DA EDUCAÇÃO BÁSICA">
                  CERTIFICADO DE CONCLUSÃO DA EDUCAÇÃO BÁSICA
                </option>
                <option value="HISTÓRICO ESCOLAR - ENSINO FUNDAMENTAL">
                  HISTÓRICO ESCOLAR - ENSINO FUNDAMENTAL
                </option>
              </select>
            </div>

            {/* Fundamentação legal */}
            <div className="md:col-span-2">
              <label className={labelHighlight}>
                Fundamentação Legal (Leis do Cabeçalho):
              </label>
              <textarea
                name="fundamentacao_legal"
                value={dados.fundamentacao_legal}
                onChange={handleChange}
                rows={2}
                className={inputPrimary}
                required
              />
            </div>

            <div>
              <label className={labelClass}>Nome do Aluno:</label>
              <input
                name="nome_aluno"
                value={dados.nome_aluno}
                onChange={handleChange}
                className={inputClass}
                required
              />
            </div>

            <div>
              <label className={labelClass}>Data de Nascimento:</label>
              <input
                name="data_nascimento"
                value={dados.data_nascimento}
                onChange={handleChange}
                placeholder="DD/MM/AAAA"
                className={inputClass}
                required
              />
            </div>

            <div>
              <label className={labelClass}>Nome da Mãe:</label>
              <input
                name="nome_mae"
                value={dados.nome_mae}
                onChange={handleChange}
                className={inputClass}
                required
              />
            </div>

            <div>
              <label className={labelClass}>Nome do Pai:</label>
              <input
                name="nome_pai"
                value={dados.nome_pai}
                onChange={handleChange}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Naturalidade:</label>
              <input
                name="naturalidade"
                value={dados.naturalidade}
                onChange={handleChange}
                placeholder="Ex: PONTO DOS VOLANTES"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>UF:</label>
              <input
                name="uf"
                value={dados.uf}
                onChange={handleChange}
                placeholder="Ex: MG"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Nacionalidade:</label>
              <input
                name="nacionalidade"
                value={dados.nacionalidade}
                onChange={handleChange}
                placeholder="Ex: BRASILEIRA"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Sexo:</label>
              <select
                name="sexo"
                value={dados.sexo}
                onChange={handleChange}
                className={inputClass}
              >
                <option value="">Selecione...</option>
                <option value="MASCULINO">MASCULINO</option>
                <option value="FEMININO">FEMININO</option>
              </select>
            </div>

            <div>
              <label className={labelClass}>RG:</label>
              <input
                name="rg"
                value={dados.rg}
                onChange={handleChange}
                placeholder="Ex: ---"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Órgão Expedidor:</label>
              <input
                name="orgao_rg"
                value={dados.orgao_rg}
                onChange={handleChange}
                placeholder="Ex: ---"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Status Atual:</label>
              <select
                name="status_curso"
                value={dados.status_curso}
                onChange={handleChange}
                className={inputClass}
              >
                <option value="">Selecione...</option>
                <option value="CURSANDO">CURSANDO</option>
                <option value="CONCLUIU">CONCLUIU</option>
                <option value="TRANSFERIDO">TRANSFERIDO</option>
              </select>
            </div>

            <div>
              <label className={labelClass}>Série Atual (Ex: O 1º ANO):</label>
              <input
                name="ano_curso"
                value={dados.ano_curso}
                onChange={handleChange}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Data de Expedição (Extenso):</label>
              <input
                name="data_extenso"
                value={dados.data_extenso}
                onChange={handleChange}
                placeholder="Ex: 16 de setembro de 2026"
                className={inputClass}
              />
            </div>
          </div>
        </details>

        {/* Anos escolares */}
        {ANOS_CONFIG.map((ano) => {
          const n = ano.num;
          return (
            <details
              key={n}
              className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm"
            >
              <summary className="font-bold text-base text-primary-800 cursor-pointer outline-none flex items-center gap-2 list-none">
                {ano.titulo}
              </summary>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
                <div>
                  <label className={labelClass}>Ano Letivo:</label>
                  <input
                    name={`ano_letivo_${n}ano`}
                    value={dados[`ano_letivo_${n}ano`]}
                    onChange={handleChange}
                    placeholder="Ex: 2026"
                    className={inputClass}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className={labelClass}>Escola:</label>
                  <input
                    name={`escola_${n}ano`}
                    value={dados[`escola_${n}ano`]}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Município/Estado:</label>
                  <input
                    name={`municipio_estado_${n}ano`}
                    value={dados[`municipio_estado_${n}ano`]}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Situação:</label>
                  <select
                    name={`situacao_${n}ano`}
                    value={dados[`situacao_${n}ano`]}
                    onChange={handleChange}
                    className={inputClass}
                  >
                    <option value="">Selecione...</option>
                    <option value="APROVADO">APROVADO</option>
                    <option value="EM CURSO">EM CURSO</option>
                    <option value="REPROVADO">REPROVADO</option>
                    <option value="TRANSFERIDO">TRANSFERIDO</option>
                  </select>
                </div>

                <div>
                  <label className={labelClass}>Dias Letivos:</label>
                  <input
                    name={`dias_letivos_${n}ano`}
                    value={dados[`dias_letivos_${n}ano`]}
                    onChange={handleChange}
                    placeholder="Ex: 200"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Mín. Promoção:</label>
                  <input
                    name={`minimo_promocao_${n}ano`}
                    value={dados[`minimo_promocao_${n}ano`]}
                    onChange={handleChange}
                    placeholder="Ex: 60%"
                    className={inputClass}
                  />
                </div>

                {ano.exibirFaltasMeio && (
                  <div className={highlightBoxDanger}>
                    <label className={labelDanger}>Faltas/Horas (Meio):</label>
                    <input
                      name={ano.keyFaltasMeio}
                      value={dados[ano.keyFaltasMeio]}
                      onChange={handleChange}
                      className={`${inputClass} bg-white`}
                    />
                  </div>
                )}

                <div className={highlightBoxDanger}>
                  <label className={labelDanger}>CH Anual (Rodapé):</label>
                  <input
                    name={ano.keyCHAnual}
                    value={dados[ano.keyCHAnual]}
                    onChange={handleChange}
                    className={`${inputClass} bg-white`}
                  />
                </div>

                <div className={highlightBoxPrimary}>
                  <label className={labelHighlight}>CH Total (Canto Dir):</label>
                  <input
                    name={`ch_total_${n}ano`}
                    value={dados[`ch_total_${n}ano`]}
                    onChange={handleChange}
                    className={`${inputClass} bg-white`}
                  />
                </div>

                <div className={highlightBoxPrimary}>
                  <label className={labelHighlight}>Faltas Totais:</label>
                  <input
                    name={`faltas_totais_${n}ano`}
                    value={dados[`faltas_totais_${n}ano`]}
                    onChange={handleChange}
                    className={`${inputClass} bg-white`}
                  />
                </div>

                {/* Disciplinas */}
                <div className="col-span-full border-t border-dashed border-gray-300 pt-3 mt-1">
                  <strong className="text-sm text-primary-800">
                    Disciplinas e Aproveitamento
                  </strong>
                </div>

                <div>
                  <label className={labelClass}>Nota L. Portuguesa:</label>
                  <input
                    name={`nota_lp_${n}ano`}
                    value={dados[`nota_lp_${n}ano`]}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
                {ano.temCHSeparada && (
                  <div>
                    <label className={labelClass}>CH L. Portuguesa:</label>
                    <input
                      name={`ch_lp_${n}ano`}
                      value={dados[`ch_lp_${n}ano`]}
                      onChange={handleChange}
                      className={inputClass}
                    />
                  </div>
                )}

                {ano.temIngles && (
                  <>
                    <div>
                      <label className={labelClass}>Nota Inglês:</label>
                      <input
                        name={`nota_ing_${n}ano`}
                        value={dados[`nota_ing_${n}ano`]}
                        onChange={handleChange}
                        className={inputClass}
                      />
                    </div>
                    {ano.temCHSeparada && (
                      <div>
                        <label className={labelClass}>CH Inglês:</label>
                        <input
                          name={`ch_ing_${n}ano`}
                          value={dados[`ch_ing_${n}ano`]}
                          onChange={handleChange}
                          className={inputClass}
                        />
                      </div>
                    )}
                  </>
                )}

                <div>
                  <label className={labelClass}>Nota Arte:</label>
                  <input
                    name={`nota_Arte_${n}ano`}
                    value={dados[`nota_Arte_${n}ano`]}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
                {ano.temCHSeparada && (
                  <div>
                    <label className={labelClass}>CH Arte:</label>
                    <input
                      name={`ch_arte_${n}ano`}
                      value={dados[`ch_arte_${n}ano`]}
                      onChange={handleChange}
                      className={inputClass}
                    />
                  </div>
                )}

                <div>
                  <label className={labelClass}>Nota Ed. Física:</label>
                  <input
                    name={`nota_edf_${n}ano`}
                    value={dados[`nota_edf_${n}ano`]}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
                {ano.temCHSeparada && (
                  <div>
                    <label className={labelClass}>CH Ed. Física:</label>
                    <input
                      name={`ch_edf_${n}ano`}
                      value={dados[`ch_edf_${n}ano`]}
                      onChange={handleChange}
                      className={inputClass}
                    />
                  </div>
                )}

                <div>
                  <label className={labelClass}>Nota Matemática:</label>
                  <input
                    name={`nota_mat_${n}ano`}
                    value={dados[`nota_mat_${n}ano`]}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
                {ano.temCHSeparada && (
                  <div>
                    <label className={labelClass}>CH Matemática:</label>
                    <input
                      name={`ch_mat_${n}ano`}
                      value={dados[`ch_mat_${n}ano`]}
                      onChange={handleChange}
                      className={inputClass}
                    />
                  </div>
                )}

                <div>
                  <label className={labelClass}>Nota Ciências:</label>
                  <input
                    name={`nota_cie_${n}ano`}
                    value={dados[`nota_cie_${n}ano`]}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
                {ano.temCHSeparada && (
                  <div>
                    <label className={labelClass}>CH Ciências:</label>
                    <input
                      name={`ch_cie_${n}ano`}
                      value={dados[`ch_cie_${n}ano`]}
                      onChange={handleChange}
                      className={inputClass}
                    />
                  </div>
                )}

                <div>
                  <label className={labelClass}>Nota História:</label>
                  <input
                    name={`nota_hist_${n}ano`}
                    value={dados[`nota_hist_${n}ano`]}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
                {ano.temCHSeparada && (
                  <div>
                    <label className={labelClass}>CH História:</label>
                    <input
                      name={`ch_hist_${n}ano`}
                      value={dados[`ch_hist_${n}ano`]}
                      onChange={handleChange}
                      className={inputClass}
                    />
                  </div>
                )}

                <div>
                  <label className={labelClass}>Nota Geografia:</label>
                  <input
                    name={`nota_geo_${n}ano`}
                    value={dados[`nota_geo_${n}ano`]}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
                {ano.temCHSeparada && (
                  <div>
                    <label className={labelClass}>CH Geografia:</label>
                    <input
                      name={`ch_geo_${n}ano`}
                      value={dados[`ch_geo_${n}ano`]}
                      onChange={handleChange}
                      className={inputClass}
                    />
                  </div>
                )}

                <div>
                  <label className={labelClass}>Nota Ens. Religioso:</label>
                  <input
                    name={`nota_ensr_${n}ano`}
                    value={dados[`nota_ensr_${n}ano`]}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
                {ano.temCHSeparada && (
                  <div>
                    <label className={labelClass}>CH Ens. Religioso:</label>
                    <input
                      name={`ch_ensr_${n}ano`}
                      value={dados[`ch_ensr_${n}ano`]}
                      onChange={handleChange}
                      className={inputClass}
                    />
                  </div>
                )}

                <div className="col-span-full mt-1">
                  <label className={labelClass}>Observações do Ano:</label>
                  <input
                    name={`obs_${n}ano`}
                    value={dados[`obs_${n}ano`]}
                    onChange={handleChange}
                    placeholder="Ex: SEGUE EM ANEXO A FICHA INDIVIDUAL"
                    className={inputClass}
                  />
                </div>
              </div>
            </details>
          );
        })}

        {/* Botão gerar */}
        <button
          type="submit"
          className="bg-primary-800 hover:bg-primary-700 text-white border-none py-4 px-6 text-base font-extrabold rounded-xl cursor-pointer mt-2 mb-10 shadow-lg transition-all hover:-translate-y-0.5 active:translate-y-0"
        >
          📄 Gerar Histórico Preenchido (.DOCX)
        </button>
      </form>
    </div>
  );
}
