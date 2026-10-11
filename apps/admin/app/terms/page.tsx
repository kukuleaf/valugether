'use client';

import { useEffect, useRef, useState } from 'react';
import { Shell } from '../../components/Shell';
import { ResourceFeedback } from '../../components/ResourceFeedback';
import { adminRequest, errorMessage } from '../../lib/api-client';
import { useAdminResource } from '../../lib/use-admin-resource';

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
  const { data: rows, error, loading, load } = useAdminResource<Term[]>('/api/admin/terms', []);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<Term | null>(null);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (editing && dialogRef.current && !dialogRef.current.open) dialogRef.current.showModal();
  }, [editing]);

  async function mutate(action: () => Promise<void>) {
    if (saving) return;
    setSaving(true);
    setMessage('');
    try {
      await action();
    } catch (caught) {
      setMessage(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  async function create() {
    if (!form.code.trim() || !form.title.trim() || !form.version.trim() || !form.content.trim()) {
      return setMessage('약관 코드, 제목, 버전, 내용을 모두 입력하세요.');
    }
    await mutate(async () => {
      await adminRequest('/api/admin/terms', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      });
      setForm(emptyForm);
      setMessage('새 약관 버전을 작성 중 상태로 저장했습니다.');
      await load();
    });
  }

  async function saveDraft() {
    if (!editing) return;
    if (!editing.title.trim() || !editing.content.trim()) {
      return setMessage('제목과 약관 내용을 입력하세요.');
    }
    await mutate(async () => {
      await adminRequest(`/api/admin/terms/${editing.term_id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: editing.title,
          content: editing.content,
          isRequired: editing.is_required,
          effectiveFrom: editing.effective_from,
        }),
      });
      setEditing(null);
      setMessage('수정했습니다.');
      await load();
    });
  }

  async function publish(term: Term) {
    if (!window.confirm(`${term.title} v${term.version}을 앱에 배포할까요?`)) return;
    await mutate(async () => {
      await adminRequest(`/api/admin/terms/${term.term_id}/publish`, { method: 'POST' });
      setMessage('배포했습니다. 같은 종류의 이전 버전은 자동 보관됩니다.');
      await load();
    });
  }

  return (
    <Shell>
      <h1 className="title">약관 관리</h1>
      <p className="muted">
        종류별 새 버전을 작성하고 검토 후 배포합니다. 배포된 내용은 수정할 수 없습니다.
      </p>

      <section className="card form-card">
        <fieldset className="editor-fields" disabled={saving}>
          <h2>새 버전 만들기</h2>
          <label htmlFor="term-code">약관 코드</label>
          <input
            id="term-code"
            className="field"
            value={form.code}
            onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })}
            placeholder="예: SERVICE, PRIVACY, MARKETING"
          />
          <label htmlFor="term-title">앱에 표시할 제목</label>
          <input
            id="term-title"
            className="field"
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
          />
          <label htmlFor="term-version">버전</label>
          <input
            id="term-version"
            className="field"
            value={form.version}
            onChange={(event) => setForm({ ...form, version: event.target.value })}
            placeholder="예: 1.1 또는 2026-09-06"
          />
          <label htmlFor="term-content">약관 내용</label>
          <textarea
            id="term-content"
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
          <button className="btn" disabled={saving} onClick={create}>
            {saving ? '저장 중…' : '작성 중으로 저장'}
          </button>
        </fieldset>
      </section>

      {message && !editing && (
        <p className="feedback" role="status">
          {message}
        </p>
      )}
      <ResourceFeedback error={error} loading={loading} retry={load} />

      <div className="table-scroll">
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
                      <button
                        className="btn secondary"
                        disabled={saving}
                        onClick={() => {
                          setMessage('');
                          setEditing(term);
                        }}
                      >
                        수정
                      </button>
                      <button className="btn" disabled={saving} onClick={() => publish(term)}>
                        배포
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <dialog
          className="card dialog"
          ref={dialogRef}
          aria-labelledby="term-dialog-title"
          onCancel={(event) => {
            if (saving) event.preventDefault();
            else setEditing(null);
          }}
          onClick={(event) => {
            if (saving || event.target !== event.currentTarget) return;
            const rect = event.currentTarget.getBoundingClientRect();
            if (
              event.clientX < rect.left ||
              event.clientX > rect.right ||
              event.clientY < rect.top ||
              event.clientY > rect.bottom
            )
              setEditing(null);
          }}
        >
          <h2 id="term-dialog-title">
            {editing.term_code} v{editing.version} 수정
          </h2>
          <label htmlFor="term-edit-title">제목</label>
          <input
            id="term-edit-title"
            disabled={saving}
            className="field"
            value={editing.title}
            onChange={(event) => setEditing({ ...editing, title: event.target.value })}
          />
          <label htmlFor="term-edit-content">내용</label>
          <textarea
            id="term-edit-content"
            disabled={saving}
            className="field textarea"
            value={editing.content}
            onChange={(event) => setEditing({ ...editing, content: event.target.value })}
          />
          <label className="check-field">
            <input
              type="checkbox"
              disabled={saving}
              checked={editing.is_required}
              onChange={(event) => setEditing({ ...editing, is_required: event.target.checked })}
            />
            필수 동의
          </label>
          {message && (
            <p className="feedback" role="status">
              {message}
            </p>
          )}
          <div className="actions">
            <button className="btn" disabled={saving} onClick={saveDraft}>
              {saving ? '저장 중…' : '저장'}
            </button>
            <button className="btn secondary" disabled={saving} onClick={() => setEditing(null)}>
              취소
            </button>
          </div>
        </dialog>
      )}
    </Shell>
  );
}

function statusLabel(status: Term['status_code']) {
  return status === 'DRAFT' ? '작성 중' : status === 'PUBLISHED' ? '배포 중' : '이전 버전';
}
