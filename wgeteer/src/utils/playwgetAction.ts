import { yaraSource, yaraAction } from './yara.js';
import logger from './logger.js';
import {
  saveFullscreenshot,
  imgResize,
  cdpScreenshot,
} from './playwgetScreenshot.js';
import { savePayload } from './payload.js';

async function playwgetAction(
  page: any,
  webpage: any,
  client: any,
  payloadsCollector?: any[],
  screenshotsCollector?: any[],
) {
  const pageId = webpage._id;
  const delay = Number(webpage.option.delay) * 1000;
  // Initialize payloads array if not exists
  if (!webpage.payloads) {
    webpage.payloads = [];
  }
  if (!webpage.screenshots) {
    webpage.screenshots = [];
  }
  // execute actions
  let actions;
  let yararule = await yaraSource(await page.content());
  logger.debug(`[${pageId}] YARA scan result: ${JSON.stringify(yararule)}`);
  if (yararule) {
    logger.debug(`[${pageId}] YARA rule found: ${yararule.name}`);
    if (yararule.actions) {
      logger.debug(`[${pageId}] Actions found: ${yararule.actions}`);
      actions = yararule.actions;
    }
    // Note: YARA results are now saved by enrichment-worker only
  } else {
    logger.debug(`[${pageId}] No YARA rule matched`);
  }
  if (webpage.option.actions) {
    actions = webpage.option.actions;
  }
  if (actions && actions.length > 1) {
    webpage.option.actions = actions;
    const lines = actions.split(/\r?\n/);
    let limit = 5;
    let ssarray: any[] = [];
    for (let line of lines) {
      // screenshot before action
      let ssobj: any = {};
      let screenshot;
      if (client) {
        screenshot = await cdpScreenshot(client);
      } else {
        screenshot = await page.screenshot({ fullPage: true });
      }
      if (screenshot) {
        const resizedImg = await imgResize(screenshot);
        if (resizedImg) {
          ssobj.thumbnail = resizedImg.toString('base64');
        }
        let fss = await saveFullscreenshot(
          screenshot,
          [],
          screenshotsCollector,
        );
        if (fss) {
          ssobj.full = fss;
        }
      }
      if (ssobj) {
        //console.log(ssobj);
        webpage.screenshots.push(ssobj);
      }
      // Save content as payload with YARA scan (before action)
      const content = await page.content();
      const contentBuffer = Buffer.from(content, 'utf-8');
      const yaraResult = await yaraAction(content);
      const payloadId = await savePayload(
        contentBuffer,
        payloadsCollector,
        yaraResult,
      );
      if (payloadId) {
        webpage.payloads.push(payloadId);
        logger.info(
          `[${pageId}] Content saved to payload: ${payloadId}, YARA: ${JSON.stringify(yaraResult)}`,
        );
      }
      // actions
      let elem = line.split('>');
      let action = elem[0]?.trim();
      let target = elem[1]?.trim();
      let input = elem[2]?.trim();
      let last = elem[3]?.trim();
      logger.debug(`[${pageId}] action: ${action}, target: ${target}`);
      let options = {
        timeout: delay,
      };
      if (action == 'eval') {
        await page.evaluate(target, options);
      } else {
        let loc = page.locator(target);
        if (action == 'clicktxt') {
          loc = page.getByText(target);
        }
        if (last == 'last') loc = loc.last();
        else loc = loc.first();
        if (action == 'click' || action == 'clicktxt') {
          await loc.click(options);
        } else if (action == 'fill') {
          await loc.fill(input, options);
        } else if (action == 'press') {
          await loc.press(input, options);
        }
      }
      //await new Promise((done) => setTimeout(done, delay));
      limit--;
      if (limit <= 0) break;
    }
    //console.log(ssarray);
    const updateData: any = {};

    if (ssarray.length > 0) {
      updateData.screenshots = ssarray;
    }

    const clipboardText = await page.evaluate(async () => {
      return navigator.clipboard ? await navigator.clipboard.readText() : '';
    });
    console.log(clipboardText);

    // Save clipboard text to payload if it exists
    if (clipboardText && clipboardText.length > 0) {
      const clipboardBuffer = Buffer.from(clipboardText, 'utf-8');
      const payloadId = await savePayload(clipboardBuffer, payloadsCollector);
      if (payloadId) {
        webpage.payloads.push(payloadId);
        logger.info(
          `[${pageId}] Clipboard text saved to payload: ${payloadId}`,
        );
      }
    }

    // Add payloads to update if any exist
    if (webpage.payloads.length > 0) {
      updateData.payloads = webpage.payloads;
    }

    await new Promise((done) => setTimeout(done, delay));
    return;
  } else {
    return;
  }
}

export { playwgetAction };
