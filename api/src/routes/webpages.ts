import express, { Router } from 'express';
import WebpageModel from '../models/webpage';
import { HarfileModel } from '../models/harfile';

const router: Router = express.Router();

// Get all webpages with pagination or ID filtering
router.get('/', async (req, res) => {
  try {
    const timestamp = new Date().toISOString();
    console.log(
      `[${timestamp}] WEBPAGES_QUERY_REQUEST - IP: ${req.ip}, Params:`,
      req.query,
    );

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;
    const ids = req.query.ids as string;
    const input = req.query.input as string;
    const search = (req.query.search as string) || '';
    const startDate = (req.query.startDate as string) || '';
    const endDate = (req.query.endDate as string) || '';

    let webpages;
    let total;

    if (ids) {
      // Filter by specific IDs
      const idArray = ids.split(',').filter((id) => id.trim());
      console.log(`[${timestamp}] WEBPAGES_FILTER_IDS - IDs:`, idArray);
      webpages = await WebpageModel.find({ _id: { $in: idArray } })
        .sort({ createdAt: -1 })
        .populate('screenshot')
        .populate('screenshots.full')
        .populate('payloads');
      total = webpages.length;
    } else if (input) {
      // Filter by input field (exact match with Website.url)
      const filter = { input: input };
      console.log(`[${timestamp}] WEBPAGES_FILTER_INPUT - Query:`, filter);
      [webpages, total] = await Promise.all([
        WebpageModel.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate('screenshot')
          .populate('screenshots.full')
          .populate('payloads'),
        WebpageModel.countDocuments(filter),
      ]);
    } else {
      // Regular pagination with search and date filters
      const query: any = {};

      if (search) {
        query.$or = [
          { url: { $regex: search, $options: 'i' } },
          { title: { $regex: search, $options: 'i' } },
          { input: { $regex: search, $options: 'i' } },
        ];
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

      const payloadId = req.query.payloadId as string;
      if (payloadId) {
        // Filter by payloadId - check both single payload and payloads array
        query.$or = [
          { payload: payloadId },
          { payloads: { $in: [payloadId] } },
        ];
      }

      const yaraRuleId = req.query.yaraRuleId as string;
      if (yaraRuleId) {
        // Filter by YARA rule ID
        query['yara.rules.id'] = { $regex: yaraRuleId, $options: 'i' };
      }

      console.log(
        `[${timestamp}] WEBPAGES_FILTER_GENERAL - Final Mongo Query:`,
        JSON.stringify(query),
      );

      [webpages, total] = await Promise.all([
        WebpageModel.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate('screenshot')
          .populate('screenshots.full')
          .populate('payloads'),
        WebpageModel.countDocuments(query),
      ]);
    }

    console.log(`[${timestamp}] WEBPAGES_QUERY_SUCCESS - Found: ${total} docs`);

    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    // Add request/response counts to each webpage
    const docsWithCounts = webpages.map((webpage) => {
      const doc = webpage.toObject ? webpage.toObject() : webpage;
      return {
        ...doc,
        requestCount: webpage.requests?.length || 0,
        responseCount: webpage.responses?.length || 0,
      };
    });

    res.json({
      docs: docsWithCounts,
      totalDocs: total,
      limit,
      totalPages,
      page,
      pagingCounter: page,
      hasPrevPage,
      hasNextPage,
      prevPage: hasPrevPage ? page - 1 : null,
      nextPage: hasNextPage ? page + 1 : null,
    });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] WEBPAGES_QUERY_ERROR:`, error);
    res
      .status(500)
      .json({ error: 'Failed to fetch webpages', details: error.message });
  }
});

// Get single webpage by ID
router.get('/:id', async (req, res) => {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
  const userAgent = req.get('User-Agent') || 'unknown';

  console.log(
    `[${timestamp}] WEBPAGE_DETAIL_REQUEST - IP: ${clientIP}, ID: ${req.params.id}, User-Agent: ${userAgent}`,
  );

  try {
    const webpage = await WebpageModel.findById(req.params.id)
      .populate('requests')
      .populate('responses')
      .populate('screenshot')
      .populate('screenshots.full')
      .populate('payloads');

    const responseTime = Date.now() - startTime;

    if (!webpage) {
      console.log(
        `[${timestamp}] WEBPAGE_DETAIL_NOT_FOUND - IP: ${clientIP}, ID: ${req.params.id}, ResponseTime: ${responseTime}ms`,
      );
      return res.status(404).json({ error: 'Webpage not found' });
    }

    console.log(
      `[${timestamp}] WEBPAGE_DETAIL_SUCCESS - IP: ${clientIP}, ID: ${req.params.id}, ResponseTime: ${responseTime}ms, HasRequests: ${webpage.requests?.length || 0}, HasResponses: ${webpage.responses?.length || 0}`,
    );
    res.json(webpage);
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error(
      `[${timestamp}] WEBPAGE_DETAIL_ERROR - IP: ${clientIP}, ID: ${req.params.id}, ResponseTime: ${responseTime}ms, Error: ${error.message}`,
    );
    console.error('Error stack:', error.stack);
    res
      .status(500)
      .json({ error: 'Failed to fetch webpage', details: error.message });
  }
});

// Download HAR file
router.get('/:id/harfile', async (req, res) => {
  try {
    // 明示的に HarfileModel クラスを渡すことで MissingSchemaError を回避します
    const webpage = await WebpageModel.findById(req.params.id).populate({
      path: 'harfile',
      model: HarfileModel,
    });

    if (!webpage) {
      return res.status(404).json({ error: 'Webpage not found' });
    }

    if (!webpage.harfile) {
      return res
        .status(404)
        .json({ error: 'HAR file not found for this webpage' });
    }

    // Set headers for file download
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${webpage._id}.har.zip"`,
    );

    // webpage.harfile is already populated, so we can use it directly
    // The populated object is stored in 'harfile' property
    const harData = (webpage.harfile as any).har;

    res.send(harData);
  } catch (error: any) {
    console.error('Error downloading HAR file:', error);
    res
      .status(500)
      .json({ error: 'Failed to download HAR file', details: error.message });
  }
});

export default router;
