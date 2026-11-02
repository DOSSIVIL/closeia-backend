import { HttpException, HttpStatus } from '@nestjs/common';

/** Codes d'erreur stables, lus par le frontend et le mobile (jamais le texte du message). */
export const ErrorCode = {
  GoogleCodeInvalid: 'GOOGLE_CODE_INVALID',
  GoogleTokenInvalid: 'GOOGLE_TOKEN_INVALID',
  GoogleEmailNotVerified: 'GOOGLE_EMAIL_NOT_VERIFIED',
  GoogleWorkspaceRequired: 'GOOGLE_WORKSPACE_REQUIRED',
  GoogleAccountConflict: 'GOOGLE_ACCOUNT_CONFLICT',
  EmailFormatInvalid: 'EMAIL_FORMAT_INVALID',
  EmailDomainUnknown: 'EMAIL_DOMAIN_UNKNOWN',
  SchoolInactive: 'SCHOOL_INACTIVE',
  AccountSuspended: 'ACCOUNT_SUSPENDED',
  AdminOnlyPortal: 'ADMIN_ONLY_PORTAL',
  RateLimited: 'RATE_LIMITED',
  SessionExpired: 'SESSION_EXPIRED',
  SessionRevoked: 'SESSION_REVOKED',
  Unauthenticated: 'UNAUTHENTICATED',
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface ErrorDetails {
  email?: string;
}

export class AppException extends HttpException {
  constructor(status: HttpStatus, code: ErrorCodeValue, message: string, details?: ErrorDetails) {
    super({ code, message, ...(details?.email ? { details: { email: details.email } } : {}) }, status);
  }
}