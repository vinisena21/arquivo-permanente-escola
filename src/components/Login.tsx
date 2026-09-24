import { useState, type FormEvent } from 'react';
import {
  GraduationCap,
  LoaderCircle,
  LockKeyhole,
  Mail
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { validarEmail, validarSenha } from '../lib/validacao';
import './Login.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [erroEmail, setErroEmail] = useState('');
  const [erroSenha, setErroSenha] = useState('');

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
          <p>Entre para consultar e gerenciar os registros.</p>
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
              'Entrar'
            )}
          </button>
        </form>

        <p className="login-security">
          Acesso restrito aos usuários autorizados.
        </p>
      </section>
    </main>
  );
}
