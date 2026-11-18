import { useState, type FormEvent } from 'react';
import {
  GraduationCap,
  LoaderCircle,
  LockKeyhole,
  Mail,
  Building2,
  MapPin,
  CheckCircle2
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { validarEmail, validarSenha } from '../lib/validacao';
import escolasData from '../data/escolas.json';
import './Login.css';

const STORAGE_KEY = 'guia_escolar_escola_ativa';
const ESCOLA_PADRAO = 'EM MARIA GERALDA MIRANDA BRITO SALOMÃO';

export default function Login() {
  const [escolaSelecionada, setEscolaSelecionada] = useState<string>(() => {
    try {
      const salva = localStorage.getItem(STORAGE_KEY);
      if (salva && (escolasData as any[]).some((e) => e.Escola === salva)) {
        return salva;
      }
    } catch {
      // Ignora erro
    }
    return ESCOLA_PADRAO;
  });

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [erroEmail, setErroEmail] = useState('');
  const [erroSenha, setErroSenha] = useState('');

  const dadosEscola = (escolasData as any[]).find((e) => e.Escola === escolaSelecionada);

  const trocarEscola = (novaEscola: string) => {
    setEscolaSelecionada(novaEscola);
    try {
      localStorage.setItem(STORAGE_KEY, novaEscola);
    } catch {
      // Ignora erro
    }
  };

  async function entrar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro('');

    const eEmail = validarEmail(email);
    const eSenha = validarSenha(senha);

    setErroEmail(eEmail ?? '');
    setErroSenha(eSenha ?? '');

    if (eEmail || eSenha) {
      return;
    }

    setCarregando(true);

    // Garante que a escola selecionada está salva no localStorage antes de logar
    try {
      localStorage.setItem(STORAGE_KEY, escolaSelecionada);
    } catch {
      // Ignora erro
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: senha
    });

    if (error) {
      console.error(error);
      setErro('E-mail ou senha incorretos.');
      setCarregando(false);
      return;
    }

    setCarregando(false);
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand">
          <div className="login-icon">
            <GraduationCap size={38} />
          </div>

          <h1>Guia Escolar</h1>
          <p>Selecione a sua escola e entre para gerenciar os registros.</p>
        </div>

        {/* Seletor de Escola */}
        <div className="login-school-selector">
          <label htmlFor="login-escola" className="login-school-label">
            <Building2 size={17} className="text-blue-600" />
            <span>Unidade Escolar</span>
          </label>

          <div className="login-school-dropdown-wrap">
            <select
              id="login-escola"
              className="login-school-select"
              value={escolaSelecionada}
              onChange={(e) => trocarEscola(e.target.value)}
            >
              {escolasData.map((e: any) => (
                <option key={e.Código} value={e.Escola}>
                  {e.Escola}
                </option>
              ))}
            </select>
          </div>

          <div className="login-school-meta">
            <span className="login-school-badge">
              <CheckCircle2 size={13} />
              CENSO: {dadosEscola?.['Identificação CENSO'] || '31353426'}
            </span>
            <span className="login-school-zone">
              <MapPin size={13} />
              {dadosEscola?.['Localização/Zona da Escola (CENSO)'] || 'Zona Urbana'}
            </span>
          </div>
        </div>

        <form className="login-form" onSubmit={entrar} noValidate>
          <label htmlFor="login-email">E-mail</label>

          <div className="login-input">
            <Mail size={20} />

            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(evento) => {
                setEmail(evento.target.value);
                if (erroEmail) setErroEmail('');
              }}
              placeholder="Digite seu e-mail"
              autoComplete="email"
              aria-invalid={Boolean(erroEmail)}
            />
          </div>
          {erroEmail && (
            <p className="login-error-campo" role="alert">
              {erroEmail}
            </p>
          )}

          <label htmlFor="login-senha">Senha</label>

          <div className="login-input">
            <LockKeyhole size={20} />

            <input
              id="login-senha"
              type="password"
              value={senha}
              onChange={(evento) => {
                setSenha(evento.target.value);
                if (erroSenha) setErroSenha('');
              }}
              placeholder="Digite sua senha"
              autoComplete="current-password"
              aria-invalid={Boolean(erroSenha)}
            />
          </div>
          {erroSenha && (
            <p className="login-error-campo" role="alert">
              {erroSenha}
            </p>
          )}

          {erro && (
            <p className="login-error" role="alert">
              {erro}
            </p>
          )}

          <button
            className="login-button"
            type="submit"
            disabled={carregando}
          >
            {carregando ? (
              <>
                <LoaderCircle className="login-spinner" size={20} />
                Entrando...
              </>
            ) : (
              'Acessar Escola Selecionada'
            )}
          </button>
        </form>

        <p className="login-security">
          Acesso seguro e restrito à rede municipal de ensino.
        </p>
      </section>
    </main>
  );
}
