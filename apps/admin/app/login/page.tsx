'use client';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const router = useRouter();
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setError('');
    try {
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
    } catch {
      setError('서버에 연결하지 못했습니다. 잠시 후 다시 시도하세요.');
    } finally {
      setPending(false);
    }
  }
  return (
    <form className="login" onSubmit={submit}>
      <h1 className="title">관리자 로그인</h1>
      <p className="muted">일반 회원 로그인과 동일한 계정이지만 ADMIN role이 있어야 합니다.</p>
      <input
        className="field"
        placeholder="email"
        aria-label="이메일"
        type="email"
        autoComplete="username"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        className="field"
        placeholder="password"
        type="password"
        aria-label="비밀번호"
        autoComplete="current-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error && <p style={{ color: '#a00000' }}>{error}</p>}
      <button className="btn" disabled={pending}>
        {pending ? '로그인 중…' : '로그인'}
      </button>
    </form>
  );
}
