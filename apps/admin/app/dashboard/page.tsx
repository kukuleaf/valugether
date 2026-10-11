'use client';
import { Shell } from '../../components/Shell';
import { JsonTable } from '../../components/JsonTable';
import { ResourceFeedback } from '../../components/ResourceFeedback';
import { useAdminResource } from '../../lib/use-admin-resource';
export default function Dashboard() {
  const { data: d, error, loading, load } = useAdminResource<any>('/api/admin/dashboard', null);
  return (
    <Shell>
      <h1 className="title">Dashboard</h1>
      <p className="muted">데이터 적재상태와 서비스 핵심 운영지표</p>
      <ResourceFeedback error={error} loading={loading} retry={load} />
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
