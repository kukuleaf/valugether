'use client';
import { Shell } from '../../components/Shell';
import { JsonTable } from '../../components/JsonTable';
import { ResourceFeedback } from '../../components/ResourceFeedback';
import { useAdminResource } from '../../lib/use-admin-resource';
export default function Providers() {
  const { data: rows, error, loading, load } = useAdminResource<any[]>('/api/admin/providers', []);
  return (
    <Shell>
      <h1 className="title">Providers</h1>
      <p className="muted">외부 공급자 상태. Secret 값은 표시하지 않습니다.</p>
      <ResourceFeedback error={error} loading={loading} retry={load} />
      {!error && !loading && <JsonTable rows={rows} />}
    </Shell>
  );
}
