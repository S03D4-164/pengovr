import { yaraApi } from '../api';

let yaraModule: any = null;
let yaraInitialized = false;

/**
 * Initialize the YARA-X WASM module.
 * Handles different initialization patterns of the library.
 */
export const initYara = async () => {
  if (yaraInitialized) return yaraModule;

  try {
    const module = (await import('@virustotal/yara-x')) as any;
    let initialized = false;

    if (module.default && typeof module.default === 'function') {
      await module.default();
      initialized = true;
    } else if (module.init && typeof module.init === 'function') {
      await module.init();
      initialized = true;
    } else if (module.initSync && typeof module.initSync === 'function') {
      module.initSync();
      initialized = true;
    } else {
      initialized = true;
    }

    if (initialized) {
      yaraModule = module;
      yaraInitialized = true;
      return yaraModule;
    }
  } catch (err) {
    console.warn(
      'YARA-X WASM failed to initialize, will use API fallback:',
      err,
    );
  }
  return null;
};

/**
 * Validate YARA rule syntax using YARA-X WASM.
 * Throws an error if syntax is invalid.
 */
export const validateRule = async (ruleString: string) => {
  const module = await initYara();
  if (module && module.Compiler) {
    try {
      const compiler = new module.Compiler();
      compiler.addSource(ruleString);
      compiler.build();
    } catch (err: any) {
      throw err;
    }
  }
};

/**
 * Scan content with YARA rules.
 */
export const scanContent = async (content: string | Uint8Array) => {
  try {
    const module = await initYara();

    if (module && module.Compiler) {
      // Fetch active rules from API (limit 1000 for scanning)
      const rulesData = await yaraApi.getYaraRules(1, 1000);
      const ruleStrings = rulesData.results.map((r: any) => r.rule).join('\n');
      console.log(ruleStrings);
      if (ruleStrings.trim()) {
        const compiler = new module.Compiler();
        compiler.addSource(ruleStrings);
        const compiledRules = compiler.build();

        const bytes =
          typeof content === 'string'
            ? new TextEncoder().encode(content)
            : content;
        const scanResult = compiledRules.scan(bytes);

        if (scanResult.valid) {
          return scanResult.matches.map((m: any) => ({
            id: m.identifier,
            tags: m.tags || [],
            meta: m.meta || {},
          }));
        }
      }
    }
  } catch (err: any) {
    console.error('Local YARA scan failed:', err);
    throw err;
  }

  return;
};
