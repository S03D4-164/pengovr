import express, { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import WebpageModel from '../models/webpage';
import ResponseModel from '../models/response';

const router: Router = express.Router();

const ENRICHMENT_QUEUE = process.env.ENRICHMENT_QUEUE || 'enrichment-tasks';

// POST /api/ai/explain - Queue AI explanation task
router.post('/explain', async (req, res) => {
  try {
    const { targetId, webpageId, content, targetType, ai } = req.body;
    const enrichmentQueue = req.app.locals.enrichmentQueue;

    // targetId または webpageId のいずれかが必須
    if (!targetId && !webpageId) {
      return res
        .status(400)
        .json({ error: 'targetId or webpageId is required' });
    }

    // ai parameter validation
    if (!ai || !['gemini', 'bedrock'].includes(ai)) {
      return res
        .status(400)
        .json({ error: 'ai must be "gemini" or "bedrock"' });
    }

    // WorkerはDBにアクセスできないため、API側でコンテンツを用意する
    let contentToExplain = content;
    const idToFetchContent = targetId || webpageId; // コンテンツ取得に使用するID

    if (!contentToExplain && idToFetchContent) {
      if (targetType === 'response') {
        const targetDoc = await ResponseModel.findById(idToFetchContent);
        contentToExplain = targetDoc?.text;
      } else {
        const targetDoc = await WebpageModel.findById(idToFetchContent);
        contentToExplain = targetDoc?.content;
      }
    }

    if (!contentToExplain) {
      return res
        .status(400)
        .json({ error: 'Content to explain could not be found or is empty.' });
    }

    const taskType = ai === 'gemini' ? 'gemini_explain' : 'bedrock_explain';

    const task = {
      id: uuidv4(),
      type: taskType,
      targetId: targetId || webpageId, // 解説対象のID (ResponseまたはWebpage)
      webpageId: webpageId, // 親WebpageのID (常にWebpageのID)
      targetType: targetType || 'webpage',
      content: contentToExplain, // 取得したコンテンツをセット
      timestamp: new Date().toISOString(),
    };

    // Add to enrichment queue
    await enrichmentQueue.add(taskType, task, { jobId: task.id });

    res.json({
      message: 'AI explanation task queued',
      taskId: task.id,
    });
  } catch (error) {
    console.error('AI queue error:', error);
    res.status(500).json({
      error: 'Failed to queue explanation task',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// POST /api/ai/explain-content - Queue AI explanation task for raw content
router.post('/explain-content', async (req, res) => {
  try {
    const { content, ai } = req.body;
    const enrichmentQueue = req.app.locals.enrichmentQueue;

    if (!content) {
      return res.status(400).json({ error: 'content is required' });
    }

    // ai parameter validation
    if (!ai || !['gemini', 'bedrock'].includes(ai)) {
      return res
        .status(400)
        .json({ error: 'ai must be "gemini" or "bedrock"' });
    }

    const taskType =
      ai === 'gemini' ? 'gemini_explain_content' : 'bedrock_explain_content';

    // Create enrichment task with raw content
    const task = {
      id: uuidv4(),
      type: taskType,
      content: content.substring(0, 100000), // Limit content size
      timestamp: new Date().toISOString(),
    };

    // Add to enrichment queue
    await enrichmentQueue.add(taskType, task);

    res.json({
      message: 'AI explanation task queued',
      taskId: task.id,
    });
  } catch (error) {
    console.error('AI queue error:', error);
    res.status(500).json({
      error: 'Failed to queue explanation task',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/ai/result/:taskId - Get AI explanation result
router.get('/result/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    const redis = req.app.locals.redis;

    if (!taskId) {
      return res.status(400).json({ error: 'taskId is required' });
    }

    // Get result from Redis (key format: aiexplain:result:${taskId})
    const result = await redis.get(`aiexplain:result:${taskId}`);

    if (!result) {
      return res.json({
        status: 'pending',
        message: 'Result not yet available',
      });
    }

    const parsedResult = JSON.parse(result);
    res.json({ status: 'completed', ...parsedResult });
  } catch (error) {
    console.error('AI result error:', error);
    res.status(500).json({
      error: 'Failed to get explanation result',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/ai/result/:targetId/:targetType - Get AI explanation from document
router.get('/result/:targetId/:targetType', async (req, res) => {
  try {
    const { targetId, targetType } = req.params;

    if (!targetId || !targetType) {
      return res
        .status(400)
        .json({ error: 'targetId and targetType are required' });
    }

    let document = null;

    if (targetType === 'response') {
      document = await ResponseModel.findById(targetId);
    } else {
      document = await WebpageModel.findById(targetId);
    }

    if (!document) {
      return res.status(404).json({ error: `${targetType} not found` });
    }

    if (document.aiExplanation) {
      res.json({
        status: 'completed',
        explanation: document.aiExplanation,
      });
    } else {
      res.json({ status: 'pending', message: 'Explanation not yet available' });
    }
  } catch (error) {
    console.error('AI result error:', error);
    res.status(500).json({
      error: 'Failed to get explanation result',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
