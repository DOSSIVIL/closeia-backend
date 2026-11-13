export type ClientKind = 'web' | 'mobile';

/** Contenu du jeton. « jti » est l'identifiant de la session côté serveur. */
export interface JwtPayload {
  sub: string;
  email: string;
  ver: number;
  jti: string;
}

export interface SessionContext {
  client: ClientKind;
  userAgent?: string;
  ip?: string;
}


export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  roles: string[];
  permissions: string[];
  documentScopes: string[];
  schoolId?: string;
}

export interface SessionResponse {
  accessToken: string;
  user: SessionUser;
}
