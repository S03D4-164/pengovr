import {
  S3Client,
  PutObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import config from '../config/index.js';
import { gzipSync } from 'zlib';

const s3Client = new S3Client({
  region: config.s3.region || 'us-east-1', // Placeholder region for S3 client compatibility
  credentials: {
    accessKeyId: config.s3.accessKey,
    secretAccessKey: config.s3.secretKey,
  },
  ...(config.s3.endpoint
    ? {
        endpoint: config.s3.endpoint,
        forcePathStyle: true,
      }
    : {}),
});

// Ensure bucket exists on start (useful for local MinIO testing)
let bucketChecked = false;
export async function ensureBucketExists(): Promise<void> {
  if (bucketChecked) return;
  try {
    await s3Client.send(
      new HeadBucketCommand({ Bucket: config.s3.bucket }),
    );
    bucketChecked = true;
  } catch (error: any) {
    if (
      error.name === 'NotFound' ||
      error.$metadata?.httpStatusCode === 404
    ) {
      console.log(
        `Bucket ${config.s3.bucket} not found. Creating it...`,
      );
      try {
        await s3Client.send(
          new CreateBucketCommand({
            Bucket: config.s3.bucket,
          }),
        );
        bucketChecked = true;
        console.log(
          `Bucket ${config.s3.bucket} successfully created.`,
        );
      } catch (createErr: any) {
        console.error(
          'Failed to create bucket:',
          createErr,
        );
        throw createErr;
      }
    } else {
      console.error(
        'Failed to check bucket existence:',
        error,
      );
      throw error;
    }
  }
}

/**
 * Uploads a string content to MinIO/S3
 */
export async function uploadString(
  key: string,
  body: string,
  contentType: string = 'application/json',
): Promise<string> {
  //logger.info(`[S3] Uploading string: ${key} (${body.length} bytes)`);
  await ensureBucketExists();
  const command = new PutObjectCommand({
    Bucket: config.s3.bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
  });

  await s3Client.send(command);
  return key;
}

/**
 * Uploads a string content as Gzipped JSON to MinIO/S3
 */
export async function uploadJSONGzip(
  key: string,
  body: any,
): Promise<string> {
  await ensureBucketExists();
  const jsonString =
    typeof body === 'string' ? body : JSON.stringify(body);
  const compressedBody = gzipSync(Buffer.from(jsonString));

  const command = new PutObjectCommand({
    Bucket: config.s3.bucket,
    Key: key.endsWith('.gz') ? key : `${key}.gz`,
    Body: compressedBody,
    ContentType: 'application/gzip',
  });

  await s3Client.send(command);
  return key;
}

/**
 * Uploads a Buffer content to MinIO/S3
 */
export async function uploadBuffer(
  key: string,
  body: Buffer,
  contentType: string = 'application/octet-stream',
): Promise<string> {
  //logger.info(`[S3] Uploading buffer: ${key} (${body.length} bytes)`);
  await ensureBucketExists();
  const command = new PutObjectCommand({
    Bucket: config.s3.bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
  });

  await s3Client.send(command);
  return key;
}

export default s3Client;
