import type { Account, Article, Comment, CommentStatus } from '../types';

let baseUrl = 'http://localhost:8080';
let jwt = '';

// Load settings from chrome storage on init
if (typeof chrome !== 'undefined' && chrome.storage) {
  chrome.storage.local.get(['apiUrl', 'jwt'], (result) => {
    baseUrl = result.apiUrl || baseUrl;
    jwt = result.jwt || '';
  });
}

export function setJwt(token: string) {
  jwt = token;
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.local.set({ jwt: token });
  }
}

export function getJwt(): string {
  return jwt;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const resp = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
      ...options.headers,
    },
  });

  if (resp.status === 401) {
    setJwt('');
    throw new Error('unauthorized');
  }

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(text || `HTTP ${resp.status}`);
  }

  return resp.json();
}

export const api = {
  login: (username: string, password: string) =>
    request<{ token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  getAccounts: () => request<Account[]>('/api/accounts'),

  getArticles: (accountId: number) =>
    request<Article[]>(`/api/accounts/${accountId}/articles`),

  getComments: (articleId: number, params?: { category?: string; status?: string }) => {
    const query = new URLSearchParams();
    if (params?.category) query.set('category', params.category);
    if (params?.status) query.set('status', params.status);
    const qs = query.toString();
    return request<Comment[]>(`/api/articles/${articleId}/comments${qs ? '?' + qs : ''}`);
  },

  updateCommentStatus: (commentId: number, status: CommentStatus) =>
    request<{ status: string }>(`/api/comments/${commentId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),
};
