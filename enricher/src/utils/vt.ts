import logger from './logger.js';

const ak = process.env.VT_KEY || process.env.VTKEY;
const vtApiEndpoint = 'https://www.virustotal.com/vtapi/v2/';

interface VTFileReportResponse {
  [key: string]: any;
  error?: string;
}

async function vtFileReport(resource: string): Promise<VTFileReportResponse> {
  const params = new URLSearchParams({
    apikey: ak || '',
    resource: resource,
  });
  const url = `${vtApiEndpoint}file/report?${params.toString()}`;

  try {
    logger.debug({ url });
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    const body = (await res.json()) as VTFileReportResponse;
    logger.debug(body);
    return body;
  } catch (err: any) {
    logger.error(err);
    return { error: err.message };
  }
}

async function vt(resource: string): Promise<VTFileReportResponse> {
  const body = await vtFileReport(resource);
  return body;
}

export { vt };
