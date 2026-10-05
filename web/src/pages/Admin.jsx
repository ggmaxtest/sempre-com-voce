import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

const TABS = ['Visão geral', 'Prompt Base', 'Usuários', 'Uso & Custos', 'Integrações', 'Agentes & Tools', 'Saúde'];

export default function Admin() {
  const [tab, setTab] = useState('Visão geral');
  return (
    <div className="page">
      <h2>Administração</h2>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
        {TABS.map((t) => (
          <button key={t} className={`btn btn-sm ${tab === t ? 'btn-primary' : ''}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>
      {tab === 'Visão geral' && <Overview />}
      {tab === 'Prompt Base' && <BasePrompt />}
      {tab === 'Usuários' && <Users />}
      {tab === 'Uso & Custos' && <Usage />}
      {tab === 'Integrações' && <Integrations />}
      {tab === 'Agentes & Tools' && <AgentsTools />}
      {tab === 'Saúde' && <Health />}
    </div>
  );
}

// PROMPT BASE GLOBAL — somente a dona da plataforma edita. Começa vazio.
function BasePrompt() {
  const [value, setValue] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get('/admin/base-prompt')
      .then((d) => { setValue(d.basePrompt || ''); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, []);

  async function save() {
    setSaving(true);
    try {
      await api.put('/admin/base-prompt', { basePrompt: value });
      setSaved(true); setTimeout(() => setSaved(false), 1800);
    } finally { setSaving(false); }
  }

  if (!loaded) return <span className="spinner" />;

  return (
    <div className="card">
      <h3 style={{ marginBottom: 6 }}>Prompt Base Global da IA</h3>
      <p style={{ color: 'var(--text-dim)', fontSize: 14, marginBottom: 14 }}>
        Define o comportamento, a personalidade, as regras e os padrões de resposta da IA
        para <b>todos os clientes</b>. Apenas você (administração) pode editar. O contexto do
        negócio/nicho que cada cliente fornece é aplicado <b>por cima</b> deste prompt, sem substituí-lo.
      </p>
      <div className="field">
        <label>Conteúdo do Prompt Base</label>
        <textarea
          className="textarea"
          rows={16}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Escreva aqui como a IA deve se comportar, responder e seguir as regras da plataforma…"
          style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13.5, lineHeight: 1.6 }}
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? <span className="spinner" /> : saved ? 'Salvo ✓' : 'Salvar Prompt Base'}
        </button>
        <span style={{ color: 'var(--text-faint)', fontSize: 12 }}>{value.length} caracteres</span>
      </div>
    </div>
  );
}

function Overview() {
  const [m, setM] = useState(null);
  useEffect(() => { api.get('/admin/metrics').then(setM).catch(() => {}); }, []);
  if (!m) return <span className="spinner" />;
  const cards = [
    ['Usuários', m.users], ['Projetos', m.projects], ['Conversas', m.conversations],
    ['Mensagens', m.messages], ['Arquivos', m.files],
  ];
  return (
    <div className="grid-cards">
      {cards.map(([label, val]) => (
        <div key={label} className="card">
          <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>{label}</div>
          <div style={{ fontSize: 30, fontWeight: 800 }}>{val}</div>
        </div>
      ))}
    </div>
  );
}

function Users() {
  const [users, setUsers] = useState([]);
  useEffect(() => { api.get('/admin/users').then((d) => setUsers(d.users)).catch(() => {}); }, []);
  async function adjust(id, amount) { await api.post(`/admin/users/${id}/credits`, { amount }); alert('Créditos ajustados.'); }
  return (
    <div className="card">
      <table className="table">
        <thead><tr><th>E-mail</th><th>Papel</th><th>Plano</th><th>Créditos</th><th>Ativo</th><th></th></tr></thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.email}</td><td><span className="badge">{u.role}</span></td><td>{u.planTier}</td>
              <td>{u.creditBalance}</td><td>{u.isActive ? '✓' : '✗'}</td>
              <td><button className="btn btn-sm" onClick={() => adjust(u.id, 100)}>+100 créditos</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Usage() {
  const [u, setU] = useState(null);
  useEffect(() => { api.get('/admin/usage').then(setU).catch(() => {}); }, []);
  if (!u) return <span className="spinner" />;
  return (
    <>
      <div className="grid-cards" style={{ marginBottom: 16 }}>
        <div className="card"><div style={{ color: 'var(--text-dim)', fontSize: 13 }}>Custo estimado total</div>
          <div style={{ fontSize: 28, fontWeight: 800 }}>${u.totalCostUsd?.toFixed(4)}</div></div>
        <div className="card"><div style={{ color: 'var(--text-dim)', fontSize: 13 }}>Eventos</div>
          <div style={{ fontSize: 28, fontWeight: 800 }}>{u.totalEvents}</div></div>
      </div>
      <div className="card">
        <h3 style={{ marginBottom: 10 }}>Por tipo</h3>
        <table className="table">
          <thead><tr><th>Tipo</th><th>Eventos</th><th>Tokens entrada</th><th>Tokens saída</th></tr></thead>
          <tbody>
            {u.byKind.map((k) => (
              <tr key={k.kind}><td>{k.kind}</td><td>{k._count._all}</td>
                <td>{k._sum.promptTokens || 0}</td><td>{k._sum.completionTokens || 0}</td></tr>
            ))}
            {u.byKind.length === 0 && <tr><td colSpan={4} style={{ color: 'var(--text-faint)' }}>Sem uso registrado ainda.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Integrations() {
  const [list, setList] = useState([]);
  useEffect(() => { api.get('/admin/integrations').then((d) => setList(d.integrations)).catch(() => {}); }, []);
  return (
    <div className="card">
      <table className="table">
        <thead><tr><th>Integração</th><th>Status</th><th>Observação</th></tr></thead>
        <tbody>
          {list.map((i) => (
            <tr key={i.provider}>
              <td>{i.label}</td>
              <td><span className={`badge ${i.status === 'CONNECTED' ? 'ok' : 'pending'}`}>{i.status}</span></td>
              <td style={{ color: 'var(--text-dim)' }}>{i.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AgentsTools() {
  const [agents, setAgents] = useState([]);
  const [tools, setTools] = useState([]);
  useEffect(() => {
    api.get('/admin/agents').then((d) => setAgents(d.agents)).catch(() => {});
    api.get('/admin/tools').then((d) => setTools(d.tools)).catch(() => {});
  }, []);
  return (
    <>
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginBottom: 10 }}>Agentes ({agents.length})</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {agents.map((a) => <span key={a} className="chip dim">{a}</span>)}
        </div>
      </div>
      <div className="card">
        <h3 style={{ marginBottom: 10 }}>Ferramentas ({tools.length})</h3>
        <table className="table">
          <thead><tr><th>Nome</th><th>Descrição</th><th>Permissões</th></tr></thead>
          <tbody>
            {tools.map((t) => (
              <tr key={t.name}><td><code>{t.name}</code></td><td style={{ color: 'var(--text-dim)' }}>{t.description}</td>
                <td>{(t.permissions || []).join(', ') || '—'}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Health() {
  const [h, setH] = useState(null);
  useEffect(() => { api.get('/admin/health').then(setH).catch(() => {}); }, []);
  if (!h) return <span className="spinner" />;
  return (
    <div className="card">
      <h3 style={{ marginBottom: 10 }}>Verificação de saúde</h3>
      {Object.entries(h.checks).map(([k, v]) => (
        <p key={k} style={{ marginBottom: 6 }}>
          {k}: <span className={`badge ${v === 'ok' || v === 'configured' ? 'ok' : 'pending'}`}>{v}</span>
        </p>
      ))}
      <p style={{ color: 'var(--text-faint)', fontSize: 13, marginTop: 8 }}>{h.time}</p>
    </div>
  );
}
