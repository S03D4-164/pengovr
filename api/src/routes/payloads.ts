import express, { Router } from 'express';
import PayloadModel from '../models/payload';
import config from '../config';

const router: Router = express.Router();

// Get all payloads
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = (req.query.search as string) || '';
    const skip = (page - 1) * limit;

    const query: any = {};
    if (search) {
      query.$or = [
        { md5: { $regex: search, $options: 'i' } },
        { 'yara.rules.id': { $regex: search, $options: 'i' } },
        { fileType: { $regex: search, $options: 'i' } },
        { 'tag.url': { $regex: search, $options: 'i' } },
      ];
    }

    const payloads = await PayloadModel.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await PayloadModel.countDocuments(query);

    const docs = payloads.map((p) => ({
      _id: p._id,
      md5: p.md5,
      tag: p.tag,
      yara: p.yara,
      size: p.payload?.length || 0,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));

    res.json({
      docs: docs,
      totalDocs: total,
      limit: limit,
      page: page,
      totalPages: Math.ceil(total / limit),
      hasPrevPage: page > 1,
      hasNextPage: page < Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Error fetching payloads:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/payloads/:id/vt-search - Queue VT search task for payload
router.post('/:id/vt-search', async (req: any, res) => {
  try {
    const payload = await PayloadModel.findById(req.params.id);

    if (!payload) {
      return res.status(404).json({ error: 'Payload not found' });
    }

    // Queue VT search task to enrichment worker
    const enrichmentQueue = req.app.locals.enrichmentQueue;
    const vtTaskId = `vt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const task = {
      id: vtTaskId,
      type: 'vt_search',
      payloadId: req.params.id,
      md5: payload.md5,
      timestamp: new Date().toISOString(),
    };

    await enrichmentQueue.add('vt_search', task, { jobId: vtTaskId });

    res.json({
      message: 'VT search task queued successfully',
      payloadId: req.params.id,
      queuedAt: task.timestamp,
    });
  } catch (error) {
    console.error('Error queuing VT search task:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/payloads/:id - Get payload by ID
router.get('/:id', async (req, res) => {
  try {
    const payload = await PayloadModel.findById(req.params.id);

    if (!payload) {
      return res.status(404).json({ error: 'Payload not found' });
    }

    // Convert Buffer to base64 for JSON response
    const responsePayload = {
      _id: payload._id,
      payload: payload.payload.toString('base64'),
      md5: payload.md5,
      fileType: payload.fileType,
      vt: payload.vt,
      tag: payload.tag,
      yara: payload.yara,
      createdAt: payload.createdAt,
      updatedAt: payload.updatedAt,
    };

    res.json(responsePayload);
  } catch (error) {
    console.error('Error fetching payload:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
