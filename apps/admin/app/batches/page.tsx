'use client';

import { useCallback, useEffect, useState } from 'react';
import { Shell } from '../../components/Shell';
import { JsonTable } from '../../components/JsonTable';

type QualityIssue = {
  data_quality_issue_id: number;
  check_code: string;
  severity_code: 'WARNING' | 'CRITICAL';
  market_code: string | null;
  actual_value: string | null;
  threshold_value: string | null;
  message: string;
};
type QualityStatus = {
  latest: null | {
    data_quality_run_id: string;
    status_code: string;
    started_at: string;
    checked_count: number;
    warning_count: number;
    critical_count: number;
    alert_status_code: string | null;
  };
  issues: QualityIssue[];
  recent: unknown[];
};

export default function Batches() {
  const [rows, setRows] = useState<any[]>([]);
  const [quality, setQuality] = useState<QualityStatus>({ latest: null, issues: [], recent: [] });
  const [message, setMessage] = useState('');
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    const [runsResponse, qualityResponse] = await Promise.all([
      fetch('/api/admin/batch-runs?limit=100'),
      fetch('/api/admin/batches/data-quality?limit=10'),
    ]);
    const [runsBody, qualityBody] = await Promise.all([
      runsResponse.json(),
      qualityResponse.json(),
    ]);
    if (!runsResponse.ok || !qualityResponse.ok) {
      setMessage(runsBody.message ?? qualityBody.message ?? '배치 상태를 불러오지 못했습니다.');
      return;
    }
    setRows(runsBody);
    setQuality(qualityBody);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function runQualityCheck() {
    if (running) return;
    setRunning(true);
    setMessage('');
    try {
      const response = await fetch('/api/admin/batches/data-quality', { method: 'POST' });
      const body = await response.json();
      if (!response.ok) {
        setMessage(messageOf(body, '품질 검사에 실패했습니다.'));
        return;
      }
      setMessage(
        `검사 완료: ${body.status}, 경고 ${body.warningCount}건, 심각 ${body.criticalCount}건`,
      );
      await load();
    } finally {
      setRunning(false);
    }
  }

  return (
    <Shell>
      <div className="editor-heading">
        <div>
          <h1 className="title">배치·데이터 품질</h1>
          <p className="muted">수집 배치와 가격·재무 데이터의 최신성·커버리지를 추적합니다.</p>
        </div>
        <button className="btn" disabled={running} onClick={runQualityCheck}>
          {running ? '검사 중…' : '지금 품질 검사'}
        </button>
      </div>
      {message && <p className="feedback">{message}</p>}

      <div className="grid">
        <div className="card">
          <div className="muted">최근 품질 상태</div>
          <div className="big">{quality.latest?.status_code ?? '-'}</div>
        </div>
        <div className="card">
          <div className="muted">경고</div>
          <div className="big">{quality.latest?.warning_count ?? '-'}</div>
        </div>
        <div className="card">
          <div className="muted">심각</div>
          <div className="big">{quality.latest?.critical_count ?? '-'}</div>
        </div>
        <div className="card">
          <div className="muted">운영 알림</div>
          <div className="big small-big">{quality.latest?.alert_status_code ?? '-'}</div>
        </div>
      </div>

      <h2>최근 품질 이슈</h2>
      {quality.issues.length ? (
        <table>
          <thead>
            <tr>
              <th>등급</th>
              <th>검사</th>
              <th>시장</th>
              <th>실제/기준</th>
              <th>내용</th>
            </tr>
          </thead>
          <tbody>
            {quality.issues.map((issue) => (
              <tr key={issue.data_quality_issue_id}>
                <td>
                  <span className={`status quality-${issue.severity_code.toLowerCase()}`}>
                    {issue.severity_code === 'CRITICAL' ? '심각' : '경고'}
                  </span>
                </td>
                <td>{issue.check_code}</td>
                <td>{issue.market_code ?? '-'}</td>
                <td>
                  {issue.actual_value ?? '-'} / {issue.threshold_value ?? '-'}
                </td>
                <td>{issue.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="muted">기록된 품질 이슈가 없습니다.</p>
      )}

      <h2>최근 배치 실행</h2>
      <JsonTable rows={rows} />
    </Shell>
  );
}

function messageOf(body: any, fallback: string) {
  const message = body?.message ?? fallback;
  return Array.isArray(message) ? message.join(', ') : String(message);
}
