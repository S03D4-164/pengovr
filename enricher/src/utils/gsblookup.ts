interface GSBResponse {
  matches?: any[];
  error?: string;
}

async function gsbLookup(url: string): Promise<GSBResponse> {
  const host = process.env.GOSB_HOST || '127.0.0.1';
  const port = process.env.GOSB_PORT || '3002';
  const ApiEndpoint = `http://${host}:${port}/v4/threatMatches:find`;
  const submit = {
    threatInfo: {
      threatEntries: [{ url: url }],
    },
  };

  try {
    console.log({ url: ApiEndpoint, body: submit });
    const res = await fetch(ApiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(submit),
    });

    if (!res.ok) {
      return { error: `HTTP error: ${res.status} ${res.statusText}` };
    }

    const body: any = await res.json();
    console.log(body);

    if ('matches' in body) {
      return body;
    } else {
      return { matches: [] };
    }
  } catch (err: any) {
    console.error('GSB lookup fetch error:', err);
    if (err.cause) {
      console.error('Error cause:', err.cause);
    }
    return { error: err.message || 'GSB failed' };
  }
}

async function lookupUrl(url: string): Promise<GSBResponse> {
  const res = await gsbLookup(url);
  return res;
}

export { lookupUrl };
