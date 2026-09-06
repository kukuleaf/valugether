'use client';
import { useEffect, useState } from 'react';
import { Shell } from '../../components/Shell';
import { JsonTable } from '../../components/JsonTable';
export default function Logs() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    fetch('/api/admin/audit-logs?limit=200')
      .then((r) => r.json())
      .then(setRows);
  }, []);
  return (
    <Shell>
      <h1 className="title">Audit Logs</h1>
      <p className="muted">
        관리자 변경과 중요 사용자행위를 추적합니다. 비밀번호/토큰/API Key는 기록하지 않습니다.
      </p>
      <JsonTable rows={rows} />
    </Shell>
  );
}
