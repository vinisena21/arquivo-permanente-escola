import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeftRight, CheckCircle2, Download, FileCheck2, LoaderCircle, Plus, Printer, ScanText, Sparkles, Upload, X, ZoomIn } from 'lucide-react';
import { saveAs } from 'file-saver';
import {
  avaliarConferencia, criarAnos, DISCIPLINAS, formatarHoras, somarCargas, sugerirAnos,
  type AnoConferencia, type PaginaLida,
} from '../lib/conferenciaHistorico';
import { lerDocumento, validarArquivos } from '../lib/leituraHistorico';
import { avaliarPreenchimento, criarDocumento, sugerirDocumento, type DocumentoConferencia } from '../lib/preenchimentoHistorico';
import { DATA_BASE_LEGAL, FONTES_LEGAIS } from '../lib/fontesLegais';
import { ResultadoAnaliseSchema, type ResultadoAnalise } from '../lib/contratoAnaliseIA';
import './ConferirHistorico.css';

export default function ConferirHistorico({ obterToken }: { obterToken?: () => Promise<string | null> }) {
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [fontes, setFontes] = useState<string[]>([]);
  const [paginas, setPaginas] = useState<PaginaLida[]>([]);
  const [anos, setAnos] = useState(criarAnos);
  const [documento, setDocumento] = useState(criarDocumento);
  const [regimento, setRegimento] = useState('');
  const [estadoIA, setEstadoIA] = useState<'verificando' | 'disponivel' | 'nao-configurada' | 'indisponivel'>('verificando');
  const [analisandoIA, setAnalisandoIA] = useState(false);
  const [erroIA, setErroIA] = useState('');
  const [analiseIA, setAnaliseIA] = useState<{ assinatura: string; resultado: ResultadoAnalise } | null>(null);
  const [serie, setSerie] = useState(6);
  const [lendo, setLendo] = useState(false);
  const [progresso, setProgresso] = useState('');
  const [erro, setErro] = useState('');
  const [identidade, setIdentidade] = useState(false);
  const [assinaturas, setAssinaturas] = useState(false);
  const [normas, setNormas] = useState(false);
  const [relatorio, setRelatorio] = useState(false);
  const [ampliada, setAmpliada] = useState<PaginaLida | null>(null);
  const cancelamento = useRef<AbortController | null>(null);
  const cancelamentoIA = useRef<AbortController | null>(null);
  const dialogo = useRef<HTMLDialogElement>(null);
  const selecionador = useRef<HTMLInputElement>(null);
  const assinaturaAtual = JSON.stringify({ paginas: paginas.map(({ lado, texto }) => ({ lado, texto })), documento, anos, regimento });
  const resultadoIA = analiseIA?.assinatura === assinaturaAtual ? analiseIA.resultado : null;
  const achados = [
    ...avaliarConferencia(paginas, anos, identidade, assinaturas, normas),
    ...avaliarPreenchimento(paginas, anos, documento),
    ...(resultadoIA?.achados.map((a) => ({ ...a, campo: `IA / ${a.campo}`, motivo: `${a.motivo}${a.evidencia ? ` Evidência (${a.origem === 'ocr' ? a.pagina : a.origem === 'indicadores' ? 'indicadores sem identificadores diretos' : 'transcrição'}): ${a.evidencia}` : ''}` })) ?? []),
  ];
  const erros = achados.filter((a) => a.nivel === 'erro');
  const duvidas = achados.filter((a) => a.nivel === 'duvida');
  const ano = anos[serie - 1]!;
  const soma = somarCargas(ano);

  useEffect(() => () => { cancelamento.current?.abort(); cancelamentoIA.current?.abort(); }, []);
  useEffect(() => { if (ampliada) dialogo.current?.showModal(); }, [ampliada]);
  useEffect(() => {
    const controlador = new AbortController();
    fetch('/api/analisar-historico', { signal: controlador.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error('Serviço indisponível.');
        const dados = await r.json();
        if (typeof dados.configurada !== 'boolean') throw new Error('Resposta inválida.');
        return dados.configurada as boolean;
      })
      .then((disponivel) => setEstadoIA(disponivel ? 'disponivel' : 'nao-configurada'))
      .catch(() => { if (!controlador.signal.aborted) setEstadoIA('indisponivel'); });
    return () => controlador.abort();
  }, []);

  async function analisarIA() {
    if (analisandoIA || lendo || !obterToken) return;
    const assinatura = assinaturaAtual;
    const controlador = new AbortController(); cancelamentoIA.current = controlador;
    const timeout = window.setTimeout(() => controlador.abort(), 65_000);
    setAnalisandoIA(true); setErroIA('');
    try {
      const token = await obterToken();
      if (!token) throw new Error('Faça login para analisar o histórico.');
      const r = await fetch('/api/analisar-historico', {
        method: 'POST', signal: controlador.signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: assinatura,
      });
      const dados = await r.json();
      if (!r.ok) throw new Error(typeof dados.erro === 'string' ? dados.erro : 'Não foi possível concluir a análise.');
      const resultado = ResultadoAnaliseSchema.parse(dados);
      setAnaliseIA({ assinatura, resultado }); setRelatorio(true);
    } catch (e) { setErroIA(controlador.signal.aborted ? 'Análise cancelada ou tempo limite excedido.' : e instanceof Error ? e.message : 'Análise indisponível.'); }
    finally { window.clearTimeout(timeout); setAnalisandoIA(false); cancelamentoIA.current = null; }
  }

  function alterarAno(dados: Partial<AnoConferencia>) {
    setAnos((atuais) => atuais.map((a) => a.serie === serie ? { ...a, ...dados, confirmado: dados.confirmado ?? false } : a));
  }

  async function ler() {
    if (lendo) return;
    const controlador = new AbortController();
    cancelamento.current = controlador;
    setErro(''); setLendo(true); setRelatorio(false);
    const timeout = window.setTimeout(() => controlador.abort(), 180_000);
    try {
      validarArquivos(arquivos);
      const resultado = await lerDocumento(arquivos, controlador.signal, setProgresso);
      if (controlador.signal.aborted) return;
      setPaginas(resultado); setAnos(sugerirAnos(resultado.map((p) => p.texto)));
      setDocumento(sugerirDocumento(resultado)); setAnaliseIA(null); setErroIA('');
      setFontes(arquivos.map((a) => a.name));
      setIdentidade(false); setAssinaturas(false); setNormas(false);
    } catch (e) {
      if (controlador.signal.aborted) setErro('Leitura cancelada. O documento anterior foi preservado.');
      else setErro(e instanceof Error ? e.message : 'Não foi possível ler o documento. Tente uma digitalização mais nítida.');
    } finally {
      window.clearTimeout(timeout);
      if (cancelamento.current === controlador) { setLendo(false); setProgresso(''); cancelamento.current = null; }
    }
  }

  function exportar() {
    const conteudo = {
      versao: 1, data: new Date().toISOString(),
      resultado: erros.length ? 'Divergências encontradas' : duvidas.length ? 'Revisão pendente' : 'Conferência assistida concluída',
      escopo: 'Somatória, preenchimento e base legal federal. IA assistiva, quando configurada; normas locais e autenticidade dependem de revisão do responsável.',
      arquivos: fontes,
      paginas: paginas.map(({ lado, texto, confianca, palavrasDuvidosas }) => ({ lado, texto, confianca, palavrasDuvidosas })),
      documento, anos, regimentoInformado: regimento, baseLegal: { data: DATA_BASE_LEGAL, fontes: FONTES_LEGAIS }, analiseIA: resultadoIA,
      revisaoHumana: { identidade, assinaturas, normas }, achados,
    };
    saveAs(new Blob([JSON.stringify(conteudo, null, 2)], { type: 'application/json' }), 'conferencia-historico.json');
  }

  const itensCarga = ano.modo === 'global'
    ? [{ rotulo: 'Carga curricular', indice: 0 }, ...ano.cargas.map((v, i) => ({ v, i })).filter(({ v, i }) => i > 0 && (Boolean(v.trim()) || i >= 9)).map(({ i }, n) => ({ rotulo: `Carga complementar ${n + 1}`, indice: i }))]
    : ano.cargas.map((_, i) => ({ rotulo: DISCIPLINAS[i] ?? `Complementar ${i - DISCIPLINAS.length + 1}`, indice: i }));

  return (
    <section className="conferencia">
      <div className="conf-heading">
        <div><h2><FileCheck2 size={24} /> Conferir Histórico</h2><p>Frente e verso · Ensino Fundamental</p></div>
        {paginas.length === 2 && <span className="conf-status">Documento carregado</span>}
      </div>

      <div className="conf-upload conf-no-print">
        <input ref={selecionador} type="file" multiple accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx,image/png,image/jpeg,image/webp" aria-label="Selecionar histórico: PDF de duas páginas, DOCX ou imagens de frente e verso" disabled={lendo} onChange={(e) => {
          const lista = Array.from(e.target.files ?? []);
          setArquivos(lista); setErro('');
          e.target.value = '';
        }} hidden />
        <button type="button" className="conf-button" disabled={lendo} onClick={() => selecionador.current?.click()}><Upload size={18} /> Selecionar PDF, DOCX ou imagens</button>
        <div className="conf-files">{arquivos.length ? arquivos.map((a, i) => <span key={`${i}-${a.name}`}>{arquivos.length === 2 ? `${i === 0 ? 'Frente' : 'Verso'}: ` : ''}{a.name}</span>) : <span>PDF (2 pág.), DOCX ou 2 imagens · até 25 MB por arquivo</span>}</div>
        {arquivos.length === 2 && <button type="button" className="conf-icon" title="Trocar a ordem dos arquivos" aria-label="Trocar a ordem dos arquivos" disabled={lendo} onClick={() => setArquivos([...arquivos].reverse())}><ArrowLeftRight size={18} /></button>}
        <button type="button" className="conf-button conf-primary" disabled={!arquivos.length || lendo} onClick={() => void ler()}>{lendo ? <LoaderCircle className="conf-spin" size={18} /> : <ScanText size={18} />} {lendo ? 'Lendo documento' : 'Ler documento'}</button>
        {lendo && <button type="button" className="conf-icon" title="Cancelar leitura" aria-label="Cancelar leitura" onClick={() => cancelamento.current?.abort()}><X size={18} /></button>}
      </div>
      {lendo && <p role="status" className="conf-progress">{progresso}</p>}
      {erro && <p role="alert" className="conf-error">{erro}</p>}

      {paginas.length === 0 ? <div className="conf-empty"><ScanText size={40} /><h3>Nenhum histórico carregado</h3><p>PDF, DOCX ou imagens de frente e verso</p></div> : <>
        <p className="conf-scope conf-no-print" role="status">Campos de identificação, anos, notas e cargas foram pré-preenchidos automaticamente a partir do texto reconhecido. Revise e confirme com o original.</p>
        <div className="conf-pages conf-no-print">
          {paginas.map((p) => <figure key={p.lado}>
            <figcaption><strong>{p.lado}</strong><span className={p.confianca < 85 ? 'conf-warning-text' : ''}>Leitura: {Math.round(p.confianca)}%</span><button type="button" className="conf-icon" aria-label={`Ampliar ${p.lado.toLowerCase()}`} title={`Ampliar ${p.lado.toLowerCase()}`} onClick={() => setAmpliada(p)}><ZoomIn size={18} /></button></figcaption>
            <button type="button" className="conf-preview" aria-label={`Abrir imagem da ${p.lado.toLowerCase()}`} onClick={() => setAmpliada(p)}><img src={p.imagem} alt={`Digitalização da ${p.lado.toLowerCase()} do histórico`} /></button>
            <details><summary>Texto reconhecido · {p.palavrasDuvidosas.length} palavras duvidosas</summary><pre>{p.texto || 'Nenhum texto reconhecido.'}</pre>{p.palavrasDuvidosas.length > 0 && <p className="conf-warning-text">Leitura incerta: {p.palavrasDuvidosas.join(', ')}</p>}</details>
          </figure>)}
        </div>

        <section className="conf-section conf-no-print">
          <h3>Identificação e preenchimento</h3>
          <div className="conf-hours">{([
            ['nomeFrente', 'Nome na frente'], ['nomeVerso', 'Nome no verso'], ['nascimento', 'Nascimento (DD/MM/AAAA)'],
            ['nomeMae', 'Filiação 1 / mãe'], ['nomePai', 'Filiação 2 / pai'], ['naturalidade', 'Naturalidade'],
            ['uf', 'UF'], ['nacionalidade', 'Nacionalidade'], ['sexo', 'Sexo'], ['expedicao', 'Data de expedição'], ['titulo', 'Título do documento'],
          ] as [keyof DocumentoConferencia, string][]).map(([chave, rotulo]) => <label key={chave}>{rotulo}<input value={documento[chave]} onChange={(e) => setDocumento((d) => ({ ...d, [chave]: e.target.value }))} /></label>)}</div>
          <label className="conf-textarea">Fundamentação legal transcrita<textarea rows={3} value={documento.fundamentacao} onChange={(e) => setDocumento((d) => ({ ...d, fundamentacao: e.target.value }))} /></label>
          <label className="conf-textarea">Observações gerais transcritas<textarea rows={3} value={documento.observacoesGerais} onChange={(e) => setDocumento((d) => ({ ...d, observacoesGerais: e.target.value }))} /></label>
        </section>

        <section className="conf-section conf-no-print" aria-label="Cargas horárias">
          <h3>Cargas horárias</h3>
          <div className="conf-series" role="tablist" aria-label="Ano escolar">{anos.map((a) => <button type="button" key={a.serie} role="tab" aria-selected={serie === a.serie} className={serie === a.serie ? 'active' : ''} onClick={() => setSerie(a.serie)}>{a.serie}º ano{a.confirmado && <CheckCircle2 size={14} />}</button>)}</div>
          <div className="conf-year-controls">
            <label className="conf-check"><input type="checkbox" checked={ano.incluido} onChange={(e) => alterarAno({ incluido: e.target.checked })} /> Conferir {serie}º ano</label>
            <label>Ano letivo<input inputMode="numeric" maxLength={4} value={ano.anoLetivo} disabled={!ano.incluido} onChange={(e) => alterarAno({ anoLetivo: e.target.value })} /></label>
            <label>Distribuição da carga<select value={ano.modo} disabled={!ano.incluido} onChange={(e) => alterarAno({ modo: e.target.value as AnoConferencia['modo'] })}><option value="global">Carga global</option><option value="disciplinas">Por disciplina</option></select></label>
          </div>
          {ano.incluido && <>
            <div className="conf-hours conf-academic">
              <label>Escola<input value={ano.escola} onChange={(e) => alterarAno({ escola: e.target.value })} /></label>
              <label>Município / estado<input value={ano.municipio} onChange={(e) => alterarAno({ municipio: e.target.value })} /></label>
              <label>Dias letivos<input inputMode="numeric" value={ano.diasLetivos} onChange={(e) => alterarAno({ diasLetivos: e.target.value })} /></label>
              <label>Situação<input value={ano.situacao} onChange={(e) => alterarAno({ situacao: e.target.value })} /></label>
              <label>Escala das notas<select value={ano.escalaNotas} onChange={(e) => alterarAno({ escalaNotas: e.target.value as AnoConferencia['escalaNotas'] })}><option value="100">0 a 100</option><option value="10">0 a 10</option><option value="conceitos">Conceitos A / B / C</option></select></label>
              <label>Mínimo para promoção<input value={ano.minimoPromocao} placeholder="Conforme o regimento" onChange={(e) => alterarAno({ minimoPromocao: e.target.value })} /></label>
              <label>Faltas em horas<input value={ano.faltasHoras} placeholder="H:MM" onChange={(e) => alterarAno({ faltasHoras: e.target.value })} /></label>
            </div>
            <h4>Notas / conceitos</h4>
            <div className="conf-hours conf-academic">{DISCIPLINAS.map((d, i) => i === 1 && serie < 6 ? null : <label key={d}>{d}<input aria-label={`${serie}º ano, nota ${d}`} value={ano.notas[i]} onChange={(e) => alterarAno({ notas: ano.notas.map((n, j) => i === j ? e.target.value : n) })} /></label>)}</div>
            <label className="conf-textarea">Observações do {serie}º ano<textarea rows={3} value={ano.observacoes} onChange={(e) => alterarAno({ observacoes: e.target.value })} /></label>
            <h4>Carga horária</h4>
            <div className="conf-hours">
              {itensCarga.map(({ rotulo, indice }) => (
                <label key={indice}>{rotulo}<input inputMode="text" placeholder="H:MM" aria-label={`${serie}º ano, ${rotulo}`} value={ano.cargas[indice] ?? ''} onChange={(e) => {
                  const next = [...ano.cargas];
                  while (next.length <= indice) next.push('');
                  next[indice] = e.target.value;
                  alterarAno({ cargas: next });
                }} /></label>
              ))}
              <button type="button" className="conf-button conf-add" onClick={() => alterarAno({ cargas: [...ano.cargas, ''] })}><Plus size={16} /> Carga complementar</button>
            </div>
            <div className="conf-totals">
              <label>Total impresso<input placeholder="H:MM" aria-label={`${serie}º ano, total impresso`} value={ano.total} onChange={(e) => alterarAno({ total: e.target.value })} /></label>
              <label>Carga horária anual<input placeholder="H:MM" aria-label={`${serie}º ano, carga anual`} value={ano.anual} onChange={(e) => alterarAno({ anual: e.target.value })} /></label>
              <div><span>Soma (curricular + complementares)</span><strong>{soma === null ? 'Pendente' : formatarHoras(soma)}</strong></div>
            </div>
            <label className="conf-check conf-confirm"><input type="checkbox" checked={ano.confirmado} onChange={(e) => alterarAno({ confirmado: e.target.checked })} /> Conferi os valores do {serie}º ano com a imagem original, incluindo cargas complementares.</label>
          </>}
        </section>

        <section className="conf-section conf-no-print">
          <h3><Sparkles size={20} /> Análise de preenchimento e legislação por IA</h3>
          <p className="conf-scope">{estadoIA === 'disponivel' ? 'A análise por IA usa os provedores configurados (Groq, OpenRouter, Gemini) com fallback automático.' : estadoIA === 'verificando' ? 'Verificando disponibilidade da IA…' : estadoIA === 'nao-configurada' ? 'Análise por IA pendente de configuração. As verificações automáticas continuam disponíveis.' : 'Serviço de IA indisponível. As verificações automáticas continuam disponíveis.'}</p>
          <label className="conf-textarea">Regimento / orientação da Secretaria (opcional)<textarea rows={3} maxLength={12000} value={regimento} onChange={(e) => setRegimento(e.target.value)} /></label>
          <details className="conf-legal-sources"><summary>Base federal consultada · {DATA_BASE_LEGAL}</summary>{FONTES_LEGAIS.map((f) => <p key={f.id}><a href={f.url} target="_blank" rel="noreferrer">{f.titulo}</a><br />{f.resumo}</p>)}</details>
          <button type="button" className="conf-button conf-primary" disabled={estadoIA !== 'disponivel' || analisandoIA || lendo || !obterToken} onClick={() => void analisarIA()}>{analisandoIA ? <LoaderCircle className="conf-spin" size={18} /> : <Sparkles size={18} />} {analisandoIA ? 'Analisando histórico' : 'Analisar com IA'}</button>
          {analisandoIA && <button type="button" className="conf-icon" aria-label="Cancelar análise de IA" title="Cancelar análise de IA" onClick={() => cancelamentoIA.current?.abort()}><X size={18} /></button>}
          {erroIA && <p className="conf-error" role="alert">{erroIA}</p>}
          {analiseIA && !resultadoIA && <p className="conf-warning-text">Os dados foram alterados após a análise. É necessário analisar novamente.</p>}
        </section>

        <section className="conf-section">
          <div className="conf-report-head">
            <h3>Resultado da conferência</h3>
            <div className="conf-actions conf-no-print">
              <button type="button" className="conf-button" onClick={() => setRelatorio((v) => !v)}>{relatorio ? 'Ocultar' : 'Mostrar'} relatório</button>
              <button type="button" className="conf-button" onClick={() => exportar()}><Download size={16} /> Exportar JSON</button>
              <button type="button" className="conf-button" onClick={() => window.print()}><Printer size={16} /> Imprimir</button>
            </div>
          </div>
          <div className="conf-summary">
            <span className={erros.length ? 'conf-error-text' : duvidas.length ? 'conf-warning-text' : 'conf-ok-text'}>
              {erros.length ? <><AlertTriangle size={16} /> {erros.length} erro(s)</> : duvidas.length ? <><AlertTriangle size={16} /> {duvidas.length} ponto(s) de revisão</> : <><CheckCircle2 size={16} /> Conferência assistida sem erros objetivos</>}
            </span>
          </div>
          {relatorio && <ul className="conf-findings">{achados.map((a, i) => <li key={i} className={`conf-${a.nivel}`}><strong>{a.campo}</strong><span>{a.nivel === 'erro' ? 'Erro' : a.nivel === 'duvida' ? 'Revisão' : 'Ok'}</span><p>{a.motivo}</p></li>)}</ul>}
          <div className="conf-human conf-no-print">
            <label className="conf-check"><input type="checkbox" checked={identidade} onChange={(e) => setIdentidade(e.target.checked)} /> Conferi identidade (nome, filiação, nascimento) entre frente e verso</label>
            <label className="conf-check"><input type="checkbox" checked={assinaturas} onChange={(e) => setAssinaturas(e.target.checked)} /> Conferi assinaturas, carimbos e data de expedição</label>
            <label className="conf-check"><input type="checkbox" checked={normas} onChange={(e) => setNormas(e.target.checked)} /> Conferi notas, frequência e fundamento com o regimento aplicável</label>
          </div>
        </section>
      </>}

      <dialog ref={dialogo} className="conf-dialog" onClose={() => setAmpliada(null)}>{ampliada && <img src={ampliada.imagem} alt={`Imagem ampliada da ${ampliada.lado.toLowerCase()}`} />}</dialog>
    </section>
  );
}
