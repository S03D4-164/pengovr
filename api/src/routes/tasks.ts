import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import Task from '../models/tasks';
import WebpageModel from '../models/webpage';
import WebsiteModel from '../models/website';

const tasksRouter: Router = Router();

interface TaskResponse {
  id: string;
  url: string;
  options: any;
  status: string;
  createdAt: Date;
  updatedAt?: Date;
  webpageId?: string;
  error?: string;
  results?: Array<{
    _id: string;
    taskId: string;
    url: string;
    title: string;
    screenshot: string | null;
    response: {
      status: number;
      statusText: string;
      timestamp: Date;
    };
    scrapedAt: Date;
    createdAt: Date;
  }>;
}

// Create a new task
tasksRouter.post('/', async (req: any, res: any) => {
  try {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] TASK_CREATE_REQUEST - URL: "${req.body.url}"`);

    const { url: taskUrl, options: taskOptions = {} } = req.body;

    if (!taskUrl || !taskUrl.match(/^https?:\/\/.+/)) {
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
        gsb: { lookup: { matches: [] } },
      });
      await website.save();

      // GSBルックアップをキューに追加
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
    }
    // ----------------------------------

    const taskId = uuidv4();

    // Create webpage immediately
    const webpage = new WebpageModel({
      input: taskUrl,
      url: taskUrl,
      option: {
        userAgent: taskOptions.userAgent || undefined,
        referer: taskOptions.referrer || undefined,
        lang: taskOptions.language || undefined,
        disableScript: taskOptions.disableScript || false,
        proxy: taskOptions.proxy || undefined,
        actions: taskOptions.actions || undefined,
        timeout: taskOptions.timeout || 30,
        delay: taskOptions.delay || 5,
        //pptr: taskOptions.pptr || undefined,
        //cloudflare: taskOptions.cloudflare || false,
        exHeaders: taskOptions.extraHeaders || undefined,
        track: taskOptions.track || undefined,
        noenrich: taskOptions.noenrich || false,
        recordHar: taskOptions.recordHar || false,
        scrot: taskOptions.scrot || false,
      },
      status: 0, // 0 = pending, will be updated by worker
    });
    await webpage.save();
    console.log(
      `[${timestamp}] Webpage created via Task route. ID: ${webpage._id}`,
    );

    /*
    const task = new Task({
      id: taskId,
      url: taskUrl,
      options: {
        userAgent: taskOptions.userAgent || null,
        referrer: taskOptions.referrer || null,
        language: taskOptions.language || null,
        disableScript: taskOptions.disableScript || false,
        proxy: taskOptions.proxy || null,
        actions: taskOptions.actions || null,
        timeout: taskOptions.timeout || 30,
        delay: taskOptions.delay || 5,
        extraHeaders: taskOptions.extraHeaders || null,
        track: taskOptions.track || null,
        noenrich: taskOptions.noenrich || false,
        recordHar: taskOptions.recordHar || false,
        scrot: taskOptions.scrot || false,
      },
      webpageId: webpage._id.toString(), // Set webpageId immediately
      status: 'pending',
    });
    */

    //await task.save();
    //console.log(`[${timestamp}] Task record saved. ID: ${taskId}`);

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
        //webpage: webpage.toObject(), // Workerが必要なデータをすべて含める
      },
      {
        jobId: taskId, // 二重実行防止 (重複排除)
        attempts: 3, // 最大3回リトライ
        backoff: {
          type: 'exponential',
          delay: 5000, // 指数バックオフ (初期5秒)
        },
        //delay: task.options.delay ? task.options.delay * 1000 : 0, // 遅延実行
      },
    );
    console.log(`[${timestamp}] TASK_CREATE_SUCCESS - TaskID: ${taskId}`);

    res.status(201).json({
      message: 'Task created successfully',
      //taskId,
      webpageId: webpage._id.toString(), // Return webpageId immediately
      /*
      task: {
        id: taskId,
        url: taskUrl,
        options: taskOptions,
        status: task.status,
        webpageId: webpage._id.toString(),
        createdAt: task.createdAt,
      },
      */
    });
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({
      error: 'Failed to create task',
      details: error.message,
    });
  }
});

// Get all tasks
tasksRouter.get('/', async (req: any, res: any) => {
  try {
    const tasksList = await Task.find().sort({ createdAt: -1 });

    res.json({
      results: tasksList.map(
        (taskItem: any): TaskResponse => ({
          id: taskItem.id,
          url: taskItem.url,
          options: taskItem.options,
          status: taskItem.status,
          createdAt: taskItem.createdAt,
          updatedAt: taskItem.updatedAt,
          webpageId: taskItem.webpageId,
        }),
      ),
      total: tasksList.length,
    });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// Get a specific task
tasksRouter.get('/:id', async (req: any, res: any) => {
  try {
    const taskItem = await Task.findOne({ id: req.params.id }).populate(
      'webpageId',
    );

    if (!taskItem) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const response: TaskResponse = {
      id: taskItem.id,
      url: taskItem.url,
      options: taskItem.options,
      status: taskItem.status,
      createdAt: taskItem.createdAt,
      updatedAt: taskItem.updatedAt,
      webpageId: taskItem.webpageId,
      error: taskItem.error,
      // PopulateされたWebpageオブジェクトをTaskResponseの型に合わせて変換して返す
      results: taskItem.webpageId
        ? [
            {
              _id: (taskItem.webpageId as any)._id.toString(),
              taskId: taskItem.id,
              url:
                (taskItem.webpageId as any).url ||
                (taskItem.webpageId as any).input,
              title: (taskItem.webpageId as any).title || 'Scraped Page',
              screenshot: (taskItem.webpageId as any).thumbnail || null,
              response: {
                status: (taskItem.webpageId as any).status || 0,
                statusText:
                  (taskItem.webpageId as any).status >= 400 ? 'Error' : 'OK',
                timestamp: (taskItem.webpageId as any).createdAt,
              },
              scrapedAt: (taskItem.webpageId as any).createdAt,
              createdAt: (taskItem.webpageId as any).createdAt,
            },
          ]
        : [],
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching task:', error);
    res.status(500).json({ error: 'Failed to fetch task' });
  }
});

export default tasksRouter;
