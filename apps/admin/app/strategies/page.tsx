'use client';

import { useCallback, useEffect, useState } from 'react';
import { Shell } from '../../components/Shell';

type Operator = 'LTE' | 'LT' | 'GTE' | 'GT' | 'EQ' | 'BETWEEN';
type Condition = {
  id?: number;
  metricCode: string;
  metricName?: string;
  unitType?: string;
  operator: Operator;
  target: number;
  target2?: number;
  weight: number;
  required: boolean;
};
type Strategy = {
  id: number;
  code: string;
  name: string;
  description: string;
  isActive: boolean;
  displayOrder: number;
  conditions: Condition[];
};
type Metric = {
  metricCode: string;
  metricName: string;
  unitType: string;
  defaultOperator: Operator;
};

const operators: Array<[Operator, string]> = [
  ['LTE', '이하 (≤)'],
  ['LT', '미만 (<)'],
  ['GTE', '이상 (≥)'],
  ['GT', '초과 (>)'],
  ['EQ', '같음 (=)'],
  ['BETWEEN', '범위'],
];

export default function StrategiesPage() {
  const [rows, setRows] = useState<Strategy[]>([]);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [editing, setEditing] = useState<Strategy | null>(null);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [strategiesResponse, metricsResponse] = await Promise.all([
      fetch('/api/admin/strategies'),
      fetch('/api/admin/strategy-metrics'),
    ]);
    const strategiesBody = await strategiesResponse.json();
    const metricsBody = await metricsResponse.json();
    if (!strategiesResponse.ok || !metricsResponse.ok) {
      setMessage(strategiesBody.message ?? metricsBody.message ?? '목록을 불러오지 못했습니다.');
      return;
    }
    setRows(strategiesBody);
    setMetrics(metricsBody);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function select(strategy: Strategy) {
    setEditing(structuredClone(strategy));
    setMessage('');
  }

  function updateCondition(index: number, patch: Partial<Condition>) {
    if (!editing) return;
    const conditions = editing.conditions.map((condition, current) =>
      current === index ? { ...condition, ...patch } : condition,
    );
    setEditing({ ...editing, conditions });
  }

  function addCondition() {
    if (!editing || !metrics.length) return;
    const metric = metrics.find(
      (candidate) => !editing.conditions.some((item) => item.metricCode === candidate.metricCode),
    );
    if (!metric) return setMessage('추가할 수 있는 지표가 없습니다.');
    setEditing({
      ...editing,
      conditions: [
        ...editing.conditions,
        {
          metricCode: metric.metricCode,
          operator: metric.defaultOperator,
          target: 0,
          weight: 1,
          required: true,
        },
      ],
    });
  }

  async function save() {
    if (!editing || saving) return;
    if (!editing.name.trim() || !editing.conditions.length) {
      return setMessage('전략 이름과 조건을 하나 이상 입력하세요.');
    }
    setSaving(true);
    setMessage('');
    try {
      const response = await fetch(`/api/admin/strategies/${editing.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: editing.name,
          description: editing.description,
          isActive: editing.isActive,
          displayOrder: editing.displayOrder,
          conditions: editing.conditions,
        }),
      });
      const body = await response.json();
      if (!response.ok) return setMessage(messageOf(body, '저장하지 못했습니다.'));
      setEditing(null);
      setMessage('전략을 저장했습니다. 앱의 일반 검색에 바로 반영됩니다.');
      await load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Shell>
      <h1 className="title">전략 관리</h1>
      <p className="muted">
        일반 검색 전략의 표시 정보와 재무 조건을 관리합니다. 전략 코드는 연동 안정성을 위해 변경하지
        않습니다.
      </p>
      {message && <p className="feedback">{message}</p>}

      <div className="split-layout">
        <section className="card compact-list">
          <h2>전략 목록</h2>
          {rows.map((strategy) => (
            <button
              className={`list-item ${editing?.id === strategy.id ? 'selected' : ''}`}
              key={strategy.id}
              onClick={() => select(strategy)}
            >
              <span>
                <strong>{strategy.name}</strong>
                <small>{strategy.code}</small>
              </span>
              <span className={`status ${strategy.isActive ? 'published' : 'archived'}`}>
                {strategy.isActive ? '사용' : '숨김'}
              </span>
            </button>
          ))}
        </section>

        <section className="card editor-card">
          {!editing ? (
            <p className="muted">왼쪽에서 수정할 전략을 선택하세요.</p>
          ) : (
            <>
              <div className="editor-heading">
                <h2>{editing.name}</h2>
                <code>{editing.code}</code>
              </div>
              <label>표시 이름</label>
              <input
                className="field"
                value={editing.name}
                maxLength={120}
                onChange={(event) => setEditing({ ...editing, name: event.target.value })}
              />
              <label>설명</label>
              <textarea
                className="field short-textarea"
                value={editing.description}
                onChange={(event) => setEditing({ ...editing, description: event.target.value })}
              />
              <div className="inline-fields">
                <label>
                  표시 순서
                  <input
                    className="field"
                    type="number"
                    min={0}
                    max={1000}
                    value={editing.displayOrder}
                    onChange={(event) =>
                      setEditing({ ...editing, displayOrder: Number(event.target.value) })
                    }
                  />
                </label>
                <label className="check-field editor-check">
                  <input
                    type="checkbox"
                    checked={editing.isActive}
                    onChange={(event) => setEditing({ ...editing, isActive: event.target.checked })}
                  />
                  앱에서 사용
                </label>
              </div>

              <div className="section-heading">
                <h3>검색 조건</h3>
                <button className="btn secondary" onClick={addCondition}>
                  조건 추가
                </button>
              </div>
              <div className="condition-list">
                {editing.conditions.map((condition, index) => (
                  <div className="condition-row" key={`${condition.metricCode}-${index}`}>
                    <label>
                      지표
                      <select
                        className="field"
                        value={condition.metricCode}
                        onChange={(event) =>
                          updateCondition(index, { metricCode: event.target.value })
                        }
                      >
                        {metrics.map((metric) => (
                          <option key={metric.metricCode} value={metric.metricCode}>
                            {metric.metricName} ({metric.metricCode})
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      비교
                      <select
                        className="field"
                        value={condition.operator}
                        onChange={(event) =>
                          updateCondition(index, { operator: event.target.value as Operator })
                        }
                      >
                        {operators.map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      기준값
                      <input
                        className="field"
                        type="number"
                        step="any"
                        value={condition.target}
                        onChange={(event) =>
                          updateCondition(index, { target: Number(event.target.value) })
                        }
                      />
                    </label>
                    {condition.operator === 'BETWEEN' && (
                      <label>
                        최대값
                        <input
                          className="field"
                          type="number"
                          step="any"
                          value={condition.target2 ?? ''}
                          onChange={(event) =>
                            updateCondition(index, { target2: Number(event.target.value) })
                          }
                        />
                      </label>
                    )}
                    <label>
                      가중치
                      <input
                        className="field"
                        type="number"
                        min="0.01"
                        max="100"
                        step="0.01"
                        value={condition.weight}
                        onChange={(event) =>
                          updateCondition(index, { weight: Number(event.target.value) })
                        }
                      />
                    </label>
                    <label className="check-field condition-check">
                      <input
                        type="checkbox"
                        checked={condition.required}
                        onChange={(event) =>
                          updateCondition(index, { required: event.target.checked })
                        }
                      />
                      필수
                    </label>
                    <button
                      className="btn danger"
                      disabled={editing.conditions.length === 1}
                      onClick={() =>
                        setEditing({
                          ...editing,
                          conditions: editing.conditions.filter((_, current) => current !== index),
                        })
                      }
                    >
                      삭제
                    </button>
                  </div>
                ))}
              </div>

              <div className="actions form-actions">
                <button className="btn" disabled={saving} onClick={save}>
                  {saving ? '저장 중…' : '저장'}
                </button>
                <button className="btn secondary" onClick={() => setEditing(null)}>
                  취소
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </Shell>
  );
}

function messageOf(body: any, fallback: string) {
  const message = body?.message ?? fallback;
  return Array.isArray(message) ? message.join(', ') : String(message);
}
