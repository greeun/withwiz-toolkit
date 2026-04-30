/**
 * Shared Auth Types
 *
 * 프레임워크 독립적인 인증 타입 정의
 * Next.js, Express, Fastify 등 어디서나 사용 가능
 */

// ============================================================================
// Logger Interface
// ============================================================================

export interface Logger {
  debug(message: string, meta?: any): void;
  info(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  error(message: string, meta?: any): void;
}

// ============================================================================
// User Types
// ============================================================================

export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
}

// ============================================================================
// JWT Types
// ============================================================================

export interface JWTPayload {
  id: string; // User ID (기존 코드와의 호환성)
  userId: string; // Refresh token용
  email: string;
  role: UserRole;
  emailVerified?: Date | null; // 이메일 인증 여부 (기존 코드와의 호환성)
  tokenType?: 'access' | 'refresh'; // 토큰 타입
  iat?: number;
  exp?: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface JWTConfig {
  secret: string;
  accessTokenExpiry: string;
  refreshTokenExpiry: string;
  algorithm: 'HS256' | 'HS384' | 'HS512';
}

// ============================================================================
// OAuth Types
// ============================================================================

export enum OAuthProvider {
  GOOGLE = 'google',
  GITHUB = 'github',
  KAKAO = 'kakao',
}

export interface OAuthUserInfo {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  emailVerified: boolean;
}

export interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
}

export interface OAuthConfig {
  google?: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  };
  github?: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  };
  kakao?: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  };
}

// ============================================================================
// Password Types
// ============================================================================

export enum PasswordStrength {
  VERY_WEAK = 'VERY_WEAK',
  WEAK = 'WEAK',
  MEDIUM = 'MEDIUM',
  STRONG = 'STRONG',
  VERY_STRONG = 'VERY_STRONG',
}

export interface PasswordValidationResult {
  isValid: boolean;
  strength: PasswordStrength;
  errors: string[];
}

export interface PasswordConfig {
  minLength: number;
  maxLength: number;
  requireNumber: boolean;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireSpecialChar: boolean;
  bcryptRounds: number;
}

// ============================================================================
// Email Token Types
// ============================================================================

export enum TokenType {
  EMAIL_VERIFICATION = 'EMAIL_VERIFICATION',
  PASSWORD_RESET = 'PASSWORD_RESET',
  MAGIC_LINK = 'MAGIC_LINK',
}

// ============================================================================
// BaseUser Interface (for Repository pattern)
// ============================================================================

export interface BaseUser {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  emailVerified: Date | null;
  isActive: boolean;
  image: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Repository Interfaces (Database Abstraction)
// ============================================================================

export interface UserRepository {
  findById(id: string): Promise<BaseUser | null>;
  findByEmail(email: string): Promise<BaseUser | null>;
  create(data: CreateUserData): Promise<BaseUser>;
  update(id: string, data: UpdateUserData): Promise<BaseUser>;
  delete(id: string): Promise<void>;
  updateLastLoginAt(id: string): Promise<void>;
  verifyEmail(email: string): Promise<void>;
}

export interface CreateUserData {
  email: string;
  password?: string | null;
  name?: string | null;
  role?: UserRole;
  emailVerified?: Date | null;
  image?: string | null;
}

export interface UpdateUserData {
  email?: string;
  password?: string;
  name?: string | null;
  role?: UserRole;
  emailVerified?: Date | null;
  isActive?: boolean;
  image?: string | null;
}

export interface OAuthAccount {
  id: string;
  userId: string;
  provider: OAuthProvider;
  providerAccountId: string;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: Date | null;
  tokenType: string | null;
  scope: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface OAuthAccountRepository {
  findByProvider(
    provider: OAuthProvider,
    providerAccountId: string
  ): Promise<OAuthAccount | null>;
  findByUserId(userId: string): Promise<OAuthAccount[]>;
  create(data: CreateOAuthAccountData): Promise<OAuthAccount>;
  update(id: string, data: UpdateOAuthAccountData): Promise<OAuthAccount>;
  delete(id: string): Promise<void>;
}

export interface CreateOAuthAccountData {
  userId: string;
  provider: OAuthProvider;
  providerAccountId: string;
  accessToken?: string | null;
  refreshToken?: string | null;
  expiresAt?: Date | null;
  tokenType?: string | null;
  scope?: string | null;
}

export interface UpdateOAuthAccountData {
  accessToken?: string | null;
  refreshToken?: string | null;
  expiresAt?: Date | null;
  tokenType?: string | null;
  scope?: string | null;
}

export interface EmailToken {
  id: string;
  email: string;
  token: string;
  type: TokenType;
  expires: Date;
  used: boolean;
  createdAt: Date;
}

export interface EmailTokenRepository {
  create(
    email: string,
    token: string,
    type: TokenType,
    expiresAt: Date
  ): Promise<EmailToken>;
  findByEmailAndToken(
    email: string,
    token: string,
    type: TokenType
  ): Promise<EmailToken | null>;
  delete(email: string, token: string, type: TokenType): Promise<void>;
  deleteExpired(): Promise<void>;
  markAsUsed(id: string): Promise<void>;
}

// ============================================================================
// Email Config Types
// ============================================================================

export interface EmailConfig {
  from: string;
  provider: 'smtp' | 'sendgrid' | 'mailgun' | 'resend';
  verificationTokenExpiry: number; // hours
  passwordResetTokenExpiry: number; // hours
  magicLinkTokenExpiry: number; // minutes
}

// ============================================================================
// Email Sender Interface
// ============================================================================

export interface EmailSender {
  sendVerificationEmail(email: string, token: string): Promise<void>;
  sendPasswordResetEmail(email: string, token: string): Promise<void>;
  sendMagicLinkEmail(email: string, token: string): Promise<void>;
  sendWelcomeEmail(email: string, name: string): Promise<void>;
}

// ============================================================================
// Main Auth Configuration
// ============================================================================

export interface AuthConfig {
  jwt: JWTConfig;
  password: PasswordConfig;
  oauth?: OAuthConfig;
  email?: EmailConfig;
  features: {
    emailVerificationRequired: boolean;
    magicLinkEnabled: boolean;
    oauthEnabled: boolean;
    passwordResetEnabled: boolean;
  };
  urls: {
    baseUrl: string;
    loginUrl: string;
    callbackUrl: string;
  };
  logger?: Logger;
}
