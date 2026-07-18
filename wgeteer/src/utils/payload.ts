import crypto from 'crypto';
import logger from './logger.js';
import { uploadBuffer } from './s3.js';

async function savePayload(
  responseBuffer: Buffer,
  payloadsCollector?: Array<any>,
  yaraData?: {
    rules: Array<{ id: string; tags: string[]; meta: Record<string, any> }>;
  },
): Promise<string | undefined> {
  try {
    const md5Hash = crypto
      .createHash('md5')
      .update(responseBuffer)
      .digest('hex');
    const generatedId = crypto.randomBytes(12).toString('hex');
    const s3Key = `payloads/${md5Hash}`;

    if (payloadsCollector) {
      // Avoid duplicate payloads in memory based on MD5
      const exists = payloadsCollector.some((p) => p.md5 === md5Hash);
      if (!exists) {
        // Upload to S3 immediately to save memory
        await uploadBuffer(s3Key, responseBuffer);

        payloadsCollector.push({
          _id: generatedId,
          md5: md5Hash,
          s3Key: s3Key,
          yara: yaraData,
        });
      } else {
        return payloadsCollector.find((p) => p.md5 === md5Hash)._id;
      }
    } else {
      await uploadBuffer(s3Key, responseBuffer);
    }

    return generatedId;
  } catch (err: any) {
    logger.error(err);
    return undefined;
  }
}

export { savePayload };
