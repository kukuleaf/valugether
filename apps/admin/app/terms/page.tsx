'use client';

import { useEffect, useState } from 'react';
import { Shell } from '../../components/Shell';

type Term = {
  term_id: number;
  term_code: string;
  title: string;
  version: string;
  content: string;
  is_required: boolean;
  status_code: 'DRAFT' | 'PUBLISHED' | 'RETIRED';
  effective_from: string | null;
};

const emptyForm = {
  code: 'SERVICE',
  title: '',
  version: '',
  content: '',
  isRequired: true,
};

export default function TermsPage() {
  const [rows, setRows] = useState<Term[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<Term | null>(null);
  const [message, setMessage] = useState('');

  const load = () =>
    fetch('/api/admin/terms')
      .then((response) => response.json())
      .then(setRows);

  useEffect(() => {
    void load();
  }, []);

  async function create() {
    setMessage('');
    const response = await fetch('/api/admin/terms', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(form),
    });
    const body = await response.json();
    if (!response.ok) return setMessage(body.message ?? '저장 실패');
    setForm(emptyForm);
    setMessage('새 약관 버전을 작성 중 상태로 저장했습니다.');
    await load();
  }

  async function saveDraft() {
    if (!editing) return;
    const response = await fetch(`/api/admin/terms/${editing.term_id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: editing.title,
        content: editing.content,
        isRequired: editing.is_required,
        effectiveFrom: editing.effective_from,
      }),
    });
    const body = await response.json();
    if (!response.ok) return setMessage(body.message ?? '수정 실패');
    setEditing(null);
    setMessage('수정했습니다.');
    await load();
  }

  async function publish(term: Term) {
    if (!window.confirm(`${term.title} v${term.version}을 앱에 배포할까요?`)) return;
    const response = await fetch(`/api/admin/terms/${term.term_id}/publish`, { method: 'POST' });
    const body = await response.json();
    if (!response.ok) return setMessage(body.message ?? '배포 실패');
    setMessage('배포했습니다. 같은 종류의 이전 버전은 자동 보관됩니다.');
    await load();
  }

  return (
    <Shell>
      <h1 className="title">약관 관리</h1>
      <p className="muted">
        종류별 새 버전을 작성하고 검토 후 배포합니다. 배포된 내용은 수정할 수 없습니다.
      </p>

      <section className="card form-card">
        <h2>새 버전 만들기</h2>
        <label>약관 코드</label>
        <input
          className="field"
          value={form.code}
          onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })}
          placeholder="예: SERVICE, PRIVACY, MARKETING"
        />
        <label>앱에 표시할 제목</label>
        <input
          className="field"
          value={form.title}
          onChange={(event) => setForm({ ...form, title: event.target.value })}
        />
        <label>버전</label>
        <input
          className="field"
          value={form.version}
          onChange={(event) => setForm({ ...form, version: event.target.value })}
          placeholder="예: 1.1 또는 2026-09-06"
        />
        <label>약관 내용</label>
        <textarea
          className="field textarea"
          value={form.content}
          onChange={(event) => setForm({ ...form, content: event.target.value })}
        />
        <label className="check-field">
          <input
            type="checkbox"
            checked={form.isRequired}
            onChange={(event) => setForm({ ...form, isRequired: event.target.checked })}
          />
          필수 동의
        </label>
        <button className="btn" onClick={create}>
          작성 중으로 저장
        </button>
      </section>

      {message && <p>{message}</p>}

      <table>
        <thead>
          <tr>
            <th>종류</th>
            <th>제목</th>
            <th>버전</th>
            <th>필수</th>
            <th>상태</th>
            <th>시행일</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((term) => (
            <tr key={term.term_id}>
              <td>{term.term_code}</td>
              <td>{term.title}</td>
              <td>{term.version}</td>
              <td>{term.is_required ? '필수' : '선택'}</td>
              <td>{statusLabel(term.status_code)}</td>
              <td>
                {term.effective_from ? new Date(term.effective_from).toLocaleDateString() : '-'}
              </td>
              <td className="actions">
                {term.status_code === 'DRAFT' && (
                  <>
                    <button className="btn secondary" onClick={() => setEditing(term)}>
                      수정
                    </button>
                    <button className="btn" onClick={() => publish(term)}>
                      배포
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {editing && (
        <div className="dialog-backdrop">
          <section className="card dialog">
            <h2>
              {editing.term_code} v{editing.version} 수정
            </h2>
            <label>제목</label>
            <input
              className="field"
              value={editing.title}
              onChange={(event) => setEditing({ ...editing, title: event.target.value })}
            />
            <label>내용</label>
            <textarea
              className="field textarea"
              value={editing.content}
              onChange={(event) => setEditing({ ...editing, content: event.target.value })}
            />
            <label className="check-field">
              <input
                type="checkbox"
                checked={editing.is_required}
                onChange={(event) => setEditing({ ...editing, is_required: event.target.checked })}
              />
              필수 동의
            </label>
            <div className="actions">
              <button className="btn" onClick={saveDraft}>
                저장
              </button>
              <button className="btn secondary" onClick={() => setEditing(null)}>
                취소
              </button>
            </div>
          </section>
        </div>
      )}
    </Shell>
  );
}

function statusLabel(status: Term['status_code']) {
  return status === 'DRAFT' ? '작성 중' : status === 'PUBLISHED' ? '배포 중' : '이전 버전';
}
