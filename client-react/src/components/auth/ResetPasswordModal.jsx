import { useState } from 'react';
import Modal from '../ui/Modal';
import { api } from '../../api/client';
import { useToast } from '../../contexts/ToastContext';

// Password reset flow. Backend (/api/auth/reset) verifies the username
// against the recovery email set at registration; on match it rewrites
// the password hash. No magic-link email required — the recovery email
// is the trust anchor.

export default function ResetPasswordModal({ open, onClose }) {
  const toast = useToast();
  const [form, setForm] = useState({ username: '', email: '', newPassword: '' });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await api.post('/api/auth/reset', {
        username:    form.username.trim(),
        email:       form.email.trim(),
        newPassword: form.newPassword,
      });
      toast.success('Password reset! You can sign in now.');
      setForm({ username: '', email: '', newPassword: '' });
      onClose?.();
    } catch (err) {
      toast.error(err.message || 'Reset failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={busy ? undefined : onClose} title="Reset Password" width="sm">
      <form onSubmit={submit} className="flex flex-col gap-3 py-2">
        <p className="text-xs text-ink-faint leading-relaxed">
          Enter the username and the recovery email you set at registration.
          Accounts without a recovery email can't be reset here — contact support.
        </p>
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
        <input
          className="input"
          type="email"
          placeholder="Recovery email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
        />
        <input
          className="input"
          type="password"
          placeholder="New password (6+ characters)"
          value={form.newPassword}
          onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
          required
          minLength={6}
        />
        <button type="submit" disabled={busy} className="btn-primary mt-2 disabled:opacity-60">
          {busy ? '…' : 'Reset Password'}
        </button>
      </form>
    </Modal>
  );
}
