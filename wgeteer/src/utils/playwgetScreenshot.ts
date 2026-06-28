import crypto from 'crypto';
import logger from './logger.js';
import { uploadBuffer } from './s3.js';

async function imgResize(buffer: Buffer): Promise<Buffer> {
  try {
    const jimpModule: any = await import('jimp');
    // v1.x (named export) または v0.x (default export/module) をサポート
    const Jimp = jimpModule.Jimp || jimpModule.default || jimpModule;

    if (!Jimp || typeof Jimp.read !== 'function') {
      throw new Error('Jimp.read is not a function. Check jimp installation.');
    }

    const image = await Jimp.read(buffer);
    if (image.bitmap.width > 240) {
      await image.resize({ w: 240 });
      await image.crop({ x: 0, y: 0, w: 240, h: 135 });
    }
    return await image.getBuffer('image/png');
  } catch (err: any) {
    logger.warn(
      `[Screenshot] imgResize failed: ${err.message}. Returning original buffer.`,
    );
    return buffer;
  }
}

async function saveFullscreenshot(
  buff: Buffer,
  tag: Array<Record<string, unknown>>,
  screenshotsCollector?: Array<any>,
): Promise<string | undefined> {
  try {
    const md5Hash = crypto.createHash('md5').update(buff).digest('hex');
    const generatedId = crypto.randomBytes(12).toString('hex');
    const s3Key = `screenshots/${generatedId}.png`;

    logger.info(
      `[Screenshot] In-memory generating screenshot with MD5: ${md5Hash}, size: ${buff.length} bytes`,
    );

    // Upload original buffer to S3 immediately
    await uploadBuffer(s3Key, buff, 'image/png');

    const ssData = {
      _id: generatedId,
      md5: md5Hash,
      s3Key: s3Key,
      tag,
    };

    if (screenshotsCollector) {
      screenshotsCollector.push(ssData);
    }

    logger.info(
      `[Screenshot] Successfully generated in-memory screenshot with ID: ${generatedId}, MD5: ${md5Hash}`,
    );
    return generatedId;
  } catch (err: any) {
    logger.error(`[Screenshot] Failed to generate screenshot: ${err.message}`);
    logger.error(`[Screenshot] Error stack: ${err.stack}`);
    return undefined;
  }
}

async function cdpScreenshot(client: any) {
  try {
    logger.info('[Screenshot] Capturing screenshot via CDP...');
    const base64ss = (
      await client.send('Page.captureScreenshot', {
        captureBeyondViewport: true,
        optimizeForSpeed: true,
      })
    ).data;
    let screenshot = Buffer.from(base64ss, 'base64');
    logger.info(`[Screenshot] Captured screenshot: ${screenshot.length} bytes`);
    return screenshot;
  } catch (err: any) {
    logger.error(`[Screenshot] Failed to capture screenshot: ${err.message}`);
    logger.error(`[Screenshot] Error stack: ${err.stack}`);
    throw err;
  }
}

export { saveFullscreenshot, imgResize, cdpScreenshot };
