import {
  S3Client,
  GetObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';
import config from '../config';

const s3Client = new S3Client({
  region: config.s3.region || 'us-east-1', // Placeholder region for S3 client compatibility
  credentials: {
    accessKeyId: config.s3.accessKey,
    secretAccessKey: config.s3.secretKey,
  },
  ...(config.s3.endpoint ? {
    endpoint: config.s3.endpoint,
    forcePathStyle: true,
  } : {}),
});

/**
 * Ensures the S3 bucket exists (creates it if missing) and empties all objects in it.
 */
export async function initializeAndEmptyBucket(): Promise<void> {
  const bucketName = config.s3.bucket;

  // 1. Connection and bucket existence check
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
    console.log(`[S3] Bucket "${bucketName}" confirmed.`);
  } catch (error: any) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      console.log(`[S3] Bucket "${bucketName}" not found. Creating...`);
      await s3Client.send(new CreateBucketCommand({ Bucket: bucketName }));
      console.log(`[S3] Bucket "${bucketName}" created successfully.`);
      return; // Newly created bucket is guaranteed to be empty
    } else {
      console.error(`[S3] Connection/Bucket check failed: ${error.message}`);
      throw error;
    }
  }

  // 2. Empty the bucket
  console.log(`[S3] Emptying bucket "${bucketName}"...`);
  try {
    let truncated = true;
    let continuationToken: string | undefined = undefined;

    while (truncated) {
      const listResponse = await s3Client.send(
        new ListObjectsV2Command({
          Bucket: bucketName,
          ContinuationToken: continuationToken,
        })
      );

      const contents = listResponse.Contents;
      if (contents && contents.length > 0) {
        const deleteObjects = contents.map((c) => ({ Key: c.Key }));
        await s3Client.send(
          new DeleteObjectsCommand({
            Bucket: bucketName,
            Delete: { Objects: deleteObjects },
          })
        );
        console.log(`[S3] Deleted ${deleteObjects.length} objects from "${bucketName}".`);
      }

      truncated = listResponse.IsTruncated ?? false;
      continuationToken = listResponse.NextContinuationToken;
    }
    console.log(`[S3] Bucket "${bucketName}" is now empty.`);
  } catch (deleteError: any) {
    console.error(`[S3] Failed to empty bucket "${bucketName}":`, deleteError.message);
    throw deleteError;
  }
}

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
