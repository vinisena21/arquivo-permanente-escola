import { useState, type FormEvent } from 'react';
import { LoaderCircle, Save, X } from 'lucide-react';
import {
  atualizarAlunoSecretaria,
  type AlunoSecretariaEditavel,
} from '../lib/alunosSecretaria';
import type { AlunoSecretariaRow, Json } from '../types/database';
import './EditarAlunoModal.css';

interface EditarAlunoSecretariaModalProps {
  aluno: AlunoSecretariaRow;
  aoFechar: () => void;
  aoSalvar: (alunoAtualizado: AlunoSecretariaRow) => void;
}

const SITUACOES = ['NORMAL', 'TRANSFERIDO', 'DESISTENTE', 'CLASSIFICADO', 'REMANEJADO', ''];
const SEXOS = ['M', 'F', 'Masculino', 'Feminino', ''];

function paraISO(data: string | null): string {
  if (!data) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(data)) return data;
  const partes = data.split('/');
  if (partes.length !== 3) return '';
  const [dia, mes, ano] = partes;
  return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
}

export default function EditarAlunoSecretariaModal({
  aluno,
  aoFechar,
  aoSalvar,
}: EditarAlunoSecretariaModalProps) {
  const [codigoMatricula, setCodigoMatricula] = useState(aluno.codigo_matricula);
  const [codigoEstudante, setCodigoEstudante] = useState(aluno.codigo_estudante ?? '');
  const [nome, setNome] = useState(aluno.nome);
  const [dataNascimento, setDataNascimento] = useState(paraISO(aluno.data_nascimento));
  const [periodo, setPeriodo] = useState(aluno.periodo ?? '');
  const [turma, setTurma] = useState(aluno.turma ?? '');
  const [turno, setTurno] = useState(aluno.turno ?? '');
  const [situacao, setSituacao] = useState(aluno.situacao ?? '');
  const [nacionalidade, setNacionalidade] = useState(aluno.nacionalidade ?? '');
  const [naturalidade, setNaturalidade] = useState(aluno.naturalidade ?? '');
  const [ufNaturalidade, setUfNaturalidade] = useState(aluno.uf_naturalidade ?? '');
  const [sexo, setSexo] = useState(aluno.sexo ?? '');
  const [identidade, setIdentidade] = useState(aluno.identidade ?? '');
  const [filiacao1, setFiliacao1] = useState(aluno.filiacao_1 ?? '');
  const [filiacao2, setFiliacao2] = useState(aluno.filiacao_2 ?? '');
  const [salvando, setSalvando] = useState(false);
  const [erroGeral, setErroGeral] = useState('');
  const [erroNome, setErroNome] = useState('');
  const [erroMatricula, setErroMatricula] = useState('');

  function validar(): boolean {
    let ok = true;
    if (!nome.trim()) {
      setErroNome('Informe o nome do aluno.');
      ok = false;
    } else {
      setErroNome('');
    }
    if (!codigoMatricula.trim()) {
      setErroMatricula('Informe o código da matrícula.');
      ok = false;
    } else {
      setErroMatricula('');
    }
    return ok;
  }

  async function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErroGeral('');
    if (!validar()) return;

    setSalvando(true);
    try {
      const editavel: AlunoSecretariaEditavel = {
        id: aluno.id,
        codigo_matricula: codigoMatricula,
        codigo_estudante: codigoEstudante || null,
        nome,
        data_nascimento: dataNascimento || null,
        periodo: periodo || null,
        turma: turma || null,
        turno: turno || null,
        situacao: situacao || null,
        nacionalidade: nacionalidade || null,
        naturalidade: naturalidade || null,
        uf_naturalidade: ufNaturalidade || null,
        sexo: sexo || null,
        identidade: identidade || null,
        filiacao_1: filiacao1 || null,
        filiacao_2: filiacao2 || null,
      };

      const atualizado = await atualizarAlunoSecretaria(
        editavel,
        aluno.dados as Json
      );
      aoSalvar(atualizado);
    } catch (erro) {
      console.error(erro);
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
        aria-labelledby="editar-secretaria-titulo"
        style={{ maxWidth: 720 }}
      >
        <header className="modal-cabecalho">
          <div>
            <h2 id="editar-secretaria-titulo">Editar aluno da secretaria</h2>
            <p>Atualize os dados da matrícula selecionada.</p>
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

        <form className="modal-formulario" onSubmit={salvar} noValidate>
          <div className="modal-campo modal-campo-largo">
            <label htmlFor="sec-nome">Nome completo</label>
            <input
              id="sec-nome"
              type="text"
              value={nome}
              onChange={(e) => {
                setNome(e.target.value);
                if (erroNome) setErroNome('');
              }}
              aria-invalid={Boolean(erroNome)}
            />
            {erroNome && <p className="modal-erro-campo">{erroNome}</p>}
          </div>

          <div className="modal-campo">
            <label htmlFor="sec-matricula">Código da matrícula</label>
            <input
              id="sec-matricula"
              type="text"
              value={codigoMatricula}
              onChange={(e) => {
                setCodigoMatricula(e.target.value);
                if (erroMatricula) setErroMatricula('');
              }}
              aria-invalid={Boolean(erroMatricula)}
            />
            {erroMatricula && <p className="modal-erro-campo">{erroMatricula}</p>}
          </div>

          <div className="modal-campo">
            <label htmlFor="sec-estudante">Código do estudante</label>
            <input
              id="sec-estudante"
              type="text"
              value={codigoEstudante}
              onChange={(e) => setCodigoEstudante(e.target.value)}
            />
          </div>

          <div className="modal-campo">
            <label htmlFor="sec-nascimento">Data de nascimento</label>
            <input
              id="sec-nascimento"
              type="date"
              value={dataNascimento}
              onChange={(e) => setDataNascimento(e.target.value)}
            />
          </div>

          <div className="modal-campo">
            <label htmlFor="sec-situacao">Situação</label>
            <select
              id="sec-situacao"
              value={situacao}
              onChange={(e) => setSituacao(e.target.value)}
            >
              {SITUACOES.map((s) => (
                <option key={s || 'vazio'} value={s}>
                  {s || '—'}
                </option>
              ))}
              {situacao && !SITUACOES.includes(situacao) && (
                <option value={situacao}>{situacao}</option>
              )}
            </select>
          </div>

          <div className="modal-campo">
            <label htmlFor="sec-periodo">Período</label>
            <input
              id="sec-periodo"
              type="text"
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
            />
          </div>

          <div className="modal-campo">
            <label htmlFor="sec-turma">Turma</label>
            <input
              id="sec-turma"
              type="text"
              value={turma}
              onChange={(e) => setTurma(e.target.value)}
            />
          </div>

          <div className="modal-campo">
            <label htmlFor="sec-turno">Turno</label>
            <input
              id="sec-turno"
              type="text"
              value={turno}
              onChange={(e) => setTurno(e.target.value)}
            />
          </div>

          <div className="modal-campo">
            <label htmlFor="sec-sexo">Sexo</label>
            <select
              id="sec-sexo"
              value={sexo}
              onChange={(e) => setSexo(e.target.value)}
            >
              {SEXOS.map((s) => (
                <option key={s || 'vazio'} value={s}>
                  {s || '—'}
                </option>
              ))}
              {sexo && !SEXOS.includes(sexo) && (
                <option value={sexo}>{sexo}</option>
              )}
            </select>
          </div>

          <div className="modal-campo">
            <label htmlFor="sec-nacionalidade">Nacionalidade</label>
            <input
              id="sec-nacionalidade"
              type="text"
              value={nacionalidade}
              onChange={(e) => setNacionalidade(e.target.value)}
            />
          </div>

          <div className="modal-campo">
            <label htmlFor="sec-naturalidade">Naturalidade</label>
            <input
              id="sec-naturalidade"
              type="text"
              value={naturalidade}
              onChange={(e) => setNaturalidade(e.target.value)}
            />
          </div>

          <div className="modal-campo">
            <label htmlFor="sec-uf">UF naturalidade</label>
            <input
              id="sec-uf"
              type="text"
              maxLength={2}
              value={ufNaturalidade}
              onChange={(e) => setUfNaturalidade(e.target.value.toUpperCase())}
            />
          </div>

          <div className="modal-campo">
            <label htmlFor="sec-identidade">Identidade (RG)</label>
            <input
              id="sec-identidade"
              type="text"
              value={identidade}
              onChange={(e) => setIdentidade(e.target.value)}
            />
          </div>

          <div className="modal-campo modal-campo-largo">
            <label htmlFor="sec-filiacao1">Filiação 1 (mãe)</label>
            <input
              id="sec-filiacao1"
              type="text"
              value={filiacao1}
              onChange={(e) => setFiliacao1(e.target.value)}
            />
          </div>

          <div className="modal-campo modal-campo-largo">
            <label htmlFor="sec-filiacao2">Filiação 2 (pai)</label>
            <input
              id="sec-filiacao2"
              type="text"
              value={filiacao2}
              onChange={(e) => setFiliacao2(e.target.value)}
            />
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
