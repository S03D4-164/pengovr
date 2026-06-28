import logger from './logger.js';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import config from '../config/index.js';

// Initialize WASM module
let wasmInitialized = false;
let yaraModule: any = null;
let cachedRules: any[] = [];
let lastRulesFetch = 0;
const RULES_CACHE_TTL = 60000;

const s3Client = new S3Client({
  endpoint: config.s3.endpoint,
  region: config.s3.region || 'us-east-1',
  credentials: {
    accessKeyId: config.s3.accessKey,
    secretAccessKey: config.s3.secretKey,
  },
  forcePathStyle: true,
});

const initWasm = async () => {
  if (!wasmInitialized) {
    try {
      yaraModule = await import('@virustotal/yara-x');

      // Node.js環境では、__dirname やモジュールのパスから .wasm ファイルを直接読み込む必要があります
      // パッケージ内の .wasm ファイルの場所を特定します
      // ※パスはプロジェクトの構造に合わせて調整してください
      const wasmPath = path.resolve(
        process.cwd(),
        'node_modules/@virustotal/yara-x/pkg/yara_x_js_bg.wasm',
      );

      const wasmBuffer = readFileSync(wasmPath);

      // initSync にバイナリを直接渡す
      if (yaraModule.initSync) {
        yaraModule.initSync(wasmBuffer);
        wasmInitialized = true;
        logger.debug('YARA-X initialized with initSync(buffer)');
      } else {
        throw new Error('initSync not found in yaraModule');
      }
    } catch (error: any) {
      logger.error(`Failed to initialize YARA-X WASM module: ${error.message}`);
      logger.error(`Error stack: ${error.stack}`);
      logger.error('Falling back to API-based YARA scanning');

      // In worker environment, if WebAssembly fails, we can't use it
      // Set wasmInitialized to false to indicate fallback mode
      wasmInitialized = false;
      yaraModule = null;
    }
  }
};

const getActiveRules = async (): Promise<any[]> => {
  const now = Date.now();
  if (cachedRules.length > 0 && now - lastRulesFetch < RULES_CACHE_TTL) {
    return cachedRules;
  }

  try {
    const data = await s3Client.send(
      new GetObjectCommand({
        Bucket: config.s3.bucket,
        Key: 'rules/yara.json',
      }),
    );
    const body = await data.Body?.transformToString();
    if (body) {
      cachedRules = JSON.parse(body);
      lastRulesFetch = now;
    }
  } catch (e: any) {}
  return cachedRules;
};

interface YaraScanResult {
  rules: Array<{ id: string; tags: string[]; meta: Record<string, any> }>;
}

// Compiled YARA rules cache
let cachedCompiledRules: any = null;
let lastRulesHash: string = '';

// Calculate hash for rules change detection
const calculateRulesHash = (rules: string[]): string => {
  // Simple hash: join all rules and get length + first/last 50 chars
  const combined = rules.join('\n');
  return `${combined.length}-${combined.slice(0, 50)}-${combined.slice(-50)}`;
};

const yaraScan = async (source: string, yararules: any[]): Promise<YaraScanResult | null> => {
  try {
    await initWasm();

    // ルールが渡されていない場合はS3からキャッシュ済みのルールを取得します
    if (!yararules || yararules.length === 0) {
      yararules = await getActiveRules();
    }

    // Check if WebAssembly is available
    if (!wasmInitialized || !yaraModule) {
      logger.debug('WebAssembly not available, using simple pattern matching fallback');
      return simplePatternMatch(source, yararules);
    }

    const rules = yararules.map((yararule: any) => yararule.rule);
    const currentHash = calculateRulesHash(rules);

    // Use the imported module classes
    const Compiler = yaraModule.Compiler;
    const Scanner = yaraModule.Scanner;

    if (!Compiler || !Scanner) {
      logger.debug('YARA-X Compiler or Scanner not available, using fallback');
      return simplePatternMatch(source, yararules);
    }

    // Check if rules have changed and recompile if needed
    if (!cachedCompiledRules || currentHash !== lastRulesHash) {
      logger.debug(`Compiling ${yararules.length} YARA rules (hash changed)`);
      const compiler = new Compiler();
      compiler.addSource(rules.join('\n'));
      cachedCompiledRules = compiler.build();
      lastRulesHash = currentHash;
    } else {
      //logger.debug('Using cached compiled YARA rules');
    }

    const compiledRules = cachedCompiledRules;

    const scanner = new Scanner(compiledRules);
    const results = scanner.scan(Buffer.from(source, 'utf-8'));

    // Debug the results structure
    //logger.debug(`YARA scan results type: ${typeof results}`);
    logger.debug(`YARA scan results: ${JSON.stringify(results)}`);

    // Handle different result structures
    let scanResult: YaraScanResult;

    if (Array.isArray(results)) {
      // If results is already an array
      scanResult = {
        rules: results.map((match: any) => ({
          id: match.identifier,
          tags: match.tags || [],
          meta: match.meta || {},
        })),
      };
    } else if (results && typeof results === 'object' && results.matches) {
      // If results has a matches property
      scanResult = {
        rules: results.matches.map((match: any) => ({
          id: match.identifier,
          tags: match.tags || [],
          meta: match.meta || {},
        })),
      };
    } else if (results && typeof results === 'object') {
      // If results is the scan result object directly
      scanResult = {
        rules: [
          {
            id: results.identifier || 'unknown',
            tags: results.tags || [],
            meta: results.meta || {},
          },
        ],
      };
    } else {
      // No matches or unexpected structure
      scanResult = { rules: [] };
    }

    if (scanResult.rules.length) {
      logger.debug(`YARA matched: ${JSON.stringify(scanResult)}`);
    }

    return scanResult;
  } catch (error: any) {
    logger.error(`YARA scan failed: ${error.message}`);
    logger.debug('Using simple pattern matching fallback');
    return simplePatternMatch(source, yararules);
  }
};

// Simple pattern matching fallback for when WebAssembly fails
const simplePatternMatch = async (
  source: string,
  yararules: any[],
): Promise<YaraScanResult | null> => {
  try {
    if (!yararules || yararules.length === 0) {
      return null;
    }

    const results: YaraScanResult = { rules: [] };

    for (const yararule of yararules) {
      if (yararule.rule && source.includes(yararule.rule.substring(0, 50))) {
        results.rules.push({
          id: yararule.name,
          tags: [],
          meta: {},
        });
        logger.debug(`Simple pattern matched: ${yararule.name}`);
      }
    }

    return results;
  } catch (error: any) {
    logger.error(`Simple pattern matching failed: ${error.message}`);
    return null;
  }
};

export const yaraSource = async (html: string, yararules: any[]): Promise<any> => {
  const yaraResult = await yaraScan(html, yararules);
  if (yaraResult?.rules.length) {
    const name = yaraResult.rules[0].id;
    return yararules.find((r: any) => r.name === name);
  }
  return undefined;
};

export const yaraAction = async (html: string, yararules: any[]) => {
  const yaraResult = await yaraScan(html, yararules);
  if (yaraResult?.rules.length) {
    return yaraResult;
  }
  return undefined;
};
