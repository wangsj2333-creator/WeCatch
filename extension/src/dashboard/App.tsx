import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { getJwt } from './api/client';
import { LoginPage } from './pages/LoginPage';
import { AccountListPage } from './pages/AccountListPage';
import { WorkspacePage } from './pages/WorkspacePage';

export function App() {
  const [loggedIn, setLoggedIn] = useState(!!getJwt());

  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get(['jwt'], (result) => {
        setLoggedIn(!!result.jwt);
      });
    }
  }, []);

  if (!loggedIn) {
    return <LoginPage onLogin={() => setLoggedIn(true)} />;
  }

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<AccountListPage onLogout={() => setLoggedIn(false)} />} />
        <Route path="/accounts/:accountId" element={<WorkspacePage onLogout={() => setLoggedIn(false)} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
