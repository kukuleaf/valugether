'use client';
import { useEffect, useState } from 'react';
import { Shell } from '../../components/Shell';
import { JsonTable } from '../../components/JsonTable';
export default function Providers() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    fetch('/api/admin/providers')
      .then((r) => r.json())
      .then(setRows);
  }, []);
  return (
    <Shell>
      <h1 className="title">Providers</h1>
      <p className="muted">외부 공급자 상태. Secret 값은 표시하지 않습니다.</p>
      <JsonTable rows={rows} />
    </Shell>
  );
}
