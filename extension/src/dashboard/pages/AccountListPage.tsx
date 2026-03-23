import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { Account } from '../types';

const C = {
  primary: '#2D4B3E',
  primaryLight: '#DDE6E1',
  surface: '#F9FAFA',
  containerLow: '#EDF1EF',
  border: '#BFC9C3',
  text: '#191C1B',
  muted: '#56635B',
};

interface Props {
  onLogout: () => void;
}

export function AccountListPage({ onLogout }: Props) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.getAccounts()
      .then(setAccounts)
      .catch(() => onLogout())
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: C.surface }}>
      {/* Top nav */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 60,
        background: '#fff', borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', zIndex: 50,
      }}>
        <h1 style={{ fontSize: 18, fontWeight: 800, color: C.primary, letterSpacing: '-0.3px' }}>
          WeCatch
        </h1>
        <button
          onClick={onLogout}
          style={{
            padding: '6px 14px', fontSize: 13, fontWeight: 600,
            background: C.containerLow, color: C.muted,
            border: `1px solid ${C.border}`, borderRadius: 6, cursor: 'pointer',
          }}
        >
          退出登录
        </button>
      </header>

      <main style={{ paddingTop: 80, maxWidth: 800, margin: '0 auto', padding: '80px 24px 24px' }}>
        <div style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 4 }}>公众号列表</h2>
          <p style={{ fontSize: 13, color: C.muted }}>选择一个公众号查看留言</p>
        </div>

        {loading ? (
          <p style={{ color: C.muted }}>加载中...</p>
        ) : accounts.length === 0 ? (
          <div style={{
            padding: 32, textAlign: 'center', color: C.muted,
            background: '#fff', borderRadius: 12, border: `1px solid ${C.border}`,
          }}>
            暂无公众号，请先使用插件抓取留言
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {accounts.map((account) => (
              <div
                key={account.id}
                onClick={() => navigate(`/accounts/${account.id}`, { state: { accountName: account.name } })}
                style={{
                  padding: '20px 24px',
                  background: '#fff', border: `1px solid ${C.border}`,
                  borderRadius: 10, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = C.primary)}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = C.border)}
              >
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 4 }}>
                    {account.name || account.wx_account_id}
                  </h3>
                  <p style={{ fontSize: 12, color: C.muted }}>
                    最近抓取：{account.last_captured_at
                      ? new Date(account.last_captured_at).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                      : '从未'}
                  </p>
                </div>
                <span style={{ color: C.primary, fontSize: 18, fontWeight: 300 }}>›</span>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
