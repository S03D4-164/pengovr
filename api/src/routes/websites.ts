import express, { Router } from 'express';
import WebsiteModel from '../models/website';
import { v4 as uuidv4 } from 'uuid';
import WebpageModel from '../models/webpage';

const router: Router = express.Router();

// Get all websites with pagination
router.get('/', async (req, res) => {
  try {
    const timestamp = new Date().toISOString();
    console.log(
      `[${timestamp}] WEBSITE_QUERY_REQUEST - IP: ${req.ip}, Params:`,
      req.query,
    );

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = (req.query.search as string) || '';
    const startDate = (req.query.startDate as string) || '';
    const endDate = (req.query.endDate as string) || '';
    const onlyTracking = req.query.onlyTracking === 'true';
    const skip = (page - 1) * limit;

    const query: any = {};

    if (search) {
      query.url = { $regex: search, $options: 'i' };
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

    if (onlyTracking) {
      query['track.counter'] = { $gt: 0 };
    }

    const [websites, total] = await Promise.all([
      WebsiteModel.find(query)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('last')
        .maxTimeMS(30000),
      WebsiteModel.countDocuments(query).maxTimeMS(30000),
    ]);

    console.log(`[${timestamp}] WEBSITE_QUERY_SUCCESS - Found: ${total} docs`);

    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.json({
      docs: websites,
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
    console.error(`[${new Date().toISOString()}] WEBSITE_QUERY_ERROR:`, error);
    res.status(500).json({
      error: 'Failed to fetch websites',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

// Get single website by ID
router.get('/:id', async (req, res) => {
  try {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] WEBSITE_DETAIL_REQUEST - ID: ${req.params.id}`);

    const website = await WebsiteModel.findById(req.params.id).populate('last');

    if (!website) {
      console.log(
        `[${timestamp}] WEBSITE_DETAIL_NOT_FOUND - ID: ${req.params.id}`,
      );
      return res.status(404).json({ error: 'Website not found' });
    }

    console.log(`[${timestamp}] WEBSITE_DETAIL_SUCCESS - URL: ${website.url}`);
    res.json(website);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] WEBSITE_DETAIL_ERROR:`, error);
    res.status(500).json({ error: 'Failed to fetch website' });
  }
});

// Create new website or get existing and create task
router.post('/', async (req, res) => {
  try {
    const timestamp = new Date().toISOString();
    const { url, options = {} } = req.body;

    console.log(`[${timestamp}] WEBSITE_CREATE_REQUEST - URL: "${url}"`);

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Check if website already exists
    let website = await WebsiteModel.findOne({ url });

    console.log(
      `[${timestamp}] Website lookup result: ${website ? 'Existing' : 'New'}`,
    );

    if (!website) {
      // Create new website if it doesn't exist
      console.log(`[${timestamp}] Creating new Website document for: ${url}`);
      website = new WebsiteModel({
        url,
      });
      await website.save();
      console.log(`[${timestamp}] Website saved. ID: ${website._id}`);

      // Add GSB lookup task for new website
      console.log(`[${timestamp}] Queuing GSB lookup task...`);
      const enrichmentQueue = req.app.locals.enrichmentQueue;
      const gsbTaskId = uuidv4();
      await enrichmentQueue.add(
        'gsb_lookup',
        {
          id: gsbTaskId,
          type: 'gsb_lookup',
          websiteId: website._id.toString(),
          url: url,
          timestamp: new Date().toISOString(),
        },
        { jobId: gsbTaskId },
      );
      console.log(
        `[${timestamp}] GSB lookup task successfully queued in ${enrichmentQueue.name}`,
      );
    } else {
      // If website already exists, GSB lookup is not queued here.
      console.log(
        `[${timestamp}] Website "${url}" already exists. Skipping GSB task generation.`,
      );
    }

    // Create webpage for scraping task
    console.log(`[${timestamp}] Creating Webpage entry for scraping...`);
    const webpage = new WebpageModel({
      input: url,
      option: options,
    });
    await webpage.save();
    console.log(`[${timestamp}] Webpage created. ID: ${webpage._id}`);

    // Create task for worker
    const taskId = uuidv4();
    // Add to BullMQ queue for processing
    console.log(
      `[${timestamp}] Adding task to BullMQ "scraping-tasks" queue...`,
    );
    const scrapingQueue = req.app.locals.scrapingQueue;
    await scrapingQueue.add(
      'scrape',
      {
        id: taskId,
        url: url,
        options: options,
        webpageId: webpage._id.toString(),
        websiteId: website._id.toString(),
      },
      {
        jobId: taskId, // 重複排除
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
    );
    console.log(`[${timestamp}] Scraping Task successfully queued to BullMQ.`);

    console.log(
      `[${timestamp}] WEBSITE_CREATE_SUCCESS - WebsiteID: ${website._id}`,
    );
    res.status(201).json(website);
  } catch (error) {
    const errTimestamp = new Date().toISOString();
    console.error(`[${errTimestamp}] WEBSITE_CREATE_ERROR:`, error);

    // Handle duplicate key error specifically
    if (error.code === 11000) {
      return res.status(409).json({ error: 'Website already exists' });
    }

    res.status(500).json({
      error: 'Failed to create website',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

// Get website by URL
router.get('/by-url/:url', async (req, res) => {
  try {
    const timestamp = new Date().toISOString();
    const url = Buffer.from(req.params.url, 'base64').toString('utf-8');
    console.log(`[${timestamp}] WEBSITE_BY_URL_REQUEST - URL: "${url}"`);

    const website = await WebsiteModel.findOne({ url }).populate('last');

    if (!website) {
      console.log(`[${timestamp}] WEBSITE_BY_URL_NOT_FOUND - URL: "${url}"`);
      return res.status(404).json({ error: 'Website not found' });
    }

    console.log(`[${timestamp}] WEBSITE_BY_URL_SUCCESS - ID: ${website._id}`);
    res.json(website);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch website' });
  }
});

// Trigger GSB lookup for a website
router.post('/:id/gsb-lookup', async (req, res) => {
  try {
    const website = await WebsiteModel.findById(req.params.id);

    if (!website) {
      return res.status(404).json({ error: 'Website not found' });
    }

    // Add GSB lookup task to enrichment queue
    const enrichmentQueue = req.app.locals.enrichmentQueue;
    const gsbTaskId = uuidv4();
    await enrichmentQueue.add(
      'gsb_lookup',
      {
        id: gsbTaskId,
        type: 'gsb_lookup',
        websiteId: website._id.toString(),
        url: website.url,
        timestamp: new Date().toISOString(),
      },
      { jobId: gsbTaskId },
    );

    console.log(
      `GSB lookup task queued for website ${website._id}: ${website.url}`,
    );
    res.json({
      message: 'GSB lookup task queued successfully',
      taskId: gsbTaskId,
    });
  } catch (error) {
    console.error('Error queuing GSB lookup:', error);
    res.status(500).json({ error: 'Failed to queue GSB lookup' });
  }
});

// Update website track settings
router.patch('/:id', async (req, res) => {
  try {
    const { track } = req.body;
    const website = await WebsiteModel.findById(req.params.id);

    if (!website) {
      return res.status(404).json({ error: 'Website not found' });
    }

    // Update track settings
    if (track.counter !== undefined) {
      website.track.counter = track.counter;
    }

    if (track.period !== undefined) {
      website.track.period = track.period;
    }

    if (track.option) {
      website.track.option = {
        ...website.track.option,
        ...track.option,
      };
    }

    await website.save();
    res.json(website);
  } catch (error) {
    console.error('Error updating website:', error);
    res.status(500).json({ error: 'Failed to update website' });
  }
});

export default router;
