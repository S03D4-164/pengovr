import express, { Router } from 'express';
import WebsiteModel from '../models/website';
import WebpageModel from '../models/webpage';
import PayloadModel from '../models/payload';
import ResponseModel from '../models/response';
import ScreenshotModel from '../models/screenshot';
import RequestModel from '../models/request';

const router: Router = express.Router();

// Get related data for website or payload
router.get('/:type/:id', async (req, res) => {
  try {
    const { type, id } = req.params;

    if (type === 'website') {
      // Get website URL first
      const website = await WebsiteModel.findById(id);
      if (!website) {
        return res.status(404).json({ error: 'Website not found' });
      }

      // Find all webpages with this URL as input
      const webpages = await WebpageModel.find({ input: website.url })
        .sort({ createdAt: -1 })
        .lean();

      // Get related data from webpages
      const webpageIds = webpages.map((w) => w._id.toString());
      const payloadIds: string[] = [];
      const responseIds: string[] = [];
      const screenshotIds: string[] = [];

      webpages.forEach((w) => {
        if (w.payloads && Array.isArray(w.payloads)) {
          w.payloads.forEach((p: any) => {
            if (p._id) payloadIds.push(p._id.toString());
            else if (typeof p === 'string') payloadIds.push(p);
          });
        }
        if (w.responses && Array.isArray(w.responses)) {
          w.responses.forEach((r: any) => {
            if (r._id) responseIds.push(r._id.toString());
            else if (typeof r === 'string') responseIds.push(r);
          });
        }
        if (w.screenshot) {
          if (typeof w.screenshot === 'string') screenshotIds.push(w.screenshot);
          else if (w.screenshot._id) screenshotIds.push(w.screenshot._id.toString());
        }
        if (w.screenshots && Array.isArray(w.screenshots)) {
          w.screenshots.forEach((s: any) => {
            if (s._id) screenshotIds.push(s._id.toString());
            else if (typeof s === 'string') screenshotIds.push(s);
            else if (s.full) {
              if (typeof s.full === 'string') screenshotIds.push(s.full);
              else if (s.full._id) screenshotIds.push(s.full._id.toString());
            }
          });
        }
      });

      // Fetch full documents
      const [payloads, responses, screenshots] = await Promise.all([
        payloadIds.length > 0 ? PayloadModel.find({ _id: { $in: payloadIds } }).lean() : [],
        responseIds.length > 0 ? ResponseModel.find({ _id: { $in: responseIds } }).lean() : [],
        screenshotIds.length > 0
          ? ScreenshotModel.find({ _id: { $in: screenshotIds } }).lean()
          : [],
      ]);

      // Add size field to payloads
      const payloadsWithSize = payloads.map((p) => ({
        ...p,
        size: p.payload?.length || 0,
      }));

      res.json({
        webpages: webpages.map((w) => ({
          ...w,
          contentLength: w.content?.length || 0,
        })),
        payloads: payloadsWithSize,
        responses,
        screenshots,
      });
    } else if (type === 'payload') {
      // Get the specific payload
      const payload = await PayloadModel.findById(id).lean();
      if (!payload) {
        return res.status(404).json({ error: 'Payload not found' });
      }

      // Find webpages that reference this payload
      const webpages = await WebpageModel.find({ payloads: { $in: [id] } }).lean();

      // Get webpage IDs for related data lookup
      const webpageIds = webpages.map((w) => w._id.toString());
      const responseIds: string[] = [];
      const screenshotIds: string[] = [];

      webpages.forEach((w) => {
        // Collect responses
        if (w.responses && Array.isArray(w.responses)) {
          w.responses.forEach((r: any) => {
            if (r._id) responseIds.push(r._id.toString());
            else if (typeof r === 'string') responseIds.push(r);
          });
        }
        // Collect screenshots
        if (w.screenshot) {
          if (typeof w.screenshot === 'string') screenshotIds.push(w.screenshot);
          else if (w.screenshot._id) screenshotIds.push(w.screenshot._id.toString());
        }
        if (w.screenshots && Array.isArray(w.screenshots)) {
          w.screenshots.forEach((s: any) => {
            if (s._id) screenshotIds.push(s._id.toString());
            else if (typeof s === 'string') screenshotIds.push(s);
            else if (s.full) {
              if (typeof s.full === 'string') screenshotIds.push(s.full);
              else if (s.full._id) screenshotIds.push(s.full._id.toString());
            }
          });
        }
      });

      // Also find responses that directly reference this payload
      const directResponses = await ResponseModel.find({ payload: id }).lean();
      directResponses.forEach((r: any) => {
        if (r._id) responseIds.push(r._id.toString());
      });

      // Fetch related responses and screenshots
      const [responses, screenshots] = await Promise.all([
        responseIds.length > 0 ? ResponseModel.find({ _id: { $in: responseIds } }).lean() : [],
        screenshotIds.length > 0
          ? ScreenshotModel.find({ _id: { $in: screenshotIds } }).lean()
          : [],
      ]);

      // Add size to payload
      const payloadWithSize = {
        ...payload,
        size: payload.payload?.length || 0,
      };

      res.json({
        payloads: [payloadWithSize],
        webpages: webpages.map((w) => ({
          ...w,
          contentLength: w.content?.length || 0,
        })),
        responses,
        screenshots,
      });
    } else {
      return res.status(400).json({ error: 'Invalid type. Must be "website" or "payload"' });
    }
  } catch (error) {
    console.error('Error fetching related data:', error);
    res.status(500).json({ error: 'Failed to fetch related data' });
  }
});

// Delete selected items
router.post('/:type/:id', async (req, res) => {
  try {
    const { type, id } = req.params;
    const { payloads, responses, webpages, screenshots, removeTarget } = req.body;

    const removed = {
      payloads: 0,
      responses: 0,
      webpages: 0,
      screenshots: 0,
      targetDeleted: false,
    };

    // Delete payloads
    if (payloads && payloads.length > 0) {
      const result = await PayloadModel.deleteMany({ _id: { $in: payloads } });
      removed.payloads = result.deletedCount || 0;
    }

    // Delete responses
    if (responses && responses.length > 0) {
      const result = await ResponseModel.deleteMany({ _id: { $in: responses } });
      removed.responses = result.deletedCount || 0;
    }

    // Delete webpages
    if (webpages && webpages.length > 0) {
      const result = await WebpageModel.deleteMany({ _id: { $in: webpages } });
      removed.webpages = result.deletedCount || 0;
    }

    // Delete screenshots
    if (screenshots && screenshots.length > 0) {
      const result = await ScreenshotModel.deleteMany({ _id: { $in: screenshots } });
      removed.screenshots = result.deletedCount || 0;
    }

    // 本体（Website または Payload）の削除処理
    if (removeTarget === true) {
      if (type === 'website') {
        const result = await WebsiteModel.findByIdAndDelete(id);
        if (result) removed.targetDeleted = true;
      } else if (type === 'payload') {
        const result = await PayloadModel.findByIdAndDelete(id);
        if (result) removed.targetDeleted = true;
      }
    }

    res.json({
      success: true,
      removed: removed,
    });
  } catch (error) {
    console.error('Error removing data:', error);
    res.status(500).json({ error: 'Failed to remove data' });
  }
});

export default router;
