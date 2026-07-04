let WappalyzerCore: any = null;
let technologies: any = null;
let categories: any = null;

const initializeWappalyzer = async () => {
  if (!WappalyzerCore) {
    try {
      const wappalyzerModule = await import('./wapalyzer-core/wappalyzer.cjs');
      const technologiesModule = await import('./wapalyzer-core/technologies.json', {
        with: { type: 'json' },
      });
      const categoriesModule = await import('./wapalyzer-core/categories.json', {
        with: { type: 'json' },
      });

      WappalyzerCore = wappalyzerModule.default || wappalyzerModule;
      technologies = technologiesModule.default || technologiesModule;
      categories = categoriesModule.default || categoriesModule;

      WappalyzerCore.setTechnologies(technologies);
      WappalyzerCore.setCategories(categories);
    } catch (error: any) {
      console.error('Failed to initialize Wappalyzer:', error);
      throw error;
    }
  }
  return { WappalyzerCore, technologies, categories };
};

const wapalyze = async (url: string, headers: any, html: string) => {
  let result: any;
  const parsedHeaders = await parseHeaders(headers);
  try {
    const { WappalyzerCore } = await initializeWappalyzer();
    const detections = await WappalyzerCore.analyze({
      url,
      headers: parsedHeaders,
      html,
      //scriptSrc: [html],
    });

    result = WappalyzerCore.resolve(detections);
  } catch (error: any) {
    console.error('Error analyzing website:', error);
  }
  //console.log(result);
  return result;
};

async function parseHeaders(headers: any) {
  //console.log(headers);
  let parsedHeaders: any = {};
  try {
    if (headers) {
      for (let header of headers) {
        parsedHeaders[header.name.toLowerCase()] = [header.value];
      }
    }
  } catch (err) {
    const entries = Object.entries(headers);
    for (const [key, value] of entries) {
      parsedHeaders[key.toLowerCase()] = [value];
    }
  }
  //console.log(parsedHeaders);
  return parsedHeaders;
}

async function analyzeResponses(responses: any) {
  for (let res of responses) {
    if (res.url) {
      const results = await wapalyze(res.url, res.headers, res.text || '');
      let wapps = [];
      if (results && Array.isArray(results)) {
        for (let result of results) {
          if (result.confidence == 100) {
            wapps.push(result.name);
          }
        }
      }
      console.log(
        `[Wappalyzer] Response ${res._id}: found ${wapps.length} techs (${wapps.join(', ') || 'none'}) (raw: ${results?.length || 0})`,
      );
      if (wapps && wapps.length > 0) res.wappalyzer = wapps;
    }
  }
  return responses;
}

async function analyzePage(webpage: any) {
  if (webpage.url && webpage.content) {
    const results = await wapalyze(webpage.url, webpage.headers, webpage.content);
    let wapps = [];
    if (results && Array.isArray(results)) {
      for (let result of results) {
        if (result.confidence == 100) {
          wapps.push(result.name);
        }
      }
    }
    console.log(`[Wappalyzer] Webpage ${webpage._id} detection: ${wapps.join(', ') || 'none'}`);
    return wapps.length > 0 ? wapps : undefined;
  }
  return undefined;
}
export { analyzePage, analyzeResponses };
