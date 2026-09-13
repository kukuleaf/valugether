'use client';

import { useState } from 'react';
import { Shell } from '../../components/Shell';

export default function RankingsPage() {
  const [marketCode, setMarketCode] = useState('US');
  const [limit, setLimit] = useState(100);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

  async function download() {
    setDownloading(true);
    setError('');
    try {
      const params = new URLSearchParams({ marketCode, limit: String(limit) });
      const response = await fetch(`/api/admin/rankings/export?${params}`);
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message ?? '엑셀 생성에 실패했습니다.');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `기업순위분석_${marketCode}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '엑셀 생성에 실패했습니다.');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Shell>
      <h1 className="title">기업 순위 Excel</h1>
      <p className="muted">
        최신 적재 데이터를 매출액과 영업이익 기준으로 정렬해 두 시트로 내려받습니다.
      </p>
      <div className="card form-card">
        <label htmlFor="market">시장</label>
        <select
          id="market"
          className="field"
          value={marketCode}
          onChange={(event) => setMarketCode(event.target.value)}
        >
          <option value="US">미국</option>
          <option value="KR">한국</option>
        </select>

        <label htmlFor="limit">시트별 기업 수</label>
        <input
          id="limit"
          className="field"
          type="number"
          min={1}
          max={500}
          value={limit}
          onChange={(event) => setLimit(Number(event.target.value))}
        />

        <button className="btn" disabled={downloading} onClick={download}>
          {downloading ? '생성 중…' : 'Excel 다운로드'}
        </button>
        {error ? <p className="error-text">{error}</p> : null}
      </div>
    </Shell>
  );
}
