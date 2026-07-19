import express, { Router } from 'express';
import ResponseModel from '../models/response';

const router: Router = express.Router();

// Get all responses with pagination
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;
    const search = (req.query.search as string) || '';
    const startDate = (req.query.startDate as string) || '';
    const endDate = (req.query.endDate as string) || '';
    const urlRegex = (req.query.urlRegex as string) || '';
    const textRegex = (req.query.textRegex as string) || '';
    const ipRegex = (req.query.ipRegex as string) || '';
    const yaraRegex = (req.query.yaraRegex as string) || '';
    const payloadId = (req.query.payloadId as string) || '';
    const yaraRuleId = (req.query.yaraRuleId as string) || '';

    const query: any = {};

    if (search) {
      query.$or = [
        { url: { $regex: search, $options: 'i' } },
        { text: { $regex: search, $options: 'i' } },
        { 'yara.rules.id': { $regex: search, $options: 'i' } },
      ];
    }

    if (urlRegex) {
      query.url = { $regex: urlRegex };
    }

    if (textRegex) {
      query.text = { $regex: textRegex };
    }

    if (ipRegex) {
      query['remoteAddress.ip'] = { $regex: ipRegex };
    }

    if (yaraRegex) {
      query['yara.rules.id'] = { $regex: yaraRegex, $options: 'i' };
    }

    if (payloadId) {
      query.payload = payloadId;
    }

    if (yaraRuleId) {
      // Filter by YARA rule ID
      query['yara.rules.id'] = { $regex: yaraRuleId, $options: 'i' };
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        const [year, month, day] = startDate.split('-').map(Number);
        const start = new Date(year, month - 1, day, 0, 0, 0, 0);
        query.createdAt.$gte = start;
      }
      if (endDate) {
        const [year, month, day] = endDate.split('-').map(Number);
        const end = new Date(year, month - 1, day, 23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    console.log('[Debug API] Query:', JSON.stringify(query));
    console.log('[Debug API] Skip:', skip, 'Limit:', limit);

    const [responses, total] = await Promise.all([
      ResponseModel.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate(['webpage', 'request']),
      ResponseModel.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.json({
      docs: responses,
      totalDocs: total,
      limit,
      totalPages,
      page,
      pagingCounter: (page - 1) * limit + 1,
      hasPrevPage,
      hasNextPage,
      prevPage: hasPrevPage ? page - 1 : null,
      nextPage: hasNextPage ? page + 1 : null,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch responses' });
  }
});

// Get single response by ID
router.get('/:id', async (req, res) => {
  try {
    const response = await ResponseModel.findById(req.params.id);

    if (!response) {
      return res.status(404).json({ error: 'Response not found' });
    }

    // Try to populate, but don't fail if references don't exist
    try {
      await response.populate('webpage');
    } catch (e) {
      console.warn('Failed to populate webpage:', e);
    }
    try {
      await response.populate('request');
    } catch (e) {
      console.warn('Failed to populate request:', e);
    }
    try {
      await response.populate('payload');
    } catch (e) {
      console.warn('Failed to populate payload:', e);
    }

    res.json(response);
  } catch (error) {
    console.error('Error fetching response:', error);
    res.status(500).json({ error: 'Failed to fetch response' });
  }
});

export default router;
