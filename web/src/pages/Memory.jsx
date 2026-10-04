import { useEffect, useState } from 'react';
import { brandApi, memoryApi } from '../lib/api.js';

export default function Memory() {
  const [fields, setFields] = useState([]);
  const [profile, setProfile] = useState({});
  const [savedAt, setSavedAt] = useState(null);
  const [saving, setSaving] = useState(false);
  const [facts, setFacts] = useState([]);
  const [newFact, setNewFact] = useState('');

  async function load() {
    try {
      const b = await brandApi.get();
      setFields(b.fields || []);
      setProfile(b.profile || {});
    } catch { /* ignore */ }
    try {
      const m = await memoryApi.list();
      setFacts(m.memories || []);
    } catch { /* ignore */ }
  }
  useEffect(() => { load(); }, []);

  async function saveBrand(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {};
      for (const [key] of fields) payload[key] = profile[key] || '';
      const { profile: saved } = await brandApi.save(payload);
      setProfile(saved);
      setSavedAt(Date.now());
      setTimeout(() => setSavedAt(null), 1500);
    } finally { setSaving(false); }
  }

  async function addFact() {
    const content = newFact.trim();
    if (!content) return;
    const { memory } = await memoryApi.add(content, 'USER');
    setFacts((f) => [{ ...memory, createdAt: new Date().toISOString() }, ...f]);
    setNewFact('');
  }

  async function removeFact(id) {
    await memoryApi.remove(id);
    setFacts((f) => f.filter((x) => x.id !== id));
  }

  return (
    <div className="page">
      <h2>Memória & Marca</h2>
      <p style={{ color: 'var(--text-dim)', marginBottom: 18 }}>
        Ensine o jeito do seu negócio. A IA usa essas informações automaticamente nas respostas.
        Você controla tudo: pode editar ou remover quando quiser. Nada é inventado.
      </p>

      <div className="card" style={{ marginBottom: 18 }}>
        <h3 style={{ marginBottom: 14 }}>Perfil da Marca</h3>
        <form onSubmit={saveBrand}>
          {fields.map(([key, label]) => (
            <div className="field" key={key}>
              <label>{label}</label>
              {['products', 'rules', 'approvedExamples', 'avoidExamples', 'positioning', 'differentials'].includes(key) ? (
                <textarea className="textarea" rows={2} value={profile[key] || ''}
                  onChange={(e) => setProfile({ ...profile, [key]: e.target.value })} />
              ) : (
                <input className="input" value={profile[key] || ''}
                  onChange={(e) => setProfile({ ...profile, [key]: e.target.value })} />
              )}
            </div>
          ))}
          <button className="btn btn-primary" disabled={saving}>
            {saving ? <span className="spinner" /> : savedAt ? 'Salvo ✓' : 'Salvar perfil'}
          </button>
        </form>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 6 }}>Fatos memorizados</h3>
        <p style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 12 }}>
          Informações pontuais que a IA deve lembrar. Ex.: "Nosso frete grátis é acima de R$199".
        </p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <input className="input" value={newFact} onChange={(e) => setNewFact(e.target.value)}
            placeholder="Ensinar um novo fato…"
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addFact(); } }} />
          <button className="btn btn-primary" onClick={addFact}>Adicionar</button>
        </div>
        {facts.length === 0 && <p style={{ color: 'var(--text-faint)' }}>Nenhum fato memorizado ainda.</p>}
        {facts.map((f) => (
          <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
            <span className="badge">{f.scope}</span>
            <span style={{ flex: 1 }}>{f.content}</span>
            <button className="btn btn-sm btn-danger" onClick={() => removeFact(f.id)}>Remover</button>
          </div>
        ))}
      </div>
    </div>
  );
}
