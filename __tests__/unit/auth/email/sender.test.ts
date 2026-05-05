/**
 * SmtpEmailSender Unit Tests
 *
 * nodemailer를 모킹하여 SMTP 이메일 발송 로직 검증
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SmtpEmailSender } from '../../../../src/auth/email/sender';

// ============================================================================
// nodemailer mock
// ============================================================================

const mockSendMail = vi.fn().mockResolvedValue({ messageId: 'test-message-id' });
const mockCreateTransport = vi.fn(() => ({ sendMail: mockSendMail }));

vi.mock('nodemailer', () => ({
  createTransport: (...args: any[]) => mockCreateTransport(...args),
}));

// ============================================================================
// Helper
// ============================================================================

function createDefaultConfig() {
  return {
    host: 'smtp.example.com',
    port: 587,
    user: 'smtp-user',
    pass: 'smtp-pass',
    from: 'noreply@example.com',
    baseUrl: 'https://myapp.com',
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('SmtpEmailSender', () => {
  let sender: SmtpEmailSender;

  beforeEach(() => {
    vi.clearAllMocks();
    sender = new SmtpEmailSender(createDefaultConfig());
  });

  describe('constructor', () => {
    it('유효한 설정으로 인스턴스를 생성해야 한다', () => {
      expect(sender).toBeDefined();
      expect(sender).toHaveProperty('sendVerificationEmail');
      expect(sender).toHaveProperty('sendPasswordResetEmail');
      expect(sender).toHaveProperty('sendMagicLinkEmail');
      expect(sender).toHaveProperty('sendWelcomeEmail');
    });

    it('커스텀 템플릿을 수용해야 한다', () => {
      const customSender = new SmtpEmailSender({
        ...createDefaultConfig(),
        templates: {
          verification: ({ token }) => ({ subject: 'Custom Verify', html: `<p>Token: ${token}</p>` }),
        },
      });
      expect(customSender).toBeDefined();
    });
  });

  describe('sendVerificationEmail', () => {
    it('올바른 from/to/subject/html로 sendMail을 호출해야 한다', async () => {
      await sender.sendVerificationEmail('user@example.com', 'verify-token-123');

      expect(mockCreateTransport).toHaveBeenCalledWith({
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        auth: { user: 'smtp-user', pass: 'smtp-pass' },
      });
      expect(mockSendMail).toHaveBeenCalledWith({
        from: 'noreply@example.com',
        to: 'user@example.com',
        subject: 'Verify your email',
        html: expect.stringContaining('verify-token-123'),
      });
    });

    it('html에 인증 링크가 포함되어야 한다', async () => {
      await sender.sendVerificationEmail('user@example.com', 'my-token');

      const callArgs = mockSendMail.mock.calls[0][0];
      expect(callArgs.html).toContain('https://myapp.com/verify-email');
      expect(callArgs.html).toContain('my-token');
      expect(callArgs.html).toContain(encodeURIComponent('user@example.com'));
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('비밀번호 재설정 이메일을 발송해야 한다', async () => {
      await sender.sendPasswordResetEmail('reset@example.com', 'reset-token-456');

      expect(mockSendMail).toHaveBeenCalledWith({
        from: 'noreply@example.com',
        to: 'reset@example.com',
        subject: 'Reset your password',
        html: expect.stringContaining('reset-token-456'),
      });
    });

    it('html에 비밀번호 재설정 링크가 포함되어야 한다', async () => {
      await sender.sendPasswordResetEmail('reset@example.com', 'reset-abc');

      const callArgs = mockSendMail.mock.calls[0][0];
      expect(callArgs.html).toContain('https://myapp.com/reset-password');
      expect(callArgs.html).toContain('reset-abc');
      expect(callArgs.html).toContain(encodeURIComponent('reset@example.com'));
    });
  });

  describe('sendMagicLinkEmail', () => {
    it('매직 링크 이메일을 발송해야 한다', async () => {
      await sender.sendMagicLinkEmail('magic@example.com', 'magic-token-789');

      expect(mockSendMail).toHaveBeenCalledWith({
        from: 'noreply@example.com',
        to: 'magic@example.com',
        subject: 'Your login link',
        html: expect.stringContaining('magic-token-789'),
      });
    });

    it('html에 매직 링크가 포함되어야 한다', async () => {
      await sender.sendMagicLinkEmail('magic@example.com', 'link-xyz');

      const callArgs = mockSendMail.mock.calls[0][0];
      expect(callArgs.html).toContain('https://myapp.com/auth/magic-link');
      expect(callArgs.html).toContain('link-xyz');
      expect(callArgs.html).toContain(encodeURIComponent('magic@example.com'));
    });
  });

  describe('sendWelcomeEmail', () => {
    it('환영 이메일을 발송해야 한다', async () => {
      await sender.sendWelcomeEmail('welcome@example.com', 'John Doe');

      expect(mockSendMail).toHaveBeenCalledWith({
        from: 'noreply@example.com',
        to: 'welcome@example.com',
        subject: 'Welcome!',
        html: expect.stringContaining('John Doe'),
      });
    });

    it('html에 사용자 이름이 포함되어야 한다', async () => {
      await sender.sendWelcomeEmail('welcome@example.com', 'Jane Smith');

      const callArgs = mockSendMail.mock.calls[0][0];
      expect(callArgs.html).toContain('Jane Smith');
      expect(callArgs.html).toContain('welcome');
    });
  });

  describe('SMTP transport 설정', () => {
    it('port 465일 때 secure가 기본 true여야 한다', async () => {
      const secureSender = new SmtpEmailSender({
        ...createDefaultConfig(),
        port: 465,
      });

      await secureSender.sendVerificationEmail('test@example.com', 'token');

      expect(mockCreateTransport).toHaveBeenCalledWith({
        host: 'smtp.example.com',
        port: 465,
        secure: true,
        auth: { user: 'smtp-user', pass: 'smtp-pass' },
      });
    });

    it('port 587일 때 secure가 기본 false여야 한다', async () => {
      await sender.sendVerificationEmail('test@example.com', 'token');

      expect(mockCreateTransport).toHaveBeenCalledWith(
        expect.objectContaining({ secure: false })
      );
    });

    it('secure 옵션이 명시적으로 설정되면 해당 값을 사용해야 한다', async () => {
      const explicitSecure = new SmtpEmailSender({
        ...createDefaultConfig(),
        port: 587,
        secure: true,
      });

      await explicitSecure.sendVerificationEmail('test@example.com', 'token');

      expect(mockCreateTransport).toHaveBeenCalledWith(
        expect.objectContaining({ secure: true, port: 587 })
      );
    });

    it('auth에 user/pass를 포함해야 한다', async () => {
      await sender.sendVerificationEmail('test@example.com', 'token');

      expect(mockCreateTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          auth: { user: 'smtp-user', pass: 'smtp-pass' },
        })
      );
    });
  });

  describe('커스텀 템플릿', () => {
    it('verification 커스텀 템플릿을 사용해야 한다', async () => {
      const customSender = new SmtpEmailSender({
        ...createDefaultConfig(),
        templates: {
          verification: ({ email, token, baseUrl }) => ({
            subject: 'Please confirm your email',
            html: `<div>Confirm: ${baseUrl}/confirm?t=${token}&e=${email}</div>`,
          }),
        },
      });

      await customSender.sendVerificationEmail('custom@example.com', 'custom-token');

      const callArgs = mockSendMail.mock.calls[0][0];
      expect(callArgs.subject).toBe('Please confirm your email');
      expect(callArgs.html).toContain('custom-token');
      expect(callArgs.html).toContain('custom@example.com');
    });

    it('passwordReset 커스텀 템플릿을 사용해야 한다', async () => {
      const customSender = new SmtpEmailSender({
        ...createDefaultConfig(),
        templates: {
          passwordReset: ({ email, token }) => ({
            subject: 'Password Change Request',
            html: `<p>Reset: ${token} for ${email}</p>`,
          }),
        },
      });

      await customSender.sendPasswordResetEmail('pw@example.com', 'pw-token');

      const callArgs = mockSendMail.mock.calls[0][0];
      expect(callArgs.subject).toBe('Password Change Request');
      expect(callArgs.html).toContain('pw-token');
    });

    it('magicLink 커스텀 템플릿을 사용해야 한다', async () => {
      const customSender = new SmtpEmailSender({
        ...createDefaultConfig(),
        templates: {
          magicLink: ({ token }) => ({
            subject: 'One-click Login',
            html: `<a href="custom/${token}">Login</a>`,
          }),
        },
      });

      await customSender.sendMagicLinkEmail('ml@example.com', 'ml-tok');

      const callArgs = mockSendMail.mock.calls[0][0];
      expect(callArgs.subject).toBe('One-click Login');
      expect(callArgs.html).toContain('ml-tok');
    });

    it('welcome 커스텀 템플릿을 사용해야 한다', async () => {
      const customSender = new SmtpEmailSender({
        ...createDefaultConfig(),
        templates: {
          welcome: ({ name }) => ({
            subject: `Hello ${name}!`,
            html: `<h1>Welcome aboard, ${name}!</h1>`,
          }),
        },
      });

      await customSender.sendWelcomeEmail('w@example.com', 'Alice');

      const callArgs = mockSendMail.mock.calls[0][0];
      expect(callArgs.subject).toBe('Hello Alice!');
      expect(callArgs.html).toContain('Welcome aboard, Alice');
    });

    it('일부 템플릿만 커스텀하면 나머지는 기본 템플릿을 사용해야 한다', async () => {
      const partialCustomSender = new SmtpEmailSender({
        ...createDefaultConfig(),
        templates: {
          verification: () => ({ subject: 'Custom Only', html: '<p>Custom</p>' }),
        },
      });

      // 커스텀 템플릿 사용
      await partialCustomSender.sendVerificationEmail('a@example.com', 't1');
      expect(mockSendMail.mock.calls[0][0].subject).toBe('Custom Only');

      // 기본 템플릿 사용
      await partialCustomSender.sendPasswordResetEmail('b@example.com', 't2');
      expect(mockSendMail.mock.calls[1][0].subject).toBe('Reset your password');
    });
  });
});
