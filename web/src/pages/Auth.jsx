import { useState } from 'react';
import { useAuth } from '../lib/store.js';

export default function Auth() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { login, register } = useAuth();

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'login') await login(email, password);
      else await register(email, password, name);
    } catch (err) {
      setError(err.message || 'Falha na autenticação.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <div className="brand" style={{ marginBottom: 18 }}>
          <div className="brand-mark">◐</div>
          <div>
            <div>Sempre com Você</div>
            <div className="brand-slogan">Uma IA. Todas as ferramentas. Um só lugar.</div>
          </div>
        </div>

        <h2>{mode === 'login' ? 'Entrar' : 'Criar conta'}</h2>
        <p className="sub">
          {mode === 'login' ? 'Bem-vindo de volta.' : 'Comece a usar sua IA companheira.'}
        </p>

        {error && <div className="error-box">{error}</div>}

        <form onSubmit={submit}>
          {mode === 'register' && (
            <div className="field">
              <label>Nome</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" />
            </div>
          )}
          <div className="field">
            <label>E-mail</label>
            <input className="input" type="email" required value={email}
              onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" />
          </div>
          <div className="field">
            <label>Senha</label>
            <input className="input" type="password" required minLength={mode === 'register' ? 8 : 1}
              value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'register' ? 'Mínimo 8 caracteres' : '••••••••'} />
          </div>
          <button className="btn btn-primary" style={{ width: '100%', marginTop: 6 }} disabled={busy}>
            {busy ? <span className="spinner" /> : mode === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>

        <div className="auth-switch">
          {mode === 'login' ? (
            <>Não tem conta? <a onClick={() => setMode('register')} style={{ cursor: 'pointer' }}>Criar conta</a></>
          ) : (
            <>Já tem conta? <a onClick={() => setMode('login')} style={{ cursor: 'pointer' }}>Entrar</a></>
          )}
        </div>
      </div>
    </div>
  );
}
