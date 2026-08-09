import { QueueEvents, Queue, FlowProducer } from 'bullmq';
import Redis from 'ioredis';
import crypto from 'crypto';
import config from '../config';
import zlib from 'zlib';
import s3Client, { downloadBuffer } from '../utils/s3';
import { DeleteObjectsCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import WebpageModel from '../models/webpage';
import WebsiteModel from '../models/website';
import mongoose from 'mongoose';
import YaraModel from '../models/yara';
import ScreenshotModel from '../models/screenshot';
import { logError, shouldLog } from '../utils/logger';

import RequestModel from '../models/request';
import ResponseModel from '../models/response';
import PayloadModel from '../models/payload';

export class ResultListener {
  private queueEvents: QueueEvents;
  private enrichmentQueue: Queue;
  private flowProducer: FlowProducer;

  constructor(redisConnection: Redis, enrichmentQueue: Queue) {
    this.queueEvents = new QueueEvents(config.queueName, {
      connection: redisConnection,
    });
    this.enrichmentQueue = enrichmentQueue;
    this.flowProducer = new FlowProducer({
      connection: redisConnection,
    }).on('error', (err) => {
      if (shouldLog()) {
        logError('BullMQ FlowProducer Error', err);
      }
    });
  }

  public listen(): void {
    console.log(
      `Starting BullMQ result listener for queue: ${config.queueName}...`,
    );

    this.queueEvents.on('completed', async ({ jobId, returnvalue }) => {
      const timestamp = new Date().toISOString();
      console.log(
        `[${timestamp}] Job ${jobId} completed. Processing scraped results...`,
      );

      try {
        const resultMeta =
          typeof returnvalue === 'string'
            ? JSON.parse(returnvalue)
            : returnvalue;
        console.log(resultMeta);
        const { resultKey, error } = resultMeta;
        let { webpageId } = resultMeta;

        if (error) {
          throw new Error(error);
        }

        if (!resultKey) {
          throw new Error('No result key provided in job completion metadata');
        }

        // Download structured relation data from SeaweedFS
        console.log(`Downloading result data from SeaweedFS key: ${resultKey}`);
        const resultBuffer = await downloadBuffer(resultKey);
        if (!resultBuffer || resultBuffer.length === 0) {
          throw new Error('Downloaded result data is empty');
        }
        const resultDecompressed = resultKey.endsWith('.gz')
          ? zlib.gunzipSync(resultBuffer)
          : resultBuffer;
        const scrapingResult = JSON.parse(resultDecompressed.toString());
        const { webpage, website } = scrapingResult;

        console.log(
          `[ResultListener] Downloaded webpage.option:`,
          JSON.stringify(webpage.option),
        );

        const requests = webpage.requests || [];
        const responses = webpage.responses || [];
        const payloads = webpage.payloads_data || [];
        const screenshots = webpage.screenshots_data || [];
        const screenshotBuffer = webpage.thumbnail;

        // Perform MongoDB bulk inserts inside a transaction or sequential saves
        // First save child references (Payloads, Requests, Responses)
        // Workerが生成した一時的なIDと、DB上の実際のIDを紐付けるマップ
        const payloadIdMap = new Map<string, any>();
        const screenshotIdMap = new Map<string, any>();
        const screenshotKeyMap = new Map<string, any>();

        if (payloads.length > 0) {
          console.log(
            `Processing ${payloads.length} payloads from S3 to MongoDB...`,
          );
          for (const p of payloads) {
            const { _id: workerId, ...payloadData } = p;

            // MD5が既にDBにあるかチェック
            let savedPayload = await PayloadModel.findOne({ md5: p.md5 });

            if (!savedPayload && p.s3Key) {
              // なければS3からダウンロードして保存
              console.log(`Downloading new payload for MD5: ${p.md5}`);
              const buffer = await downloadBuffer(p.s3Key);
              savedPayload = await PayloadModel.findOneAndUpdate(
                { md5: p.md5 },
                { ...payloadData, payload: buffer },
                { upsert: true, returnDocument: 'after' },
              );
            }

            if (savedPayload) {
              payloadIdMap.set(workerId, savedPayload._id);
            }
          }
        }

        if (screenshots.length > 0) {
          console.log(`Saving ${screenshots.length} screenshots to MongoDB...`);
          for (const s of screenshots) {
            const { _id: workerId, ...screenshotData } = s;

            // MD5が既にDBにあるかチェック
            let savedScreenshot = await ScreenshotModel.findOne({ md5: s.md5 });

            if (!savedScreenshot) {
              console.log(`Downloading new screenshot for MD5: ${s.md5}`);
              const buffer = await downloadBuffer(s.s3Key);
              savedScreenshot = await ScreenshotModel.findOneAndUpdate(
                { md5: s.md5 },
                { ...screenshotData, screenshot: buffer.toString('base64') },
                { upsert: true, returnDocument: 'after' },
              );
            }

            if (savedScreenshot) {
              screenshotIdMap.set(workerId, savedScreenshot._id);
              if (s.s3Key) {
                screenshotKeyMap.set(s.s3Key, savedScreenshot._id);
                const fileName = s.s3Key.split('/').pop();
                if (fileName)
                  screenshotKeyMap.set(fileName, savedScreenshot._id);
              }
            }
          }
        }

        // 子ドキュメント (Requests, Responses) の関連付けを確実にします
        for (const req of requests) {
          req.webpage = webpageId;
        }

        for (const res of responses) {
          res.webpage = webpageId;
          // Payload の ID が DB 側で変わった可能性があるため、Response 内の参照を更新します
          if (res.payload && payloadIdMap.has(res.payload)) {
            res.payload = payloadIdMap.get(res.payload);
          }
        }

        if (requests.length > 0) {
          console.log(`Saving ${requests.length} requests to MongoDB...`);
          try {
            await RequestModel.insertMany(requests, { ordered: false });
          } catch (err: any) {
            console.warn(
              `[ResultListener] Some requests failed to save for job ${jobId}:`,
              err.message,
            );
          }
        }

        if (responses.length > 0) {
          console.log(`Saving ${responses.length} responses to MongoDB...`);
          try {
            await ResponseModel.insertMany(responses, { ordered: false });
          } catch (err: any) {
            console.warn(
              `[ResultListener] Some responses failed to save for job ${jobId}:`,
              err.message,
            );
          }
        }

        // Replace full objects with IDs for the main Webpage document
        const webpageData = { ...webpage };
        webpageData.requests = requests.map((r: any) => r._id);
        webpageData.responses = responses.map((res: any) => res._id);

        // Handle harfile: if it's a string (S3 key), download it and create a Harfile document
        if (
          webpageData.harfile &&
          !mongoose.Types.ObjectId.isValid(webpageData.harfile)
        ) {
          if (webpageData.option?.noenrich) {
            console.log(
              `[ResultListener] Skipping HAR file processing as noenrich option is enabled.`,
            );
            delete webpageData.harfile;
          } else {
            console.log(
              `Queueing enrichment task for HAR file: ${webpageData.harfile}`,
            );
            const harTaskId = `har-${jobId}`;
            await this.enrichmentQueue.add(
              'process_har',
              {
                id: harTaskId,
                type: 'process_har',
                webpageId,
                s3Key: webpageData.harfile,
                timestamp: new Date().toISOString(),
              },
              { jobId: harTaskId },
            );
            // Remove the S3 key string from the data so it doesn't cause a CastError
            // when updating MongoDB (expects an ObjectId).
            // The harfile reference will be updated once the enrichment task completes.
            delete webpageData.harfile;
          }
        }

        // Update screenshot references
        if (
          webpageData.screenshot &&
          screenshotIdMap.has(webpageData.screenshot)
        ) {
          webpageData.screenshot = screenshotIdMap.get(webpageData.screenshot);
        } else if (
          webpageData.screenshot &&
          screenshotKeyMap.has(webpageData.screenshot)
        ) {
          webpageData.screenshot = screenshotKeyMap.get(webpageData.screenshot);
        } else if (
          webpageData.screenshot &&
          !mongoose.Types.ObjectId.isValid(webpageData.screenshot)
        ) {
          // If it's a direct S3 key but not in our maps, process it manually (fallback)
          const screenshotKey = webpageData.screenshot;
          console.log(
            `[ResultListener] Processing main screenshot from direct S3 key: ${screenshotKey}`,
          );
          try {
            const buffer = await downloadBuffer(screenshotKey);
            const md5 = crypto.createHash('md5').update(buffer).digest('hex');
            const savedScreenshot = await ScreenshotModel.findOneAndUpdate(
              { md5 },
              { md5, screenshot: buffer.toString('base64') },
              { upsert: true, returnDocument: 'after' },
            );
            if (savedScreenshot) {
              webpageData.screenshot = savedScreenshot._id;
              screenshotIdMap.set(screenshotKey, savedScreenshot._id);
            }
          } catch (e: any) {
            console.warn(
              `[ResultListener] Main screenshot mapping failed for key: ${screenshotKey} - ${e.message}`,
            );
            webpageData.screenshot = null;
          }
        }

        if (Array.isArray(webpageData.screenshots)) {
          for (const s of webpageData.screenshots) {
            if (s.full && screenshotIdMap.has(s.full)) {
              s.full = screenshotIdMap.get(s.full);
            } else if (s.full && screenshotKeyMap.has(s.full)) {
              s.full = screenshotKeyMap.get(s.full);
            } else if (s.full && !mongoose.Types.ObjectId.isValid(s.full)) {
              // Try manual fallback for gallery items too
              try {
                const buffer = await downloadBuffer(s.full);
                const md5 = crypto
                  .createHash('md5')
                  .update(buffer)
                  .digest('hex');
                const savedScreenshot = await ScreenshotModel.findOneAndUpdate(
                  { md5 },
                  { md5, screenshot: buffer.toString('base64') },
                  { upsert: true, returnDocument: 'after' },
                );
                if (savedScreenshot) s.full = savedScreenshot._id;
              } catch (e: any) {
                console.warn(
                  `[ResultListener] Gallery mapping failed for key: ${s.full}`,
                );
                s.full = null;
              }
            }
          }
        }

        // Webpage 内の Payload 参照（単一および配列）も更新します
        if (webpageData.payload && payloadIdMap.has(webpageData.payload)) {
          webpageData.payload = payloadIdMap.get(webpageData.payload);
        }
        if (Array.isArray(webpageData.payloads)) {
          webpageData.payloads = webpageData.payloads.map(
            (id: any) => payloadIdMap.get(id) || id,
          );
        }

        delete webpageData.payloads_data;
        delete webpageData.screenshots_data;

        // Save main webpage document
        // Use findByIdAndUpdate to merge results into the existing document (placeholder)
        // We remove _id from webpageData to prevent Mongoose from trying to update the immutable ID field
        const { _id, id, ...updateFields } = webpageData;
        console.log(
          `[ResultListener] MongoDB: Attempting to update Webpage ${webpageId} with ${updateFields.requests?.length || 0} requests and ${updateFields.responses?.length || 0} responses...`,
        );

        await WebpageModel.findByIdAndUpdate(webpageId, updateFields, {
          runValidators: true,
        });
        console.log(
          `[ResultListener] MongoDB: Webpage ${webpageId} successfully updated with scraped data.`,
        );

        // Update Website last crawled relation
        let websiteDoc = await WebsiteModel.findOne({ url: webpage.input });
        if (websiteDoc) {
          websiteDoc.last = webpageId;

          // Decrement tracking counter if it's active
          if (websiteDoc.track && websiteDoc.track.counter > 0) {
            websiteDoc.track.counter -= 1;
            console.log(
              `[ResultListener] Decremented tracking counter for ${websiteDoc.url}. Remaining: ${websiteDoc.track.counter}`,
            );
          }

          await websiteDoc.save();
          console.log(
            `[ResultListener] MongoDB: Updated existing Website ${websiteDoc._id} last reference to Webpage ${webpageId}`,
          );
        }

        console.log(
          `[ResultListener] MongoDB: Task ${jobId} status updated to "completed"`,
        );

        // Queue specialized enrichment tasks (Split into parallel jobs)
        console.log(
          `[ResultListener] DEBUG: webpageData.option =`,
          JSON.stringify(webpageData.option),
        );
        if (webpageData.option?.noenrich) {
          console.log(
            `[ResultListener] Skipping specialized enrichment tasks (yara, wappalyzer, dns) for Webpage ${webpageId} as noenrich option is enabled.`,
          );
          if (!webpageData.option?.keeps3) {
            console.log(`[ResultListener] Cleaning up source: ${resultKey}`);

            // Delete entire webpages/{webpageId}/ directory using batch delete
            const webpagePrefix = `webpages/${webpageId}/`;
            try {
              let continuationToken: string | undefined;
              let deletedCount = 0;

              do {
                const listResponse = await s3Client.send(
                  new ListObjectsV2Command({
                    Bucket: config.s3.bucket,
                    Prefix: webpagePrefix,
                    ContinuationToken: continuationToken,
                  }),
                );

                if (listResponse.Contents && listResponse.Contents.length > 0) {
                  const keysToDelete = listResponse.Contents.map((obj) => ({
                    Key: obj.Key!,
                  })).filter((item) => item.Key);

                  if (keysToDelete.length > 0) {
                    await s3Client.send(
                      new DeleteObjectsCommand({
                        Bucket: config.s3.bucket,
                        Delete: { Objects: keysToDelete },
                      }),
                    );
                    deletedCount += keysToDelete.length;
                  }
                }

                continuationToken = listResponse.NextContinuationToken;
              } while (continuationToken);

              console.log(
                `[ResultListener] Deleted entire webpage directory for ${webpageId} (${deletedCount} files)`,
              );
            } catch (err: any) {
              console.warn(
                `[ResultListener] Failed to cleanup webpage directory for ${webpageId}: ${err.message}`,
              );
            }
          }
        } else {
          console.log(
            `[ResultListener] Queueing specialized enrichment tasks (yara, wappalyzer, dns) for Webpage ${webpageId}...`,
          );
          const yaraRules = await YaraModel.find({ valid: true }).lean();
          const baseTaskData = {
            webpageId,
            resultKey, // 全ての子タスクが元のスクレイピング結果を参照できるようにする
            url: webpage.url || webpage.input,
            timestamp: new Date().toISOString(),
          };

          // Flow (依存関係) の作成
          await this.flowProducer.add({
            name: 'enrichment_finalizer',
            queueName: config.enrichmentQueue,
            data: { webpageId, resultKey },
            opts: { jobId: `finalizer-${webpageId}` },
            children: [
              {
                name: 'yara',
                data: { ...baseTaskData, content: webpage.content, yaraRules },
                queueName: config.enrichmentQueue,
                opts: {
                  jobId: `yara-${webpageId}`,
                  attempts: 2,
                  backoff: { type: 'fixed', delay: 0 },
                  ignoreDependencyOnFailure: true,
                },
              },
              {
                name: 'wappalyzer',
                data: { ...baseTaskData, content: webpage.content },
                queueName: config.enrichmentQueue,
                opts: {
                  jobId: `wappalyzer-${webpageId}`,
                  attempts: 2,
                  backoff: { type: 'fixed', delay: 0 }, // 自分のCPU処理なので待つ必要がない
                  ignoreDependencyOnFailure: true,
                },
              },
              {
                name: 'dns',
                data: { ...baseTaskData, remoteAddress: webpage.remoteAddress },
                queueName: config.enrichmentQueue,
                opts: {
                  jobId: `dns-${webpageId}`,
                  attempts: 3,
                  backoff: { type: 'exponential', delay: 1000 },
                  ignoreDependencyOnFailure: true,
                },
              },
            ],
          });
        }

        console.log(
          `[${timestamp}] Successfully persisted task ${jobId} results and updated status to completed.`,
        );
      } catch (err: any) {
        console.error(`Failed to process results for job ${jobId}:`, err);
      }
    });

    this.queueEvents.on('failed', async ({ jobId, failedReason }) => {
      const timestamp = new Date().toISOString();
      console.error(
        `[${timestamp}] Job ${jobId} failed in queue. Reason: ${failedReason}`,
      );
    });
  }
}
export default ResultListener;
