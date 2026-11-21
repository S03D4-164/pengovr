import logger from './logger.js';
//import crypto from 'crypto';
import * as fs from 'fs';
import { ZipWriter, BlobWriter, BlobReader } from '@zip.js/zip.js';
import { uploadBuffer } from './s3.js';

async function createZip(
  data: Buffer,
  filename: string,
  password: string,
): Promise<Buffer> {
  const zipWriter = new ZipWriter(new BlobWriter('application/zip'), {
    password,
    encryptionStrength: 3, // AES-256
  });

  const blob = new Blob([new Uint8Array(data)]);
  await zipWriter.add(filename, new BlobReader(blob));
  const zipBlob = await zipWriter.close();

  const arrayBuffer = await zipBlob.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function saveHarfile(
  harfile: any,
  pageId: any,
): Promise<string | undefined> {
  const buf = fs.readFileSync(harfile);
  const HAR_SIZE_LIMIT = 10 * 1024 * 1024; // 10MB

  if (buf.length > HAR_SIZE_LIMIT) {
    logger.warn(
      `[${pageId}] HAR file size (${buf.length} bytes) exceeds limit of ${HAR_SIZE_LIMIT} bytes. Skipping upload.`,
    );
    return undefined;
  }

  //logger.debug(buf.length);
  const zippedHar = await createZip(buf, `${pageId}.har`, 'infected');
  logger.debug(`[${pageId}] Compressed HAR size: ${zippedHar.length} bytes`);
  try {
    const s3Key = `webpages/${pageId}/harfile.zip`;
    await uploadBuffer(s3Key, zippedHar, 'application/zip');
    return s3Key;
  } catch (err: any) {
    logger.error(err);
    return undefined;
  }
}

export { saveHarfile, createZip };
