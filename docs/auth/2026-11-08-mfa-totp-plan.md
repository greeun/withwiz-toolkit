# MFA(TOTP + 복구 코드) — toolkit 0.30.0 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** toolkit 인증 처리기에 TOTP 2단계 인증(등록·검증·해제·복구 코드·잠금)을 기본 꺼짐 기능으로 추가한다.

**Architecture:** `core/auth/mfa` 에 프레임워크 없는 부품(TOTP·base32·암호화·복구 코드·시도 저장소·`MfaService`)을 두고,
`next/auth-handlers` 가 설정(`options.mfa`)이 있을 때만 로그인·OAuth 콜백에서 세션 대신 대기 토큰을 주고
`/mfa/*` 처리기로 검증·관리한다. Prisma 어댑터에 `PrismaMfaRepository` 를 더한다.

**Tech Stack:** TypeScript, Next.js route handlers, `jose`(JWTService), `node:crypto`, vitest, tsup.

**Spec:** `docs/auth/2026-11-08-mfa-totp-design.md` (같은 브랜치). auth-ui 0.10.0 은 별도 계획이다.

## Global Constraints

- 작업 디렉터리: `node-packages/withwiz-toolkit/.claude/worktrees/mfa-totp`, 브랜치 `feat/mfa-totp`(develop 기준).
- 계층 규칙: `core` 는 `next`·`prisma`·프레임워크를 import 하지 않는다. `next`·`prisma` 는 `core` 만 import 하고 서로 import 하지 않는다.
- **`options.mfa` 가 없거나 `enabled:false` 면 모든 처리기의 응답 본문·상태·쿠키·토큰 클레임이 0.29.0 과 같다**(`amr` 클레임도 넣지 않는다).
- 새 외부 의존성을 추가하지 않는다(TOTP·base32 는 `node:crypto` 로 직접 구현).
- TOTP: SHA-1, 6자리, 30초, 앞뒤 1스텝 허용. 비밀 키 20바이트.
- 복구 코드: 10개, `xxxx-xxxx`(소문자 base32 `[a-z2-7]`), SHA-256 해시로만 저장, 1회용.
- 암호화: AES-256-GCM, 형식 `v1.<keyId>.<iv>.<ciphertext>.<tag>`(base64url), `keyId` = 키 바이트 SHA-256 hex 앞 8자. 첫 키로 암호화.
- 대기 토큰: `tokenType:"mfa_pending"`, 만료 300초. 쿠키 이름 `mfa_pending`(`authCookieName` 적용), HttpOnly, SameSite=Lax, 경로 `mfa.cookiePath ?? '/api/auth'`.
- 한도: 대기 토큰당 실패 5회면 폐기, 사용자당 900초 안에 실패 10회면 900초 잠금(로그인 검증·관리 엔드포인트 합산).
- `amr` 값: `pwd`, `fed`, `otp`, `rec`, `mfa`.
- 오류 응답은 standard 형식. 새 key 는 `ERROR_CODES`·`AUTH_ERROR_CODE_MAP`·`core/error/messages/{ko,en,ja}.ts` 에 모두 등록한다.
- 새 공개 모듈은 `package.json` exports 에 수기로 추가한다(`exports-integrity` 테스트).
- 커밋 전 `git config --local --get user.name` 확인, 메시지는 저장소 관례(conventional), 끝에 아래 두 줄:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` / `Claude-Session: https://claude.ai/code/session_01EtyBDzL8CHT3CWhLJrhczF`
- 테스트는 변경 범위만: `npx vitest run -c __tests__/vitest.config.ts <파일>`. 전체(`npm test`)와 빌드는 Task 11 에서만.

## Review Focus

1. 이전 30초 창의 코드(시계 오차) — 허용돼야 한다. 두 창 이전 코드는 거부. → Task 1 테스트.
2. 같은 코드를 같은 창에서 두 번 제출(재사용) — 두 번째는 실패하고 실패 횟수에 들어간다. → Task 6 테스트.
3. 복구 코드를 대문자·공백·하이픈 없이 입력 — 같은 코드로 인정한다. → Task 2 테스트.
4. MFA 를 켠 사용자의 OAuth 콜백 응답에 access·refresh 쿠키가 하나라도 실리면 안 된다. → Task 9 테스트.
5. 대기 토큰을 access·refresh 토큰 자리에 넣으면 거부돼야 한다. → Task 5 테스트.
6. `mfa` 미설정 소비자의 login 응답이 0.29 와 같아야 한다(`amr` 없음). → Task 8 테스트.

---

### Task 1: base32 · TOTP

**Files:**
- Create: `src/core/auth/mfa/base32.ts`, `src/core/auth/mfa/totp.ts`
- Test: `__tests__/unit/auth/mfa/totp.test.ts`

**Interfaces:**
- Produces:
  - `base32Encode(bytes: Uint8Array): string` — RFC 4648, 대문자, 패딩 없음.
  - `base32Decode(input: string): Buffer` — 대소문자 무시, 공백·`=` 무시, 그 밖의 문자는 `Error`.
  - `TOTP_DEFAULTS = { digits: 6, period: 30, window: 1 } as const`
  - `generateTotpSecret(): string` — 20바이트 무작위 → base32.
  - `currentStep(nowMs?: number, period?: number): number`
  - `totpCode(secret: string, step: number, digits?: number): string` — HMAC-SHA1, RFC 4226 동적 절단, 0 채움.
  - `verifyTotp(secret: string, code: string, opts?: { nowMs?: number; window?: number }): number | null` — 맞은 스텝 반환. `^\d{6}$` 가 아니면 즉시 null. 비교는 `timingSafeEqual`.
  - `buildOtpauthUri(p: { issuer: string; account: string; secret: string }): string` — `otpauth://totp/<enc(issuer)>:<enc(account)>?secret=…&issuer=<enc(issuer)>&algorithm=SHA1&digits=6&period=30`.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
const RFC_SECRET = base32Encode(Buffer.from('12345678901234567890'));
it.each([[59, '94287082'], [1111111109, '07081804'], [1111111111, '14050471'],
  [1234567890, '89005924'], [2000000000, '69279037'], [20000000000, '65353130']])(
  'RFC 6238 부록 B SHA1 벡터 T=%i', (t, expected) => {
    expect(totpCode(RFC_SECRET, Math.floor(t / 30), 8)).toBe(expected);
  });
it('6자리는 8자리의 끝 6자리', () => expect(totpCode(RFC_SECRET, Math.floor(59 / 30))).toBe('287082'));
it('base32 왕복·소문자·공백 허용', () => {
  const b = Buffer.from('hello world');
  expect(base32Decode(base32Encode(b).toLowerCase().replace(/(.{4})/g, '$1 '))).toEqual(b);
});
it('base32 잘못된 문자는 오류', () => expect(() => base32Decode('ABC1')).toThrow());
it('이전 창 코드는 허용, 두 창 이전은 거부', () => {
  const now = 1_700_000_000_000; const s = currentStep(now);
  expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, s - 1), { nowMs: now })).toBe(s - 1);
  expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, s - 2), { nowMs: now })).toBeNull();
});
it('형식이 틀리면 null', () => expect(verifyTotp(RFC_SECRET, '12345a')).toBeNull());
it('generateTotpSecret 은 32자 base32(20바이트)', () => {
  expect(generateTotpSecret()).toMatch(/^[A-Z2-7]{32}$/);
});
it('otpauth URI', () => expect(buildOtpauthUri({ issuer: 'binder', account: 'a@b.c', secret: 'ABC' }))
  .toBe('otpauth://totp/binder:a%40b.c?secret=ABC&issuer=binder&algorithm=SHA1&digits=6&period=30'));
```

- [ ] **Step 2: 실패 확인** — `npx vitest run -c __tests__/vitest.config.ts __tests__/unit/auth/mfa/totp.test.ts` → 모듈 없음으로 FAIL.
- [ ] **Step 3: 구현** — 위 시그니처대로 두 파일 작성.
- [ ] **Step 4: 통과 확인** — 같은 명령 PASS.
- [ ] **Step 5: 커밋** — `feat(auth): TOTP·base32 구현(RFC 6238)`

### Task 2: 비밀 키 암호화 · 복구 코드

**Files:**
- Create: `src/core/auth/mfa/secret-box.ts`, `src/core/auth/mfa/recovery-codes.ts`
- Test: `__tests__/unit/auth/mfa/secret-box.test.ts`, `__tests__/unit/auth/mfa/recovery-codes.test.ts`

**Interfaces:**
- Produces:
  - `interface SecretBox { seal(plain: string): string; open(sealed: string): string }`
  - `createSecretBox(keys: string[]): SecretBox` — 각 키는 base64 로 디코드해 32바이트여야 하고, 비었거나 길이가 틀리면 생성 시 `Error('MFA encryption key must be 32 bytes (base64)')`.
  - `RECOVERY_CODE_COUNT = 10`
  - `generateRecoveryCodes(count?: number): string[]`
  - `hashRecoveryCode(input: string): string` — 소문자화 후 `[a-z2-7]` 이외 문자 제거 → SHA-256 hex.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
const k1 = randomBytes(32).toString('base64'); const k2 = randomBytes(32).toString('base64');
it('왕복', () => { const b = createSecretBox([k1]); expect(b.open(b.seal('SECRET'))).toBe('SECRET'); });
it('형식 v1.<8hex>.…', () => expect(createSecretBox([k1]).seal('x')).toMatch(/^v1\.[0-9a-f]{8}\.[\w-]+\.[\w-]+\.[\w-]+$/));
it('키 교체: 옛 키로 봉인한 값을 새 목록으로 연다', () => {
  const sealed = createSecretBox([k1]).seal('x'); expect(createSecretBox([k2, k1]).open(sealed)).toBe('x');
});
it('모르는 키·변조는 오류', () => {
  const sealed = createSecretBox([k1]).seal('x');
  expect(() => createSecretBox([k2]).open(sealed)).toThrow();
  expect(() => createSecretBox([k1]).open(sealed.slice(0, -2) + 'AA')).toThrow();
});
it('32바이트가 아닌 키는 생성 시 오류', () => expect(() => createSecretBox([Buffer.alloc(16).toString('base64')])).toThrow());
it('복구 코드 10개, 형식, 중복 없음', () => {
  const codes = generateRecoveryCodes(); expect(codes).toHaveLength(10);
  codes.forEach((c) => expect(c).toMatch(/^[a-z2-7]{4}-[a-z2-7]{4}$/)); expect(new Set(codes).size).toBe(10);
});
it('정규화: 대문자·공백·하이픈 없음도 같은 해시', () => {
  expect(hashRecoveryCode(' ABCD 2345 ')).toBe(hashRecoveryCode('abcd-2345'));
});
```

- [ ] **Step 2: 실패 확인** — 두 파일 실행 → FAIL.
- [ ] **Step 3: 구현.**
- [ ] **Step 4: 통과 확인.**
- [ ] **Step 5: 커밋** — `feat(auth): MFA 비밀 키 암호화와 복구 코드`

### Task 3: 시도 저장소

**Files:**
- Create: `src/core/auth/mfa/types.ts`(이 Task 에서는 아래 저장소 타입과 상수만), `src/core/auth/mfa/attempt-store.ts`
- Test: `__tests__/unit/auth/mfa/attempt-store.test.ts`

**Interfaces:**
- Produces (`types.ts`):
  - `MFA_LIMITS = { pendingTtlSec: 300, perPendingMaxFailures: 5, perUserMaxFailures: 10, userWindowSec: 900, lockSec: 900 } as const`
  - `interface MfaAttemptStore { consumePending(jti: string, ttlSec: number): Promise<boolean>; isPendingConsumed(jti: string): Promise<boolean>; recordPendingFailure(jti: string, ttlSec: number): Promise<number>; recordUserFailure(userId: string, windowSec: number): Promise<number>; lock(userId: string, ttlSec: number): Promise<void>; lockedFor(userId: string): Promise<number>; clearUser(userId: string): Promise<void> }` — `consumePending` 은 처음이면 true, `lockedFor` 는 남은 초(없으면 0), `record*` 는 누적 횟수 반환. 사용자 실패 창은 첫 실패 시각부터 고정.
- Produces (`attempt-store.ts`):
  - `interface MfaAttemptCache { get<T>(key: string): Promise<T | null>; set<T>(key: string, value: T, ttl?: number): Promise<void>; delete(key: string): Promise<void>; setIfNotExists?<T>(key: string, value: T, ttl?: number): Promise<boolean> }`
  - `createCacheMfaAttemptStore(cache: MfaAttemptCache, opts?: { prefix?: string; now?: () => number }): MfaAttemptStore` — 기본 prefix `'mfa:'`. `consumePending` 은 `setIfNotExists` 가 있으면 그것을 쓴다. 횟수는 get→set(원자적이지 않음을 주석에 명시).
  - `createInMemoryMfaAttemptStore(opts?: { now?: () => number }): MfaAttemptStore` — `Map` + 만료 시각, 외부 의존 없음.

- [ ] **Step 1: 실패하는 테스트 작성** — 두 구현에 같은 시나리오를 `describe.each` 로 돌린다(캐시 구현은 테스트 안의 Map 기반 가짜 캐시로).

```ts
it('consumePending 은 한 번만 true', async () => {
  expect(await s.consumePending('j', 300)).toBe(true); expect(await s.consumePending('j', 300)).toBe(false);
  expect(await s.isPendingConsumed('j')).toBe(true);
});
it('사용자 실패 창은 첫 실패부터 900초', async () => {
  expect(await s.recordUserFailure('u', 900)).toBe(1); clock += 899_000;
  expect(await s.recordUserFailure('u', 900)).toBe(2); clock += 2_000;
  expect(await s.recordUserFailure('u', 900)).toBe(1);
});
it('lock 과 남은 초, clearUser', async () => {
  await s.lock('u', 900); clock += 100_000; expect(await s.lockedFor('u')).toBe(800);
  await s.clearUser('u'); expect(await s.lockedFor('u')).toBe(0);
});
it('대기 토큰별 실패 횟수', async () => {
  expect(await s.recordPendingFailure('j', 300)).toBe(1); expect(await s.recordPendingFailure('j', 300)).toBe(2);
});
```

- [ ] **Step 2–4: 실패 확인 → 구현 → 통과.**
- [ ] **Step 5: 커밋** — `feat(auth): MFA 시도 횟수·잠금 저장소`

### Task 4: MFA 저장소 인터페이스 · Prisma 어댑터

**Files:**
- Modify: `src/core/auth/mfa/types.ts`
- Create: `src/prisma/auth-adapter/mfa-repository.ts`
- Modify: `src/prisma/auth-adapter/index.ts`(재수출), `docs/MODULE_USAGE.md`(Prisma 스키마 조각)
- Test: `__tests__/unit/auth/prisma-mfa-repository.test.ts`

**Interfaces:**
- Produces (`types.ts`):
  - `interface UserMfaRecord { userId: string; secretEnc: string; enabledAt: Date | null; lastUsedStep: number | null }`
  - `interface MfaRepository { findByUserId(userId: string): Promise<UserMfaRecord | null>; savePendingSecret(userId: string, secretEnc: string): Promise<void>; enable(userId: string, recoveryCodeHashes: string[]): Promise<void>; disable(userId: string): Promise<void>; markStepUsed(userId: string, step: number): Promise<boolean>; consumeRecoveryCode(userId: string, codeHash: string): Promise<boolean>; replaceRecoveryCodes(userId: string, codeHashes: string[]): Promise<void>; countUnusedRecoveryCodes(userId: string): Promise<number> }`
    - `savePendingSecret`: upsert(enabledAt=null, lastUsedStep=null), 그 사용자의 복구 코드 삭제.
    - `enable`: enabledAt=now, 복구 코드 교체(한 트랜잭션).
    - `disable`: `UserMfa`·복구 코드 삭제.
    - `markStepUsed`: `updateMany where {userId, OR:[{lastUsedStep:null},{lastUsedStep:{lt:step}}]}` → `count===1`.
    - `consumeRecoveryCode`: `updateMany where {userId, codeHash, usedAt:null}` → `count===1`.
- Produces (prisma): `class PrismaMfaRepository implements MfaRepository { constructor(prisma: PrismaClientLike, config?: { userMfaModel?: string; recoveryCodeModel?: string }) }` — 기본 모델 `userMfa`·`mfaRecoveryCode`.
- 스키마 조각(MODULE_USAGE.md 에 그대로 싣는다):

```prisma
model UserMfa {
  userId       String    @id
  secretEnc    String
  enabledAt    DateTime?
  lastUsedStep Int?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  user         User      @relation(fields: [userId], references: [id], onDelete: Cascade)
}
model MfaRecoveryCode {
  id        String    @id @default(cuid())
  userId    String
  codeHash  String
  usedAt    DateTime?
  createdAt DateTime  @default(now())
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([userId, codeHash])
  @@index([userId])
}
```

- [ ] **Step 1: 실패하는 테스트 작성** — 기존 `prisma-adapter.test.ts` 처럼 `updateMany`·`upsert`·`deleteMany`·`$transaction` 을 가진 가짜 prisma 로:
  `markStepUsed` 가 `count:1`→true·`count:0`→false, where 절에 `lt: step` 포함; `consumeRecoveryCode` where 에 `usedAt: null`; `enable` 이 `$transaction` 안에서 deleteMany→createMany→update 순; 모델 이름 설정이 반영되는지.
- [ ] **Step 2–4: 실패 확인 → 구현 → 통과.**
- [ ] **Step 5: 커밋** — `feat(prisma): MFA 저장소 어댑터와 스키마 문서`

### Task 5: JWT — `amr` 클레임과 대기 토큰

**Files:**
- Modify: `src/core/auth/types/index.ts`(`JWTPayload.amr?: string[]`), `src/core/auth/jwt/index.ts`, `src/core/auth/services/token-refresh.service.ts`
- Create: `src/core/auth/mfa/amr.ts`
- Test: `__tests__/unit/auth/jwt-service.test.ts`(추가), `__tests__/unit/auth/services/token-refresh.service.test.ts`(추가)

**Interfaces:**
- Produces:
  - `AMR = { PASSWORD: 'pwd', FEDERATED: 'fed', OTP: 'otp', RECOVERY: 'rec', MFA: 'mfa' } as const` (`amr.ts`)
  - `createTokenPair(user, options?: { jti?: string; familyId?: string; amr?: string[] })` — `amr` 이 있을 때만 access·refresh 양쪽에 싣는다.
  - `createRefreshToken(userId, options?: { jti?; familyId?; amr?: string[] })`, `verifyRefreshToken` 반환에 `amr?: string[]`.
  - `interface MfaPendingClaims { userId: string; amr: string[]; origin: 'password' | 'oauth'; provider?: string }`
  - `createMfaPendingToken(claims: MfaPendingClaims, ttlSec?: number): Promise<{ token: string; jti: string }>` — 기본 300초, `tokenType:'mfa_pending'`, 새 `jti`.
  - `verifyMfaPendingToken(token: string): Promise<MfaPendingClaims & { jti: string }>` — tokenType 이 다르면 `JWTError`.
  - `TokenRefreshService.refresh` — 옛 refresh 의 `amr` 를 새 access·refresh 에 옮긴다. 없으면 넣지 않는다.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
it('amr 을 주면 access·refresh 에 실린다, 안 주면 클레임 자체가 없다', async () => {
  const withAmr = await svc.createTokenPair(user, { amr: ['pwd', 'otp', 'mfa'] });
  expect((await svc.verifyAccessToken(withAmr.accessToken)).amr).toEqual(['pwd', 'otp', 'mfa']);
  expect((await svc.verifyRefreshToken(withAmr.refreshToken)).amr).toEqual(['pwd', 'otp', 'mfa']);
  const plain = await svc.createTokenPair(user);
  expect(decodeJwt(plain.accessToken)).not.toHaveProperty('amr');
});
it('대기 토큰 왕복', async () => {
  const { token, jti } = await svc.createMfaPendingToken({ userId: 'u1', amr: ['pwd'], origin: 'password' });
  expect(await svc.verifyMfaPendingToken(token)).toMatchObject({ userId: 'u1', amr: ['pwd'], origin: 'password', jti });
});
it('대기 토큰은 access·refresh 로 쓸 수 없다', async () => {
  const { token } = await svc.createMfaPendingToken({ userId: 'u1', amr: ['pwd'], origin: 'password' });
  await expect(svc.verifyAccessToken(token)).rejects.toThrow();
  await expect(svc.verifyRefreshToken(token)).rejects.toThrow();
});
it('access 토큰은 대기 토큰으로 쓸 수 없다', async () => {
  await expect(svc.verifyMfaPendingToken((await svc.createTokenPair(user)).accessToken)).rejects.toThrow();
});
// token-refresh.service.test.ts
it('회전 시 amr 유지', async () => { /* amr 실린 refresh 로 refresh() → 새 access·refresh 의 amr 동일 */ });
```

- [ ] **Step 2: 실패 확인.** `verifyRefreshToken` 이 tokenType 을 검사하지 않으면 그 검사도 이 Task 에서 추가한다.
- [ ] **Step 3: 구현.**
- [ ] **Step 4: 통과 확인** — 두 테스트 파일 + `__tests__/unit/auth/handlers` 전체(회귀).
- [ ] **Step 5: 커밋** — `feat(auth): 토큰 amr 클레임과 MFA 대기 토큰`

### Task 6: `MfaService`

**Files:**
- Create: `src/core/auth/mfa/mfa.service.ts`, `src/core/auth/mfa/index.ts`(이 디렉터리의 공개 부품 재수출)
- Modify: `src/core/auth/errors/index.ts`(`MfaLockedError`)
- Test: `__tests__/unit/auth/mfa/mfa.service.test.ts`, 테스트용 가짜 `__tests__/unit/auth/mfa/fakes.ts`(`InMemoryMfaRepository`)

**Interfaces:**
- Consumes: Task 1–5 의 모든 부품.
- Produces:
  - `type MfaProof = { code: string } | { recoveryCode: string }`
  - `class MfaLockedError extends AuthError { retryAfter: number }` — code `'MFA_LOCKED'`, status 429.
  - `class MfaService`
    - `constructor(cfg: { repository: MfaRepository; attemptStore: MfaAttemptStore; secretBox: SecretBox; issuer: string; now?: () => number; onFailure?: (userId: string, reason: 'invalid_code' | 'locked') => Promise<void>; onLocked?: (userId: string) => Promise<void> })`
    - `isEnabled(userId): Promise<boolean>` — 레코드가 있고 `enabledAt` 이 있을 때.
    - `status(userId): Promise<{ enabled: boolean; recoveryCodesRemaining: number }>`
    - `beginSetup(userId, account: string): Promise<{ secret: string; otpauthUri: string }>` — 켜져 있으면 `AuthError('…','MFA_ALREADY_ENABLED',409)`.
    - `enable(userId, code: string): Promise<{ recoveryCodes: string[] }>` — 진행 중 레코드가 없으면 `MFA_NOT_ENABLED`(409), 이미 켜져 있으면 `MFA_ALREADY_ENABLED`.
    - `disable(userId, proof: MfaProof): Promise<'code' | 'recoveryCode'>` — 켜져 있지 않으면 `MFA_NOT_ENABLED`.
    - `regenerateRecoveryCodes(userId, code: string): Promise<{ recoveryCodes: string[] }>` — TOTP 코드만 받는다.
    - `verifyChallenge(userId, proof: MfaProof, pendingJti: string): Promise<'otp' | 'rec'>`
  - `resetMfa(deps: { repository: MfaRepository; attemptStore: MfaAttemptStore }, userId: string): Promise<void>` — disable + clearUser(운영자 초기화용).
- 증명 확인 순서(모든 공개 메서드 공통, `pendingJti` 는 `verifyChallenge` 만):
  1. `lockedFor(userId) > 0` → `MfaLockedError`(retryAfter=남은 초), `onFailure(userId,'locked')`.
  2. `pendingJti` 가 이미 소비됐으면 `AuthError('MFA_PENDING_EXPIRED',401)`.
  3. TOTP: `verifyTotp` → 스텝 → `markStepUsed` 가 false 면 실패로 본다(재사용). 복구 코드: `consumeRecoveryCode(hashRecoveryCode)`.
  4. 실패: `recordUserFailure` → 10 이상이면 `lock(900)` + `onLocked` + `MfaLockedError(900)`. 아니면 `pendingJti` 가 있을 때 `recordPendingFailure` → 5 이상이면 `consumePending`(폐기) 후 `MFA_PENDING_EXPIRED`. 그 밖은 `AuthError('MFA_INVALID_CODE',401)`. 모두 `onFailure(userId,'invalid_code')` 를 먼저 부른다.
  5. `verifyChallenge` 성공: `consumePending(jti)` 가 false 면 `MFA_PENDING_EXPIRED`(경쟁). 성공 시 `clearUser` 는 하지 않는다(실패 창은 시간으로 만료).

- [ ] **Step 1: 실패하는 테스트 작성** — 가짜 시계와 `createInMemoryMfaAttemptStore`, `InMemoryMfaRepository` 로:
  - 등록 흐름: `beginSetup` → `totpCode(secret, step)` 로 `enable` → 복구 코드 10개, `isEnabled` true, `status.recoveryCodesRemaining` 10.
  - 켜진 상태에서 `beginSetup` → `MFA_ALREADY_ENABLED`.
  - **같은 코드 두 번**: 첫 `verifyChallenge(u, {code}, 'j1')` 'otp', 같은 코드로 `'j2'` → `MFA_INVALID_CODE`.
  - 복구 코드: `verifyChallenge(u,{recoveryCode: codes[0].toUpperCase()},'j3')` → 'rec', 같은 코드 다시 → 실패, 남은 9개.
  - 대기 토큰 5회 실패 → 다섯 번째가 `MFA_PENDING_EXPIRED`, 이후 올바른 코드도 같은 jti 로 `MFA_PENDING_EXPIRED`.
  - 사용자 10회 실패(서로 다른 jti 2개에 걸쳐) → 열 번째가 `MfaLockedError` retryAfter 900, `onLocked` 1회 호출, 잠긴 동안 올바른 코드도 `MfaLockedError`, 900초 뒤 통과.
  - `disable` 실패도 사용자 실패 횟수에 들어간다(관리 엔드포인트 합산).
  - `regenerateRecoveryCodes` 후 옛 복구 코드 실패, 새 코드 성공.
  - `resetMfa` 후 `isEnabled` false, `lockedFor` 0.
- [ ] **Step 2–4: 실패 확인 → 구현 → 통과.**
- [ ] **Step 5: 커밋** — `feat(auth): MfaService(등록·검증·해제·잠금)`

### Task 7: 처리기 옵션 · 오류 코드 · 대기 토큰 전달

**Files:**
- Modify: `src/next/auth-types/handler-types.ts`, `src/core/constants/error-codes.ts`, `src/next/error/error-handler.ts`(`AUTH_ERROR_CODE_MAP`), `src/core/error/messages/{ko,en,ja}.ts`
- Create: `src/next/auth-handlers/mfa-runtime.ts`, `src/next/auth-handlers/mfa-pending.ts`
- Test: `__tests__/unit/auth/handlers/mfa-runtime.test.ts`

**Interfaces:**
- Produces (`handler-types.ts`):
  - `AuthHandlerOptions.mfa?: { enabled: boolean; issuer: string; encryptionKeys: string[]; repository: MfaRepository; attemptStore?: MfaAttemptStore; cookiePath?: string }`
  - `AuthHandlerUrls.mfaChallenge?: string`
  - `AuthHandlerHooks` 추가: `onMfaEnabled?(user: BaseUser): Promise<void>`, `onMfaDisabled?(user: BaseUser, by: 'code' | 'recoveryCode'): Promise<void>`, `onMfaFailed?(userId: string, reason: 'invalid_code' | 'locked'): Promise<void>`, `onMfaLocked?(user: BaseUser): Promise<void>`
- 오류 key(숫자는 아래를 쓰되 이미 쓰인 번호면 같은 대역의 빈 번호로 바꾸고 커밋 메시지에 적는다):
  `MFA_REQUIRED` 40120, `MFA_INVALID_CODE` 40121, `MFA_PENDING_EXPIRED` 40122, `MFA_NOT_CONFIGURED` 40420, `MFA_ALREADY_ENABLED` 40920, `MFA_NOT_ENABLED` 40921, `MFA_LOCKED` 42920. 사용자 문구 ko/en/ja 를 모두 쓴다(예 ko: "인증 앱의 6자리 코드를 입력하세요" / "코드가 올바르지 않습니다" / "인증 시간이 지났습니다. 다시 로그인하세요" / "2단계 인증 기능이 꺼져 있습니다" / "이미 2단계 인증을 사용 중입니다" / "2단계 인증을 사용하고 있지 않습니다" / "시도가 너무 많습니다. 잠시 후 다시 시도하세요").
- Produces (`mfa-runtime.ts`):
  - `interface MfaRuntime { service: MfaService; jwtService: JWTService; attemptStore: MfaAttemptStore; cookiePath: string }`
  - `getMfaRuntime(options: AuthHandlerOptions): MfaRuntime | null` — `mfa?.enabled` 가 아니면 null. `options.mfa` 객체 기준 `WeakMap` 으로 한 번만 만든다(처리기들이 같은 `attemptStore` 를 공유). `urls.mfaChallenge` 가 없으면 `Error`. `attemptStore` 가 없으면 `createInMemoryMfaAttemptStore()` + `dependencies.logger?.warn('MFA attemptStore not set — in-memory store is single-instance only')` 한 번. `onFailure`·`onLocked` 를 hooks 에 연결(`onLocked` 는 `userRepository.findById` 로 사용자를 찾아 `onMfaLocked`).
- Produces (`mfa-pending.ts`):
  - `MFA_PENDING_COOKIE = 'mfa_pending'`
  - `setMfaPendingCookie(res: NextResponse, token: string, opts: { secure?: boolean; path: string })` / `clearMfaPendingCookie(res, opts)` — maxAge 300 / 0, httpOnly, sameSite 'lax', 이름 `authCookieName(MFA_PENDING_COOKIE)`.
  - `mfaRequiredResponse(request, respond, token: string, options: AuthHandlerOptions, runtime: MfaRuntime): NextResponse` — 401 `MFA_REQUIRED` 표준 오류 본문. 전달 모드가 header·hybrid 면 본문 최상위에 `mfaToken` 을 더하고, cookie·hybrid 면 쿠키를 붙인다.
  - `readMfaPendingToken(request: NextRequest, body: unknown): string | null` — 쿠키 우선, 없으면 본문 `mfaToken`.

- [ ] **Step 1: 실패하는 테스트 작성** — `getMfaRuntime`: 꺼짐이면 null; 같은 options 로 두 번 부르면 같은 객체; `mfaChallenge` 없으면 throw; 저장소 없으면 warn 1회. `mfaRequiredResponse`: cookie 모드는 쿠키만(`mfaToken` 없음), header 모드는 본문 `mfaToken` 만(쿠키 없음), hybrid 는 둘 다; 상태 401, `error.key==='MFA_REQUIRED'`, `error.code===40120`.
- [ ] **Step 2–4: 실패 확인 → 구현 → 통과.**
- [ ] **Step 5: 커밋** — `feat(auth): MFA 처리기 옵션·오류 코드·대기 토큰 전달`

### Task 8: 비밀번호 로그인 분기 · 세션 발급기

**Files:**
- Modify: `src/next/auth-handlers/session.ts`, `src/next/auth-handlers/login.handler.ts`
- Test: `__tests__/unit/auth/handlers/mfa-login.test.ts`

**Interfaces:**
- Consumes: `getMfaRuntime`, `mfaRequiredResponse`, `AMR`.
- Produces: `issueSession(user, request, extraBody = {}, status = 200, ctx?: { amr?: string[]; callAfterLogin?: boolean })` — `ctx.amr` 를 `createTokenPair` 에 넘기고, `callAfterLogin === false` 면 `onAfterLogin` 을 부르지 않는다(기본 true). `updateLastLoginAt` 은 항상 부른다.
- 로그인: 이메일 인증 검사 뒤 `runtime && await runtime.service.isEnabled(user.id)` 면 `createMfaPendingToken({ userId, amr: ['pwd'], origin: 'password' })` → `mfaRequiredResponse`. 이때 `updateLastLoginAt`·`onAfterLogin` 은 부르지 않는다. MFA 를 안 켠 사용자는 `issueSession(user, req, {}, 200, { amr: runtime ? ['pwd'] : undefined })`.

- [ ] **Step 1: 실패하는 테스트 작성**
  - MFA 켠 사용자: 401 `MFA_REQUIRED`, `mfa_pending` 쿠키 있음, `access_token`·`refresh_token` 쿠키 없음, `updateLastLoginAt`·`onAfterLogin` 미호출.
  - 비밀번호가 틀리면 MFA 여부와 관계없이 `INVALID_CREDENTIALS`(대기 토큰 없음).
  - `emailVerificationRequired` 이고 미인증이면 `EMAIL_NOT_VERIFIED` 가 MFA 보다 먼저.
  - MFA 기능은 켰지만 사용자는 안 켬: 200, access 토큰 `amr` = `['pwd']`.
  - **`mfa` 미설정 회귀:** 200, 본문 키 집합이 0.29 와 같고 access 토큰에 `amr` 없음.
- [ ] **Step 2–4: 실패 확인 → 구현 → 통과** (`__tests__/unit/auth/handlers` 전체도 실행).
- [ ] **Step 5: 커밋** — `feat(auth): 비밀번호 로그인에 MFA 단계 추가`

### Task 9: OAuth 콜백 분기

**Files:**
- Modify: `src/core/auth/services/oauth-callback.service.ts`, `src/next/auth-handlers/oauth-callback.handler.ts`
- Test: `__tests__/unit/auth/services/oauth-callback.service.test.ts`(추가), `__tests__/unit/auth/handlers/mfa-oauth.test.ts`

**Interfaces:**
- Produces (서비스):
  - `resolveUser(input: OAuthCallbackInput): Promise<{ user: BaseUser; isNewUser: boolean }>` — 기존 세 갈래(연결 갱신·기존 이메일 연결·신규 생성)와 모든 보안 검사를 그대로 옮긴다. `updateLastLoginAt`·토큰 생성은 하지 않는다.
  - `issueTokens(user: BaseUser, opts?: { amr?: string[] }): Promise<TokenPair>`
  - `handleCallback` 은 `resolveUser` → (신규가 아니면) `updateLastLoginAt` → `issueTokens` 로 다시 구성한다. 반환값과 호출 순서가 기존 테스트 그대로 통과해야 한다.
- 처리기: `resolveUser` 뒤 `runtime && !isNewUser && await runtime.service.isEnabled(user.id)` 면 `createMfaPendingToken({ userId, amr: ['fed'], origin: 'oauth', provider })` → `urls.mfaChallenge`(기준 `urls.baseUrl`)로 리디렉션, `setMfaPendingCookie`, state 쿠키 삭제. 이 경로는 `updateLastLoginAt`·`onAfterOAuth`·토큰 생성을 하지 않는다. 그 밖은 기존 순서(`updateLastLoginAt`·`issueTokens({ amr: runtime ? ['fed'] : undefined })`·`onAfterOAuth`·`onOAuthFirstLogin`)를 유지한다. 주의: 기존 신규 사용자 경로는 `updateLastLoginAt` 을 부르지 않았으므로 그대로 둔다.

- [ ] **Step 1: 실패하는 테스트 작성**
  - MFA 켠 기존 사용자: 302 → `mfaChallenge`, `mfa_pending` 쿠키 있음, **access·refresh 쿠키 없음**, `onAfterOAuth`·`updateLastLoginAt` 미호출, state 쿠키 삭제.
  - MFA 안 켠 사용자·`mfa` 미설정: 기존 테스트(`handlers.test.ts`·`oauth-callback.service.test.ts`) 무변경 통과.
  - 미검증 이메일 연결 거부 등 보안 오류는 MFA 이전에 그대로 난다.
- [ ] **Step 2–4: 실패 확인 → 구현 → 통과.**
- [ ] **Step 5: 커밋** — `feat(auth): OAuth 콜백에 MFA 단계 추가`

### Task 10: `/mfa/*` 처리기 · `/me` · 비밀번호 재설정 연계

**Files:**
- Create: `src/next/auth-handlers/mfa.handlers.ts`
- Modify: `src/next/auth-handlers/index.ts`(`AuthRouteHandlers`·`createAuthHandlers`·재수출), `src/next/auth-handlers/me.handler.ts`, `src/next/auth-handlers/reset-password.handler.ts`
- Test: `__tests__/unit/auth/handlers/mfa-handlers.test.ts`

**Interfaces:**
- Produces: `createMfaVerifyHandler`, `createMfaStatusHandler`, `createMfaSetupHandler`, `createMfaEnableHandler`, `createMfaDisableHandler`, `createMfaRecoveryCodesHandler` — 모두 `(options: AuthHandlerOptions) => (req: NextRequest) => Promise<Response>`. `AuthRouteHandlers` 에 `mfaVerify`·`mfaStatus`·`mfaSetup`·`mfaEnable`·`mfaDisable`·`mfaRecoveryCodes` 추가.
- 공통: `getMfaRuntime` 가 null 이면 404 `MFA_NOT_CONFIGURED`. 본문 검증은 zod: `{ code: /^\d{6}$/ }` 또는 `{ recoveryCode: string(1..32) }`(verify·disable 은 둘 중 하나, enable·recovery-codes 는 code 만). `MfaLockedError` 는 429 + `Retry-After` 헤더 + 본문 최상위 `retryAfter`.
- 관리 처리기(status·setup·enable·disable·recovery-codes): `/me` 와 같은 방식으로 access 토큰 → 사용자. 없으면 401 `UNAUTHORIZED`.
  - status → `{ success: true, enabled, recoveryCodesRemaining }`
  - setup → `{ success: true, secret, otpauthUri }`(account = user.email)
  - enable → `{ success: true, recoveryCodes }` + `onMfaEnabled(user)`
  - disable → `{ success: true }` + `onMfaDisabled(user, by)`
  - recovery-codes → `{ success: true, recoveryCodes }`
- verify: `readMfaPendingToken` → 없거나 검증 실패면 401 `MFA_PENDING_EXPIRED`. `verifyChallenge` 성공 시 사용자 조회(없거나 `isActive===false` 면 401 `MFA_PENDING_EXPIRED`) → `issueSession(user, req, extra, 200, { amr: [...pending.amr, method, 'mfa'], callAfterLogin: origin === 'password' })`, `origin==='oauth'` 면 `extra.redirectTo = urls.afterOAuth ?? urls.afterLogin ?? '/'` 이고 `onAfterOAuth(user, provider, false)` 호출. 응답에 `clearMfaPendingCookie`. 실패 응답에서는 대기 쿠키를 지우지 않는다(`MFA_PENDING_EXPIRED` 일 때만 지운다).
- `/me`: 런타임이 있으면 `mfaEnabled` 를 `extendUserResponse` 결과보다 **먼저** 넣는다(소비자가 덮어쓸 수 있게).
- 비밀번호 재설정 성공 후 런타임이 있으면 그 사용자의 `attemptStore.clearUser(userId)`.

- [ ] **Step 1: 실패하는 테스트 작성** — 실제 `JWTService`·`MfaService`, 가짜 저장소로 처리기를 직접 호출:
  - 로그인(Task 8) → 쿠키의 대기 토큰으로 verify 성공: 200, access·refresh 쿠키, access `amr` = `['pwd','otp','mfa']`, 대기 쿠키 삭제, `onAfterLogin` 1회.
  - header 모드: 본문 `mfaToken` 으로 verify 성공.
  - OAuth 출신 대기 토큰: 본문 `redirectTo`, `onAfterOAuth(user, 'google', false)`, `onAfterLogin` 미호출, `amr` = `['fed','otp','mfa']`.
  - 대기 토큰으로 두 번 verify → 두 번째 `MFA_PENDING_EXPIRED`.
  - 잠김: 429, `Retry-After: 900`, 본문 `retryAfter: 900`.
  - setup→enable→status(enabled true, 10)→disable(복구 코드)→status(false). 로그인 없이 관리 처리기 → 401.
  - `mfa` 미설정이면 6개 처리기 모두 404 `MFA_NOT_CONFIGURED`. `/me` 에 `mfaEnabled` 없음.
  - 재설정 후 잠금 해제.
- [ ] **Step 2–4: 실패 확인 → 구현 → 통과** (`__tests__/unit/auth` 전체).
- [ ] **Step 5: 커밋** — `feat(auth): MFA 검증·관리 처리기`

### Task 11: 공개 경로 · 문서 · 버전

**Files:**
- Modify: `package.json`(exports: `./core/auth/mfa`, `./core/auth/mfa/totp`, `./core/auth/mfa/secret-box`, `./core/auth/mfa/recovery-codes`, `./core/auth/mfa/attempt-store`, `./core/auth/mfa/mfa.service`, `./core/auth/mfa/types`, `./core/auth/mfa/amr`, `./next/auth-handlers/mfa.handlers`, `./prisma/auth-adapter/mfa-repository` 와 기존 패턴의 `types` 항목; version `0.30.0`)
- Modify: `CHANGELOG.md`(0.30.0 — 추가 항목, 기본 꺼짐, 소비자 설정 예시, 디스패치 라우트에 추가할 6줄), `docs/MODULE_STRUCTURE.md`, `docs/FRAMEWORK_TIERS.md`, `src/core/auth/README.md`, `README.ko.md`(인증 절에 MFA 한 단락)

- [ ] **Step 1:** exports 추가 후 `npm run build` 성공 확인.
- [ ] **Step 2:** `npm test` 전체 통과 확인(`exports-integrity` 포함). 실패하면 원인을 고치고 다시 실행.
- [ ] **Step 3:** 문서·CHANGELOG·버전 갱신. CHANGELOG 에 소비자 디스패치 예시를 싣는다:
  `POST mfa/verify → mfaVerify`, `GET mfa → mfaStatus`, `POST mfa/setup → mfaSetup`, `POST mfa/enable → mfaEnable`, `POST mfa/disable → mfaDisable`, `POST mfa/recovery-codes → mfaRecoveryCodes`.
- [ ] **Step 4: 커밋** — `docs: MFA 문서와 공개 경로, 0.30.0` (버전 올림을 같은 커밋에 포함하지 않으려면 `chore: bump version to 0.30.0` 로 나눈다).
