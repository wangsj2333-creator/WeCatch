import React, { useState } from 'react';
import { api, setJwt } from '../api/client';

const C = {
  primary: '#2D4B3E',
  primaryLight: '#DDE6E1',
  surface: '#F9FAFA',
  border: '#BFC9C3',
  text: '#191C1B',
  muted: '#56635B',
  error: '#BA1A1A',
  errorBg: '#FFDAD6',
};

interface Props {
  onLogin: () => void;
}

export function LoginPage({ onLogin }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token } = await api.login(username, password);
      setJwt(token);
      onLogin();
    } catch {
      setError('登录失败，请检查用户名和密码');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: C.surface,
    }}>
      <div style={{
        width: 360,
        background: '#fff',
        borderRadius: 12,
        padding: '40px 36px',
        boxShadow: '0 4px 24px rgba(45,75,62,0.08)',
        border: `1px solid ${C.border}`,
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: C.primary, letterSpacing: '-0.5px' }}>
            WeCatch
          </h1>
          <p style={{ color: C.muted, fontSize: 13, marginTop: 6 }}>留言管理后台</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              用户名
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              style={{
                width: '100%', padding: '10px 12px',
                border: `1.5px solid ${C.border}`, borderRadius: 8,
                fontSize: 14, color: C.text, background: '#fff',
                outline: 'none',
              }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              密码
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: '100%', padding: '10px 12px',
                border: `1.5px solid ${C.border}`, borderRadius: 8,
                fontSize: 14, color: C.text, background: '#fff',
                outline: 'none',
              }}
            />
          </div>

          {error && (
            <div style={{
              marginBottom: 16, padding: '10px 12px',
              background: C.errorBg, color: C.error,
              borderRadius: 8, fontSize: 13,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '11px 0',
              background: loading ? C.muted : C.primary,
              color: '#fff', border: 'none', borderRadius: 8,
              fontSize: 14, fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s',
            }}
          >
            {loading ? '登录中...' : '登录'}
          </button>
        </form>
      </div>
    </div>
  );
}
