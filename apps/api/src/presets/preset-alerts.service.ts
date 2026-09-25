import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { DB_POOL } from '../common/database/database.module';
import { MailService } from '../common/mail/mail.service';
import { ScreenConditionDto } from '../screening/screening.dto';
import { ScreeningService } from '../screening/screening.service';

type PresetRow = {
  preset_id: number;
  preset_name: string;
  market_filter_json: string[];
  exchange_filter_json: string[];
  last_match_security_ids: number[];
  last_notification_at: Date | null;
  conditions: Array<{
    metricCode: string;
    operator: string;
    target: number;
    target2?: number | null;
    weight?: number | null;
  }>;
};

type PresetNotice = {
  presetId: number;
  presetName: string;
  securityIds: number[];
  companies: Array<{ securityId: number; ticker: string; name: string }>;
};

@Injectable()
export class PresetAlertsService {
  private readonly logger = new Logger(PresetAlertsService.name);

  constructor(
    @Inject(DB_POOL) private readonly db: Pool,
    private readonly screening: ScreeningService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  async runDue() {
    const dueUsers = await this.db.query(
      `select s.user_id,s.notification_interval_days,s.email_enabled,u.email,
              u.email_verified_at is not null as email_verified
       from user_notification_setting s
       join app_user u on u.user_id=s.user_id and u.status_code='ACTIVE' and u.deleted_at is null
       where s.custom_company_enabled=true
         and (s.next_notification_at is null or s.next_notification_at<=now())
       order by s.user_id`,
    );
    let evaluatedPresets = 0;
    let notifiedUsers = 0;
    let emailedUsers = 0;
    let emailFailures = 0;
    let emailSkipped = 0;

    for (const setting of dueUsers.rows) {
      const presets = await this.loadPresets(setting.user_id);
      const notices: PresetNotice[] = [];

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
            false,
          );
          const exact = result.results.filter((item: any) => item.matchType === 'EXACT');
          exactIds = exact.map((item: any) => Number(item.securityId));
          const previous = new Set((preset.last_match_security_ids ?? []).map(Number));
          const newMatches = exact.filter((item: any) => !previous.has(Number(item.securityId)));
          if (preset.last_notification_at && newMatches.length) {
            notices.push({
              presetId: preset.preset_id,
              presetName: preset.preset_name,
              securityIds: newMatches.map((item: any) => Number(item.securityId)),
              companies: newMatches.map((item: any) => ({
                securityId: Number(item.securityId),
                ticker: String(item.ticker),
                name: String(item.name),
              })),
            });
          }
        }
        await this.db.query(
          `update screen_preset
           set last_match_security_ids=$2::jsonb,last_notification_at=now(),updated_at=now()
           where preset_id=$1`,
          [preset.preset_id, JSON.stringify(exactIds)],
        );
      }

      if (notices.length) {
        const count = notices.reduce((sum, notice) => sum + notice.securityIds.length, 0);
        const emailStatus = this.emailStatus(setting);
        const notification = await this.db.query(
          `insert into user_notification(
             user_id,preset_id,notification_type,title,body,payload_json,email_status,email_error
           ) values($1,null,'CUSTOM_COMPANY_MATCH',$2,$3,$4::jsonb,$5,$6)
           returning notification_id`,
          [
            setting.user_id,
            '맞춤 기업 정보 알림',
            `${notices.length}개 기준에서 새로운 조건 충족 기업 ${count}개를 찾았습니다.`,
            JSON.stringify({
              presets: notices.map(({ companies: _companies, ...notice }) => notice),
            }),
            emailStatus.status,
            emailStatus.reason,
          ],
        );
        notifiedUsers++;
        if (emailStatus.status === 'PENDING') {
          try {
            await this.mail.sendPresetMatchNotification(
              setting.email,
              notices.map((notice) => ({
                presetName: notice.presetName,
                companies: notice.companies,
              })),
            );
            await this.db.query(
              `update user_notification
               set email_status='SENT',email_attempted_at=now(),email_sent_at=now(),email_error=null
               where notification_id=$1`,
              [notification.rows[0].notification_id],
            );
            emailedUsers++;
          } catch (error) {
            emailFailures++;
            await this.recordEmailFailure(
              notification.rows[0].notification_id,
              setting.user_id,
              error,
            );
          }
        } else {
          emailSkipped++;
        }
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
      emailedUsers,
      emailFailures,
      emailSkipped,
    };
  }

  private emailStatus(setting: any): { status: string; reason: string | null } {
    if (!setting.email_enabled) return { status: 'NOT_REQUESTED', reason: null };
    if (this.config.get<string>('PRESET_ALERT_EMAIL_ENABLED') !== 'true') {
      return { status: 'SKIPPED', reason: 'EMAIL_DELIVERY_DISABLED' };
    }
    if (!setting.email_verified) return { status: 'SKIPPED', reason: 'EMAIL_NOT_VERIFIED' };
    return { status: 'PENDING', reason: null };
  }

  private async recordEmailFailure(notificationId: number, userId: string, error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    this.logger.error(`Preset alert email failed: ${message}`);
    await this.db.query(
      `update user_notification
       set email_status='FAILED',email_attempted_at=now(),email_error=$2
       where notification_id=$1`,
      [notificationId, message.slice(0, 2000)],
    );
    await this.db
      .query(
        `insert into application_error_log(error_code,error_class,message,context_json)
         values('PRESET_ALERT_EMAIL_FAILED',$1,$2,$3::jsonb)`,
        [
          error instanceof Error ? error.name : 'Error',
          message.slice(0, 2000),
          JSON.stringify({ userId, notificationId }),
        ],
      )
      .catch(() => undefined);
  }

  private async loadPresets(userId: string): Promise<PresetRow[]> {
    const result = await this.db.query(
      `select p.preset_id,p.preset_name,p.market_filter_json,p.exchange_filter_json,
              p.last_match_security_ids,p.last_notification_at,
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
