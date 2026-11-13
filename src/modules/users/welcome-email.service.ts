import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailerService } from '@nestjs-modules/mailer';

export interface WelcomeEmailInput {
  email: string;
  firstName: string;
  lastName: string;
  roleCode: string;
  roleName: string;
  schoolName: string;
  password?: string;
}

const DEFAULT_MOBILE_APP_URL =
  'https://play.google.com/store/apps/details?id=com.closeia.mobile';

@Injectable()
export class WelcomeEmailService {
  private readonly logger = new Logger(WelcomeEmailService.name);

  constructor(
    private readonly mailer: MailerService,
    private readonly config: ConfigService,
  ) {}

  async sendWelcome(input: WelcomeEmailInput): Promise<void> {
    const host = this.config.get<string>('SMTP_HOST');
    const username = this.config.get<string>('SMTP_USER');
    const password = this.config.get<string>('SMTP_PASSWORD');
    const from = this.config.get<string>('SMTP_FROM');
    const frontendUrl = this.config.get<string>('FRONTEND_URL');
    const mobileAppUrl =
      this.config.get<string>('MOBILE_APP_URL') ?? DEFAULT_MOBILE_APP_URL;

    if (!host || !username || !password || !from || !frontendUrl) {
      throw new ServiceUnavailableException(
        'Le service e-mail n’est pas configuré. Renseignez les variables SMTP du backend.',
      );
    }

    const webUrl = new URL('/login', frontendUrl).toString();
    const fullName = [input.firstName, input.lastName]
      .map((part) => part.trim())
      .filter(Boolean)
      .join(' ');
    const name = fullName || 'Bonjour';
    const roleName = input.roleName.trim();
    const schoolName = input.schoolName.trim() || 'votre établissement';
    const greeting =
      input.roleCode === 'STUDENT'
        ? `Bonjour étudiant(e) ${name}`
        : `Bonjour ${name}`;
    const title =
      input.roleCode === 'STUDENT'
        ? 'Votre espace étudiant vous attend'
        : 'Votre compte CloseIA est prêt';
    const intro =
      input.roleCode === 'STUDENT'
        ? `Votre compte étudiant a été créé pour ${schoolName}. Retrouvez vos ressources et échangez avec votre assistant pédagogique depuis CloseIA.`
        : `Votre compte a été créé sur CloseIA pour ${schoolName}. Vous pouvez dès maintenant accéder à votre espace.`;
    const text = [
      greeting,
      '',
      intro,
      `Établissement : ${schoolName}`,
      `Rôle : ${roleName}`,
      ...(input.password
        ? [
            '',
            'IDENTIFIANTS ADMINISTRATEUR',
            `Adresse e-mail : ${input.email}`,
            `Mot de passe initial : ${input.password}`,
            'Conservez-le en lieu sûr et ne le partagez avec personne.',
          ]
        : []),
      '',
      `Accéder à CloseIA sur le web : ${webUrl}`,
      `Télécharger CloseIA sur Android : ${mobileAppUrl}`,
      '',
      'Les liens de téléchargement peuvent être provisoires avant le déploiement des applications.',
      'À bientôt sur CloseIA.',
      'L’équipe CloseIA',
    ].join('\n');

    try {
      await this.mailer.sendMail({
        to: input.email,
        subject:
          input.roleCode === 'STUDENT'
            ? 'Bienvenue sur CloseIA — espace étudiant'
            : 'Bienvenue sur CloseIA',
        text,
        html: this.buildHtml({
          email: input.email,
          greeting,
          title,
          intro,
          roleName,
          schoolName,
          webUrl,
          mobileAppUrl,
          password: input.password,
        }),
      });
    } catch (error) {
      this.logger.error(
        `Échec de l’envoi du courriel de bienvenue à ${input.email}.`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new ServiceUnavailableException(
        'Le compte a été créé, mais le courriel de bienvenue n’a pas pu être envoyé.',
      );
    }
  }

  private buildHtml(input: {
    email: string;
    greeting: string;
    title: string;
    intro: string;
    roleName: string;
    schoolName: string;
    webUrl: string;
    mobileAppUrl: string;
    password?: string;
  }): string {
    const escape = (value: string) => this.escapeHtml(value);
    const passwordBlock = input.password
      ? `<tr><td style="padding:0 32px 24px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff8e8;border:1px solid #f1dfb5;border-radius:12px"><tr><td style="padding:18px 20px"><p style="margin:0 0 12px;color:#785b18;font-size:13px;font-weight:700;letter-spacing:.04em">VOS IDENTIFIANTS ADMINISTRATEUR</p><p style="margin:0 0 8px;color:#18324b;font-size:14px"><strong>Adresse e-mail</strong><br>${escape(input.email)}</p><p style="margin:0 0 10px;color:#18324b;font-size:14px"><strong>Mot de passe initial</strong><br><span style="font-family:Consolas,monospace;font-size:16px;word-break:break-all">${escape(input.password)}</span></p><p style="margin:0;color:#785b18;font-size:12px;line-height:1.6">Ce mot de passe vous est transmis pour votre première connexion. Gardez ce message confidentiel et ne transférez pas vos identifiants.</p></td></tr></table></td></tr>`
      : '';

    return `<main style="margin:0;background:#f2f6fb;padding:28px 12px;font-family:Arial,Helvetica,sans-serif;color:#18324b"><table role="presentation" align="center" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;margin:0 auto;background:#fff;border:1px solid #e1e9f2;border-radius:18px;overflow:hidden"><tr><td style="background:#12304c;padding:28px 32px"><p style="margin:0 0 10px;color:#a8d7ff;font-size:12px;font-weight:700;letter-spacing:.18em">CLOSEIA</p><h1 style="margin:0;color:#fff;font-size:26px;line-height:1.25">${escape(input.title)}</h1></td></tr><tr><td style="padding:28px 32px 18px"><p style="margin:0 0 14px;font-size:16px;font-weight:700">${escape(input.greeting)},</p><p style="margin:0;color:#52677d;font-size:14px;line-height:1.7">${escape(input.intro)}</p></td></tr><tr><td style="padding:0 32px 24px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f8fc;border-radius:12px"><tr><td style="padding:16px 18px"><p style="margin:0 0 8px;color:#72849a;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase">Récapitulatif du compte</p><p style="margin:0 0 6px;font-size:14px"><strong>Rôle :</strong> ${escape(input.roleName)}</p><p style="margin:0;font-size:14px"><strong>Établissement :</strong> ${escape(input.schoolName)}</p></td></tr></table></td></tr>${passwordBlock}<tr><td style="padding:0 32px 12px"><p style="margin:0 0 12px;color:#52677d;font-size:13px;line-height:1.6">Retrouvez CloseIA sur vos appareils :</p><p style="margin:0 0 12px"><a href="${escape(input.webUrl)}" style="display:inline-block;padding:13px 20px;background:#1675b9;border-radius:8px;color:#fff;font-size:14px;font-weight:700;text-decoration:none">Accéder à la plateforme web</a></p><p style="margin:0 0 8px"><a href="${escape(input.mobileAppUrl)}" style="display:inline-block;padding:12px 20px;background:#e8f3fc;border:1px solid #cfe4f5;border-radius:8px;color:#155d91;font-size:14px;font-weight:700;text-decoration:none">Télécharger l’application Android</a></p><p style="margin:0;color:#7a8a9b;font-size:11px;line-height:1.5">Le lien mobile peut être provisoire jusqu’à la publication de l’application sur le Play Store.</p></td></tr><tr><td style="padding:18px 32px 26px"><p style="margin:0;color:#52677d;font-size:13px;line-height:1.6">Nous sommes ravis de vous accueillir. À bientôt sur CloseIA !<br><strong>L’équipe CloseIA</strong></p></td></tr><tr><td style="border-top:1px solid #e8eef5;padding:16px 32px"><p style="margin:0;color:#8a99a9;font-size:11px;line-height:1.5">Cet e-mail a été envoyé automatiquement. Si vous n’attendiez pas ce message, contactez l’administrateur de votre établissement.</p></td></tr></table></main>`;
  }

  private escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (character) => {
      const entities: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      };
      return entities[character] ?? character;
    });
  }
}
