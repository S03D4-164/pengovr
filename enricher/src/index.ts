import Redis from 'ioredis';
import { Worker, Job } from 'bullmq';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import config from './config/index.js';
import zlib from 'zlib';

import { getHostInfo } from './utils/ipInfo.js';
import { getDNSInfo } from './utils/dns.js';
import { analyzePage, analyzeResponses } from './utils/wappalyzer.js';
import { yaraAction } from './utils/yara.js';
import explainCode from './utils/gemini.js';
import { vt } from './utils/vt.js';
import { lookupUrl } from './utils/gsblookup.js';

class EnrichmentWorker {
  private worker: Worker | null = null;
  public redis: Redis;
  private s3Client: S3Client;
  private running: boolean = false;

  constructor() {
    // Redisの初期化
    this.redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      maxRetriesPerRequest: null,
    });

    // SeaweedFS (S3互換) の初期化
    this.s3Client = new S3Client({
      endpoint: config.s3.endpoint,
      region: config.s3.region || 'us-east-1',
      credentials: {
        accessKeyId: config.s3.accessKey,
        secretAccessKey: config.s3.secretKey,
      },
      forcePathStyle: true,
    });
  }

  async init() {
    console.log('Enrichment Worker connected to Redis');
    console.log('Enrichment Worker initialized S3 Client for SeaweedFS');

    // バケットの存在確認と自動作成
    try {
      await this.s3Client.send(
        new HeadBucketCommand({ Bucket: config.s3.bucket }),
      );
      console.log(`S3 Bucket "${config.s3.bucket}" confirmed.`);
    } catch (error: any) {
      if (
        error.name === 'NotFound' ||
        error.$metadata?.httpStatusCode === 404
      ) {
        console.log(`S3 Bucket "${config.s3.bucket}" not found. Creating...`);
        await this.s3Client.send(
          new CreateBucketCommand({ Bucket: config.s3.bucket }),
        );
        console.log(`S3 Bucket "${config.s3.bucket}" created successfully.`);
      } else {
        console.error(`Error checking/creating S3 bucket: ${error.message}`);
        throw error; // 起動時に致命的なエラーとして扱う
      }
    }
  }

  // SeaweedFSへのアップロード
  private async uploadToS3(
    key: string,
    body: Buffer | string,
    contentType: string,
  ): Promise<string> {
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: config.s3.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    return `${config.s3.bucket}/${key}`;
  }

  // SeaweedFSからのダウンロードと解凍
  private async downloadFromS3(key: string): Promise<any> {
    const command = new GetObjectCommand({
      Bucket: config.s3.bucket,
      Key: key,
    });
    const response = await this.s3Client.send(command);
    const body = await response.Body?.transformToByteArray();
    if (!body) return null;
    const buffer = Buffer.from(body);
    const decompressed = key.endsWith('.gz') ? zlib.gunzipSync(buffer) : buffer;
    return JSON.parse(decompressed.toString());
  }

  async start() {
    if (this.running) {
      console.log('Enrichment Worker is already running');
      return;
    }

    this.running = true;
    console.log(
      `Starting BullMQ enrichment worker for queue: ${config.enrichmentQueue}...`,
    );

    this.worker = new Worker(
      config.enrichmentQueue,
      async (job: Job) => {
        await this.processEnrichmentTask(job);
      },
      {
        connection: {
          host: config.redis.host,
          port: config.redis.port,
          password: config.redis.password,
        },
        lockDuration: 3 * 60 * 1000,
        //concurrency: config.concurrency || 1,
      },
    );

    this.worker.on('failed', (job, err) => {
      console.error(`Job ${job?.id} failed:`, err.message);
    });
  }

  async stop() {
    this.running = false;
    console.log('Stopping enrichment worker...');
    if (this.worker) {
      await this.worker.close();
    }
  }

  private async enrichRemoteAddress(
    target: any,
    host: string | null,
    ip: string | null,
    ipInfoCache: Map<string, any>,
    dnsInfoCache: Map<string, any>,
    processedHosts: Set<string>,
    processedIps: Set<string>,
    targetName: string,
  ): Promise<boolean> {
    let hostInfo;
    if (ip) {
      if (processedIps.has(ip)) {
        hostInfo = ipInfoCache.get(ip);
        //console.log(`Using cached IP info for ${targetName}: ${ip}`);
      } else {
        hostInfo = await getHostInfo(ip);
        if (!hostInfo) {
          hostInfo = {
            ip: ip,
            reverse: [],
            bgp: [],
            geoip: {},
          };
        }
        ipInfoCache.set(ip, hostInfo);
        processedIps.add(ip);
        console.log(`Retrieved IP info for ${targetName}: ${ip}`);
      }
    } else if (host) {
      if (processedHosts.has(host)) {
        hostInfo = ipInfoCache.get(host);
        //console.log(`Using cached IP info for ${targetName} host: ${host}`);
      } else {
        hostInfo = await getHostInfo(host);
        ipInfoCache.set(host, hostInfo);
        processedHosts.add(host);
        console.log(`Retrieved IP info for ${targetName} host: ${host}`);
      }
    } else {
      console.log(`No host information available for ${targetName}`);
      return false;
    }

    if (
      hostInfo &&
      (hostInfo.ip || hostInfo.reverse || hostInfo.bgp || hostInfo.geoip)
    ) {
      target.remoteAddress = {
        ip: hostInfo.ip,
        reverse: (hostInfo.reverse as string[]) || [],
        bgp: (hostInfo.bgp as any[]) || [],
        geoip: (hostInfo.geoip as any) || {},
        port: target.remoteAddress?.port,
      };
      //console.log(`${targetName}.remoteAddress:`, target.remoteAddress);
    }

    if (host) {
      //console.log(`Getting DNS information for ${targetName} host: ${host}`);
      try {
        let dnsInfo;
        if (processedHosts.has(host)) {
          dnsInfo = dnsInfoCache.get(host);
          //console.log(`Using cached DNS info for ${targetName} host: ${host}`);
        } else {
          dnsInfo = await getDNSInfo(host);
          dnsInfoCache.set(host, dnsInfo);
          processedHosts.add(host);
        }

        if (
          dnsInfo &&
          (dnsInfo.records.A ||
            dnsInfo.records.AAAA ||
            dnsInfo.records.MX ||
            dnsInfo.records.NS)
        ) {
          const records = {
            A: dnsInfo.records.A || [],
            AAAA: dnsInfo.records.AAAA || [],
            MX: dnsInfo.records.MX || [],
            NS: dnsInfo.records.NS || [],
            TXT: dnsInfo.records.TXT || [],
            CNAME: Array.isArray(dnsInfo.records.CNAME)
              ? dnsInfo.records.CNAME
              : dnsInfo.records.CNAME
                ? [dnsInfo.records.CNAME]
                : [],
            SOA: dnsInfo.records.SOA || undefined,
            PTR: dnsInfo.records.PTR || [],
          };

          target.remoteAddress = {
            ...target.remoteAddress,
            dns: {
              domain: dnsInfo.domain,
              records: records,
              lookupTime: dnsInfo.lookupTime,
              errors: dnsInfo.errors || [],
            },
          };

          //console.log(`${targetName}.remoteAddress.dns:`, target.remoteAddress.dns);
        } else {
          console.log(`No DNS records found for ${targetName} host:`, host);
        }
      } catch (dnsError: any) {
        console.error(
          `DNS lookup failed for ${targetName} ${host}:`,
          dnsError.message,
        );
        target.remoteAddress = {
          ...target.remoteAddress,
          dns: {
            domain: host,
            records: {
              A: [],
              AAAA: [],
              MX: [],
              NS: [],
              TXT: [],
              PTR: [],
            },
            lookupTime: 0,
            errors: [`DNS lookup failed: ${dnsError.message}`],
          },
        };
      }
    }

    return true;
  }

  async processEnrichmentTask(job: Job) {
    const { data, name: jobName } = job;
    const {
      id: taskId,
      webpageId,
      type: taskType = 'enrichment',
      content: taskContent,
      payloadId,
      websiteId,
      url: taskUrl,
      targetType,
      resultKey,
      s3Key,
    } = data;
    const actualJobId = job.id; // BullMQのジョブID (yara-webpageId 等)

    console.log(`Processing job ${actualJobId} (Name: ${jobName})`);

    // Handle HAR processing task
    if (taskType === 'process_har') {
      // API側の resultProcessor が S3 から直接ダウンロードして DB に保存するため、
      // Worker側では何もせず、ジョブを完了させて API に通知します。
      return;
    }

    // Handle Gemini explanation task
    if (taskType === 'gemini_explain') {
      const targetId = data.targetId || webpageId;
      await this.processGeminiExplainTask(
        taskId,
        targetId,
        targetType || 'webpage',
        taskContent,
      );
      return;
    }

    // Handle Gemini explanation for raw content
    if (taskType === 'gemini_explain_content') {
      await this.processGeminiExplainContentTask(taskId, taskContent);
      return;
    }

    // Handle VT search task
    if (taskType === 'vt_search') {
      const md5 = data.md5;
      if (md5 && payloadId) {
        await this.processVTSearchTask(taskId, payloadId, md5);
      } else {
        console.error('VT search task missing payloadId or md5');
      }
      return;
    }

    // Handle GSB lookup task
    if (taskType === 'gsb_lookup') {
      if (websiteId && taskUrl) {
        await this.processGSBLookupTask(taskId, websiteId, taskUrl);
      } else {
        console.error('GSB lookup task missing websiteId or url');
      }
      return;
    }

    // Cache for IP and DNS info within this task
    const ipInfoCache = new Map<string, any>();
    const dnsInfoCache = new Map<string, any>();
    const processedHosts = new Set<string>();
    const processedIps = new Set<string>();

    try {
      const inputKey = resultKey || s3Key;
      if (!inputKey) throw new Error('No resultKey/s3Key provided');

      console.log(
        `Downloading source data for job ${jobName} from S3: ${inputKey}`,
      );
      const fullData = await this.downloadFromS3(inputKey);
      if (!fullData || !fullData.webpage)
        throw new Error('Failed to download source data');
      const webpage = fullData.webpage;
      const responses = fullData.webpage.responses || [];

      if (jobName === 'dns') {
        const url = webpage.url ? new URL(webpage.url) : null;
        await this.enrichRemoteAddress(
          webpage,
          url?.hostname || null,
          webpage.remoteAddress?.ip || null,
          ipInfoCache,
          dnsInfoCache,
          processedHosts,
          processedIps,
          'webpage',
        );

        for (const res of responses) {
          const resUrl = res.url ? new URL(res.url) : null;
          await this.enrichRemoteAddress(
            res,
            resUrl?.hostname || null,
            res.remoteAddress?.ip || null,
            ipInfoCache,
            dnsInfoCache,
            processedHosts,
            processedIps,
            'response',
          );
        }
      }

      if (jobName === 'wappalyzer') {
        if (webpage.content && webpage.headers) {
          const wapps = await analyzePage(webpage);
          if (wapps?.length) webpage.wappalyzer = wapps;
        }
        await analyzeResponses(responses);
      }

      if (jobName === 'yara') {
        const rules = data.yaraRules || [];
        if (webpage.content) {
          const yRes = await yaraAction(webpage.content, rules);
          if (yRes) webpage.yara = yRes;
        }
        for (const res of responses) {
          if (res.text) {
            const yRes = await yaraAction(res.text, rules);
            if (yRes) res.yara = yRes;
          }
        }
      }

      // 各タスクの結果を個別に保存 (finalizer ジョブ自体は結果データのアップロード不要)
      if (jobName !== 'enrichment_finalizer') {
        const enrichmentResultKey = `webpages/${webpageId}/enrichments/${jobName}.json`;
        const resultData = { webpage, responses };
        await this.uploadToS3(
          enrichmentResultKey,
          JSON.stringify(resultData),
          'application/json',
        );
        console.log(
          `Results for ${jobName} uploaded to: ${enrichmentResultKey}`,
        );
      }

      console.log(`Job ${actualJobId} completed successfully`);
    } catch (error) {
      console.error(`Enrichment task ${taskId} failed:`, error);
      console.error(`Job ${job.id} failed:`, error);
      throw error;
    }
  }

  async processGeminiExplainTask(
    taskId: string,
    targetId: string,
    targetType: string,
    content: string | undefined,
  ) {
    try {
      console.log(
        `Processing Gemini explanation for task ${taskId}, ${targetType} ${targetId}`,
      );

      // API接続禁止のため、コンテンツはジョブデータから直接取得する
      const contentToExplain = content;
      if (!contentToExplain) {
        console.error(
          `Gemini explain task ${taskId}: no content available (not provided and ${targetType} has no content)`,
        );
        return;
      }

      // Generate explanation using Gemini
      const explanation = await explainCode(contentToExplain);

      if (explanation) {
        // 結果をMinIOに保存
        let storageKey: string;
        if (targetType === 'response') {
          storageKey = `responses/${targetId}/explanations/${taskId}.txt`;
        } else if (targetType === 'webpage') {
          storageKey = `webpages/${targetId}/explanations/${taskId}.txt`;
        } else {
          // deobfuscator or other types
          storageKey = `explanations/gemini/content-${taskId}.txt`;
        }
        const storagePath = await this.uploadToS3(
          storageKey,
          explanation,
          'text/plain',
        );
        console.log(`Gemini explanation saved to SeaweedFS: ${storagePath}`);
      }

      console.log(`Gemini explanation completed for task ${taskId}`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      console.error(
        `Error processing Gemini explanation for task ${taskId}:`,
        error,
      );

      // エラー情報もSeaweedFSに保存して、API側で確認できるようにする
      let errorKey: string;
      if (content?.includes('response') || content?.includes('text')) {
        // Guess from content type, default to gemini
        errorKey = `explanations/gemini/content-${taskId}-error.txt`;
      } else {
        errorKey = `explanations/gemini/content-${taskId}-error.txt`;
      }
      await this.uploadToS3(errorKey, errorMessage, 'text/plain');
    }
  }

  async processGeminiExplainContentTask(
    taskId: string,
    content: string | undefined,
  ) {
    try {
      console.log(
        `Processing Gemini explanation for raw content, task ${taskId}`,
      );

      if (!content) {
        console.error(
          `Gemini explain content task ${taskId}: no content provided`,
        );
        await this.redis.setex(
          `gemini:result:${taskId}`,
          3600,
          JSON.stringify({ error: 'No content provided' }),
        );
        return;
      }

      // Generate explanation using Gemini
      const explanation = await explainCode(content);

      // Save result to Redis with 1 hour expiration
      const result = explanation
        ? { explanation, status: 'completed' }
        : { error: 'No explanation generated', status: 'failed' };

      await this.redis.setex(
        `gemini:result:${taskId}`,
        3600,
        JSON.stringify(result),
      );
      console.log(`Gemini explanation saved to Redis for task ${taskId}`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      console.error(
        `Error processing Gemini explanation for task ${taskId}:`,
        error,
      );

      // Save error to Redis
      await this.redis.setex(
        `gemini:result:${taskId}`,
        3600,
        JSON.stringify({ error: errorMessage, status: 'failed' }),
      );
    }
  }

  async processVTSearchTask(
    taskId: string,
    payloadId: string,
    md5: string,
  ): Promise<void> {
    try {
      console.log(`Processing VT search task for payload ${payloadId}`);
      const result = await vt(md5);

      if (result.error) {
        console.error(
          `VT search failed for payload ${payloadId}:`,
          result.error,
        );
      } else {
        console.log(`VT search completed for payload ${payloadId}`);
      }

      // 結果をMinIOに保存（API側が回収できるように）
      const resultKey = `payloads/${payloadId}/vt/${taskId}.json`;
      await this.uploadToS3(
        resultKey,
        JSON.stringify({ payloadId, vt: result }),
        'application/json',
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      console.error(
        `Error processing VT search for payload ${payloadId}:`,
        errorMessage,
      );
    }
  }

  async processGSBLookupTask(
    taskId: string,
    websiteId: string,
    url: string,
  ): Promise<void> {
    try {
      console.log(
        `Processing GSB lookup task for website ${websiteId}, url: ${url}`,
      );
      // lookupSiteはWebsiteModelを使用してしまうため、直接lookupUrlを使用して検査のみ行う
      const result = await lookupUrl(url);

      const resultKey = `websites/${websiteId}/gsb/${taskId}.json`;
      const resultData = {
        taskId,
        websiteId,
        url,
        gsb: result,
      };
      await this.uploadToS3(
        resultKey,
        JSON.stringify(resultData),
        'application/json',
      );
      console.log(`GSB lookup results saved to SeaweedFS: ${resultKey}`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      console.error(
        `Error processing GSB lookup for website ${websiteId}:`,
        errorMessage,
      );
      await this.uploadToS3(
        `results/gsb-${taskId}-error.txt`,
        errorMessage,
        'text/plain',
      );
    }
  }
}

const enrichmentWorker = new EnrichmentWorker();

enrichmentWorker
  .init()
  .then(() => {
    enrichmentWorker.start();
  })
  .catch((err) => {
    console.error('Failed to initialize Enrichment Worker:', err);
    process.exit(1);
  });

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down enrichment worker gracefully...');
  await enrichmentWorker.stop();
  await enrichmentWorker.redis.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log(
    'Received SIGTERM, shutting down enrichment worker gracefully...',
  );
  await enrichmentWorker.stop();
  await enrichmentWorker.redis.disconnect();
  process.exit(0);
});
