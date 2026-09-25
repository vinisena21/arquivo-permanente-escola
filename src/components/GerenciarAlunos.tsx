import {
  useMemo,
  useState,
  type FormEvent
} from 'react';
import {
  FolderOpen,
  LoaderCircle,
  Sparkles,
  UserPlus
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { AlunoArquivo } from '../types/database';
import {
  validarNome,
  validarDataISO,
  validarNumeroArquivo,
  validarPasta
} from '../lib/validacao';
import './GerenciarAlunos.css';

interface AlunoResumo {
  id: number;
  codigoPasta: string;
  numero: number;
}

/** @deprecated Use AlunoArquivo from types/database */
export type AlunoCadastrado = AlunoArquivo;

interface GerenciarAlunosProps {
  alunos: AlunoResumo[];
  onAlunoCadastrado: (aluno: AlunoArquivo) => void;
}

interface ErrosCampos {
  nome?: string;
  dataNascimento?: string;
  pasta?: string;
  numero?: string;
}

function formatarDataParaExibicao(data: string | null): string {
  if (!data) return '';
  const partes = data.split('-');
  if (partes.length !== 3) return data;
  const [ano, mes, dia] = partes;
  return `${dia}/${mes}/${ano}`;
}

function encontrarPrimeiroDisponivel(
  alunos: AlunoResumo[],
  codigoPasta: string
): number {
  if (!codigoPasta) {
    return 1;
  }

  const numerosOcupados = new Set(
    alunos
      .filter((aluno) => aluno.codigoPasta === codigoPasta)
      .map((aluno) => aluno.numero)
  );

  let primeiroDisponivel = 1;

  while (numerosOcupados.has(primeiroDisponivel)) {
    primeiroDisponivel += 1;
  }

  return primeiroDisponivel;
}

export default function GerenciarAlunos({
  alunos,
  onAlunoCadastrado
}: GerenciarAlunosProps) {
  const [nome, setNome] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [pastaSelecionada, setPastaSelecionada] = useState('');
  const [numero, setNumero] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [erroGeral, setErroGeral] = useState('');
  const [erros, setErros] = useState<ErrosCampos>({});

  const pastasOrdenadas = useMemo(() => {
    const quantidades = new Map<string, number>();

    for (const aluno of alunos) {
      const quantidadeAtual = quantidades.get(aluno.codigoPasta) ?? 0;
      quantidades.set(aluno.codigoPasta, quantidadeAtual + 1);
    }

    return Array.from(quantidades.entries())
      .map(([codigo, quantidade]) => ({ codigo, quantidade }))
      .sort((pastaA, pastaB) =>
        pastaA.codigo.localeCompare(pastaB.codigo, 'pt-BR', { numeric: true })
      );
  }, [alunos]);

  const pastaRecomendada = useMemo(() => {
    const nomeDigitado = nome
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    if (!nomeDigitado || pastasOrdenadas.length === 0) {
      return null;
    }

    const primeiraLetra = nomeDigitado.charAt(0).toLocaleUpperCase('pt-BR');

    const pastasDaLetra = pastasOrdenadas.filter((pasta) => {
      const letraDaPasta = pasta.codigo
        .trim()
        .charAt(0)
        .toLocaleUpperCase('pt-BR');
      return letraDaPasta === primeiraLetra;
    });

    if (pastasDaLetra.length === 0) {
      return null;
    }

    return [...pastasDaLetra].sort((pastaA, pastaB) => {
      if (pastaA.quantidade !== pastaB.quantidade) {
        return pastaA.quantidade - pastaB.quantidade;
      }
      return pastaA.codigo.localeCompare(pastaB.codigo, 'pt-BR', {
        numeric: true
      });
    })[0];
  }, [alunos, nome, pastasOrdenadas]);

  const pastaAtual = pastaSelecionada || pastaRecomendada?.codigo || '';

  const numeroSugerido = useMemo(
    () => encontrarPrimeiroDisponivel(alunos, pastaAtual),
    [alunos, pastaAtual]
  );

  const numeroAtual = numero || String(numeroSugerido);

  function selecionarPasta(novaPasta: string) {
    setPastaSelecionada(novaPasta);
    setNumero(String(encontrarPrimeiroDisponivel(alunos, novaPasta)));
    setMensagem('');
    setErroGeral('');
    setErros((e) => ({ ...e, pasta: undefined, numero: undefined }));
  }

  function usarRecomendacao() {
    if (!pastaRecomendada) return;
    selecionarPasta(pastaRecomendada.codigo);
    setMensagem(`Pasta ${pastaRecomendada.codigo} selecionada.`);
  }

  function validarFormulario(): boolean {
    const novosErros: ErrosCampos = {};

    const erroNome = validarNome(nome);
    if (erroNome) novosErros.nome = erroNome;

    const erroData = validarDataISO(dataNascimento, false);
    if (erroData) novosErros.dataNascimento = erroData;

    const erroPasta = validarPasta(pastaAtual);
    if (erroPasta) novosErros.pasta = erroPasta;

    const erroNumero = validarNumeroArquivo(numeroAtual);
    if (erroNumero) novosErros.numero = erroNumero;

    setErros(novosErros);
    return Object.keys(novosErros).length === 0;
  }

  async function cadastrarAluno(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setMensagem('');
    setErroGeral('');

    if (!validarFormulario()) {
      return;
    }

    const nomeTratado = nome
      .trim()
      .replace(/\s+/g, ' ')
      .toLocaleUpperCase('pt-BR');

    const numeroTratado = Number(numeroAtual);

    setSalvando(true);

    try {
      const { data: numeroExistente, error: erroConsulta } = await supabase
        .from('alunos')
        .select('id')
        .eq('codigo_pasta', pastaAtual)
        .eq('numero', numeroTratado)
        .limit(1);

      if (erroConsulta) throw erroConsulta;

      if (numeroExistente && numeroExistente.length > 0) {
        setErros((e) => ({
          ...e,
          numero: `O número ${numeroTratado} já está ocupado na pasta ${pastaAtual}.`
        }));
        return;
      }

      const { data: novoAluno, error: erroCadastro } = await supabase
        .from('alunos')
        .insert({
          nome: nomeTratado,
          data_nascimento: dataNascimento || null,
          codigo_pasta: pastaAtual,
          numero: numeroTratado,
          status: 'Arquivado'
        })
        .select('id, nome, data_nascimento, codigo_pasta, numero, status')
        .single();

      if (erroCadastro) throw erroCadastro;

      if (novoAluno) {
        onAlunoCadastrado({
          id: novoAluno.id,
          nome: novoAluno.nome,
          dataNascimento: formatarDataParaExibicao(novoAluno.data_nascimento),
          codigoPasta: novoAluno.codigo_pasta,
          numero: novoAluno.numero,
          status: novoAluno.status
        });
      }

      setMensagem(
        `${nomeTratado} foi cadastrado na pasta ${pastaAtual}, número ${numeroTratado}.`
      );

      setNome('');
      setDataNascimento('');
      setPastaSelecionada('');
      setNumero('');
      setErros({});
    } catch (erroEncontrado) {
      console.error(erroEncontrado);
      setErroGeral('Não foi possível cadastrar o aluno. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section className="gerenciar-container">
      <div className="gerenciar-titulo">
        <div>
          <h2>Gerenciar alunos</h2>
          <p>Cadastre novos registros no arquivo permanente.</p>
        </div>
        <UserPlus size={30} />
      </div>

      {pastaRecomendada && (
        <div className="recomendacao-card">
          <div className="recomendacao-icone">
            <Sparkles size={24} />
          </div>

          <div>
            <span>Recomendação inteligente</span>
            <strong>Pasta {pastaRecomendada.codigo}</strong>
            <p>
              Para nomes começando com{' '}
              <strong>
                {nome.trim().charAt(0).toLocaleUpperCase('pt-BR')}
              </strong>
              , esta é a pasta com menos registros: {pastaRecomendada.quantidade}{' '}
              alunos.
            </p>
          </div>

          <button type="button" onClick={usarRecomendacao}>
            Usar pasta
          </button>
        </div>
      )}

      <form className="gerenciar-formulario" onSubmit={cadastrarAluno} noValidate>
        <div className="campo campo-largo">
          <label htmlFor="aluno-nome">Nome completo</label>
          <input
            id="aluno-nome"
            type="text"
            value={nome}
            onChange={(evento) => {
              setNome(evento.target.value);
              if (erros.nome) setErros((e) => ({ ...e, nome: undefined }));
            }}
            placeholder="Digite o nome completo"
            aria-invalid={Boolean(erros.nome)}
          />
          {erros.nome && <p className="gerenciar-erro-campo">{erros.nome}</p>}
        </div>

        <div className="campo">
          <label htmlFor="aluno-nascimento">Data de nascimento</label>
          <input
            id="aluno-nascimento"
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
            <p className="gerenciar-erro-campo">{erros.dataNascimento}</p>
          )}
        </div>

        <div className="campo">
          <label htmlFor="aluno-pasta">Pasta</label>
          <div className="campo-com-icone">
            <FolderOpen size={19} />
            <select
              id="aluno-pasta"
              value={pastaAtual}
              onChange={(evento) => selecionarPasta(evento.target.value)}
              aria-invalid={Boolean(erros.pasta)}
            >
              <option value="">Selecione uma pasta</option>
              {pastasOrdenadas.map((pasta) => (
                <option key={pasta.codigo} value={pasta.codigo}>
                  {pasta.codigo} — {pasta.quantidade} alunos
                </option>
              ))}
            </select>
          </div>
          {erros.pasta && <p className="gerenciar-erro-campo">{erros.pasta}</p>}
        </div>

        <div className="campo">
          <label htmlFor="aluno-numero">Número do arquivo</label>
          <input
            id="aluno-numero"
            type="number"
            min="1"
            value={numeroAtual}
            onChange={(evento) => {
              setNumero(evento.target.value);
              if (erros.numero) setErros((e) => ({ ...e, numero: undefined }));
            }}
            aria-invalid={Boolean(erros.numero)}
          />
          <small>Primeiro disponível: {numeroSugerido}</small>
          {erros.numero && <p className="gerenciar-erro-campo">{erros.numero}</p>}
        </div>

        {erroGeral && <p className="gerenciar-erro">{erroGeral}</p>}
        {mensagem && <p className="gerenciar-sucesso">{mensagem}</p>}

        <button className="salvar-aluno" type="submit" disabled={salvando}>
          {salvando ? (
            <>
              <LoaderCircle className="gerenciar-spinner" size={20} />
              Salvando...
            </>
          ) : (
            <>
              <UserPlus size={20} />
              Cadastrar aluno
            </>
          )}
        </button>
      </form>
    </section>
  );
}
