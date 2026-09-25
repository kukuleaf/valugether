import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { AuditService } from '../audit/audit.service';
import { DB_POOL } from '../common/database/database.module';

export type NoticeInput = {
  title: string;
  body: string;
  startsAt?: string | null;
  endsAt?: string | null;
};

@Injectable()
export class AdminNoticesService {
  constructor(
    @Inject(DB_POOL) private readonly db: Pool,
    private readonly audit: AuditService,
  ) {}

  async list() {
    return (
      await this.db.query(
        `select notice_id,title,body,status_code,starts_at,ends_at,created_by,created_at,updated_at
         from notice
         order by case status_code when 'PUBLISHED' then 0 when 'DRAFT' then 1 else 2 end,
                  created_at desc`,
      )
    ).rows;
  }

  async create(actorUserId: string, input: NoticeInput) {
    this.validateText(input);
    this.validateDates(input);
    const created = (
      await this.db.query(
        `insert into notice(title,body,status_code,starts_at,ends_at,created_by)
         values($1,$2,'DRAFT',$3::timestamptz,$4::timestamptz,$5)
         returning *`,
        [
          input.title.trim(),
          input.body.trim(),
          input.startsAt ?? null,
          input.endsAt ?? null,
          actorUserId,
        ],
      )
    ).rows[0];
    await this.writeAudit(actorUserId, created.notice_id, null, created);
    return created;
  }

  async update(actorUserId: string, noticeId: number, input: NoticeInput) {
    this.validateText(input);
    this.validateDates(input);
    const before = await this.find(noticeId);
    if (!before) throw new BadRequestException('공지사항을 찾을 수 없습니다.');
    if (before.status_code === 'ARCHIVED') {
      throw new BadRequestException('보관된 공지사항은 수정할 수 없습니다.');
    }
    const after = (
      await this.db.query(
        `update notice
         set title=$2,body=$3,starts_at=$4::timestamptz,ends_at=$5::timestamptz,updated_at=now()
         where notice_id=$1 returning *`,
        [
          noticeId,
          input.title.trim(),
          input.body.trim(),
          input.startsAt ?? null,
          input.endsAt ?? null,
        ],
      )
    ).rows[0];
    await this.writeAudit(actorUserId, noticeId, before, after);
    return after;
  }

  async publish(actorUserId: string, noticeId: number) {
    const before = await this.find(noticeId);
    if (!before) throw new BadRequestException('공지사항을 찾을 수 없습니다.');
    if (before.status_code === 'ARCHIVED') {
      throw new BadRequestException('보관된 공지사항은 게시할 수 없습니다.');
    }
    const after = (
      await this.db.query(
        `update notice
         set status_code='PUBLISHED',starts_at=coalesce(starts_at,now()),updated_at=now()
         where notice_id=$1 returning *`,
        [noticeId],
      )
    ).rows[0];
    await this.writeAudit(actorUserId, noticeId, before, after);
    return after;
  }

  async archive(actorUserId: string, noticeId: number) {
    const before = await this.find(noticeId);
    if (!before) throw new BadRequestException('공지사항을 찾을 수 없습니다.');
    const after = (
      await this.db.query(
        `update notice set status_code='ARCHIVED',updated_at=now()
         where notice_id=$1 returning *`,
        [noticeId],
      )
    ).rows[0];
    await this.writeAudit(actorUserId, noticeId, before, after);
    return after;
  }

  async remove(actorUserId: string, noticeId: number) {
    const before = await this.find(noticeId);
    if (!before) throw new BadRequestException('공지사항을 찾을 수 없습니다.');
    if (before.status_code !== 'DRAFT') {
      throw new BadRequestException('작성 중인 공지사항만 삭제할 수 있습니다.');
    }
    await this.db.query('delete from notice where notice_id=$1', [noticeId]);
    await this.writeAudit(actorUserId, noticeId, before, { deleted: true });
    return { deleted: true };
  }

  private validateDates(input: NoticeInput) {
    if (input.startsAt && input.endsAt && new Date(input.startsAt) >= new Date(input.endsAt)) {
      throw new BadRequestException('공지 종료 시각은 시작 시각보다 뒤여야 합니다.');
    }
  }

  private validateText(input: NoticeInput) {
    if (!input.title.trim() || !input.body.trim()) {
      throw new BadRequestException('공지 제목과 내용을 입력하세요.');
    }
  }

  private async find(noticeId: number) {
    return (
      (await this.db.query('select * from notice where notice_id=$1', [noticeId])).rows[0] ?? null
    );
  }

  private writeAudit(actorUserId: string, noticeId: number, before: any, after: any) {
    return this.audit.write({
      actorUserId,
      actionCode: 'ADMIN_CONFIG_CHANGE',
      targetType: 'NOTICE',
      targetId: String(noticeId),
      before,
      after,
    });
  }
}
