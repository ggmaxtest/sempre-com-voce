import { useEffect, useState } from 'react';
import { Routes, Route, useNavigate, useParams, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from './lib/store.js';
import { api } from './lib/api.js';
import { Icon } from './components/icons.jsx';
import Auth from './pages/Auth.jsx';
import Chat from './pages/Chat.jsx';
import Projects from './pages/Projects.jsx';
import Settings from './pages/Settings.jsx';
import Admin from './pages/Admin.jsx';
import Memory from './pages/Memory.jsx';

export default function App() {
  const { user, loading, bootstrap } = useAuth();
  useEffect(() => { bootstrap(); }, []);

  if (loading) {
    return <div style={{ display: 'grid', placeItems: 'center', height: '100vh' }}><span className="spinner" /></div>;
  }
  if (!user) return <Auth />;

  return (
    <Routes>
      <Route path="/*" element={<Shell />} />
    </Routes>
  );
}

function Shell() {
  const { user, logout, setTheme } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [conversations, setConversations] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  async function loadConversations() {
    try { const { conversations } = await api.get('/chat/conversations'); setConversations(conversations); }
    catch { setConversations([]); }
  }
  useEffect(() => {
    loadConversations();
    const h = () => loadConversations();
    window.addEventListener('scv:conversations-changed', h);
    return () => window.removeEventListener('scv:conversations-changed', h);
  }, []);

  async function newChat() { navigate('/'); setSidebarOpen(false); }
  async function rename(id) {
    const title = prompt('Novo nome da conversa:');
    if (!title) return;
    await api.patch(`/chat/conversations/${id}`, { title });
    loadConversations();
  }
  async function removeConvo(id) {
    if (!confirm('Excluir esta conversa?')) return;
    await api.del(`/chat/conversations/${id}`);
    if (location.pathname.includes(id)) navigate('/');
    loadConversations();
  }

  const isActive = (path) => location.pathname === path;

  return (
    <div className="app-shell">
      <div className={`overlay ${sidebarOpen ? 'show' : ''}`} onClick={() => setSidebarOpen(false)} />
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="brand">
            <div className="brand-mark">◐</div>
            <div>
              <div style={{ fontSize: 16 }}>Sempre com Você</div>
              <div className="brand-slogan">Uma IA. Todas as ferramentas.</div>
            </div>
          </div>
        </div>

        <div className="sidebar-section">
          <button className="btn btn-primary" style={{ width: '100%', marginBottom: 10 }} onClick={newChat}>
            <Icon.plus /> Nova conversa
          </button>

          <div className="nav-item" onClick={() => { navigate('/projects'); setSidebarOpen(false); }}>
            <Icon.folder /> Meus Projetos
          </div>
          <div className="nav-item" onClick={() => { navigate('/memory'); setSidebarOpen(false); }}>
            <Icon.brain /> Memória & Marca
          </div>
          <div className="nav-item" onClick={() => { navigate('/settings'); setSidebarOpen(false); }}>
            <Icon.settings /> Configurações
          </div>
          {user.role === 'ADMIN' && (
            <div className="nav-item" onClick={() => { navigate('/admin'); setSidebarOpen(false); }}>
              <Icon.shield /> Administração
            </div>
          )}

          <div className="sidebar-title">Histórico</div>
          {conversations.map((c) => (
            <div key={c.id} className={`nav-item convo-item ${location.pathname.includes(c.id) ? 'active' : ''}`}
              onClick={() => { navigate(`/c/${c.id}`); setSidebarOpen(false); }}>
              <Icon.chat />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</span>
              <span className="convo-actions">
                <button className="btn-ghost btn-sm" style={{ padding: 4 }} onClick={(e) => { e.stopPropagation(); rename(c.id); }}><Icon.edit /></button>
                <button className="btn-ghost btn-sm" style={{ padding: 4 }} onClick={(e) => { e.stopPropagation(); removeConvo(c.id); }}><Icon.trash /></button>
              </span>
            </div>
          ))}
          {conversations.length === 0 && <p style={{ color: 'var(--text-faint)', fontSize: 13, padding: '4px 8px' }}>Nenhuma conversa ainda.</p>}
        </div>

        <div className="sidebar-footer">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name || user.email}</div>
              <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>{user.creditBalance} créditos</div>
            </div>
            <button className="btn-ghost btn-sm" onClick={() => logout()} title="Sair"><Icon.logout /></button>
          </div>
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <button className="btn-ghost mobile-menu-btn" style={{ padding: 8 }} onClick={() => setSidebarOpen(true)}><Icon.menu /></button>
          <div style={{ flex: 1 }} />
          <div className="theme-toggle">
            <button className={user.theme === 'lunar' ? 'active' : ''} onClick={() => setTheme('lunar')}>🌙</button>
            <button className={user.theme === 'solar' ? 'active' : ''} onClick={() => setTheme('solar')}>☀️</button>
          </div>
        </div>

        <Routes>
          <Route path="/" element={<Chat />} />
          <Route path="/c/:id" element={<Chat />} />
          <Route path="/project/:projectId" element={<ProjectChat />} />
          <Route path="/project/:projectId/c/:id" element={<ProjectChat />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/memory" element={<Memory />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/admin" element={user.role === 'ADMIN' ? <Admin /> : <Navigate to="/" />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
}

function ProjectChat() {
  const { projectId } = useParams();
  return <Chat projectId={projectId} key={projectId} />;
}
