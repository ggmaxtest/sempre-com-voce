import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', context: '' });
  const navigate = useNavigate();

  async function load() {
    const { projects } = await api.get('/projects');
    setProjects(projects);
  }
  useEffect(() => { load(); }, []);

  async function create(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    await api.post('/projects', form);
    setForm({ name: '', description: '', context: '' });
    setCreating(false);
    load();
  }

  async function remove(id) {
    if (!confirm('Excluir este projeto? As conversas vinculadas serão desvinculadas.')) return;
    await api.del(`/projects/${id}`);
    load();
  }

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Meus Projetos</h2>
        <button className="btn btn-primary" onClick={() => setCreating((v) => !v)}>Novo projeto</button>
      </div>
      <p style={{ color: 'var(--text-dim)', marginBottom: 18 }}>
        Cada projeto tem seu próprio contexto, arquivos e memória. A IA entende automaticamente o projeto selecionado.
      </p>

      {creating && (
        <form className="card" style={{ marginBottom: 18 }} onSubmit={create}>
          <div className="field"><label>Nome</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Sem Perrengue Digital" /></div>
          <div className="field"><label>Descrição</label>
            <input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="field"><label>Contexto (a IA usa automaticamente)</label>
            <textarea className="textarea" rows={3} value={form.context} onChange={(e) => setForm({ ...form, context: e.target.value })}
              placeholder="Produto, público, objetivo, tom de voz, informações relevantes…" /></div>
          <button className="btn btn-primary">Criar projeto</button>
        </form>
      )}

      <div className="grid-cards">
        {projects.map((p) => (
          <div key={p.id} className="card">
            <h3 style={{ marginBottom: 6 }}>{p.name}</h3>
            <p style={{ color: 'var(--text-dim)', fontSize: 14, minHeight: 40 }}>{p.description || 'Sem descrição.'}</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button className="btn btn-sm btn-primary" onClick={() => navigate(`/project/${p.id}`)}>Abrir</button>
              <button className="btn btn-sm btn-danger" onClick={() => remove(p.id)}>Excluir</button>
            </div>
          </div>
        ))}
        {projects.length === 0 && !creating && (
          <p style={{ color: 'var(--text-faint)' }}>Nenhum projeto ainda. Crie o primeiro.</p>
        )}
      </div>
    </div>
  );
}
