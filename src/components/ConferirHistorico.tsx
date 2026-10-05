import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeftRight, CheckCircle2, Download, FileCheck2, LoaderCircle, Plus, Printer, ScanText, Upload, X, ZoomIn } from 'lucide-react';
import { saveAs } from 'file-saver';
import {
  avaliarConferencia, criarAnos, DISCIPLINAS, formatarHoras, somarCargas, sugerirAnos,
  type AnoConferencia, type PaginaLida,
} from '../lib/conferenciaHistorico';
import { lerDocumento, validarArquivos } from '../lib/leituraHistorico';
import './ConferirHistorico.css';

export default function ConferirHistorico() {
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [fontes, setFontes] = useState<string[]>([]);
  const [paginas, setPaginas] = useState<PaginaLida[]>([]);
  const [anos, setAnos] = useState(criarAnos);
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
  const dialogo = useRef<HTMLDialogElement>(null);
  const selecionador = useRef<HTMLInputElement>(null);
  const achados = avaliarConferencia(paginas, anos, identidade, assinaturas, normas);
  const erros = achados.filter((a) => a.nivel === 'erro');
  const duvidas = achados.filter((a) => a.nivel === 'duvida');
  const ano = anos[serie - 1];
  const soma = somarCargas(ano);

  useEffect(() => () => cancelamento.current?.abort(), []);
  useEffect(() => { if (ampliada) dialogo.current?.showModal(); }, [ampliada]);

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
      escopo: 'Somatória de cargas, total impresso e carga anual. Demais regras escolares conferidas por responsável humano. Não certifica autenticidade nem conformidade legal.',
      arquivos: fontes,
      paginas: paginas.map(({ lado, texto, confianca, palavrasDuvidosas }) => ({ lado, texto, confianca, palavrasDuvidosas })),
      anos, revisaoHumana: { identidade, assinaturas, normas }, achados,
    };
    saveAs(new Blob([JSON.stringify(conteudo, null, 2)], { type: 'application/json' }), 'conferencia-historico.json');
  }

  return (
    <section className="conferencia">
      <div className="conf-heading">
        <div><h2><FileCheck2 size={24} /> Conferir Histórico</h2><p>Frente e verso · Ensino Fundamental</p></div>
        {paginas.length === 2 && <span className="conf-status">Documento carregado</span>}
      </div>

      <div className="conf-upload conf-no-print">
        <input ref={selecionador} type="file" multiple accept="application/pdf,image/png,image/jpeg,image/webp" aria-label="Selecionar histórico, PDF de duas páginas ou imagens de frente e verso" disabled={lendo} onChange={(e) => {
          const lista = Array.from(e.target.files ?? []);
          setArquivos(lista); setErro('');
          e.target.value = '';
        }} hidden />
        <button type="button" className="conf-button" disabled={lendo} onClick={() => selecionador.current?.click()}><Upload size={18} /> Selecionar PDF ou imagens</button>
        <div className="conf-files">{arquivos.length ? arquivos.map((a, i) => <span key={`${i}-${a.name}`}>{arquivos.length === 2 ? `${i === 0 ? 'Frente' : 'Verso'}: ` : ''}{a.name}</span>) : <span>PDF de 2 páginas ou 2 imagens · até 25 MB por arquivo</span>}</div>
        {arquivos.length === 2 && <button type="button" className="conf-icon" title="Trocar a ordem dos arquivos" aria-label="Trocar a ordem dos arquivos" disabled={lendo} onClick={() => setArquivos([...arquivos].reverse())}><ArrowLeftRight size={18} /></button>}
        <button type="button" className="conf-button conf-primary" disabled={!arquivos.length || lendo} onClick={() => void ler()}>{lendo ? <LoaderCircle className="conf-spin" size={18} /> : <ScanText size={18} />} {lendo ? 'Lendo documento' : 'Ler frente e verso'}</button>
        {lendo && <button type="button" className="conf-icon" title="Cancelar leitura" aria-label="Cancelar leitura" onClick={() => cancelamento.current?.abort()}><X size={18} /></button>}
      </div>
      {lendo && <p role="status" className="conf-progress">{progresso}</p>}
      {erro && <p role="alert" className="conf-error">{erro}</p>}

      {paginas.length === 0 ? <div className="conf-empty"><ScanText size={40} /><h3>Nenhum histórico carregado</h3><p>Frente e verso pendentes</p></div> : <>
        <div className="conf-pages conf-no-print">
          {paginas.map((p) => <figure key={p.lado}>
            <figcaption><strong>{p.lado}</strong><span className={p.confianca < 85 ? 'conf-warning-text' : ''}>Leitura: {Math.round(p.confianca)}%</span><button type="button" className="conf-icon" aria-label={`Ampliar ${p.lado.toLowerCase()}`} title={`Ampliar ${p.lado.toLowerCase()}`} onClick={() => setAmpliada(p)}><ZoomIn size={18} /></button></figcaption>
            <button type="button" className="conf-preview" aria-label={`Abrir imagem da ${p.lado.toLowerCase()}`} onClick={() => setAmpliada(p)}><img src={p.imagem} alt={`Digitalização da ${p.lado.toLowerCase()} do histórico`} /></button>
            <details><summary>Texto reconhecido · {p.palavrasDuvidosas.length} palavras duvidosas</summary><pre>{p.texto || 'Nenhum texto reconhecido.'}</pre>{p.palavrasDuvidosas.length > 0 && <p className="conf-warning-text">Leitura incerta: {p.palavrasDuvidosas.join(', ')}</p>}</details>
          </figure>)}
        </div>

        <section className="conf-section conf-no-print" aria-label="Cargas horárias">
          <h3>Cargas horárias</h3>
          <div className="conf-series" role="tablist" aria-label="Ano escolar">{anos.map((a) => <button type="button" key={a.serie} role="tab" aria-selected={serie === a.serie} className={serie === a.serie ? 'active' : ''} onClick={() => setSerie(a.serie)}>{a.serie}º ano{a.confirmado && <CheckCircle2 size={14} />}</button>)}</div>
          <div className="conf-year-controls">
            <label className="conf-check"><input type="checkbox" checked={ano.incluido} onChange={(e) => alterarAno({ incluido: e.target.checked })} /> Conferir {serie}º ano</label>
            <label>Ano letivo<input inputMode="numeric" maxLength={4} value={ano.anoLetivo} disabled={!ano.incluido} onChange={(e) => alterarAno({ anoLetivo: e.target.value })} /></label>
            <label>Distribuição da carga<select value={ano.modo} disabled={!ano.incluido} onChange={(e) => alterarAno({ modo: e.target.value as AnoConferencia['modo'] })}><option value="global">Carga global</option><option value="disciplinas">Por disciplina</option></select></label>
          </div>
          {ano.incluido && <>
            <div className="conf-hours">
              {(ano.modo === 'global' ? ano.cargas.slice(0, 1) : ano.cargas).map((valor, i) => <label key={i}>{ano.modo === 'global' ? 'Carga curricular global' : (DISCIPLINAS[i] ?? `Complementar ${i - DISCIPLINAS.length + 1}`)}<input inputMode="text" placeholder="H:MM" aria-label={`${serie}º ano, ${ano.modo === 'global' ? 'carga global' : (DISCIPLINAS[i] ?? `complementar ${i - DISCIPLINAS.length + 1}`)}`} value={valor} onChange={(e) => alterarAno({ cargas: ano.cargas.map((c, n) => n === i ? e.target.value : c) })} /></label>)}
              {ano.modo === 'disciplinas' && <button type="button" className="conf-button conf-add" onClick={() => alterarAno({ cargas: [...ano.cargas, ''] })}><Plus size={16} /> Carga complementar</button>}
            </div>
            <div className="conf-totals">
              <label>Total impresso<input placeholder="H:MM" aria-label={`${serie}º ano, total impresso`} value={ano.total} onChange={(e) => alterarAno({ total: e.target.value })} /></label>
              <label>Carga horária anual<input placeholder="H:MM" aria-label={`${serie}º ano, carga anual`} value={ano.anual} onChange={(e) => alterarAno({ anual: e.target.value })} /></label>
              <div><span>{ano.modo === 'global' ? 'Carga global informada' : 'Soma calculada'}</span><strong>{soma === null ? 'Pendente' : formatarHoras(soma)}</strong></div>
            </div>
            <label className="conf-check conf-confirm"><input type="checkbox" checked={ano.confirmado} onChange={(e) => alterarAno({ confirmado: e.target.checked })} /> Conferi os valores do {serie}º ano com a imagem original, incluindo cargas complementares.</label>
          </>}
        </section>

        <section className="conf-section conf-no-print">
          <h3>Revisão do responsável</h3>
          <label className="conf-check"><input type="checkbox" checked={identidade} onChange={(e) => setIdentidade(e.target.checked)} /> Identificação e dados pessoais conferidos; frente e verso correspondem ao mesmo aluno.</label>
          <label className="conf-check"><input type="checkbox" checked={assinaturas} onChange={(e) => setAssinaturas(e.target.checked)} /> Data, assinaturas, registros e carimbos conferidos no documento original.</label>
          <label className="conf-check"><input type="checkbox" checked={normas} onChange={(e) => setNormas(e.target.checked)} /> Notas, frequência, situação, dias letivos e fundamento legal conferidos com as normas aplicáveis.</label>
          <button type="button" className="conf-button conf-primary" disabled={lendo} onClick={() => setRelatorio(true)}><FileCheck2 size={18} /> Avaliar histórico</button>
        </section>

        {relatorio && <section className="conf-section conf-report" aria-live="polite">
          <div className="conf-heading"><h3>Relatório de conferência</h3><div className="conf-report-actions conf-no-print"><button type="button" className="conf-icon" title="Baixar relatório JSON" aria-label="Baixar relatório JSON" onClick={exportar}><Download size={18} /></button><button type="button" className="conf-icon" title="Imprimir relatório" aria-label="Imprimir relatório" onClick={() => window.print()}><Printer size={18} /></button></div></div>
          <p className={`conf-verdict ${erros.length ? 'conf-error' : duvidas.length ? 'conf-warning-text' : 'conf-success'}`}>{erros.length ? 'Divergências encontradas' : duvidas.length ? 'Revisão pendente' : 'Conferência assistida concluída'} · {erros.length} erro(s) · {duvidas.length} dúvida(s)</p>
          <p className="conf-scope">Somatória, total impresso e carga anual: verificações automáticas. Demais regras: revisão do responsável. Este relatório não certifica autenticidade nem conformidade legal.</p>
          <p className="conf-source">Documento avaliado: {fontes.join(' · ')}</p>
          <div className="conf-table-scroll"><table><caption>Cargas dos anos selecionados</caption><thead><tr><th>Ano</th><th>Letivo</th><th>Soma / global</th><th>Total impresso</th><th>Carga anual</th><th>Transcrição</th></tr></thead><tbody>{anos.filter((a) => a.incluido).map((a) => <tr key={a.serie}><td>{a.serie}º</td><td>{a.anoLetivo || 'Pendente'}</td><td>{somarCargas(a) === null ? 'Pendente' : formatarHoras(somarCargas(a)!)}</td><td>{a.total || 'Pendente'}</td><td>{a.anual || 'Pendente'}</td><td>{a.confirmado ? 'Conferida' : 'Pendente'}</td></tr>)}</tbody></table></div>
          <ul className="conf-findings">{[...erros, ...duvidas, ...achados.filter((a) => a.nivel === 'ok')].map((a, i) => <li key={i} className={`conf-finding-${a.nivel}`}>{a.nivel === 'ok' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}<div><strong>{a.campo}</strong><p>{a.motivo}</p></div><span>{a.nivel === 'ok' ? 'Confere' : a.nivel === 'erro' ? 'Erro' : 'Dúvida'}</span></li>)}</ul>
        </section>}
      </>}
      <dialog ref={dialogo} className="conf-dialog" onClose={() => setAmpliada(null)} onCancel={() => setAmpliada(null)}><div><strong>{ampliada?.lado}</strong><button type="button" className="conf-icon" title="Fechar imagem" aria-label="Fechar imagem" onClick={() => dialogo.current?.close()}><X size={20} /></button></div>{ampliada && <img src={ampliada.imagem} alt={`Imagem ampliada da ${ampliada.lado.toLowerCase()}`} />}</dialog>
    </section>
  );
}
