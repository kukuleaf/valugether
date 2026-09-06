'use client';
import { useEffect, useState } from 'react';
import { Shell } from '../../components/Shell';
import { JsonTable } from '../../components/JsonTable';
export default function Dashboard() {
  const [d, setD] = useState<any>();
  useEffect(() => {
    fetch('/api/admin/dashboard')
      .then((r) => r.json())
      .then(setD);
  }, []);
  return (
    <Shell>
      <h1 className="title">Dashboard</h1>
      <p className="muted">데이터 적재상태와 서비스 핵심 운영지표</p>
      <div className="grid">
        <div className="card">
          <div className="muted">회원</div>
          <div className="big">{d?.users?.total ?? '-'}</div>
        </div>
        <div className="card">
          <div className="muted">활성 회원</div>
          <div className="big">{d?.users?.active ?? '-'}</div>
        </div>
        <div className="card">
          <div className="muted">오늘 검색</div>
          <div className="big">{d?.today?.searches ?? '-'}</div>
        </div>
      </div>
      <h2>가격 기준일</h2>
      <JsonTable rows={d?.priceFreshness ?? []} />
      <h2>최근 배치</h2>
      <JsonTable rows={d?.latestBatches ?? []} />
    </Shell>
  );
}
