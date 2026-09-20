import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';

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

  private tokenUrl(base: string, token: string) {
    return `${base}${base.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;
  }

  private html(title: string, message: string, url: string, button: string) {
    const safeUrl = url.replaceAll('&', '&amp;').replaceAll('"', '&quot;');
    return `<!doctype html><html lang="ko"><body style="font-family:sans-serif;color:#162a3a">
      <h2>${title}</h2><p>${message}</p>
      <p><a href="${safeUrl}" style="display:inline-block;padding:12px 18px;background:#176b87;color:white;text-decoration:none;border-radius:8px">${button}</a></p>
      <p style="font-size:12px;color:#667984">요청하지 않았다면 이 메일을 무시하세요.</p>
    </body></html>`;
  }
}
