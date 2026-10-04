import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { api, sendChat, refineContent, getQuickActions } from '../lib/api.js';
import { useAuth } from '../lib/store.js';
import { Icon } from '../components/icons.jsx';

const SUGGESTIONS = [
  { title: 'Analise meu negócio', sub: 'Descubra gargalos e oportunidades', text: 'Analise meu negócio e me diga por onde começar a melhorar as vendas.' },
  { title: 'Crie uma campanha', sub: 'Estratégia, oferta, copy e criativos', text: 'Crie uma campanha completa para o meu produto.' },
  { title: 'Pesquise meu mercado', sub: 'Tendências, demanda e concorrência', text: 'Pesquise o mercado e os concorrentes do meu nicho.' },
  { title: 'Escreva uma página de vendas', sub: 'Copy de alta conversão', text: 'Escreva uma página de vendas para o meu produto.' },
];

const STATUS_LABEL = {
  analisando: 'Analisando', pesquisando: 'Pesquisando', processando: 'Processando',
  criando: 'Criando', validando: 'Validando', aguardando: 'Aguardando', concluido: 'Concluído',
};

export default function Chat({ projectId }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState(null);
  const [plan, setPlan] = useState(null);
  const [events, setEvents] = useState([]);
  const [streamText, setStreamText] = useState('');
  const [streamSources, setStreamSources] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [quickActions, setQuickActions] = useState([]);
  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => { loadConversation(id); }, [id]);
  useEffect(() => { getQuickActions().then((d) => setQuickActions(d.actions || [])).catch(() => {}); }, []);

  async function loadConversation(convoId) {
    setPlan(null); setEvents([]); setStreamText(''); setStatus(null);
    if (!convoId) { setMessages([]); return; }
    try {
      const { conversation } = await api.get(`/chat/conversations/${convoId}`);
      setMessages(conversation.messages.map((m) => ({ role: m.role.toLowerCase(), content: m.content, meta: m.meta, attachments: m.attachments })));
    } catch { setMessages([]); }
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, streamText, status, plan]);

  async function handleSend(text) {
    const content = (text ?? input).trim();
    if (!content || sending) return;
    setInput('');
    setSending(true);
    setStatus('analisando'); setPlan(null); setEvents([]); setStreamText(''); setStreamSources([]);
    const attachIds = attachments.map((a) => a.id);
    const srcAcc = [];
    const srcSeen = new Set();
    setMessages((m) => [...m, { role: 'user', content, attachments }]);
    setAttachments([]);

    let acc = '';
    await sendChat(
      { conversationId: id, projectId, message: content, attachments: attachIds },
      {
        onMeta: ({ conversationId }) => {
          if (!id && conversationId) {
            window.history.replaceState(null, '', projectId ? `/project/${projectId}/c/${conversationId}` : `/c/${conversationId}`);
          }
        },
        onStatus: ({ status }) => setStatus(status),
        onPlan: (p) => { setPlan(p); setStatus(p.complexity === 'complex' ? 'processando' : 'criando'); },
        onEvent: (ev) => {
          setEvents((e) => [...e, ev]);
          if (ev.type === 'sources' && ev.sources?.length) {
            for (const x of ev.sources) {
              if (x.url && !srcSeen.has(x.url)) { srcSeen.add(x.url); srcAcc.push(x); }
            }
            setStreamSources([...srcAcc]);
          }
          if (ev.type === 'pesquisando' || ev.tool === 'web_search') setStatus('pesquisando');
        },
        onDelta: (t) => { acc += t; setStreamText(acc); },
        onDone: (d) => {
          setMessages((m) => [...m, { role: 'ai', content: acc, meta: { agents: plan?.agents, sources: srcAcc } }]);
          setStreamText(''); setStreamSources([]); setStatus(null); setPlan(null); setEvents([]); setSending(false);
          if (typeof d.creditsLeft === 'number') updateUser({ creditBalance: d.creditsLeft });
          if (!id && d.conversationId) {
            window.dispatchEvent(new CustomEvent('scv:conversations-changed'));
          }
        },
        onError: (e) => {
          setMessages((m) => [...m, { role: 'ai', content: `⚠️ ${e.message}` }]);
          setStreamText(''); setStatus(null); setSending(false);
        },
      },
    );
  }

  async function onFilePick(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    if (projectId) fd.append('projectId', projectId);
    try {
      const { file: asset } = await api.upload('/files', fd);
      setAttachments((a) => [...a, asset]);
    } catch (err) {
      alert('Falha no upload: ' + err.message);
    }
    e.target.value = '';
  }

  const empty = messages.length === 0 && !streamText && !status;

  return (
    <>
      <div className="chat-scroll" ref={scrollRef}>
        {empty ? (
          <div className="welcome">
            <div>
              <div className="welcome-mark">◐</div>
              <h1>Em que posso ajudar?</h1>
              <p>Conte o que você precisa — eu cuido do resto.</p>
              <div className="suggestions">
                {SUGGESTIONS.map((s) => (
                  <button key={s.title} className="suggestion" onClick={() => handleSend(s.text)}>
                    <b>{s.title}</b><span>{s.sub}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="chat-inner">
            {messages.map((m, i) => <Message key={i} msg={m} conversationId={id} quickActions={quickActions} onRegenerate={m.role === 'ai' && i === messages.length - 1 ? () => regenerate() : null} />)}

            {(status || plan || events.length > 0) && (
              <div className="msg ai">
                <div className="msg-avatar ai">◐</div>
                <div style={{ flex: 1 }}>
                  <div className="status-chips">
                    {status && <span className="chip"><span className="dot-pulse" />{STATUS_LABEL[status] || status}</span>}
                    {plan?.agents?.map((a) => <span key={a} className="chip dim">{a}</span>)}
                    {events.filter((e) => e.type === 'tool_start').map((e, idx) => (
                      <span key={idx} className="chip dim">🔧 {e.tool}</span>
                    ))}
                  </div>
                  {streamText && (
                    <div className="msg-bubble" style={{ marginTop: 10 }}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamText}</ReactMarkdown>
                      <Sources sources={streamSources} />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="composer-wrap">
        {attachments.length > 0 && (
          <div className="attach-chips">
            {attachments.map((a) => (
              <span key={a.id} className="chip dim">📎 {a.filename}
                <button className="btn-ghost btn-sm" style={{ padding: 2 }}
                  onClick={() => setAttachments((x) => x.filter((f) => f.id !== a.id))}>✕</button>
              </span>
            ))}
          </div>
        )}
        <div className="composer">
          <input ref={fileInputRef} type="file" hidden onChange={onFilePick}
            accept=".csv,.xlsx,.xls,.pdf,.png,.jpg,.jpeg,.webp,.txt,.json" />
          <button className="btn-ghost" style={{ padding: 8 }} onClick={() => fileInputRef.current?.click()} title="Anexar arquivo">
            <Icon.attach />
          </button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Conte o que você precisa…"
            rows={1}
            onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 180) + 'px'; }}
          />
          <button className="send-btn" disabled={sending || !input.trim()} onClick={() => handleSend()}>
            {sending ? <span className="spinner" style={{ borderTopColor: '#fff' }} /> : <Icon.send />}
          </button>
        </div>
      </div>
    </>
  );

  function regenerate() {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUser) {
      setMessages((m) => m.slice(0, -1));
      handleSend(lastUser.content);
    }
  }
}

function Message({ msg, onRegenerate, conversationId, quickActions = [] }) {
  const isUser = msg.role === 'user';
  const [copied, setCopied] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [refining, setRefining] = useState(null); // action key em andamento
  const [refined, setRefined] = useState(null);   // { action, text }

  async function runAction(actionKey) {
    if (refining) return;
    setRefining(actionKey);
    setRefined({ action: actionKey, text: '' });
    let acc = '';
    await refineContent(
      { conversationId, content: msg.content, action: actionKey, messageId: msg.id },
      {
        onDelta: (t) => { acc += t; setRefined({ action: actionKey, text: acc }); },
        onDone: () => setRefining(null),
        onError: (e) => { setRefined({ action: actionKey, text: `⚠️ ${e.message}` }); setRefining(null); },
      },
    );
  }

  return (
    <div className={`msg ${isUser ? 'user' : 'ai'}`}>
      <div className={`msg-avatar ${isUser ? 'user' : 'ai'}`}>{isUser ? '🙂' : '◐'}</div>
      <div style={{ maxWidth: '76%' }}>
        <div className="msg-bubble">
          {isUser ? msg.content : <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>}
          {msg.attachments?.length > 0 && (
            <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {msg.attachments.map((a) => <span key={a.id} className="badge">📎 {a.filename}</span>)}
            </div>
          )}
          {!isUser && <Sources sources={msg.meta?.sources} />}
        </div>

        {!isUser && (
          <div className="msg-actions">
            <button className="btn-ghost btn-sm" onClick={() => { navigator.clipboard.writeText(msg.content); setCopied(true); setTimeout(() => setCopied(false), 1200); }}>
              <Icon.copy /> {copied ? 'Copiado' : 'Copiar'}
            </button>
            {onRegenerate && <button className="btn-ghost btn-sm" onClick={onRegenerate}><Icon.refresh /> Regenerar</button>}
            {quickActions.length > 0 && (
              <button className="btn-ghost btn-sm" onClick={() => setShowActions((v) => !v)}>
                ✨ Ações rápidas
              </button>
            )}
          </div>
        )}

        {!isUser && showActions && (
          <div className="quick-actions">
            {quickActions.map((a) => (
              <button key={a.key} className="qa-chip" disabled={!!refining}
                onClick={() => runAction(a.key)}>
                {refining === a.key ? <span className="spinner" style={{ width: 12, height: 12 }} /> : a.emoji} {a.label}
              </button>
            ))}
          </div>
        )}

        {!isUser && refined && (
          <div className="refined-block">
            <div className="refined-head">
              {quickActions.find((a) => a.key === refined.action)?.emoji}{' '}
              {quickActions.find((a) => a.key === refined.action)?.label || 'Refinado'}
              {refining && <span className="spinner" style={{ width: 12, height: 12, marginLeft: 8 }} />}
            </div>
            <div className="msg-bubble" style={{ marginTop: 6 }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{refined.text || '…'}</ReactMarkdown>
            </div>
            {!refining && refined.text && (
              <div className="msg-actions">
                <button className="btn-ghost btn-sm" onClick={() => { navigator.clipboard.writeText(refined.text); }}>
                  <Icon.copy /> Copiar
                </button>
                <button className="btn-ghost btn-sm" onClick={() => setRefined(null)}>
                  ✕ Descartar (manter original)
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Sources({ sources }) {
  if (!sources?.length) return null;
  return (
    <div className="sources">
      <div className="sources-title">🔎 Fontes</div>
      {sources.map((s, i) => {
        let host = s.source;
        try { if (!host) host = new URL(s.url).hostname; } catch { /* ignore */ }
        const favicon = host ? `https://www.google.com/s2/favicons?domain=${host}&sz=32` : null;
        return (
          <a key={i} className="source-link" href={s.url} target="_blank" rel="noopener noreferrer">
            {favicon && <img className="favicon" src={favicon} alt="" />}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title || s.url}</span>
            {host && <span className="src-host">{host}</span>}
          </a>
        );
      })}
    </div>
  );
}
