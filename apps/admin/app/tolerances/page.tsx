'use client';
import { useState } from 'react';
import { Shell } from '../../components/Shell';
import { ResourceFeedback } from '../../components/ResourceFeedback';
import { adminRequest, errorMessage } from '../../lib/api-client';
import { useAdminResource } from '../../lib/use-admin-resource';
export default function Tolerances() {
  const { data: rows, error, loading, load } = useAdminResource<any[]>('/api/admin/tolerances', []);
  const [message, setMessage] = useState('');
  async function save(r: any, v: string) {
    if (!v.trim() || !Number.isFinite(Number(v)) || Number(v) < 0) {
      setMessage('허용오차는 0 이상의 숫자로 입력하세요.');
      return;
    }
    try {
      await adminRequest(`/api/admin/tolerances/${r.tolerance_id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: r.tolerance_type, value: Number(v) }),
      });
      setMessage('허용오차를 저장했습니다.');
      await load();
    } catch (caught) {
      setMessage(errorMessage(caught));
    }
  }
  return (
    <Shell>
      <h1 className="title">근접검색 허용오차</h1>
      <p className="muted">SYS001 계열 설정. 변경내역은 audit_log에 기록됩니다.</p>
      <ResourceFeedback error={error} loading={loading} retry={load} />
      {message && (
        <p className="feedback" role="status">
          {message}
        </p>
      )}
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Metric</th>
              <th>Operator</th>
              <th>Type</th>
              <th>Value</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <Row key={r.tolerance_id} r={r} save={save} />
            ))}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
function Row({ r, save }: { r: any; save: (r: any, v: string) => Promise<void> }) {
  const [v, setV] = useState(String(r.tolerance_value));
  const [pending, setPending] = useState(false);
  return (
    <tr>
      <td>{r.setting_detail_code}</td>
      <td>
        {r.metric_code} · {r.metric_name_ko}
      </td>
      <td>{r.operator_code}</td>
      <td>{r.tolerance_type}</td>
      <td>
        <input
          aria-label={`${r.metric_code} ${r.operator_code} 허용오차`}
          type="number"
          min={0}
          step="any"
          value={v}
          onChange={(e) => setV(e.target.value)}
          style={{ width: 100, padding: 8 }}
        />
      </td>
      <td>
        <button
          className="btn"
          disabled={pending}
          onClick={async () => {
            setPending(true);
            try {
              await save(r, v);
            } finally {
              setPending(false);
            }
          }}
        >
          {pending ? '저장 중…' : '저장'}
        </button>
      </td>
    </tr>
  );
}
