'use client';
export function JsonTable({ rows }: { rows: any[] }) {
  if (!rows?.length) return <div className="card muted">데이터 없음</div>;
  const keys = Object.keys(rows[0]).slice(0, 8);
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {keys.map((k) => (
              <th key={k}>{k}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {keys.map((k) => (
                <td key={k}>
                  {typeof r[k] === 'object' ? JSON.stringify(r[k]) : String(r[k] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
