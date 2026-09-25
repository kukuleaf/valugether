'use client';

import { useCallback, useEffect, useState } from 'react';
import { Shell } from '../../components/Shell';

type Notice = {
  notice_id: number;
  title: string;
  body: string;
  status_code: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  starts_at: string | null;
  ends_at: string | null;
  updated_at: string;
};
type NoticeForm = {
  id?: number;
  title: string;
  body: string;
  startsAt: string;
  endsAt: string;
};
const emptyForm: NoticeForm = { title: '', body: '', startsAt: '', endsAt: '' };

export default function NoticesPage() {
  const [rows, setRows] = useState<Notice[]>([]);
  const [form, setForm] = useState<NoticeForm>(emptyForm);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch('/api/admin/notices');
    const body = await response.json();
    if (!response.ok) return setMessage(messageOf(body, '공지 목록을 불러오지 못했습니다.'));
    setRows(body);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (saving) return;
    setSaving(true);
    setMessage('');
    try {
      const response = await fetch(
        form.id ? `/api/admin/notices/${form.id}` : '/api/admin/notices',
        {
          method: form.id ? 'PATCH' : 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            title: form.title,
            body: form.body,
            startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
            endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
          }),
        },
      );
      const body = await response.json();
      if (!response.ok) return setMessage(messageOf(body, '저장하지 못했습니다.'));
      setForm(emptyForm);
      setMessage(form.id ? '공지를 수정했습니다.' : '공지를 작성 중 상태로 저장했습니다.');
      await load();
    } finally {
      setSaving(false);
    }
  }

  function edit(notice: Notice) {
    setForm({
      id: notice.notice_id,
      title: notice.title,
      body: notice.body,
      startsAt: toLocalInput(notice.starts_at),
      endsAt: toLocalInput(notice.ends_at),
    });
    setMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function action(notice: Notice, kind: 'publish' | 'archive' | 'delete') {
    const labels = { publish: '게시', archive: '보관', delete: '삭제' };
    if (!window.confirm(`“${notice.title}” 공지를 ${labels[kind]}할까요?`)) return;
    const response = await fetch(
      kind === 'delete'
        ? `/api/admin/notices/${notice.notice_id}`
        : `/api/admin/notices/${notice.notice_id}/${kind}`,
      { method: kind === 'delete' ? 'DELETE' : 'POST' },
    );
    const body = await response.json();
    if (!response.ok) return setMessage(messageOf(body, `${labels[kind]}하지 못했습니다.`));
    if (form.id === notice.notice_id) setForm(emptyForm);
    setMessage(`${labels[kind]}했습니다.`);
    await load();
  }

  return (
    <Shell>
      <h1 className="title">공지 관리</h1>
      <p className="muted">
        작성 중으로 저장하고 검토 후 게시합니다. 게시 기간도 지정할 수 있습니다.
      </p>

      <section className="card form-card notice-form">
        <div className="editor-heading">
          <h2>{form.id ? '공지 수정' : '새 공지'}</h2>
          {form.id && (
            <button className="btn secondary" onClick={() => setForm(emptyForm)}>
              새 공지로 전환
            </button>
          )}
        </div>
        <label>제목</label>
        <input
          className="field"
          maxLength={250}
          value={form.title}
          onChange={(event) => setForm({ ...form, title: event.target.value })}
        />
        <label>내용</label>
        <textarea
          className="field textarea"
          maxLength={10000}
          value={form.body}
          onChange={(event) => setForm({ ...form, body: event.target.value })}
        />
        <div className="inline-fields">
          <label>
            게시 시작 (비우면 게시 즉시)
            <input
              className="field"
              type="datetime-local"
              value={form.startsAt}
              onChange={(event) => setForm({ ...form, startsAt: event.target.value })}
            />
          </label>
          <label>
            게시 종료 (선택)
            <input
              className="field"
              type="datetime-local"
              value={form.endsAt}
              onChange={(event) => setForm({ ...form, endsAt: event.target.value })}
            />
          </label>
        </div>
        <button
          className="btn"
          disabled={saving || !form.title.trim() || !form.body.trim()}
          onClick={save}
        >
          {saving ? '저장 중…' : form.id ? '수정 저장' : '작성 중으로 저장'}
        </button>
      </section>

      {message && <p className="feedback">{message}</p>}

      <div className="notice-list">
        {rows.map((notice) => (
          <article className="card notice-admin-card" key={notice.notice_id}>
            <div className="editor-heading">
              <div>
                <span className={`status ${notice.status_code.toLowerCase()}`}>
                  {statusLabel(notice.status_code)}
                </span>
                <h3>{notice.title}</h3>
              </div>
              <small>{new Date(notice.updated_at).toLocaleString()}</small>
            </div>
            <p className="notice-body">{notice.body}</p>
            <p className="muted">
              기간: {notice.starts_at ? new Date(notice.starts_at).toLocaleString() : '게시 즉시'} ~{' '}
              {notice.ends_at ? new Date(notice.ends_at).toLocaleString() : '종료 없음'}
            </p>
            <div className="actions">
              {notice.status_code !== 'ARCHIVED' && (
                <button className="btn secondary" onClick={() => edit(notice)}>
                  수정
                </button>
              )}
              {notice.status_code === 'DRAFT' && (
                <>
                  <button className="btn" onClick={() => action(notice, 'publish')}>
                    게시
                  </button>
                  <button className="btn danger" onClick={() => action(notice, 'delete')}>
                    삭제
                  </button>
                </>
              )}
              {notice.status_code === 'PUBLISHED' && (
                <button className="btn danger" onClick={() => action(notice, 'archive')}>
                  게시 종료
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    </Shell>
  );
}

function toLocalInput(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function statusLabel(status: Notice['status_code']) {
  return status === 'DRAFT' ? '작성 중' : status === 'PUBLISHED' ? '게시 중' : '보관';
}

function messageOf(body: any, fallback: string) {
  const message = body?.message ?? fallback;
  return Array.isArray(message) ? message.join(', ') : String(message);
}
