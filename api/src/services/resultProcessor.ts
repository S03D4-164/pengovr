import { QueueEvents, Queue } from 'bullmq';
import {
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import s3Client, { downloadBuffer } from '../utils/s3'; // 共通のクライアントをインポート
import mongoose from 'mongoose';
import WebsiteModel from '../models/website';
import WebpageModel from '../models/webpage';
import ResponseModel from '../models/response';
import PayloadModel from '../models/payload';
import { HarfileModel } from '../models/harfile';
import config from '../config';
import { logError, shouldLog } from '../utils/logger';

async function getJsonFromS3(key: string) {
  try {
    const data = await s3Client.send(
      new GetObjectCommand({
        Bucket: config.s3.bucket,
        Key: key,
      }),
    );
    const body = await data.Body?.transformToString();
    return body ? JSON.parse(body) : null;
  } catch (e) {
    // 404 (NoSuchKey) の場合はエラーログを出さない
    if (e.name === 'NoSuchKey' || e.$metadata?.httpStatusCode === 404) {
      return null;
    }
    console.error(
      `[ResultProcessor] Error fetching JSON from S3 (${key}):`,
      e.message,
    );
    return null;
  }
}

export function initResultListeners(
  redisConnection: any,
  enrichmentQueue: Queue,
) {
  console.log(
    `[ResultProcessor] Initializing listeners for queue: ${config.enrichmentQueue}`,
  );
  const enrichmentEvents = new QueueEvents(config.enrichmentQueue, {
    connection: redisConnection,
  });

  enrichmentEvents.on('completed', async ({ jobId }) => {
    console.log(
      `[ResultProcessor] Job ${jobId} completion event received. Fetching results from SeaweedFS...`,
    );

    const job = await enrichmentQueue.getJob(jobId);
    if (!job) {
      console.warn(
        `[ResultProcessor] Job ${jobId} not found in enrichment queue. (Check removeOnComplete setting)`,
      );
      return;
    }

    // ジョブの種類に応じた適切な結果ファイルのみを処理する
    if (job.name === 'gsb_lookup') {
      const websiteId = job.data.websiteId;
      const s3Key = `websites/${websiteId}/gsb/${jobId}.json`;
      const gsbResult = await getJsonFromS3(s3Key);
      if (gsbResult) {
        await WebsiteModel.findByIdAndUpdate(gsbResult.websiteId, {
          $set: { gsb: { lookup: gsbResult.gsb } },
        });
        console.log(
          `[ResultProcessor] MongoDB: GSB matches (${gsbResult.gsb.matches?.length || 0}) saved for Website ${gsbResult.websiteId}`,
        );
        await s3Client.send(
          new DeleteObjectCommand({
            Bucket: config.s3.bucket,
            Key: s3Key,
          }),
        );
        return;
      }
    } else if (['enrichment', 'yara', 'wappalyzer', 'dns'].includes(job.name)) {
      // Worker側で保存した jobId.json を取得
      const targetWebpageId = job.data.webpageId;
      const s3Key = `webpages/${targetWebpageId}/enrichments/${job.name}.json`;
      const enrichResult = await getJsonFromS3(s3Key);
      if (enrichResult) {
        const webpageData = { ...enrichResult.webpage };

        // harfile が ObjectId ではなく S3 キー（文字列パス）の場合は削除して CastError を防ぐ
        if (
          webpageData.harfile &&
          !mongoose.Types.ObjectId.isValid(webpageData.harfile)
        ) {
          delete webpageData.harfile;
        }

        // jobId はプレフィックス付き（yara-IDなど）なので data.webpageId を優先
        const targetWebpageId =
          job.data.webpageId || webpageData._id || webpageData.id;

        // ホワイトリスト方式: 解析結果として更新を許可するフィールドのみを抽出
        const updateFields: any = {};

        // job.name に基づいて、更新を許可するフィールドを厳格に制限します
        const fieldMapping: Record<string, string[]> = {
          enrichment: ['wappalyzer', 'yara', 'remoteAddress'],
          wappalyzer: ['wappalyzer'],
          yara: ['yara'],
          dns: ['remoteAddress'],
        };

        const allowedFields = fieldMapping[job.name] || [];

        allowedFields.forEach((field) => {
          if (webpageData[field] !== undefined) {
            updateFields[field] = webpageData[field];
          }
        });
        updateFields.updatedAt = new Date();

        console.log(
          `[ResultProcessor] MongoDB: Updating Webpage ${targetWebpageId} with results from ${job.name}...`,
        );
        const webpage = await WebpageModel.findByIdAndUpdate(targetWebpageId, {
          $set: updateFields,
        });

        if (enrichResult.responses) {
          console.log(
            `[ResultProcessor] MongoDB: Updating ${enrichResult.responses.length} associated responses...`,
          );
          for (const res of enrichResult.responses) {
            const { _id: resId } = res;
            if (!resId) continue;

            // Responseに対するホワイトリスト
            const resFields: any = {};
            allowedFields.forEach((field) => {
              if (res[field] !== undefined) {
                resFields[field] = res[field];
              }
            });

            if (
              resFields.wappalyzer ||
              resFields.yara ||
              resFields.remoteAddress
            ) {
              console.log(
                `[ResultProcessor] Response ${resId} updated by ${job.name}: ${Object.keys(resFields).join(', ')}`,
              );
            }

            try {
              const updated = await ResponseModel.findByIdAndUpdate(
                resId,
                { $set: resFields },
                { returnDocument: 'after' },
              );
              if (updated) {
                console.log(
                  `[ResultProcessor] MongoDB: Response ${resId} updated with enrichment metadata.`,
                );
              } else {
                console.warn(
                  `[ResultProcessor] MongoDB: Response ${resId} not found in database. Update skipped.`,
                );
              }
            } catch (err: any) {
              console.error(
                `[ResultProcessor] Error updating response ${resId}:`,
                err.message,
              );
            }
          }
        }
        console.log(
          `[ResultProcessor] MongoDB: Enrichment results successfully synced for Webpage ${targetWebpageId}`,
        );

        // 解析ワーカーが作成した一時的な結果ファイルを削除
        if (!webpage.option?.keeps3) {
          await s3Client.send(
            new DeleteObjectCommand({ Bucket: config.s3.bucket, Key: s3Key }),
          );
        }
        return;
      }
    } else if (job.name === 'vt_search') {
      const payloadId = job.data.payloadId;
      const s3Key = `payloads/${payloadId}/vt/${jobId}.json`;
      const vtResult = await getJsonFromS3(s3Key);
      if (vtResult) {
        await PayloadModel.findByIdAndUpdate(payloadId, {
          $set: { vt: vtResult.vt },
        });
        console.log(
          `[ResultProcessor] MongoDB: VT search results saved for Payload ${payloadId}`,
        );
        await s3Client
          .send(
            new DeleteObjectCommand({
              Bucket: config.s3.bucket,
              Key: s3Key,
            }),
          )
          .catch(() => null);
        return;
      }
    } else if (job.name === 'enrichment_finalizer') {
      console.log(job.data);
      // すべての子ジョブ (yara, wappalyzer, dns) が成功した後にここが実行される
      const webpageId = job.data.webpageId;

      // Check if keeps3 is enabled
      let keeps3 = false;
      if (webpageId) {
        try {
          const webpage = await WebpageModel.findById(webpageId);
          keeps3 = webpage?.option?.keeps3 || false;
        } catch (err) {
          console.warn(`Failed to fetch webpage ${webpageId}:`, err);
        }
      }

      if (!keeps3) {
        console.log(
          `[ResultProcessor] All enrichment sub-tasks completed. Cleaning up entire webpage directory for ${webpageId}...`,
        );

        // Delete entire webpages/{webpageId}/ directory using batch delete
        if (webpageId) {
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
              `[ResultProcessor] Deleted entire webpage directory for ${webpageId} (${deletedCount} files)`,
            );
          } catch (err: any) {
            console.warn(
              `[ResultProcessor] Failed to cleanup webpage directory for ${webpageId}: ${err.message}`,
            );
          }
        }
      } else {
        console.log(
          `[ResultProcessor] Skipping S3 cleanup for webpage ${webpageId} because keeps3 is enabled`,
        );
      }
      return;
    } else if (
      job.name === 'gemini_explain' ||
      job.name === 'bedrock_explain'
    ) {
      let s3Key: string;
      if (job.data.targetType === 'response') {
        s3Key = `responses/${job.data.targetId}/explanations/${jobId}.txt`;
      } else if (job.data.targetType === 'webpage') {
        s3Key = `webpages/${job.data.targetId}/explanations/${jobId}.txt`;
      } else {
        // deobfuscator or other types
        s3Key = `explanations/${job.name}/content-${jobId}.txt`;
      }

      const explanation = await s3Client
        .send(
          new GetObjectCommand({
            Bucket: config.s3.bucket,
            Key: s3Key,
          }),
        )
        .then((res) => res.Body?.transformToString())
        .catch(() => null);

      if (explanation) {
        const targetId = job.data.targetId || job.data.webpageId;
        console.log(
          `[ResultProcessor] MongoDB: Saving ${job.name} explanation to ${job.data.targetType} ${targetId}...`,
        );
        if (job.data.targetType === 'response') {
          await ResponseModel.findByIdAndUpdate(targetId, {
            aiExplanation: explanation,
          });
        } else {
          await WebpageModel.findByIdAndUpdate(targetId, {
            aiExplanation: explanation,
          });
        }
        console.log(
          `[ResultProcessor] MongoDB: ${job.name} explanation successfully saved.`,
        );

        // 説明をS3から削除
        await s3Client
          .send(
            new DeleteObjectCommand({
              Bucket: config.s3.bucket,
              Key: s3Key,
            }),
          )
          .catch(() => null);
        return;
      }
    } else if (job.name === 'process_har') {
      const { s3Key, webpageId } = job.data;
      if (s3Key && webpageId) {
        console.log(
          `[ResultProcessor] Persisting HAR from S3 to MongoDB: ${s3Key}`,
        );
        try {
          const harBuffer = await downloadBuffer(s3Key);
          if (harBuffer && harBuffer.length > 0) {
            const harDoc = new HarfileModel({
              har: harBuffer,
              webpage: webpageId,
            });
            console.log(
              `[ResultProcessor] MongoDB: Saving HAR binary for Webpage ${webpageId}...`,
            );
            const savedHar = await harDoc.save();

            const webpage = await WebpageModel.findByIdAndUpdate(webpageId, {
              $set: { harfile: savedHar._id },
            });
            console.log(
              `[ResultProcessor] MongoDB: HAR file persisted (ID: ${savedHar._id}) and linked to Webpage ${webpageId}`,
            );

            // DB保存完了後、S3の一時ファイル（ZIP）を削除
            if (!webpage.option?.keeps3) {
              await s3Client.send(
                new DeleteObjectCommand({
                  Bucket: config.s3.bucket,
                  Key: s3Key,
                }),
              );
            }
          }
        } catch (err: any) {
          console.error(
            `[ResultProcessor] Failed to persist HAR for ${webpageId}:`,
            err.message,
          );
        }
        return;
      }
    } else if (
      ['gemini_explain_content', 'bedrock_explain_content'].includes(job.name)
    ) {
      // AI explanation for raw content is stored directly in Redis by enricher
      // No additional processing needed here
      console.log(
        `[ResultProcessor] Job ${job.name} ${jobId} completed. Result stored in Redis.`,
      );
      return;
    }

    // どの結果ファイルも処理されなかった場合のログ
    console.log(
      `[ResultProcessor] Job ${jobId} finished processing (no specific result file matched).`,
    );
  });

  enrichmentEvents.on('error', (error) => {
    if (shouldLog()) {
      logError(`[ResultProcessor] QueueEvents error:`, error);
    }
  });
}
