'use client';

import { useCallback, useEffect, useState } from 'react';
import { Shell } from '../../components/Shell';
import { adminRequest, errorMessage } from '../../lib/api-client';
import { ResourceFeedback } from '../../components/ResourceFeedback';

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
  sortMetricCode: string | null;
  sortDirection: 'ASC' | 'DESC';
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
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [strategiesBody, metricsBody] = await Promise.all([
        adminRequest<Strategy[]>('/api/admin/strategies'),
        adminRequest<Metric[]>('/api/admin/strategy-metrics'),
      ]);
      setRows(strategiesBody);
      setMetrics(metricsBody);
    } catch (error) {
      setLoadError(errorMessage(error));
    } finally {
      setLoading(false);
    }
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
    if (
      !Number.isInteger(editing.displayOrder) ||
      editing.displayOrder < 0 ||
      editing.displayOrder > 1000 ||
      editing.conditions.some(
        (condition) =>
          !Number.isFinite(condition.target) ||
          !Number.isFinite(condition.weight) ||
          condition.weight < 0.01 ||
          condition.weight > 100,
      )
    ) {
      return setMessage('표시 순서(0~1000)와 조건의 숫자·가중치(0.01~100)를 확인하세요.');
    }
    if (
      new Set(editing.conditions.map((condition) => condition.metricCode)).size !==
      editing.conditions.length
    ) {
      return setMessage('같은 지표는 전략에 한 번만 사용할 수 있습니다.');
    }
    if (
      editing.conditions.some(
        (condition) =>
          condition.operator === 'BETWEEN' &&
          (condition.target2 == null || condition.target > condition.target2),
      )
    ) {
      return setMessage('범위 조건의 최솟값과 최댓값을 확인하세요.');
    }
    setSaving(true);
    setMessage('');
    try {
      await adminRequest(`/api/admin/strategies/${editing.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: editing.name,
          description: editing.description,
          isActive: editing.isActive,
          displayOrder: editing.displayOrder,
          sortMetricCode: editing.sortMetricCode,
          sortDirection: editing.sortDirection,
          conditions: editing.conditions,
        }),
      });
      setEditing(null);
      setMessage('전략을 저장했습니다. 앱의 일반 검색에 바로 반영됩니다.');
      await load();
    } catch (error) {
      setMessage(errorMessage(error));
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
      {message && (
        <p className="feedback" role="status">
          {message}
        </p>
      )}
      <ResourceFeedback error={loadError} loading={loading} retry={load} />

      <div className="split-layout">
        <section className="card compact-list">
          <h2>전략 목록</h2>
          {rows.map((strategy) => (
            <button
              className={`list-item ${editing?.id === strategy.id ? 'selected' : ''}`}
              key={strategy.id}
              disabled={saving}
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
            <fieldset className="editor-fields" disabled={saving}>
              <div className="editor-heading">
                <h2>{editing.name}</h2>
                <code>{editing.code}</code>
              </div>
              <label htmlFor="strategy-name">표시 이름</label>
              <input
                id="strategy-name"
                className="field"
                value={editing.name}
                maxLength={120}
                onChange={(event) => setEditing({ ...editing, name: event.target.value })}
              />
              <label htmlFor="strategy-description">설명</label>
              <textarea
                id="strategy-description"
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
                <h3>결과 정렬</h3>
              </div>
              <p className="muted">
                정확 일치와 유사도로 먼저 정렬한 뒤, 같은 점수인 기업에 적용합니다.
              </p>
              <div className="inline-fields">
                <label>
                  정렬 지표
                  <select
                    className="field"
                    value={editing.sortMetricCode ?? ''}
                    onChange={(event) =>
                      setEditing({ ...editing, sortMetricCode: event.target.value || null })
                    }
                  >
                    <option value="">추가 정렬 없음</option>
                    {metrics.map((metric) => (
                      <option key={metric.metricCode} value={metric.metricCode}>
                        {metric.metricName} ({metric.metricCode})
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  정렬 방향
                  <select
                    className="field"
                    value={editing.sortDirection}
                    disabled={!editing.sortMetricCode}
                    onChange={(event) =>
                      setEditing({
                        ...editing,
                        sortDirection: event.target.value as 'ASC' | 'DESC',
                      })
                    }
                  >
                    <option value="ASC">낮은 값 먼저</option>
                    <option value="DESC">높은 값 먼저</option>
                  </select>
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
                        {metrics
                          .filter(
                            (metric) =>
                              metric.metricCode === condition.metricCode ||
                              !editing.conditions.some(
                                (item) => item.metricCode === metric.metricCode,
                              ),
                          )
                          .map((metric) => (
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
                <button
                  className="btn secondary"
                  disabled={saving}
                  onClick={() => setEditing(null)}
                >
                  취소
                </button>
              </div>
            </fieldset>
          )}
        </section>
      </div>
    </Shell>
  );
}
