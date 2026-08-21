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
  aoSalvar: (
    alunoAtualizado: AlunoEditavel
  ) => void;
}

function converterParaISO(
  data: string
): string {
  if (!data) {
    return '';
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return data;
  }

  const partes = data.split('/');

  if (partes.length !== 3) {
    return '';
  }

  const [dia, mes, ano] = partes;

  return `${ano}-${mes}-${dia}`;
}

function converterParaBrasileiro(
  data: string
): string {
  if (!data) {
    return '';
  }

  const partes = data.split('-');

  if (partes.length !== 3) {
    return data;
  }

  const [ano, mes, dia] = partes;

  return `${dia}/${mes}/${ano}`;
}

export default function EditarAlunoModal({
  aluno,
  pastas,
  aoFechar,
  aoSalvar
}: EditarAlunoModalProps) {
  const [nome, setNome] =
    useState(aluno.nome);

  const [dataNascimento, setDataNascimento] =
    useState(
      converterParaISO(
        aluno.dataNascimento
      )
    );

  const [codigoPasta, setCodigoPasta] =
    useState(aluno.codigoPasta);

  const [numero, setNumero] =
    useState(String(aluno.numero));

  const [status, setStatus] =
    useState(aluno.status);

  const [salvando, setSalvando] =
    useState(false);

  const [erro, setErro] = useState('');

  async function salvarAlteracoes(
    evento: FormEvent<HTMLFormElement>
  ) {
    evento.preventDefault();
    setErro('');

    const nomeTratado = nome
      .trim()
      .replace(/\s+/g, ' ')
      .toLocaleUpperCase('pt-BR');

    const pastaTratada = codigoPasta
      .trim()
      .toLocaleUpperCase('pt-BR');

    const numeroTratado =
      Number(numero);

    if (!nomeTratado) {
      setErro(
        'Informe o nome do aluno.'
      );

      return;
    }

    if (!pastaTratada) {
      setErro(
        'Selecione uma pasta.'
      );

      return;
    }

    if (
      !Number.isInteger(numeroTratado) ||
      numeroTratado <= 0
    ) {
      setErro(
        'Informe um número válido.'
      );

      return;
    }

    setSalvando(true);

    try {
      const {
        data: registroExistente,
        error: erroConsulta
      } = await supabase
        .from('alunos')
        .select('id')
        .eq(
          'codigo_pasta',
          pastaTratada
        )
        .eq('numero', numeroTratado)
        .neq('id', aluno.id)
        .limit(1);

      if (erroConsulta) {
        throw erroConsulta;
      }

      if (
        registroExistente &&
        registroExistente.length > 0
      ) {
        setErro(
          `O número ${numeroTratado} já está ocupado na pasta ${pastaTratada}.`
        );

        return;
      }

      const { error: erroAtualizacao } =
        await supabase
          .from('alunos')
          .update({
            nome: nomeTratado,
            data_nascimento:
              dataNascimento || null,
            codigo_pasta:
              pastaTratada,
            numero: numeroTratado,
            status
          })
          .eq('id', aluno.id);

      if (erroAtualizacao) {
        throw erroAtualizacao;
      }

      aoSalvar({
        id: aluno.id,
        nome: nomeTratado,
        dataNascimento:
          converterParaBrasileiro(
            dataNascimento
          ),
        codigoPasta: pastaTratada,
        numero: numeroTratado,
        status
      });
    } catch (erroEncontrado) {
      console.error(erroEncontrado);

      setErro(
        'Não foi possível salvar as alterações.'
      );
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div
      className="modal-fundo"
      role="presentation"
    >
      <section
        className="modal-editar"
        role="dialog"
        aria-modal="true"
        aria-labelledby="editar-aluno-titulo"
      >
        <header className="modal-cabecalho">
          <div>
            <h2 id="editar-aluno-titulo">
              Editar aluno
            </h2>

            <p>
              Atualize as informações do
              registro selecionado.
            </p>
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

        <form
          className="modal-formulario"
          onSubmit={salvarAlteracoes}
        >
          <div className="modal-campo modal-campo-largo">
            <label htmlFor="editar-nome">
              Nome completo
            </label>

            <input
              id="editar-nome"
              type="text"
              value={nome}
              onChange={(evento) =>
                setNome(
                  evento.target.value
                )
              }
              required
            />
          </div>

          <div className="modal-campo">
            <label htmlFor="editar-nascimento">
              Data de nascimento
            </label>

            <input
              id="editar-nascimento"
              type="date"
              value={dataNascimento}
              onChange={(evento) =>
                setDataNascimento(
                  evento.target.value
                )
              }
            />
          </div>

          <div className="modal-campo">
            <label htmlFor="editar-pasta">
              Pasta
            </label>

            <select
              id="editar-pasta"
              value={codigoPasta}
              onChange={(evento) =>
                setCodigoPasta(
                  evento.target.value
                )
              }
              required
            >
              {pastas.map((pasta) => (
                <option
                  key={pasta}
                  value={pasta}
                >
                  {pasta}
                </option>
              ))}
            </select>
          </div>

          <div className="modal-campo">
            <label htmlFor="editar-numero">
              Número do arquivo
            </label>

            <input
              id="editar-numero"
              type="number"
              min="1"
              value={numero}
              onChange={(evento) =>
                setNumero(
                  evento.target.value
                )
              }
              required
            />
          </div>

          <div className="modal-campo">
            <label htmlFor="editar-status">
              Status
            </label>

            <select
              id="editar-status"
              value={status}
              onChange={(evento) =>
                setStatus(
                  evento.target.value
                )
              }
            >
              <option value="Arquivado">
                Arquivado
              </option>

              <option value="Pendente">
                Pendente
              </option>

              <option value="Transferido">
                Transferido
              </option>
            </select>
          </div>

          {erro && (
            <p className="modal-erro">
              {erro}
            </p>
          )}

          <div className="modal-acoes">
            <button
              type="button"
              className="modal-cancelar"
              onClick={aoFechar}
              disabled={salvando}
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="modal-salvar"
              disabled={salvando}
            >
              {salvando ? (
                <>
                  <LoaderCircle
                    className="modal-spinner"
                    size={19}
                  />

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