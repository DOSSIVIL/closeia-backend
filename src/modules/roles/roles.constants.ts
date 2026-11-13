export const Permission = {
  DashboardRead: 'dashboard.read',
  SchoolsRead: 'schools.read',
  SchoolsWrite: 'schools.write',
  UsersRead: 'users.read',
  UsersWrite: 'users.write',
  RolesRead: 'roles.read',
  RolesWrite: 'roles.write',
  AssignmentsRead: 'assignments.read',
  AssignmentsWrite: 'assignments.write',
  DocumentsRead: 'documents.read',
  DocumentsWrite: 'documents.write',
  ConversationsRead: 'conversations.read',
  AuditRead: 'audit.read',
  ChatUse: 'chat.use',
} as const;

export const ALL_PERMISSIONS: readonly string[] = Object.values(Permission);

export const DocumentScope = {
  Platform: 'PLATFORM',
  School: 'SCHOOL',
  AssignedSpaces: 'ASSIGNED_SPACES',
  OwnDocuments: 'OWN_DOCUMENTS',
} as const;

export type DocumentScope = (typeof DocumentScope)[keyof typeof DocumentScope];

export const ALL_DOCUMENT_SCOPES: readonly DocumentScope[] =
  Object.values(DocumentScope);
export const ASSIGNABLE_DOCUMENT_SCOPES: readonly DocumentScope[] = [
  DocumentScope.School,
  DocumentScope.AssignedSpaces,
  DocumentScope.OwnDocuments,
];

export const RoleCode = {
  PlatformAdmin: 'PLATFORM_ADMIN',
  SchoolAdmin: 'SCHOOL_ADMIN',
  Staff: 'STAFF',
  Student: 'STUDENT',
  Guest: 'GUEST',
} as const;

/** Rôles autorisés sur le portail web et à la connexion par mot de passe. */
export const ADMIN_ROLE_CODES: readonly string[] = [
  RoleCode.PlatformAdmin,
  RoleCode.SchoolAdmin,
];

/** Rôle donné à un compte créé à sa première connexion : aucun droit documentaire. */
export const DEFAULT_ROLE_CODE: string = RoleCode.Guest;

export interface DefaultRoleDefinition {
  code: string;
  name: string;
  description: string;
  permissions: readonly string[];
  documentScopes: readonly DocumentScope[];
}

export const DEFAULT_ROLES: DefaultRoleDefinition[] = [
  {
    code: RoleCode.PlatformAdmin,
    name: 'Administrateur plateforme',
    description: 'Contrôle total de la plateforme.',
    permissions: ALL_PERMISSIONS,
    documentScopes: ALL_DOCUMENT_SCOPES,
  },
  {
    code: RoleCode.SchoolAdmin,
    name: 'Administrateur école',
    description:
      'Administre les utilisateurs et les documents de son établissement.',
    permissions: [
      Permission.DashboardRead,
      Permission.SchoolsRead,
      Permission.UsersRead,
      Permission.UsersWrite,
      Permission.RolesRead,
      Permission.AssignmentsRead,
      Permission.AssignmentsWrite,
      Permission.DocumentsRead,
      Permission.DocumentsWrite,
      Permission.ConversationsRead,
      Permission.AuditRead,
      Permission.ChatUse,
    ],
    documentScopes: [
      DocumentScope.School,
      DocumentScope.AssignedSpaces,
      DocumentScope.OwnDocuments,
    ],
  },
  {
    code: RoleCode.Staff,
    name: 'Personnel',
    description: 'Personnel d’un établissement.',
    permissions: [Permission.DocumentsRead, Permission.ChatUse],
    documentScopes: [DocumentScope.AssignedSpaces, DocumentScope.OwnDocuments],
  },
  {
    code: RoleCode.Student,
    name: 'Élève',
    description: 'Élève ou étudiant d’un établissement.',
    permissions: [Permission.DocumentsRead, Permission.ChatUse],
    documentScopes: [DocumentScope.AssignedSpaces, DocumentScope.OwnDocuments],
  },
  {
    code: RoleCode.Guest,
    name: 'Invité',
    description:
      'Compte valide sans aucun droit documentaire tant qu’un administrateur ne lui en donne pas.',
    permissions: [],
    documentScopes: [],
  },
];
