import playwget from './utils/playwget.js';
import { saveHarfile } from './utils/harfile.js';
import { uploadJSONGzip } from './utils/s3.js';
//import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

interface ScrapeOptions {
  [key: string]: any; // 任意のオプションを受け入れ
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
    webpageId: string,
    options: ScrapeOptions = {},
  ): Promise<ScrapeResult> {
    console.log(
      `[Scraper] Starting scrape with options:`,
      JSON.stringify(options),
    );

    // Prepare virtual Webpage object
    const webpage: any = {
      _id: webpageId,
      input: url,
      option: options,
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

    // Upload artifacts to SeaweedFS and get storage IDs/Keys
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
      // Cleanup local files
      if (fs.existsSync(workDir)) {
        fs.rmSync(workDir, { recursive: true, force: true });
      }
    }

    // Prepare final result object for API listener
    const finalResult = {
      webpage: processedWebpage,
      //website: website,
    };

    // Upload the monolithic result file
    const resultKey = `webpages/${webpageId}/result.json.gz`;
    console.log(`[${webpageId}] Uploading monolithic result to S3...`);
    await uploadJSONGzip(resultKey, finalResult);

    return {
      webpageId,
      resultKey,
    };
  }
}

export default Scraper;
