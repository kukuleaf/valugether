'use client';

import { useState } from 'react';

export function LogoutButton() {
  const [pending, setPending] = useState(false);

  async function logout() {
    if (pending) return;
    setPending(true);
    try {
      await fetch('/api/session/logout', { method: 'POST' });
    } finally {
      window.location.assign('/login');
    }
  }

  return (
    <button className="btn secondary" type="button" disabled={pending} onClick={logout}>
      {pending ? '로그아웃 중…' : '로그아웃'}
    </button>
  );
}
