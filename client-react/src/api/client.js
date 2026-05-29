// Tiny fetch wrapper. Reads the JWT from localStorage and attaches it as a
// Bearer header. Throws a normalized Error so callers can show error.message
// in toasts without parsing the response shape.

const TOKEN_KEY = 'uno_token';

export function getToken()  { return localStorage.getItem(TOKEN_KEY); }
export function setToken(t) { localStorage.setItem(TOKEN_KEY, t); }
export function clearToken(){ localStorage.removeItem(TOKEN_KEY); }

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* empty body */ }
  if (!res.ok) {
    const msg = data?.error || data?.message || `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  get:  (p)        => request('GET',    p),
  post: (p, body)  => request('POST',   p, body),
  patch:(p, body)  => request('PATCH',  p, body),
  del:  (p)        => request('DELETE', p),
};
