/**
 * R2 Storage Unit Tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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

describe('R2 Storage', () => {
  const R2_ENV = {
    R2_ACCOUNT_ID: 'test-account-id',
    R2_ACCESS_KEY_ID: 'test-access-key',
    R2_SECRET_ACCESS_KEY: 'test-secret-key',
    R2_BUCKET_NAME: 'test-bucket',
    R2_PUBLIC_URL: 'https://cdn.example.com',
  };

  beforeEach(() => {
    vi.resetModules();
    mockSend.mockReset();
  });

  afterEach(() => {
    // 환경 변수 정리
    Object.keys(R2_ENV).forEach((key) => {
      delete process.env[key];
    });
  });

  describe('isR2Enabled', () => {
    it('should return false when R2 env vars are not set', async () => {
      const { isR2Enabled } = await import('@withwiz/storage/r2-storage');
      expect(isR2Enabled()).toBe(false);
    });

    it('should return true when all R2 env vars are set', async () => {
      Object.assign(process.env, R2_ENV);
      const { isR2Enabled } = await import('@withwiz/storage/r2-storage');
      expect(isR2Enabled()).toBe(true);
    });

    it('should return false when partial R2 env vars are set', async () => {
      process.env.R2_ACCOUNT_ID = 'test';
      // missing other required vars
      const { isR2Enabled } = await import('@withwiz/storage/r2-storage');
      expect(isR2Enabled()).toBe(false);
    });
  });

  describe('uploadToR2', () => {
    it('should throw when R2 is not configured', async () => {
      const { uploadToR2 } = await import('@withwiz/storage/r2-storage');
      await expect(uploadToR2('test.txt', Buffer.from('hello'), 'text/plain'))
        .rejects.toThrow('R2 storage is not configured');
    });

    it('should upload file and return result with public URL', async () => {
      Object.assign(process.env, R2_ENV);
      mockSend.mockResolvedValueOnce({});
      const { uploadToR2 } = await import('@withwiz/storage/r2-storage');

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
      const envWithoutPublicUrl = { ...R2_ENV };
      delete envWithoutPublicUrl.R2_PUBLIC_URL;
      Object.assign(process.env, envWithoutPublicUrl);
      mockSend.mockResolvedValueOnce({});
      const { uploadToR2 } = await import('@withwiz/storage/r2-storage');

      const result = await uploadToR2('file.jpg', Buffer.from('img'), 'image/jpeg');

      expect(result.url).toContain('test-bucket');
      expect(result.url).toContain('test-account-id');
      expect(result.url).toContain('file.jpg');
    });
  });

  describe('deleteFromR2', () => {
    it('should throw when R2 is not configured', async () => {
      const { deleteFromR2 } = await import('@withwiz/storage/r2-storage');
      await expect(deleteFromR2('test.txt')).rejects.toThrow('R2 storage is not configured');
    });

    it('should delete file successfully', async () => {
      Object.assign(process.env, R2_ENV);
      mockSend.mockResolvedValueOnce({});
      const { deleteFromR2 } = await import('@withwiz/storage/r2-storage');

      await expect(deleteFromR2('uploads/test.txt')).resolves.toBeUndefined();
      expect(mockSend).toHaveBeenCalledOnce();
    });
  });

  describe('getFromR2', () => {
    it('should throw when R2 is not configured', async () => {
      const { getFromR2 } = await import('@withwiz/storage/r2-storage');
      await expect(getFromR2('test.txt')).rejects.toThrow('R2 storage is not configured');
    });

    it('should return file body and content type', async () => {
      Object.assign(process.env, R2_ENV);
      const mockBody = { pipe: vi.fn() };
      mockSend.mockResolvedValueOnce({
        Body: mockBody,
        ContentType: 'image/png',
      });
      const { getFromR2 } = await import('@withwiz/storage/r2-storage');

      const result = await getFromR2('photo.png');

      expect(result).not.toBeNull();
      expect(result!.contentType).toBe('image/png');
      expect(result!.body).toBe(mockBody);
    });

    it('should return null when Body is empty', async () => {
      Object.assign(process.env, R2_ENV);
      mockSend.mockResolvedValueOnce({ Body: null });
      const { getFromR2 } = await import('@withwiz/storage/r2-storage');

      const result = await getFromR2('missing.txt');
      expect(result).toBeNull();
    });

    it('should return null for NoSuchKey error', async () => {
      Object.assign(process.env, R2_ENV);
      const noSuchKeyError = new Error('NoSuchKey');
      (noSuchKeyError as any).name = 'NoSuchKey';
      mockSend.mockRejectedValueOnce(noSuchKeyError);
      const { getFromR2 } = await import('@withwiz/storage/r2-storage');

      const result = await getFromR2('nonexistent.txt');
      expect(result).toBeNull();
    });

    it('should rethrow non-NoSuchKey errors', async () => {
      Object.assign(process.env, R2_ENV);
      mockSend.mockRejectedValueOnce(new Error('Network error'));
      const { getFromR2 } = await import('@withwiz/storage/r2-storage');

      await expect(getFromR2('file.txt')).rejects.toThrow('Network error');
    });

    it('should default to application/octet-stream when ContentType is missing', async () => {
      Object.assign(process.env, R2_ENV);
      mockSend.mockResolvedValueOnce({
        Body: { pipe: vi.fn() },
        ContentType: undefined,
      });
      const { getFromR2 } = await import('@withwiz/storage/r2-storage');

      const result = await getFromR2('file.bin');
      expect(result!.contentType).toBe('application/octet-stream');
    });
  });
});
