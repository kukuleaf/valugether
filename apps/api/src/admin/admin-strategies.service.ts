import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { AuditService } from '../audit/audit.service';
import { DB_POOL } from '../common/database/database.module';

export type StrategyConditionInput = {
  metricCode: string;
  operator: 'LTE' | 'LT' | 'GTE' | 'GT' | 'EQ' | 'BETWEEN';
  target: number;
  target2?: number;
  weight: number;
  required: boolean;
};

export type UpdateStrategyInput = {
  name: string;
  description: string;
  isActive: boolean;
  displayOrder: number;
  conditions: StrategyConditionInput[];
};

@Injectable()
export class AdminStrategiesService {
  constructor(
    @Inject(DB_POOL) private readonly db: Pool,
    private readonly audit: AuditService,
  ) {}

  async list() {
    const result = await this.db.query(
      `select s.strategy_id,s.strategy_code,s.strategy_name,s.description,s.is_active,
              s.display_order,s.updated_at,
              coalesce(json_agg(json_build_object(
                'id',c.strategy_condition_id,'metricCode',m.metric_code,
                'metricName',m.metric_name_ko,'unitType',m.unit_type,
                'operator',c.operator_code,'target',c.target_value,
                'target2',c.target_value2,'weight',c.weight,'required',c.required
              ) order by c.display_order) filter (where c.strategy_condition_id is not null),'[]') conditions
       from screen_strategy s
       left join screen_strategy_condition c on c.strategy_id=s.strategy_id
       left join financial_metric m on m.metric_id=c.metric_id
       group by s.strategy_id
       order by s.display_order,s.strategy_id`,
    );
    return result.rows.map((row) => this.mapStrategy(row));
  }

  async metrics() {
    const result = await this.db.query(
      `select metric_code,metric_name_ko,unit_type,default_operator
       from financial_metric where is_active=true
       order by statement_type,display_order,metric_code`,
    );
    return result.rows.map((row) => ({
      metricCode: row.metric_code,
      metricName: row.metric_name_ko,
      unitType: row.unit_type,
      defaultOperator: row.default_operator ?? 'EQ',
    }));
  }

  async update(actorUserId: string, strategyId: number, input: UpdateStrategyInput) {
    if (!input.name.trim()) throw new BadRequestException('전략 이름을 입력하세요.');
    const client = await this.db.connect();
    let before: any;
    try {
      await client.query('begin');
      const locked = await client.query(
        'select strategy_id from screen_strategy where strategy_id=$1 for update',
        [strategyId],
      );
      if (!locked.rowCount) throw new BadRequestException('전략을 찾을 수 없습니다.');
      const beforeRow = await this.loadOne(client, strategyId);
      if (!beforeRow) throw new BadRequestException('전략을 찾을 수 없습니다.');
      before = this.mapStrategy(beforeRow);

      const uniqueMetrics = new Set(input.conditions.map((condition) => condition.metricCode));
      if (uniqueMetrics.size !== input.conditions.length) {
        throw new BadRequestException('같은 지표는 전략에 한 번만 사용할 수 있습니다.');
      }
      for (const condition of input.conditions) {
        if (condition.operator === 'BETWEEN') {
          if (condition.target2 == null || condition.target > condition.target2) {
            throw new BadRequestException('범위 조건의 최솟값과 최댓값을 확인하세요.');
          }
        }
      }
      const metrics = await client.query(
        `select metric_id,metric_code from financial_metric
         where is_active=true and metric_code=any($1::text[])`,
        [[...uniqueMetrics]],
      );
      if (metrics.rowCount !== uniqueMetrics.size) {
        throw new BadRequestException('사용할 수 없는 지표가 포함되어 있습니다.');
      }
      const metricIds = new Map(metrics.rows.map((row) => [row.metric_code, row.metric_id]));

      await client.query(
        `update screen_strategy
         set strategy_name=$2,description=$3,is_active=$4,display_order=$5,updated_at=now()
         where strategy_id=$1`,
        [
          strategyId,
          input.name.trim(),
          input.description.trim() || null,
          input.isActive,
          input.displayOrder,
        ],
      );
      await client.query('delete from screen_strategy_condition where strategy_id=$1', [
        strategyId,
      ]);
      for (const [index, condition] of input.conditions.entries()) {
        await client.query(
          `insert into screen_strategy_condition(
             strategy_id,metric_id,operator_code,target_value,target_value2,
             weight,required,display_order
           ) values($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            strategyId,
            metricIds.get(condition.metricCode),
            condition.operator,
            condition.target,
            condition.operator === 'BETWEEN' ? condition.target2 : null,
            condition.weight,
            condition.required,
            index,
          ],
        );
      }
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }

    const afterRow = await this.loadOne(this.db, strategyId);
    const after = afterRow ? this.mapStrategy(afterRow) : null;
    await this.audit.write({
      actorUserId,
      actionCode: 'ADMIN_CONFIG_CHANGE',
      targetType: 'SCREEN_STRATEGY',
      targetId: String(strategyId),
      before,
      after,
    });
    return after;
  }

  private async loadOne(client: Pool | PoolClient, strategyId: number) {
    const result = await client.query(
      `select s.*,
              coalesce(json_agg(json_build_object(
                'metricCode',m.metric_code,'operator',c.operator_code,
                'target',c.target_value,'target2',c.target_value2,
                'weight',c.weight,'required',c.required
              ) order by c.display_order) filter (where c.strategy_condition_id is not null),'[]') conditions
       from screen_strategy s
       left join screen_strategy_condition c on c.strategy_id=s.strategy_id
       left join financial_metric m on m.metric_id=c.metric_id
       where s.strategy_id=$1
       group by s.strategy_id`,
      [strategyId],
    );
    return result.rows[0] ?? null;
  }

  private mapStrategy(row: any) {
    return {
      id: Number(row.strategy_id),
      code: row.strategy_code,
      name: row.strategy_name,
      description: row.description ?? '',
      isActive: row.is_active,
      displayOrder: row.display_order,
      updatedAt: row.updated_at,
      conditions: row.conditions.map((condition: any) => ({
        ...condition,
        id: condition.id == null ? undefined : Number(condition.id),
        target: Number(condition.target),
        target2: condition.target2 == null ? undefined : Number(condition.target2),
        weight: Number(condition.weight),
      })),
    };
  }
}
