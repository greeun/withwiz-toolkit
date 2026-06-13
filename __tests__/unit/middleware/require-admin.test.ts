/**
 * requireAdmin Unit Tests
 *
 * - 기본 관리자 역할('ADMIN') 검증
 * - 소비자 지정 관리자 역할(adminRole 파라미터) 검증 — 어휘 비소유 보장
 */
import { describe, it, expect } from 'vitest';
import { requireAdmin } from '@withwiz/toolkit/next/utils/api-helpers';

describe('requireAdmin', () => {
  describe('기본 관리자 역할 (ADMIN)', () => {
    it('ADMIN 역할이면 isAdmin: true 를 반환해야 한다', () => {
      const result = requireAdmin('ADMIN');
      expect(result.isAdmin).toBe(true);
    });

    it('ADMIN 이 아니면 isAdmin: false 와 403 응답을 반환해야 한다', () => {
      const result = requireAdmin('USER');
      expect(result.isAdmin).toBe(false);
      if (!result.isAdmin) {
        expect(result.response.status).toBe(403);
      }
    });
  });

  describe('소비자 지정 관리자 역할 (adminRole 파라미터)', () => {
    it('지정한 관리자 역할과 일치하면 isAdmin: true 를 반환해야 한다', () => {
      const result = requireAdmin('SUPERADMIN', 'SUPERADMIN');
      expect(result.isAdmin).toBe(true);
    });

    it('기본 ADMIN 이라도 지정 관리자 역할과 다르면 거부해야 한다', () => {
      const result = requireAdmin('ADMIN', 'SUPERADMIN');
      expect(result.isAdmin).toBe(false);
      if (!result.isAdmin) {
        expect(result.response.status).toBe(403);
      }
    });
  });
});
