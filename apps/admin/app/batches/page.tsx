'use client';
import { useEffect, useState } from 'react';
import { Shell } from '../../components/Shell';
import { JsonTable } from '../../components/JsonTable';
export default function Batches() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    fetch('/api/admin/batch-runs?limit=100')
      .then((r) => r.json())
      .then(setRows);
  }, []);
  return (
    <Shell>
      <h1 className="title">Batch Runs</h1>
      <p className="muted">수집/가공 배치의 성공·실패·건수를 추적합니다.</p>
      <JsonTable rows={rows} />
    </Shell>
  );
}
