import playwget from './utils/playwget.js';
import { saveHarfile } from './utils/harfile.js';
import { uploadJSONGzip } from './utils/s3.js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

interface ScrapeOptions {
  [key: string]: any;  // 任意のオプションを受け入れ
}

interface ScrapeResult {
  webpageId: string;
  resultKey: string;
}

class Scraper {
  /**
   * Execute scraping and return data for API storage
   */
  async scrape(
    url: string,
    options: ScrapeOptions = {},
  ): Promise<ScrapeResult> {
    console.log(`[Scraper] Starting scrape with options:`, JSON.stringify(options));
    // APIから渡された既存のIDがある場合はそれを使用し、なければ新規生成する
    const websiteId =
      options.websiteId || crypto.randomBytes(12).toString('hex');
    const webpageId =
      options.existingWebpageId || crypto.randomBytes(12).toString('hex');

    // Prepare virtual Website object
    const website: any = {
      _id: websiteId as any,
      url,
      track: {
        period: options.period || 1,
        counter: options.counter || 0,
        option: {
          userAgent: options.userAgent,
          referer: options.referrer,
          timeout: options.timeout || 30,
          delay: options.delay || 5,
          lang: options.language,
          disableScript: options.disableScript,
          proxy: options.proxy,
          actions: options.actions,
          pptr: options.pptr,
          cloudflare: options.cloudflare,
          exHeaders: options.extraHeaders,
          track: options.track,
        },
      },
      last: webpageId as any,
    };

    // Prepare virtual Webpage object
    const webpage: any = {
      _id: webpageId,
      input: url,
      option: {
        userAgent: options.userAgent,
        referer:
          typeof options.referrer === 'string' ? options.referrer : undefined,
        timeout: options.timeout || 30,
        delay: options.delay || 5,
        lang: options.language,
        disableScript: options.disableScript,
        proxy: options.proxy,
        actions: options.actions,
        noenrich: options.noenrich,
        recordHar: options.recordHar,
        scrot: options.scrot,
      },
      favicon: [],
      screenshots: [],
    };

    // Execute playwget
    const processedWebpage = await playwget(webpage);
    if (!processedWebpage) {
      throw new Error('playwget failed to process the URL');
    }

    // Ensure option is preserved in the processed webpage
    if (!processedWebpage.option) {
      processedWebpage.option = webpage.option;
    }

    // 1. Upload artifacts to SeaweedFS and get storage IDs/Keys
    const dataDir = '/tmp/ppengo';
    const workDir = path.join(dataDir, webpageId);

    try {
      // ブラウザが終了した後に作成されるHARファイルをチェックしてアップロード
      const harPath = path.join(workDir, 'pw.har');
      if (fs.existsSync(harPath)) {
        const harKey = await saveHarfile(harPath, webpageId);
        if (harKey) {
          processedWebpage.harfile = harKey;
        }
      }
    } finally {
      // 2. Cleanup local files
      if (fs.existsSync(workDir)) {
        fs.rmSync(workDir, { recursive: true, force: true });
      }
    }

    // 3. Prepare final result object for API listener
    // ResultListener expects an object containing { webpage, website }
    const finalResult = {
      webpage: processedWebpage,
      website: website,
    };

    // 4. Upload the monolithic result file
    const resultKey = `${webpageId}/result.json.gz`;
    console.log(`[${webpageId}] Uploading monolithic result to S3...`);
    await uploadJSONGzip(resultKey, finalResult);

    return {
      webpageId,
      resultKey,
    };
  }
}

export default Scraper;
