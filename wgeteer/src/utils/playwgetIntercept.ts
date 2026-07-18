import crypto from 'crypto';
import logger from './logger.js';
import { savePayload } from './payload.js';

async function saveResponse(
  interceptedResponse: any,
  pageId: string,
  responseCache: any[],
  payloadsCollector?: Array<any>,
): Promise<any> {
  let responseBuffer: Buffer | undefined;
  let text: string | undefined;
  let payloadId: string | undefined;
  const responseStatus: number = await interceptedResponse.status();
  let interceptionId: string | undefined;

  try {
    for (const cache of responseCache) {
      if (
        interceptedResponse.url() === cache.url &&
        cache.status === responseStatus
      ) {
        responseBuffer = cache.body;
        if (responseBuffer) text = cache.body.toString('utf-8');
        interceptionId = cache.interceptionId;
        break;
      }
    }

    if (!responseBuffer && responseStatus >= 200) {
      responseBuffer = await interceptedResponse.body();
    }
  } catch (err: any) {
    //logger.error(`[${pageId}] ${err} ${interceptedResponse.url()}`);
  }

  if (responseBuffer) {
    payloadId = await savePayload(responseBuffer, payloadsCollector);
  }

  try {
    if (!text && responseStatus >= 200) {
      text = await interceptedResponse.text();
    }
  } catch (err: any) {
    //logger.error(`[${pageId}] ${err} ${interceptedResponse.url()}`);
  }

  let securityDetails: any = {};
  try {
    const secDetails = await interceptedResponse.securityDetails();
    if (secDetails) {
      securityDetails = {
        issuer: secDetails.issuer,
        protocol: secDetails.protocol,
        subjectName: secDetails.subjectName,
        validFrom: secDetails.validFrom,
        validTo: secDetails.validTo,
      };
    }
  } catch (err: any) {
    logger.debug(`[${pageId}] ${err}`);
  }

  const serverAddr = await interceptedResponse.serverAddr();
  let remoteAddress: any = {};
  if (serverAddr) {
    //console.log(serverAddr);
    // Remove brackets from IPv6 addresses (e.g., '[2606:4700:10::6814:179a]' -> '2606:4700:10::6814:179a')
    const ipAddress = serverAddr.ipAddress?.replace(/^\[(.*)\]$/, '$1');
    remoteAddress = {
      ip: ipAddress,
      port: serverAddr.port,
    };
  }
  try {
    const url: string = interceptedResponse.url();
    const urlHash: string = crypto.createHash('md5').update(url).digest('hex');
    const headers: any = interceptedResponse.headers();
    const newHeaders: any = {};

    for (const key of Object.keys(headers)) {
      const newKey: string = key.includes('.')
        ? key.replace(/\./g, '\uff0e')
        : key;
      newHeaders[newKey] = headers[key];
    }

    const response = {
      _id: crypto.randomBytes(12).toString('hex'),
      webpage: pageId,
      url,
      urlHash,
      status: interceptedResponse.status(),
      statusText: interceptedResponse.statusText(),
      ok: interceptedResponse.ok(),
      mimeType: headers['content-type'] || null,
      encoding: headers['content-encoding'] || null,
      remoteAddress,
      headers: newHeaders,
      securityDetails,
      payload: payloadId,
      text,
      interceptionId,
    };

    if (text) {
      const sizelimit: number = 10 * 1024 * 1024;
      const resLength: number = JSON.stringify(response).length;
      if (resLength > sizelimit) {
        logger.warn(
          `[${pageId}] Response body for ${url} is too large (${resLength} bytes) and will be dropped to stay within MongoDB limits.`,
        );
        response.text = undefined;
      }
    }
    return response;
  } catch (err: any) {
    logger.error(`[${pageId}]  ${err}`);
    return undefined;
  }
}

async function saveRequest(
  interceptedRequest: any,
  pageId: string,
): Promise<any> {
  const headers: any = interceptedRequest.headers();
  const newHeaders: any = {};
  for (const key of Object.keys(headers)) {
    const newKey: string = key.includes('.')
      ? key.replace(/\./g, '\uff0e')
      : key;
    newHeaders[newKey] = headers[key];
  }

  try {
    const request: any = {
      _id: crypto.randomBytes(12).toString('hex'),
      webpage: pageId,
      url: interceptedRequest.url(),
      method: interceptedRequest.method(),
      resourceType: interceptedRequest.resourceType(),
      isNavigationRequest: interceptedRequest.isNavigationRequest(),
      postData: interceptedRequest.postData(),
      headers: newHeaders,
      failure: interceptedRequest.failure(),
    };
    return request;
  } catch (err: any) {
    logger.error(`[${pageId}] ${err}`);
    return undefined;
  }
}

export { saveRequest, saveResponse };
