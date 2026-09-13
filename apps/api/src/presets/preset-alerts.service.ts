import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { DB_POOL } from '../common/database/database.module';
import { ScreenConditionDto } from '../screening/screening.dto';
import { ScreeningService } from '../screening/screening.service';

@Injectable()
export class PresetAlertsService {
  constructor(
    @Inject(DB_POOL) private readonly db: Pool,
    private readonly screening: ScreeningService,
  ) {}

  async runDue() {
    const due = await this.db.query(
      `select p.preset_id,p.user_id,p.preset_name,p.market_filter_json,
              p.notification_interval_days,p.last_match_security_ids,
              coalesce(json_agg(json_build_object(
                'metricCode',m.metric_code,'operator',c.operator_code,
                'target',c.target_value,'target2',c.target_value2,'weight',c.weight
              ) order by c.display_order) filter (where c.preset_condition_id is not null),'[]') conditions
       from screen_preset p
       left join screen_preset_condition c on c.preset_id=p.preset_id
       left join financial_metric m on m.metric_id=c.metric_id
       where p.notification_enabled=true
         and (p.next_notification_at is null or p.next_notification_at<=now())
       group by p.preset_id
       order by p.preset_id`,
    );
    let notified = 0;
    for (const preset of due.rows) {
      let exactIds: number[] = [];
      const conditions = (preset.conditions as any[]).map((condition): ScreenConditionDto => ({
        metricCode: condition.metricCode,
        operator: condition.operator,
        target: Number(condition.target),
        target2: condition.target2 == null ? undefined : Number(condition.target2),
        weight: Number(condition.weight ?? 1),
      }));
      if (conditions.length) {
        const result = await this.screening.search(
          {
            conditions,
            marketCodes: preset.market_filter_json?.length ? preset.market_filter_json : undefined,
            limit: 200,
          },
          preset.user_id,
        );
        const exact = result.results.filter((item: any) => item.matchType === 'EXACT');
        exactIds = exact.map((item: any) => Number(item.securityId));
        const previousIds = new Set<number>((preset.last_match_security_ids ?? []).map(Number));
        const newMatches = exact.filter((item: any) => !previousIds.has(Number(item.securityId)));
        if (newMatches.length) {
          await this.db.query(
            `insert into user_notification(user_id,preset_id,title,body,payload_json)
             values($1,$2,$3,$4,$5::jsonb)`,
            [
              preset.user_id,
              preset.preset_id,
              `${preset.preset_name} 조건 충족 기업`,
              `${newMatches.length}개 기업이 새로 조건을 충족했습니다.`,
              JSON.stringify({
                securityIds: exact.map((item: any) => item.securityId),
                newSecurityIds: newMatches.map((item: any) => item.securityId),
              }),
            ],
          );
          notified++;
        }
      }
      await this.db.query(
        `update screen_preset
         set last_notification_at=now(),
             next_notification_at=now()+(notification_interval_days::text || ' days')::interval,
             last_match_security_ids=$2::jsonb
         where preset_id=$1`,
        [preset.preset_id, JSON.stringify(exactIds)],
      );
    }
    return { evaluated: Number(due.rowCount ?? 0), notified };
  }
}
