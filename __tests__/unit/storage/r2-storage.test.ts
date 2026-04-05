/**
 * R2 Storage Unit Tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AppError } from '@withwiz/error/app-error';
import { ERROR_CODES } from '@withwiz/constants/error-codes';
import { initializeStorage, resetStorage } from '../../../src/storage/config';

// S3Client mock
const mockSend = vi.fn();
vi.mock('@aws-sdk/client-s3', () => {
  return {
    S3Client: class MockS3Client {
      send = mockSend;
    },
    PutObjectCommand: class MockPutObjectCommand {
      constructor(public input: any) {}
    },
    DeleteObjectCommand: class MockDeleteObjectCommand {
      constructor(public input: any) {}
    },
    GetObjectCommand: class MockGetObjectCommand {
      constructor(public input: any) {}
    },
  };
});

// r2-storage를 static import로 가져옴 (resetR2로 캐시 초기화)
import { isR2Enabled, uploadToR2, deleteFromR2, getFromR2, resetR2 } from '@withwiz/storage/r2-storage';

describe('R2 Storage', () => {
  const R2_STORAGE_CONFIG = {
    accountId: 'test-account-id',
    accessKeyId: 'test-access-key',
    secretAccessKey: 'test-secret-key',
    bucketName: 'test-bucket',
    publicUrl: 'https://cdn.example.com',
  };

  beforeEach(() => {
    mockSend.mockReset();
    // 스토리지 config 및 r2 모듈 캐시 리셋
    resetStorage();
    resetR2();
  });

  afterEach(() => {
    // 스토리지 config 및 r2 모듈 캐시 리셋
    resetStorage();
    resetR2();
  });

  describe('isR2Enabled', () => {
    it('should return false when R2 env vars are not set', () => {
      expect(isR2Enabled()).toBe(false);
    });

    it('should return true when all R2 config is set', () => {
      initializeStorage(R2_STORAGE_CONFIG);
      expect(isR2Enabled()).toBe(true);
    });

    it('should return false when storage is not initialized', () => {
      // resetStorage() 이후 초기화하지 않은 상태
      expect(isR2Enabled()).toBe(false);
    });
  });

  describe('uploadToR2', () => {
    it('should throw AppError.serviceUnavailable when R2 is not configured', async () => {
      try {
        await uploadToR2('test.txt', Buffer.from('hello'), 'text/plain');
        expect.unreachable('Should have thrown');
      } catch (error: any) {
        expect(error.name).toBe('AppError');
        expect(error.code).toBe(ERROR_CODES.SERVICE_UNAVAILABLE.code);
        expect(error.status).toBe(503);
        expect(error.message).toContain('R2 storage is not configured');
      }
    });

    it('should upload file and return result with public URL', async () => {
      initializeStorage(R2_STORAGE_CONFIG);
      mockSend.mockResolvedValueOnce({});

      const body = Buffer.from('test content');
      const result = await uploadToR2('uploads/test.txt', body, 'text/plain');

      expect(result).toEqual({
        key: 'uploads/test.txt',
        url: 'https://cdn.example.com/uploads/test.txt',
        size: body.length,
      });
      expect(mockSend).toHaveBeenCalledOnce();
    });

    it('should construct default URL when publicUrl is not set', async () => {
      initializeStorage({
        accountId: R2_STORAGE_CONFIG.accountId,
        accessKeyId: R2_STORAGE_CONFIG.accessKeyId,
        secretAccessKey: R2_STORAGE_CONFIG.secretAccessKey,
        bucketName: R2_STORAGE_CONFIG.bucketName,
        // publicUrl 미설정
      });
      mockSend.mockResolvedValueOnce({});

      const result = await uploadToR2('file.jpg', Buffer.from('img'), 'image/jpeg');

      expect(result.url).toContain('test-bucket');
      expect(result.url).toContain('test-account-id');
      expect(result.url).toContain('file.jpg');
    });
  });

  describe('deleteFromR2', () => {
    it('should throw AppError.serviceUnavailable when R2 is not configured', async () => {
      try {
        await deleteFromR2('test.txt');
        expect.unreachable('Should have thrown');
      } catch (error: any) {
        expect(error.name).toBe('AppError');
        expect(error.code).toBe(ERROR_CODES.SERVICE_UNAVAILABLE.code);
      }
    });

    it('should delete file successfully', async () => {
      initializeStorage(R2_STORAGE_CONFIG);
      mockSend.mockResolvedValueOnce({});

      await expect(deleteFromR2('uploads/test.txt')).resolves.toBeUndefined();
      expect(mockSend).toHaveBeenCalledOnce();
    });
  });

  describe('getFromR2', () => {
    it('should throw AppError.serviceUnavailable when R2 is not configured', async () => {
      try {
        await getFromR2('test.txt');
        expect.unreachable('Should have thrown');
      } catch (error: any) {
        expect(error.name).toBe('AppError');
        expect(error.code).toBe(ERROR_CODES.SERVICE_UNAVAILABLE.code);
      }
    });

    it('should return file body and content type', async () => {
      initializeStorage(R2_STORAGE_CONFIG);
      const mockBody = { pipe: vi.fn() };
      mockSend.mockResolvedValueOnce({
        Body: mockBody,
        ContentType: 'image/png',
      });

      const result = await getFromR2('photo.png');

      expect(result).not.toBeNull();
      expect(result!.contentType).toBe('image/png');
      expect(result!.body).toBe(mockBody);
    });

    it('should return null when Body is empty', async () => {
      initializeStorage(R2_STORAGE_CONFIG);
      mockSend.mockResolvedValueOnce({ Body: null });

      const result = await getFromR2('missing.txt');
      expect(result).toBeNull();
    });

    it('should return null for NoSuchKey error', async () => {
      initializeStorage(R2_STORAGE_CONFIG);
      const noSuchKeyError = new Error('NoSuchKey');
      (noSuchKeyError as any).name = 'NoSuchKey';
      mockSend.mockRejectedValueOnce(noSuchKeyError);

      const result = await getFromR2('nonexistent.txt');
      expect(result).toBeNull();
    });

    it('should rethrow non-NoSuchKey errors', async () => {
      initializeStorage(R2_STORAGE_CONFIG);
      mockSend.mockRejectedValueOnce(new Error('Network error'));

      await expect(getFromR2('file.txt')).rejects.toThrow('Network error');
    });

    it('should default to application/octet-stream when ContentType is missing', async () => {
      initializeStorage(R2_STORAGE_CONFIG);
      mockSend.mockResolvedValueOnce({
        Body: { pipe: vi.fn() },
        ContentType: undefined,
      });

      const result = await getFromR2('file.bin');
      expect(result!.contentType).toBe('application/octet-stream');
    });
  });
});
