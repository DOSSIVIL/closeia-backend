import {
  HttpException, HttpStatus, Injectable, InternalServerErrorException, Logger, ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client, TokenPayload } from 'google-auth-library';
import { AppException, ErrorCode } from '../../common/filters/app-exception';

export interface VerifiedGoogleProfile {
  sub: string;
  email: string;
  hd?: string;
  givenName?: string;
  familyName?: string;
  picture?: string;
}

type GoogleHttpError = {
  code?: string | number;
  message?: string;
  response?: { status?: number; data?: { error?: string; error_description?: string } };
};

const NETWORK_CODES = [
  'ETIMEDOUT', 'ENOTFOUND', 'ECONNRESET', 'ECONNREFUSED', 'EAI_AGAIN',
  'ENETUNREACH', 'EHOSTUNREACH', 'UND_ERR_CONNECT_TIMEOUT',
];

const CONFIG_HINTS: Record<string, string> = {
  invalid_client:
    'Le secret ne correspond pas au client Web (premier identifiant de GOOGLE_CLIENT_IDS) : recopiez les deux depuis le même client dans Google Cloud.',
  unauthorized_client: 'Le client Google n’est pas autorisé pour ce type de connexion : utilisez un client de type « Application Web ».',
  redirect_uri_mismatch: 'Incohérence de redirection : le client doit être de type « Application Web », avec http://localhost:4200 en origine autorisée.',
  invalid_request: 'Requête mal formée : vérifiez GOOGLE_CLIENT_IDS et GOOGLE_CLIENT_SECRET (espaces, guillemets).',
};

@Injectable()
export class GoogleVerifierService {
  private readonly logger = new Logger(GoogleVerifierService.name);
  private readonly client = new OAuth2Client();
  private readonly audiences: string[];
  private readonly webClientId: string;
  private readonly clientSecret: string;

  constructor(config: ConfigService) {
    this.audiences = config
      .getOrThrow<string>('GOOGLE_CLIENT_IDS')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (this.audiences.length === 0) throw new Error('GOOGLE_CLIENT_IDS est vide.');
    this.webClientId = this.audiences[0]; // convention : le premier identifiant est le client Web
    this.clientSecret = config.getOrThrow<string>('GOOGLE_CLIENT_SECRET').trim();

    this.logger.log(`Client Google Web : ${this.webClientId.slice(0, 14)}… (doit correspondre au frontend)`);
    if (!this.clientSecret.startsWith('GOCSPX-')) {
      this.logger.warn('GOOGLE_CLIENT_SECRET ne commence pas par « GOCSPX- » : vérifiez la valeur copiée.');
    }
  }

  /**
   * Flux popup du portail web : échange le code d'autorisation contre un jeton d'identité
   * (échange serveur à serveur avec le code secret), puis vérifie ce jeton.
   */
  async exchangeCode(code: string): Promise<VerifiedGoogleProfile> {
    const oauth = new OAuth2Client(this.webClientId, this.clientSecret, 'postmessage');
    let idToken: string | null | undefined;
    try {
      const { tokens } = await oauth.getToken(code);
      idToken = tokens.id_token;
    } catch (err) {
      throw this.toExchangeException(err);
    }
    if (!idToken) {
      this.logger.error('Google n’a renvoyé aucun id_token : la portée « openid » est-elle bien demandée ?');
      throw new AppException(HttpStatus.UNAUTHORIZED, ErrorCode.GoogleTokenInvalid, 'Jeton Google manquant.');
    }
    return this.verify(idToken);
  }

  /** Vérifie signature, émetteur, audience et expiration d'un jeton d'identité (mobile, ou après échange). */
  async verify(idToken: string): Promise<VerifiedGoogleProfile> {
    let payload: TokenPayload | undefined;
    try {
      const ticket = await this.client.verifyIdToken({ idToken, audience: this.audiences });
      payload = ticket.getPayload();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const clockHint = /used too (late|early)/i.test(message)
        ? ' → l’horloge de cet ordinateur est décalée : synchronisez l’heure Windows.'
        : /audience/i.test(message)
          ? ' → l’identifiant client du frontend diffère de GOOGLE_CLIENT_IDS.'
          : '';
      this.logger.warn(`Jeton Google refusé : ${message}${clockHint}`);
      throw new AppException(HttpStatus.UNAUTHORIZED, ErrorCode.GoogleTokenInvalid, 'Jeton Google invalide ou expiré.');
    }
    if (!payload?.sub || !payload.email) {
      throw new AppException(HttpStatus.UNAUTHORIZED, ErrorCode.GoogleTokenInvalid, 'Jeton Google incomplet.');
    }
    if (!payload.email_verified) {
      throw new AppException(
        HttpStatus.FORBIDDEN, ErrorCode.GoogleEmailNotVerified, 'Adresse Google non vérifiée.', { email: payload.email },
      );
    }

    return {
      sub: payload.sub,
      email: payload.email,
      hd: payload.hd?.toLowerCase(),
      givenName: payload.given_name,
      familyName: payload.family_name,
      picture: payload.picture,
    };
  }

  /** Distingue « code vraiment expiré », « configuration fausse » et « Google injoignable ». */
  private toExchangeException(err: unknown): HttpException {
    const e = err as GoogleHttpError;
    const googleError = e.response?.data?.error;
    const description = e.response?.data?.error_description ?? '';
    const networkCode = typeof e.code === 'string' ? e.code : undefined;

    if (googleError === 'invalid_grant') {
      this.logger.warn(
        `Google a refusé le code (invalid_grant ${description}) : code déjà utilisé, réellement expiré, ou émis pour un autre client que ${this.webClientId.slice(0, 14)}…`,
      );
      return new AppException(HttpStatus.UNAUTHORIZED, ErrorCode.GoogleCodeInvalid, 'Code Google invalide ou expiré.');
    }
    if (googleError) {
      this.logger.error(
        `Google a refusé l’échange : ${googleError} ${description} → ${CONFIG_HINTS[googleError] ?? 'Vérifiez la configuration Google.'}`,
      );
      return new InternalServerErrorException('Configuration Google invalide côté serveur.');
    }
    if (!e.response || (networkCode && NETWORK_CODES.includes(networkCode))) {
      this.logger.error(
        `Google est injoignable depuis le serveur (${networkCode ?? e.message ?? 'erreur réseau'}) : vérifiez Internet, le pare-feu ou le proxy.`,
      );
      return new ServiceUnavailableException('Google est injoignable depuis le serveur.');
    }
    this.logger.error(`Échange du code : réponse inattendue (HTTP ${e.response?.status}) : ${e.message}`);
    return new InternalServerErrorException('Erreur lors de la connexion Google.');
  }
}