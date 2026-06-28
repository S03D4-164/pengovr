import express, { Router } from 'express';
import ScreenshotModel, { screenshotModelType } from '../models/screenshot';

const router: Router = express.Router();

// Get all screenshots
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = (req.query.search as string) || '';
    const startDate = (req.query.startDate as string) || '';
    const endDate = (req.query.endDate as string) || '';
    const skip = (page - 1) * limit;

    const query: any = {};
    if (search) {
      query.$or = [
        { tag: { $regex: search, $options: 'i' } },
        { 'tag.url': { $regex: search, $options: 'i' } },
      ];
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    const screenshots = await ScreenshotModel.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await ScreenshotModel.countDocuments(query);

    res.json({
      docs: screenshots,
      totalDocs: total,
      limit: limit,
      page: page,
      totalPages: Math.ceil(total / limit),
      hasPrevPage: page > 1,
      hasNextPage: page < Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Error fetching screenshots:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get screenshot by ID
router.get('/:id', async (req, res) => {
  try {
    console.log('Looking for screenshot with ID:', req.params.id);
    const screenshot = await ScreenshotModel.findById(req.params.id);

    if (!screenshot) {
      console.log('Screenshot not found in database for ID:', req.params.id);
      // Check if screenshot exists at all
      const allScreenshots = await ScreenshotModel.find({}).limit(5);
      console.log(
        'Available screenshot IDs:',
        allScreenshots.map((s) => s._id),
      );
      return res.status(404).json({ error: 'Screenshot not found' });
    }

    console.log('Found screenshot:', screenshot._id);
    res.json(screenshot);
  } catch (error) {
    console.error('Error fetching screenshot:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
