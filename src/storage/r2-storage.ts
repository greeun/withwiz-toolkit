/**
 * CloudFlare R2 Storage Service
 *
 * S3 호환 API를 사용하는 CloudFlare R2 오브젝트 스토리지 클라이언트.
 * 다중 인스턴스 환경에서 파일 공유를 위해 로컬 파일시스템 대신 사용.
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { AppError } from '@withwiz/error/app-error';
import { getStorageConfig } from './config';
import type { ResolvedStorageConfig } from './config';

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrl?: string; // 커스텀 도메인 또는 R2 퍼블릭 URL
}

interface UploadResult {
  key: string;
  url: string;
  size: number;
}

let r2Client: S3Client | null = null;
let r2Config: R2Config | null = null;

function getConfig(): R2Config | null {
  if (r2Config) return r2Config;

  let storageConfig: ResolvedStorageConfig;
  try {
    storageConfig = getStorageConfig();
  } catch {
    return null; // Storage not initialized = R2 disabled
  }

  r2Config = {
    accountId: storageConfig.accountId,
    accessKeyId: storageConfig.accessKeyId,
    secretAccessKey: storageConfig.secretAccessKey,
    bucketName: storageConfig.bucketName,
    publicUrl: storageConfig.publicUrl,
  };
  return r2Config;
}

function getClient(): S3Client | null {
  const config = getConfig();
  if (!config) return null;

  if (!r2Client) {
    r2Client = new S3Client({
      region: 'auto',
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  return r2Client;
}

/**
 * R2가 활성화되어 있는지 확인
 */
export function isR2Enabled(): boolean {
  return getConfig() !== null;
}

/**
 * R2에 파일 업로드
 */
export async function uploadToR2(
  key: string,
  body: Buffer,
  contentType: string
): Promise<UploadResult> {
  const client = getClient();
  const config = getConfig();

  if (!client || !config) {
    throw AppError.serviceUnavailable('R2 storage is not configured');
  }

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucketName,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );

  const url = config.publicUrl
    ? `${config.publicUrl.replace(/\/$/, '')}/${key}`
    : `https://${config.bucketName}.${config.accountId}.r2.cloudflarestorage.com/${key}`;

  return {
    key,
    url,
    size: body.length,
  };
}

/**
 * R2에서 파일 삭제
 */
export async function deleteFromR2(key: string): Promise<void> {
  const client = getClient();
  const config = getConfig();

  if (!client || !config) {
    throw AppError.serviceUnavailable('R2 storage is not configured');
  }

  await client.send(
    new DeleteObjectCommand({
      Bucket: config.bucketName,
      Key: key,
    })
  );
}

/**
 * R2에서 파일 조회
 */
export async function getFromR2(key: string): Promise<{ body: ReadableStream; contentType: string } | null> {
  const client = getClient();
  const config = getConfig();

  if (!client || !config) {
    throw AppError.serviceUnavailable('R2 storage is not configured');
  }

  try {
    const response = await client.send(
      new GetObjectCommand({
        Bucket: config.bucketName,
        Key: key,
      })
    );

    if (!response.Body) return null;

    return {
      body: response.Body as unknown as ReadableStream,
      contentType: response.ContentType || 'application/octet-stream',
    };
  } catch (error: any) {
    if (error.name === 'NoSuchKey') return null;
    throw error;
  }
}
