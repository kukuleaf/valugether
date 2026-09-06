'use client';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const r = await fetch('/api/session/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!r.ok) {
      setError('관리자 로그인에 실패했습니다.');
      return;
    }
    router.push('/dashboard');
    router.refresh();
  }
  return (
    <form className="login" onSubmit={submit}>
      <h1 className="title">관리자 로그인</h1>
      <p className="muted">일반 회원 로그인과 동일한 계정이지만 ADMIN role이 있어야 합니다.</p>
      <input
        className="field"
        placeholder="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        className="field"
        placeholder="password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error && <p style={{ color: '#a00000' }}>{error}</p>}
      <button className="btn">로그인</button>
    </form>
  );
}
