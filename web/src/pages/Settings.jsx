import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/store.js';

export default function Settings() {
  const { user, setTheme, updateUser } = useAuth();
  const [form, setForm] = useState({ name: user?.name || '', tone: user?.tone || '', locale: user?.locale || 'pt-BR' });
  const [credits, setCredits] = useState(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get('/users/me/credits').then(setCredits).catch(() => {});
  }, []);

  async function save(e) {
    e.preventDefault();
    const { user: updated } = await api.patch('/users/me', form);
    updateUser(updated);
    setSaved(true); setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div className="page">
      <h2>Configurações</h2>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginBottom: 14 }}>Perfil</h3>
        <form onSubmit={save}>
          <div className="field"><label>Nome</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="field"><label>Tom de voz preferido</label>
            <input className="input" value={form.tone} onChange={(e) => setForm({ ...form, tone: e.target.value })}
              placeholder="Ex.: direto, acolhedor, técnico…" /></div>
          <div className="field"><label>Idioma</label>
            <input className="input" value={form.locale} onChange={(e) => setForm({ ...form, locale: e.target.value })} /></div>
          <button className="btn btn-primary">{saved ? 'Salvo ✓' : 'Salvar'}</button>
        </form>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginBottom: 14 }}>Aparência</h3>
        <label style={{ display: 'block', marginBottom: 8 }}>Tema</label>
        <div className="theme-toggle">
          <button className={user?.theme === 'lunar' ? 'active' : ''} onClick={() => setTheme('lunar')}>🌙 Lunar</button>
          <button className={user?.theme === 'solar' ? 'active' : ''} onClick={() => setTheme('solar')}>☀️ Solar</button>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 14 }}>Plano e créditos</h3>
        <p>Plano atual: <span className="badge ok">{user?.planTier}</span></p>
        <p style={{ marginTop: 8 }}>Saldo de créditos: <b>{credits?.balance ?? user?.creditBalance ?? 0}</b></p>
        {credits?.costs && (
          <p style={{ color: 'var(--text-dim)', fontSize: 13, marginTop: 8 }}>
            Custos: chat {credits.costs.CHAT} · pesquisa {credits.costs.SEARCH} · imagem {credits.costs.IMAGE} · análise {credits.costs.ANALYSIS} créditos.
          </p>
        )}
      </div>
    </div>
  );
}
