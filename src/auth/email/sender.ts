import type { EmailSender } from '../types';

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  baseUrl: string;
  secure?: boolean;
  templates?: Partial<EmailTemplates>;
}

export interface EmailTemplates {
  verification: (params: { email: string; token: string; baseUrl: string }) => { subject: string; html: string };
  passwordReset: (params: { email: string; token: string; baseUrl: string }) => { subject: string; html: string };
  magicLink: (params: { email: string; token: string; baseUrl: string }) => { subject: string; html: string };
  welcome: (params: { email: string; name: string }) => { subject: string; html: string };
}

export class SmtpEmailSender implements EmailSender {
  private config: SmtpConfig;
  private templates: EmailTemplates;

  constructor(config: SmtpConfig) {
    this.config = config;
    this.templates = { ...getDefaultTemplates(), ...config.templates };
  }

  async sendVerificationEmail(email: string, token: string): Promise<void> {
    const { subject, html } = this.templates.verification({ email, token, baseUrl: this.config.baseUrl });
    await this.send(email, subject, html);
  }

  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const { subject, html } = this.templates.passwordReset({ email, token, baseUrl: this.config.baseUrl });
    await this.send(email, subject, html);
  }

  async sendMagicLinkEmail(email: string, token: string): Promise<void> {
    const { subject, html } = this.templates.magicLink({ email, token, baseUrl: this.config.baseUrl });
    await this.send(email, subject, html);
  }

  async sendWelcomeEmail(email: string, name: string): Promise<void> {
    const { subject, html } = this.templates.welcome({ email, name });
    await this.send(email, subject, html);
  }

  private async send(to: string, subject: string, html: string): Promise<void> {
    const nodemailer = await import('nodemailer');
    const transport = nodemailer.createTransport({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure ?? this.config.port === 465,
      auth: { user: this.config.user, pass: this.config.pass },
    });
    await transport.sendMail({ from: this.config.from, to, subject, html });
  }
}

function getDefaultTemplates(): EmailTemplates {
  return {
    verification: ({ email, token, baseUrl }) => ({
      subject: 'Verify your email',
      html: `<p>Click the link to verify your email:</p><a href="${baseUrl}/verify-email?email=${encodeURIComponent(email)}&token=${token}">Verify Email</a>`,
    }),
    passwordReset: ({ email, token, baseUrl }) => ({
      subject: 'Reset your password',
      html: `<p>Click the link to reset your password:</p><a href="${baseUrl}/reset-password?email=${encodeURIComponent(email)}&token=${token}">Reset Password</a>`,
    }),
    magicLink: ({ email, token, baseUrl }) => ({
      subject: 'Your login link',
      html: `<p>Click the link to sign in:</p><a href="${baseUrl}/auth/magic-link?email=${encodeURIComponent(email)}&token=${token}">Sign In</a>`,
    }),
    welcome: ({ name }) => ({
      subject: 'Welcome!',
      html: `<p>Hi ${name}, welcome to our platform!</p>`,
    }),
  };
}
