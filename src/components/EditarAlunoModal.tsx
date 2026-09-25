import {
  useState,
  type FormEvent
} from 'react';
import {
  LoaderCircle,
  Save,
  X
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  validarNome,
  validarDataISO,
  validarNumeroArquivo,
  validarPasta
} from '../lib/validacao';
import './EditarAlunoModal.css';

export interface AlunoEditavel {
  id: number;
  nome: string;
  dataNascimento: string;
  codigoPasta: string;
  numero: number;
  status: string;
}

interface EditarAlunoModalProps {
  aluno: AlunoEditavel;
  pastas: string[];
  aoFechar: () => void;
  aoSalvar: (alunoAtualizado: AlunoEditavel) => void;
}

interface ErrosCampos {
  nome?: string;
  dataNascimento?: string;
  pasta?: string;
  numero?: string;
}

function converterParaISO(data: string): string {
  if (!data) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(data)) return data;

  const partes = data.split('/');
  if (partes.length !== 3) return '';

  const [dia, mes, ano] = partes;
  return `${ano}-${mes}-${dia}`;
}

function converterParaBrasileiro(data: string): string {
  if (!data) return '';
  const partes = data.split('-');
  if (partes.length !== 3) return data;
  const [ano, mes, dia] = partes;
  return `${dia}/${mes}/${ano}`;
}

export default function EditarAlunoModal({
  aluno,
  pastas,
  aoFechar,
  aoSalvar
}: EditarAlunoModalProps) {
  const [nome, setNome] = useState(aluno.nome);
  const [dataNascimento, setDataNascimento] = useState(
    converterParaISO(aluno.dataNascimento)
  );
  const [codigoPasta, setCodigoPasta] = useState(aluno.codigoPasta);
  const [numero, setNumero] = useState(String(aluno.numero));
  const [status, setStatus] = useState(aluno.status);
  const [salvando, setSalvando] = useState(false);
  const [erroGeral, setErroGeral] = useState('');
  const [erros, setErros] = useState<ErrosCampos>({});

  function validarFormulario(): boolean {
    const novosErros: ErrosCampos = {};

    const erroNome = validarNome(nome);
    if (erroNome) novosErros.nome = erroNome;

    const erroData = validarDataISO(dataNascimento, false);
    if (erroData) novosErros.dataNascimento = erroData;

    const erroPasta = validarPasta(codigoPasta);
    if (erroPasta) novosErros.pasta = erroPasta;

    const erroNumero = validarNumeroArquivo(numero);
    if (erroNumero) novosErros.numero = erroNumero;

    setErros(novosErros);
    return Object.keys(novosErros).length === 0;
  }

  async function salvarAlteracoes(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErroGeral('');

    if (!validarFormulario()) return;

    const nomeTratado = nome
      .trim()
      .replace(/\s+/g, ' ')
      .toLocaleUpperCase('pt-BR');

    const pastaTratada = codigoPasta.trim().toLocaleUpperCase('pt-BR');
    const numeroTratado = Number(numero);

    setSalvando(true);

    try {
      const { data: registroExistente, error: erroConsulta } = await supabase
        .from('alunos')
        .select('id')
        .eq('codigo_pasta', pastaTratada)
        .eq('numero', numeroTratado)
        .neq('id', aluno.id)
        .limit(1);

      if (erroConsulta) throw erroConsulta;

      if (registroExistente && registroExistente.length > 0) {
        setErros((e) => ({
          ...e,
          numero: `O número ${numeroTratado} já está ocupado na pasta ${pastaTratada}.`
        }));
        return;
      }

      const { error: erroAtualizacao } = await supabase
        .from('alunos')
        .update({
          nome: nomeTratado,
          data_nascimento: dataNascimento || null,
          codigo_pasta: pastaTratada,
          numero: numeroTratado,
          status
        })
        .eq('id', aluno.id);

      if (erroAtualizacao) throw erroAtualizacao;

      aoSalvar({
        id: aluno.id,
        nome: nomeTratado,
        dataNascimento: converterParaBrasileiro(dataNascimento),
        codigoPasta: pastaTratada,
        numero: numeroTratado,
        status
      });
    } catch (erroEncontrado) {
      console.error(erroEncontrado);
      setErroGeral('Não foi possível salvar as alterações.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="modal-fundo" role="presentation">
      <section
        className="modal-editar"
        role="dialog"
        aria-modal="true"
        aria-labelledby="editar-aluno-titulo"
      >
        <header className="modal-cabecalho">
          <div>
            <h2 id="editar-aluno-titulo">Editar aluno</h2>
            <p>Atualize as informações do registro selecionado.</p>
          </div>

          <button
            type="button"
            className="modal-fechar"
            onClick={aoFechar}
            aria-label="Fechar edição"
          >
            <X size={22} />
          </button>
        </header>

        <form className="modal-formulario" onSubmit={salvarAlteracoes} noValidate>
          <div className="modal-campo modal-campo-largo">
            <label htmlFor="editar-nome">Nome completo</label>
            <input
              id="editar-nome"
              type="text"
              value={nome}
              onChange={(evento) => {
                setNome(evento.target.value);
                if (erros.nome) setErros((e) => ({ ...e, nome: undefined }));
              }}
              aria-invalid={Boolean(erros.nome)}
            />
            {erros.nome && <p className="modal-erro-campo">{erros.nome}</p>}
          </div>

          <div className="modal-campo">
            <label htmlFor="editar-nascimento">Data de nascimento</label>
            <input
              id="editar-nascimento"
              type="date"
              value={dataNascimento}
              onChange={(evento) => {
                setDataNascimento(evento.target.value);
                if (erros.dataNascimento)
                  setErros((e) => ({ ...e, dataNascimento: undefined }));
              }}
              aria-invalid={Boolean(erros.dataNascimento)}
            />
            {erros.dataNascimento && (
              <p className="modal-erro-campo">{erros.dataNascimento}</p>
            )}
          </div>

          <div className="modal-campo">
            <label htmlFor="editar-pasta">Pasta</label>
            <select
              id="editar-pasta"
              value={codigoPasta}
              onChange={(evento) => {
                setCodigoPasta(evento.target.value);
                if (erros.pasta) setErros((e) => ({ ...e, pasta: undefined }));
              }}
              aria-invalid={Boolean(erros.pasta)}
            >
              {pastas.map((pasta) => (
                <option key={pasta} value={pasta}>
                  {pasta}
                </option>
              ))}
            </select>
            {erros.pasta && <p className="modal-erro-campo">{erros.pasta}</p>}
          </div>

          <div className="modal-campo">
            <label htmlFor="editar-numero">Número do arquivo</label>
            <input
              id="editar-numero"
              type="number"
              min="1"
              value={numero}
              onChange={(evento) => {
                setNumero(evento.target.value);
                if (erros.numero) setErros((e) => ({ ...e, numero: undefined }));
              }}
              aria-invalid={Boolean(erros.numero)}
            />
            {erros.numero && <p className="modal-erro-campo">{erros.numero}</p>}
          </div>

          <div className="modal-campo">
            <label htmlFor="editar-status">Status</label>
            <select
              id="editar-status"
              value={status}
              onChange={(evento) => setStatus(evento.target.value)}
            >
              <option value="Arquivado">Arquivado</option>
              <option value="Pendente">Pendente</option>
              <option value="Transferido">Transferido</option>
            </select>
          </div>

          {erroGeral && <p className="modal-erro">{erroGeral}</p>}

          <div className="modal-acoes">
            <button
              type="button"
              className="modal-cancelar"
              onClick={aoFechar}
              disabled={salvando}
            >
              Cancelar
            </button>

            <button type="submit" className="modal-salvar" disabled={salvando}>
              {salvando ? (
                <>
                  <LoaderCircle className="modal-spinner" size={19} />
                  Salvando...
                </>
              ) : (
                <>
                  <Save size={19} />
                  Salvar alterações
                </>
              )}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
