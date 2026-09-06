import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import WebpageModel from '../models/webpage';
import WebsiteModel from '../models/website';

const tasksRouter: Router = Router();

// Create a new task
tasksRouter.post('/', async (req: any, res: any) => {
  try {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] TASK_CREATE_REQUEST - URL: "${req.body.url}"`);

    const { url: taskUrl, options: taskOptions = {} } = req.body;

    if (!taskUrl || !taskUrl.match(/^(http|ftp)s?:\/\/.+/)) {
      return res.status(400).json({ error: 'Invalid URL' });
    }

    // --- Websiteの作成とGSB連携を追加 ---
    let website = await WebsiteModel.findOne({ url: taskUrl });
    if (!website) {
      console.log(
        `[${timestamp}] Creating new Website document via Task route: ${taskUrl}`,
      );
      website = new WebsiteModel({
        url: taskUrl,
      });
      await website.save();

      // GSBルックアップをキューに追加（noenrichが設定されていない場合のみ）
      if (!taskOptions?.noenrich) {
        const enrichmentQueue = req.app.locals.enrichmentQueue;
        const gsbTaskId = uuidv4();
        await enrichmentQueue.add(
          'gsb_lookup',
          {
            id: gsbTaskId,
            type: 'gsb_lookup',
            websiteId: website._id.toString(),
            url: taskUrl,
            timestamp: new Date().toISOString(),
          },
          { jobId: gsbTaskId },
        );
        console.log(
          `[${timestamp}] GSB lookup task queued for new website via Task route`,
        );
      } else {
        console.log(`[${timestamp}] GSB lookup skipped due to noenrich option`);
      }
    }
    // ----------------------------------

    const taskId = uuidv4();

    // Create webpage immediately
    const webpage = new WebpageModel({
      input: taskUrl,
      option: taskOptions,
    });
    await webpage.save();
    console.log(
      `[${timestamp}] Webpage created via Task route. ID: ${webpage._id}`,
    );

    // Add to Redis queue using BullMQ for processing
    const scrapingQueue = req.app.locals.scrapingQueue;
    console.log(
      `[${timestamp}] Adding task to BullMQ "scraping-tasks" queue...`,
    );
    await scrapingQueue.add(
      'scrape',
      {
        id: taskId,
        url: taskUrl,
        options: taskOptions,
        webpageId: webpage._id.toString(),
        websiteId: website._id.toString(),
      },
      {
        jobId: taskId, // 二重実行防止 (重複排除)
        attempts: 3, // 最大3回リトライ
        backoff: {
          type: 'exponential',
          delay: 5000, // 指数バックオフ (初期5秒)
        },
      },
    );
    console.log(`[${timestamp}] TASK_CREATE_SUCCESS - TaskID: ${taskId}`);

    res.status(201).json({
      message: 'Task created successfully',
      webpageId: webpage._id.toString(), // Return webpageId immediately
    });
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({
      error: 'Failed to create task',
      details: error.message,
    });
  }
});

export default tasksRouter;
