import { SmtpEmailSender } from '../../../../src/auth/email/sender';

describe('SmtpEmailSender', () => {
  it('should construct with valid config', () => {
    const sender = new SmtpEmailSender({
      host: 'smtp.test.com',
      port: 587,
      user: 'user',
      pass: 'pass',
      from: 'noreply@test.com',
      baseUrl: 'http://localhost:3000',
    });
    expect(sender).toBeDefined();
    expect(sender).toHaveProperty('sendVerificationEmail');
    expect(sender).toHaveProperty('sendPasswordResetEmail');
    expect(sender).toHaveProperty('sendMagicLinkEmail');
    expect(sender).toHaveProperty('sendWelcomeEmail');
  });

  it('should accept custom templates', () => {
    const sender = new SmtpEmailSender({
      host: 'smtp.test.com',
      port: 587,
      user: 'user',
      pass: 'pass',
      from: 'noreply@test.com',
      baseUrl: 'http://localhost:3000',
      templates: {
        verification: ({ token }) => ({ subject: 'Custom', html: `<p>${token}</p>` }),
      },
    });
    expect(sender).toBeDefined();
  });
});
