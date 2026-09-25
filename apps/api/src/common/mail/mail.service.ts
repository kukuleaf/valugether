import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';

export type PresetMatchEmailNotice = {
  presetName: string;
  companies: Array<{ ticker: string; name: string }>;
};

export type OperationalAlert = {
  status: string;
  issues: Array<{
    checkCode: string;
    severity: string;
    marketCode?: string;
    actual?: number;
    threshold?: number;
    message: string;
  }>;
};

@Injectable()
export class MailService {
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    const user = this.config.get<string>('SMTP_USER');
    this.from = this.config.get<string>('MAIL_FROM') ?? 'no-reply@example.local';
    this.transporter = nodemailer.createTransport({
      host: this.config.get<string>('SMTP_HOST') ?? 'localhost',
      port: Number(this.config.get('SMTP_PORT') ?? 1025),
      secure: this.config.get<string>('SMTP_SECURE') === 'true',
      auth: user ? { user, pass: this.config.get<string>('SMTP_PASSWORD') ?? '' } : undefined,
      connectionTimeout: Number(this.config.get('SMTP_CONNECTION_TIMEOUT_MS') ?? 5000),
      greetingTimeout: Number(this.config.get('SMTP_GREETING_TIMEOUT_MS') ?? 5000),
      socketTimeout: Number(this.config.get('SMTP_SOCKET_TIMEOUT_MS') ?? 10_000),
      disableFileAccess: true,
      disableUrlAccess: true,
    });
  }

  sendEmailVerification(email: string, token: string) {
    const url = this.tokenUrl(
      this.config.get<string>('EMAIL_VERIFICATION_URL') ?? 'rightstockvalue://auth/verify-email',
      token,
    );
    return this.transporter.sendMail({
      from: this.from,
      to: email,
      subject: '[바른주식 밸류] 이메일을 인증해 주세요',
      text: `아래 링크를 열어 이메일 인증을 완료해 주세요.\n\n${url}\n\n이 링크는 제한된 시간 동안만 유효합니다.`,
      html: this.html(
        '이메일 인증',
        '아래 버튼을 눌러 이메일 인증을 완료해 주세요.',
        url,
        '이메일 인증하기',
      ),
    });
  }

  sendPasswordReset(email: string, token: string) {
    const url = this.tokenUrl(
      this.config.get<string>('PASSWORD_RESET_URL') ?? 'rightstockvalue://auth/reset-password',
      token,
    );
    return this.transporter.sendMail({
      from: this.from,
      to: email,
      subject: '[바른주식 밸류] 비밀번호 재설정',
      text: `아래 링크를 열어 비밀번호를 재설정해 주세요.\n\n${url}\n\n요청하지 않았다면 이 메일을 무시하세요.`,
      html: this.html(
        '비밀번호 재설정',
        '아래 버튼을 눌러 새 비밀번호를 설정해 주세요.',
        url,
        '비밀번호 재설정하기',
      ),
    });
  }

  sendPresetMatchNotification(email: string, notices: PresetMatchEmailNotice[]) {
    const totalCount = notices.reduce((sum, notice) => sum + notice.companies.length, 0);
    const url = this.config.get<string>('PRESET_ALERT_URL') ?? 'rightstockvalue://custom';
    const textDetails = notices
      .map(
        (notice) =>
          `${notice.presetName}\n${notice.companies
            .slice(0, 20)
            .map((company) => `- ${company.ticker} ${company.name}`)
            .join('\n')}`,
      )
      .join('\n\n');
    const htmlDetails = notices
      .map(
        (notice) =>
          `<h3 style="margin:20px 0 8px">${this.escapeHtml(notice.presetName)}</h3><ul>${notice.companies
            .slice(0, 20)
            .map(
              (company) =>
                `<li><strong>${this.escapeHtml(company.ticker)}</strong> ${this.escapeHtml(company.name)}</li>`,
            )
            .join('')}</ul>`,
      )
      .join('');
    const safeUrl = this.escapeHtml(url);
    return this.transporter.sendMail({
      from: this.from,
      to: email,
      subject: `[바른주식 밸류] 새 조건 충족 기업 ${totalCount}건`,
      text: `저장한 맞춤기업 기준에서 새로운 조건 충족 기업 ${totalCount}건을 찾았습니다.\n\n${textDetails}\n\n앱에서 확인: ${url}\n\n이 정보는 투자 참고용이며 투자 권유가 아닙니다.`,
      html: `<!doctype html><html lang="ko"><body style="font-family:sans-serif;color:#162a3a">
        <h2>새로운 맞춤기업을 찾았습니다</h2>
        <p>저장한 기준에서 새로운 조건 충족 기업 <strong>${totalCount}건</strong>을 찾았습니다.</p>
        ${htmlDetails}
        <p><a href="${safeUrl}" style="display:inline-block;padding:12px 18px;background:#176b87;color:white;text-decoration:none;border-radius:8px">앱에서 확인하기</a></p>
        <p style="font-size:12px;color:#667984">이 정보는 투자 참고용이며 투자 권유가 아닙니다. 알림 설정은 앱에서 변경할 수 있습니다.</p>
      </body></html>`,
    });
  }

  sendOperationalAlert(recipients: string[], alert: OperationalAlert) {
    const lines = alert.issues.map(
      (issue) =>
        `[${issue.severity}] ${issue.checkCode}${issue.marketCode ? `/${issue.marketCode}` : ''}: ${issue.message}`,
    );
    const rows = alert.issues
      .map(
        (issue) =>
          `<tr><td style="padding:8px;border:1px solid #d9e1e7">${this.escapeHtml(issue.severity)}</td>` +
          `<td style="padding:8px;border:1px solid #d9e1e7">${this.escapeHtml(issue.checkCode)}</td>` +
          `<td style="padding:8px;border:1px solid #d9e1e7">${this.escapeHtml(issue.marketCode ?? '-')}</td>` +
          `<td style="padding:8px;border:1px solid #d9e1e7">${this.escapeHtml(issue.message)}</td></tr>`,
      )
      .join('');
    return this.transporter.sendMail({
      from: this.from,
      to: recipients,
      subject: `[바른주식 밸류 운영] 데이터 품질 ${alert.status} (${alert.issues.length}건)`,
      text: `데이터 품질 검사에서 ${alert.issues.length}건을 발견했습니다.\n\n${lines.join('\n')}`,
      html: `<!doctype html><html lang="ko"><body style="font-family:sans-serif;color:#162a3a">
        <h2>데이터 품질 검사: ${this.escapeHtml(alert.status)}</h2>
        <p>확인이 필요한 항목 ${alert.issues.length}건입니다.</p>
        <table style="border-collapse:collapse"><thead><tr><th>등급</th><th>검사</th><th>시장</th><th>내용</th></tr></thead><tbody>${rows}</tbody></table>
      </body></html>`,
    });
  }

  private tokenUrl(base: string, token: string) {
    return `${base}${base.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;
  }

  private html(title: string, message: string, url: string, button: string) {
    const safeUrl = this.escapeHtml(url);
    return `<!doctype html><html lang="ko"><body style="font-family:sans-serif;color:#162a3a">
      <h2>${title}</h2><p>${message}</p>
      <p><a href="${safeUrl}" style="display:inline-block;padding:12px 18px;background:#176b87;color:white;text-decoration:none;border-radius:8px">${button}</a></p>
      <p style="font-size:12px;color:#667984">요청하지 않았다면 이 메일을 무시하세요.</p>
    </body></html>`;
  }

  private escapeHtml(value: string) {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }
}
