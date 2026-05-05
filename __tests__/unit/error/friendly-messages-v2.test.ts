/**
 * Friendly Messages V2 Unit Tests
 *
 * Tests for src/error/friendly-messages-v2.ts
 * - getFriendlyMessage
 * - getErrorDisplayInfo
 * - formatFriendlyError
 */
import { describe, it, expect } from 'vitest';

describe('friendly-messages-v2', () => {
  // ============================================================================
  // getFriendlyMessage
  // ============================================================================
  describe('getFriendlyMessage', () => {
    it('should return IErrorMessage with title and description for known code', async () => {
      const { getFriendlyMessage } = await import('@withwiz/error/friendly-messages-v2');
      const result = getFriendlyMessage(40001, 'ko');
      expect(result).toHaveProperty('title');
      expect(result).toHaveProperty('description');
      expect(result.title).toBe('입력 정보를 확인해 주세요');
      expect(result.description).toBe('입력하신 정보 중 일부가 올바르지 않습니다.');
    });

    it('should return Korean message with ko locale', async () => {
      const { getFriendlyMessage } = await import('@withwiz/error/friendly-messages-v2');
      const result = getFriendlyMessage(40101, 'ko');
      expect(result.title).toBe('로그인이 필요해요');
      expect(result.description).toBe('이 기능은 로그인이 필요합니다.');
    });

    it('should return English message with en locale', async () => {
      const { getFriendlyMessage } = await import('@withwiz/error/friendly-messages-v2');
      const result = getFriendlyMessage(40001, 'en');
      expect(result.title).toBe('Please check your input');
      expect(result.description).toBe('Some information you entered is incorrect.');
    });

    it('should return default/fallback message for unknown code', async () => {
      const { getFriendlyMessage } = await import('@withwiz/error/friendly-messages-v2');
      const result = getFriendlyMessage(99999, 'ko');
      expect(result.title).toBe('문제가 발생했어요');
      expect(result.description).toBe('예상치 못한 오류가 발생했습니다.');
    });

    it('should return default English fallback for unknown code with en locale', async () => {
      const { getFriendlyMessage } = await import('@withwiz/error/friendly-messages-v2');
      const result = getFriendlyMessage(99999, 'en');
      expect(result.title).toBe('Something went wrong');
      expect(result.description).toBe('An unexpected error occurred.');
    });

    it('should default to ko locale when locale is not provided', async () => {
      const { getFriendlyMessage } = await import('@withwiz/error/friendly-messages-v2');
      const result = getFriendlyMessage(40001);
      expect(result.title).toBe('입력 정보를 확인해 주세요');
    });

    it('should include action field when available', async () => {
      const { getFriendlyMessage } = await import('@withwiz/error/friendly-messages-v2');
      const result = getFriendlyMessage(40001, 'ko');
      expect(result.action).toBe('입력 내용을 다시 확인해 주세요.');
    });
  });

  // ============================================================================
  // getErrorDisplayInfo
  // ============================================================================
  describe('getErrorDisplayInfo', () => {
    it('should return IErrorDisplay with all required fields', async () => {
      const { getErrorDisplayInfo } = await import('@withwiz/error/friendly-messages-v2');
      const result = getErrorDisplayInfo(40001, 'ko');
      expect(result).toHaveProperty('code');
      expect(result).toHaveProperty('title');
      expect(result).toHaveProperty('description');
      expect(result).toHaveProperty('icon');
      expect(result).toHaveProperty('severity');
      expect(result.code).toBe(40001);
    });

    it('should return severity "error" and icon "🔧" for server category (500xx)', async () => {
      const { getErrorDisplayInfo } = await import('@withwiz/error/friendly-messages-v2');
      const result = getErrorDisplayInfo(50002, 'ko');
      expect(result.severity).toBe('error');
      expect(result.icon).toBe('🔧');
    });

    it('should return severity "critical" and icon "🛡️" for security category (403xx 71+)', async () => {
      const { getErrorDisplayInfo } = await import('@withwiz/error/friendly-messages-v2');
      const result = getErrorDisplayInfo(40371, 'ko');
      expect(result.severity).toBe('critical');
      expect(result.icon).toBe('🛡️');
    });

    it('should return severity "warning" and icon "⚠️" for validation category (400xx)', async () => {
      const { getErrorDisplayInfo } = await import('@withwiz/error/friendly-messages-v2');
      const result = getErrorDisplayInfo(40001, 'ko');
      expect(result.severity).toBe('warning');
      expect(result.icon).toBe('⚠️');
    });

    it('should return severity "warning" and icon "🔐" for auth category (401xx)', async () => {
      const { getErrorDisplayInfo } = await import('@withwiz/error/friendly-messages-v2');
      const result = getErrorDisplayInfo(40101, 'ko');
      expect(result.severity).toBe('warning');
      expect(result.icon).toBe('🔐');
    });

    it('should return severity "warning" and icon "🚫" for permission category (403xx 01-70)', async () => {
      const { getErrorDisplayInfo } = await import('@withwiz/error/friendly-messages-v2');
      const result = getErrorDisplayInfo(40304, 'ko');
      expect(result.severity).toBe('warning');
      expect(result.icon).toBe('🚫');
    });

    it('should return severity "info" and icon "🔍" for resource category (404xx)', async () => {
      const { getErrorDisplayInfo } = await import('@withwiz/error/friendly-messages-v2');
      const result = getErrorDisplayInfo(40401, 'ko');
      expect(result.severity).toBe('info');
      expect(result.icon).toBe('🔍');
    });

    it('should return severity "warning" and icon "⚡" for conflict category (409xx)', async () => {
      const { getErrorDisplayInfo } = await import('@withwiz/error/friendly-messages-v2');
      const result = getErrorDisplayInfo(40904, 'ko');
      expect(result.severity).toBe('warning');
      expect(result.icon).toBe('⚡');
    });

    it('should return severity "warning" and icon "📋" for business category (422xx)', async () => {
      const { getErrorDisplayInfo } = await import('@withwiz/error/friendly-messages-v2');
      const result = getErrorDisplayInfo(42201, 'ko');
      expect(result.severity).toBe('warning');
      expect(result.icon).toBe('📋');
    });

    it('should return severity "warning" and icon "⏱️" for rateLimit category (429xx)', async () => {
      const { getErrorDisplayInfo } = await import('@withwiz/error/friendly-messages-v2');
      const result = getErrorDisplayInfo(42901, 'ko');
      expect(result.severity).toBe('warning');
      expect(result.icon).toBe('⏱️');
    });

    it('should return severity "error" and icon "❌" for unknown category', async () => {
      const { getErrorDisplayInfo } = await import('@withwiz/error/friendly-messages-v2');
      const result = getErrorDisplayInfo(99999, 'ko');
      expect(result.severity).toBe('error');
      expect(result.icon).toBe('❌');
    });

    it('should include action field when message has action', async () => {
      const { getErrorDisplayInfo } = await import('@withwiz/error/friendly-messages-v2');
      const result = getErrorDisplayInfo(40001, 'ko');
      expect(result.action).toBe('입력 내용을 다시 확인해 주세요.');
    });

    it('should return English content with en locale', async () => {
      const { getErrorDisplayInfo } = await import('@withwiz/error/friendly-messages-v2');
      const result = getErrorDisplayInfo(40001, 'en');
      expect(result.title).toBe('Please check your input');
      expect(result.description).toBe('Some information you entered is incorrect.');
    });
  });

  // ============================================================================
  // formatFriendlyError
  // ============================================================================
  describe('formatFriendlyError', () => {
    it('should return formatted string with title, description, and code', async () => {
      const { formatFriendlyError } = await import('@withwiz/error/friendly-messages-v2');
      const result = formatFriendlyError(40001, 'ko');
      expect(result).toBe('입력 정보를 확인해 주세요 - 입력하신 정보 중 일부가 올바르지 않습니다. [40001]');
    });

    it('should format with English content when en locale', async () => {
      const { formatFriendlyError } = await import('@withwiz/error/friendly-messages-v2');
      const result = formatFriendlyError(40001, 'en');
      expect(result).toBe('Please check your input - Some information you entered is incorrect. [40001]');
    });

    it('should use default message for unknown code', async () => {
      const { formatFriendlyError } = await import('@withwiz/error/friendly-messages-v2');
      const result = formatFriendlyError(99999, 'ko');
      expect(result).toBe('문제가 발생했어요 - 예상치 못한 오류가 발생했습니다. [99999]');
    });

    it('should default to ko locale when not provided', async () => {
      const { formatFriendlyError } = await import('@withwiz/error/friendly-messages-v2');
      const result = formatFriendlyError(40001);
      expect(result).toContain('입력 정보를 확인해 주세요');
      expect(result).toContain('[40001]');
    });

    it('should format auth error correctly', async () => {
      const { formatFriendlyError } = await import('@withwiz/error/friendly-messages-v2');
      const result = formatFriendlyError(40101, 'ko');
      expect(result).toContain('로그인이 필요해요');
      expect(result).toContain('[40101]');
    });

    it('should format server error correctly', async () => {
      const { formatFriendlyError } = await import('@withwiz/error/friendly-messages-v2');
      const result = formatFriendlyError(50002, 'ko');
      expect(result).toContain('[50002]');
    });
  });
});
