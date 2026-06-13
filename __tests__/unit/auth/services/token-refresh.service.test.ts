import { TokenRefreshService } from '@withwiz/toolkit/core/auth/services/token-refresh.service';
import { JWTService } from '@withwiz/toolkit/core/auth/jwt';
import type { UserRepository } from '@withwiz/toolkit/core/auth/types';
import type { IRefreshTokenStore } from '@withwiz/toolkit/core/auth/services/refresh-token-store';

/** 테스트용 인메모리 refresh 토큰 store. */
function makeInMemoryStore() {
  const used = new Set<string>();
  const revoked = new Set<string>();
  const store: IRefreshTokenStore = {
    isUsed: async (jti: string) => used.has(jti),
    markUsed: async (jti: string) => { used.add(jti); },
    isFamilyRevoked: async (fid: string) => revoked.has(fid),
    revokeFamily: async (fid: string) => { revoked.add(fid); },
    register: vi.fn(async () => {}),
  };
  return { store, used, revoked };
}

const jwtSecret = 'a'.repeat(32);

const mockUserRepo: UserRepository = {
  findById: vi.fn().mockResolvedValue({ id: 'user-1', email: 'test@test.com', role: 'USER', emailVerified: new Date(), isActive: true }),
  findByEmail: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  updateLastLoginAt: vi.fn(),
  verifyEmail: vi.fn(),
};

describe('TokenRefreshService', () => {
  let service: TokenRefreshService;
  let jwtService: JWTService;

  beforeEach(() => {
    vi.clearAllMocks();
    jwtService = new JWTService({ secret: jwtSecret, accessTokenExpiry: '7d', refreshTokenExpiry: '30d', algorithm: 'HS256' });
    service = new TokenRefreshService({
      userRepository: mockUserRepo,
      jwtSecret,
    });
  });

  it('should issue new access token from valid refresh token', async () => {
    const refreshToken = await jwtService.createRefreshToken('user-1');
    const result = await service.refresh(refreshToken);
    expect(result.accessToken).toBeDefined();
    expect(result.user.id).toBe('user-1');
    expect(result.user.email).toBe('test@test.com');
  });

  it('should throw for inactive user', async () => {
    (mockUserRepo.findById as any).mockResolvedValueOnce({ id: 'user-1', email: 'test@test.com', isActive: false });
    const refreshToken = await jwtService.createRefreshToken('user-1');
    await expect(service.refresh(refreshToken)).rejects.toThrow('Account is disabled');
  });

  it('should throw for blacklisted token', async () => {
    service = new TokenRefreshService({
      userRepository: mockUserRepo,
      jwtSecret,
      isTokenBlacklisted: async () => true,
    });
    const refreshToken = await jwtService.createRefreshToken('user-1');
    await expect(service.refresh(refreshToken)).rejects.toThrow('Token has been revoked');
  });

  it('should throw for non-existent user', async () => {
    (mockUserRepo.findById as any).mockResolvedValueOnce(null);
    const refreshToken = await jwtService.createRefreshToken('user-1');
    await expect(service.refresh(refreshToken)).rejects.toThrow('User not found');
  });

  it('does not rotate (no refreshToken in result) when no store is configured', async () => {
    const refreshToken = await jwtService.createRefreshToken('user-1', { jti: 'J1', familyId: 'F1' });
    const result = await service.refresh(refreshToken);
    expect(result.refreshToken).toBeUndefined();
  });

  describe('with refreshTokenStore (rotation + reuse detection)', () => {
    let store: IRefreshTokenStore;
    let used: Set<string>;
    let revoked: Set<string>;

    beforeEach(() => {
      ({ store, used, revoked } = makeInMemoryStore());
      service = new TokenRefreshService({ userRepository: mockUserRepo, jwtSecret, refreshTokenStore: store });
    });

    it('rotates the refresh token and marks the old jti used', async () => {
      const t1 = await jwtService.createRefreshToken('user-1', { jti: 'J1', familyId: 'F1' });
      const result = await service.refresh(t1);

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.refreshToken).not.toBe(t1);
      expect(used.has('J1')).toBe(true);
      // 새 refresh 는 같은 family, 새 jti 를 가진다
      const verified = await jwtService.verifyRefreshToken(result.refreshToken!);
      expect(verified.familyId).toBe('F1');
      expect(verified.jti).not.toBe('J1');
    });

    it('detects reuse of an already-rotated token and revokes the whole family', async () => {
      const t1 = await jwtService.createRefreshToken('user-1', { jti: 'J1', familyId: 'F1' });
      const first = await service.refresh(t1); // J1 회전 → used

      // 탈취된 구 토큰 t1 재제출 → reuse 탐지
      await expect(service.refresh(t1)).rejects.toThrow('Refresh token reuse detected');
      expect(revoked.has('F1')).toBe(true);

      // family 무효화로 회전된 신규 토큰도 더 이상 못 쓴다
      await expect(service.refresh(first.refreshToken!)).rejects.toThrow('Token has been revoked');
    });

    it('rejects a token whose family was revoked (logout)', async () => {
      const t1 = await jwtService.createRefreshToken('user-1', { jti: 'J1', familyId: 'F1' });
      await service.revokeFamily('F1');
      await expect(service.refresh(t1)).rejects.toThrow('Token has been revoked');
    });

    it('revokeByToken revokes the family of a given refresh token', async () => {
      const t1 = await jwtService.createRefreshToken('user-1', { jti: 'J1', familyId: 'F1' });
      await service.revokeByToken(t1);
      expect(revoked.has('F1')).toBe(true);
    });

    it('bootstraps a new family for a legacy token without identifiers', async () => {
      const legacy = await jwtService.createRefreshToken('user-1'); // jti/familyId 없음
      const result = await service.refresh(legacy);
      expect(result.refreshToken).toBeDefined();
      const verified = await jwtService.verifyRefreshToken(result.refreshToken!);
      expect(verified.familyId).toBeDefined();
      expect(verified.jti).toBeDefined();
    });

    it('registers each newly issued refresh token', async () => {
      const t1 = await jwtService.createRefreshToken('user-1', { jti: 'J1', familyId: 'F1' });
      await service.refresh(t1);
      expect(store.register).toHaveBeenCalledWith(
        expect.objectContaining({ familyId: 'F1', userId: 'user-1' }),
      );
    });
  });

  describe('without store, revoke methods throw', () => {
    it('revokeFamily throws STORE_NOT_CONFIGURED', async () => {
      await expect(service.revokeFamily('F1')).rejects.toThrow('store is not configured');
    });
  });
});
