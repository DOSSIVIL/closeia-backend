import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MailerService } from '@nestjs-modules/mailer';
import { WelcomeEmailService } from './welcome-email.service';

describe('WelcomeEmailService', () => {
  let service: WelcomeEmailService;
  let sendMail: jest.Mock;

  beforeEach(async () => {
    sendMail = jest.fn().mockResolvedValue(undefined);
    const settings: Record<string, string> = {
      SMTP_HOST: 'smtp.example.com',
      SMTP_USER: 'sender@example.com',
      SMTP_PASSWORD: 'smtp-secret',
      SMTP_FROM: 'CloseIA <sender@example.com>',
      FRONTEND_URL: 'https://web.closeia.example',
      MOBILE_APP_URL:
        'https://play.google.com/store/apps/details?id=com.closeia.mobile',
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WelcomeEmailService,
        { provide: MailerService, useValue: { sendMail } },
        {
          provide: ConfigService,
          useValue: { get: (key: string) => settings[key] },
        },
      ],
    }).compile();

    service = module.get<WelcomeEmailService>(WelcomeEmailService);
  });

  it('sends student-specific welcome content with school and both platform links', async () => {
    await service.sendWelcome({
      email: 'student@school.example',
      firstName: 'Aïcha',
      lastName: 'Diallo',
      roleCode: 'STUDENT',
      roleName: 'Élève',
      schoolName: 'Lycée des Horizons',
    });

    const message = sendMail.mock.calls[0][0] as {
      subject: string;
      text: string;
      html: string;
    };
    expect(message.subject).toContain('espace étudiant');
    expect(message.text).toContain('Bonjour étudiant(e) Aïcha Diallo');
    expect(message.text).toContain('Lycée des Horizons');
    expect(message.text).toContain('https://web.closeia.example/login');
    expect(message.text).toContain(
      'https://play.google.com/store/apps/details',
    );
    expect(message.html).toContain('Accéder à la plateforme web');
    expect(message.html).toContain('Télécharger l’application Android');
    expect(message.html).not.toContain('Mot de passe initial');
  });

  it('includes administrator role and initial password only in the welcome email', async () => {
    await service.sendWelcome({
      email: 'admin@school.example',
      firstName: 'Nadia',
      lastName: 'Martin',
      roleCode: 'SCHOOL_ADMIN',
      roleName: 'Administratrice école',
      schoolName: 'Collège du Centre',
      password: 'Initial-Admin-2026',
    });

    const message = sendMail.mock.calls[0][0] as {
      text: string;
      html: string;
    };
    expect(message.text).toContain('Administratrice école');
    expect(message.text).toContain('Initial-Admin-2026');
    expect(message.html).toContain('Initial-Admin-2026');
    expect(message.html).toContain('Collège du Centre');
    expect(message.html).toContain('Accéder à la plateforme web');
    expect(message.html).toContain('Télécharger l’application Android');
  });

  it('escapes user-provided content in HTML', async () => {
    await service.sendWelcome({
      email: 'user@school.example',
      firstName: '<script>alert(1)</script>',
      lastName: 'User',
      roleCode: 'STAFF',
      roleName: 'Personnel',
      schoolName: 'École & Collège',
    });

    const message = sendMail.mock.calls[0][0] as { html: string };
    expect(message.html).not.toContain('<script>');
    expect(message.html).toContain('&lt;script&gt;');
    expect(message.html).toContain('École &amp; Collège');
  });
});
