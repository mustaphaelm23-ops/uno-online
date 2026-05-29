import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

// Auth page mirrors the lobby's vibe — same vignette + panel-card aesthetic
// — so the transition into the lobby feels continuous rather than two
// different apps. Tab toggle between Sign In and Register.

export default function AuthPage() {
  const { login, register } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState('login');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', email: '' });

  const onSubmit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      if (tab === 'login') await login(form.username.trim(), form.password);
      else                 await register(form.username.trim(), form.password, form.email.trim() || undefined);
      toast.success(tab === 'login' ? 'Welcome back!' : 'Account created. Welcome!');
    } catch (err) {
      toast.error(err.message || 'Failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="h-full grid place-items-center px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="w-full max-w-md panel-card p-8"
      >
        <div className="flex flex-col items-center gap-2 mb-6">
          <div className="font-display text-5xl tracking-wider text-accent drop-shadow-[0_4px_24px_rgba(245,158,11,0.4)]">UNO</div>
          <div className="text-ink-soft text-xs uppercase tracking-[0.3em]">Online Arena</div>
        </div>

        <div className="flex gap-1 mb-6 p-1 bg-bg/60 rounded-xl border border-line">
          {['login', 'register'].map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition
                          ${tab === k ? 'bg-violet text-white shadow-glow' : 'text-ink-soft hover:text-ink'}`}
            >
              {k === 'login' ? 'Sign In' : 'Register'}
            </button>
          ))}
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <input
            className="input"
            placeholder="Username"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            required
            minLength={3}
            maxLength={20}
            autoFocus
          />
          {tab === 'register' && (
            <input
              className="input"
              type="email"
              placeholder="Email (optional)"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          )}
          <input
            className="input"
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
            minLength={6}
          />
          <button type="submit" disabled={busy} className="btn-primary mt-2 disabled:opacity-60">
            {busy ? '…' : tab === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-xs text-ink-faint mt-6">
          By continuing, you accept the house rules. House cut: 10% per match.
        </p>
      </motion.div>
    </div>
  );
}
