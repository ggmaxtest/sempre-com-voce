import { create } from 'zustand';
import { api, setToken } from './api.js';

export const useAuth = create((set, get) => ({
  user: null,
  loading: true,

  async bootstrap() {
    try {
      const { user } = await api.get('/auth/me');
      set({ user, loading: false });
      applyTheme(user.theme || 'lunar');
    } catch {
      set({ user: null, loading: false });
      applyTheme(localStorage.getItem('scv_theme') || 'lunar');
    }
  },

  async login(email, password) {
    const { user, token } = await api.post('/auth/login', { email, password });
    setToken(token);
    set({ user });
    applyTheme(user.theme || 'lunar');
  },

  async register(email, password, name) {
    const { user, token } = await api.post('/auth/register', { email, password, name });
    setToken(token);
    set({ user });
    applyTheme(user.theme || 'lunar');
  },

  async logout() {
    try { await api.post('/auth/logout'); } catch {}
    setToken(null);
    set({ user: null });
  },

  async setTheme(theme) {
    applyTheme(theme);
    const user = get().user;
    if (user) {
      set({ user: { ...user, theme } });
      try { await api.patch('/users/me', { theme }); } catch {}
    }
  },

  updateUser(patch) {
    set({ user: { ...get().user, ...patch } });
  },
}));

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('scv_theme', theme);
}
