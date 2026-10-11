'use client';
import { Shell } from '../../components/Shell';
import { JsonTable } from '../../components/JsonTable';
import { ResourceFeedback } from '../../components/ResourceFeedback';
import { useAdminResource } from '../../lib/use-admin-resource';
export default function Logs() {
  const {
    data: rows,
    error,
    loading,
    load,
  } = useAdminResource<any[]>('/api/admin/audit-logs?limit=200', []);
  return (
    <Shell>
      <h1 className="title">Audit Logs</h1>
      <p className="muted">
        관리자 변경과 중요 사용자행위를 추적합니다. 비밀번호/토큰/API Key는 기록하지 않습니다.
      </p>
      <ResourceFeedback error={error} loading={loading} retry={load} />
      {!error && !loading && <JsonTable rows={rows} />}
    </Shell>
  );
}
