import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { DB_POOL } from '../common/database/database.module';
import { ScreenConditionDto } from '../screening/screening.dto';
import { ScreeningService } from '../screening/screening.service';

type PresetRow = {
  preset_id: number;
  preset_name: string;
  market_filter_json: string[];
  exchange_filter_json: string[];
  last_match_security_ids: number[];
  conditions: Array<{
    metricCode: string;
    operator: string;
    target: number;
    target2?: number | null;
    weight?: number | null;
  }>;
};

@Injectable()
export class PresetAlertsService {
  constructor(
    @Inject(DB_POOL) private readonly db: Pool,
    private readonly screening: ScreeningService,
  ) {}

  async runDue() {
    const dueUsers = await this.db.query(
      `select user_id,notification_interval_days
       from user_notification_setting
       where custom_company_enabled=true
         and (next_notification_at is null or next_notification_at<=now())
       order by user_id`,
    );
    let evaluatedPresets = 0;
    let notifiedUsers = 0;

    for (const setting of dueUsers.rows) {
      const presets = await this.loadPresets(setting.user_id);
      const notices: Array<{ presetId: number; presetName: string; securityIds: number[] }> = [];

      for (const preset of presets) {
        evaluatedPresets++;
        const conditions = preset.conditions.map((condition): ScreenConditionDto => ({
          metricCode: condition.metricCode,
          operator: condition.operator as ScreenConditionDto['operator'],
          target: Number(condition.target),
          target2: condition.target2 == null ? undefined : Number(condition.target2),
          weight: Number(condition.weight ?? 1),
        }));
        let exactIds: number[] = [];
        if (conditions.length) {
          const result = await this.screening.search(
            {
              conditions,
              marketCodes: preset.market_filter_json?.length
                ? preset.market_filter_json
                : undefined,
              exchangeCodes: preset.exchange_filter_json?.length
                ? preset.exchange_filter_json
                : undefined,
              limit: 200,
            },
            setting.user_id,
          );
          const exact = result.results.filter((item: any) => item.matchType === 'EXACT');
          exactIds = exact.map((item: any) => Number(item.securityId));
          const previous = new Set((preset.last_match_security_ids ?? []).map(Number));
          const newIds = exactIds.filter((securityId) => !previous.has(securityId));
          if (newIds.length) {
            notices.push({
              presetId: preset.preset_id,
              presetName: preset.preset_name,
              securityIds: newIds,
            });
          }
        }
        await this.db.query(
          `update screen_preset set last_match_security_ids=$2::jsonb,updated_at=now()
           where preset_id=$1`,
          [preset.preset_id, JSON.stringify(exactIds)],
        );
      }

      if (notices.length) {
        const count = notices.reduce((sum, notice) => sum + notice.securityIds.length, 0);
        await this.db.query(
          `insert into user_notification(
             user_id,preset_id,notification_type,title,body,payload_json
           ) values($1,null,'CUSTOM_COMPANY_MATCH',$2,$3,$4::jsonb)`,
          [
            setting.user_id,
            '맞춤 기업 정보 알림',
            `${notices.length}개 기준에서 새로운 조건 충족 기업 ${count}개를 찾았습니다.`,
            JSON.stringify({ presets: notices }),
          ],
        );
        notifiedUsers++;
      }

      await this.db.query(
        `update user_notification_setting
         set last_notification_at=now(),
             next_notification_at=now()+($2::text || ' days')::interval,
             updated_at=now()
         where user_id=$1`,
        [setting.user_id, setting.notification_interval_days],
      );
    }

    return {
      evaluatedUsers: Number(dueUsers.rowCount ?? 0),
      evaluatedPresets,
      notifiedUsers,
    };
  }

  private async loadPresets(userId: string): Promise<PresetRow[]> {
    const result = await this.db.query(
      `select p.preset_id,p.preset_name,p.market_filter_json,p.exchange_filter_json,
              p.last_match_security_ids,
              coalesce(json_agg(json_build_object(
                'metricCode',m.metric_code,'operator',c.operator_code,
                'target',c.target_value,'target2',c.target_value2,'weight',c.weight
              ) order by c.display_order) filter (where c.preset_condition_id is not null),'[]') conditions
       from screen_preset p
       left join screen_preset_condition c on c.preset_id=p.preset_id
       left join financial_metric m on m.metric_id=c.metric_id
       where p.user_id=$1
       group by p.preset_id
       order by p.preset_id`,
      [userId],
    );
    return result.rows;
  }
}
