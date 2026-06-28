import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import config from '../config';

const s3Client = new S3Client({
  endpoint: config.s3.endpoint,
  credentials: {
    accessKeyId: config.s3.accessKey,
    secretAccessKey: config.s3.secretKey,
  },
  forcePathStyle: true, // Required for MinIO
  region: 'us-east-1', // Placeholder region for S3 client compatibility
});

/**
 * Downloads an object from MinIO/S3 and returns its string content
 */
export async function downloadString(key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: config.s3.bucket,
    Key: key,
  });

  const response = await s3Client.send(command);
  if (!response.Body) {
    throw new Error(`Empty body for object: ${key}`);
  }

  return response.Body.transformToString();
}

/**
 * Downloads an object from MinIO/S3 and returns its Buffer content
 */
export async function downloadBuffer(key: string): Promise<Buffer> {
  const command = new GetObjectCommand({
    Bucket: config.s3.bucket,
    Key: key,
  });

  const response = await s3Client.send(command);
  if (!response.Body) {
    throw new Error(`Empty body for object: ${key}`);
  }

  const byteArray = await response.Body.transformToByteArray();
  return Buffer.from(byteArray);
}

export default s3Client;
