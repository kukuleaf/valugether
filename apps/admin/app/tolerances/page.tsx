'use client';
import { useEffect, useState } from 'react';
import { Shell } from '../../components/Shell';
export default function Tolerances() {
  const [rows, setRows] = useState<any[]>([]);
  const load = () =>
    fetch('/api/admin/tolerances')
      .then((r) => r.json())
      .then(setRows);
  useEffect(() => {
    void load();
  }, []);
  async function save(r: any, v: string) {
    await fetch(`/api/admin/tolerances/${r.tolerance_id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: r.tolerance_type, value: Number(v) }),
    });
    load();
  }
  return (
    <Shell>
      <h1 className="title">근접검색 허용오차</h1>
      <p className="muted">SYS001 계열 설정. 변경내역은 audit_log에 기록됩니다.</p>
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
    </Shell>
  );
}
function Row({ r, save }: { r: any; save: (r: any, v: string) => void }) {
  const [v, setV] = useState(String(r.tolerance_value));
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
          value={v}
          onChange={(e) => setV(e.target.value)}
          style={{ width: 100, padding: 8 }}
        />
      </td>
      <td>
        <button className="btn" onClick={() => save(r, v)}>
          저장
        </button>
      </td>
    </tr>
  );
}
