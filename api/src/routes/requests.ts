import express, { Router } from 'express';
import RequestModel from '../models/request';

const router: Router = express.Router();

// Get single request by ID
router.get('/:id', async (req, res) => {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
  const userAgent = req.get('User-Agent') || 'unknown';

  console.log(
    `[${timestamp}] REQUEST_DETAIL_REQUEST - IP: ${clientIP}, ID: ${req.params.id}, User-Agent: ${userAgent}`,
  );

  try {
    const request = await RequestModel.findById(req.params.id)
      .populate('webpage')
      .populate('response');

    const responseTime = Date.now() - startTime;

    if (!request) {
      console.log(
        `[${timestamp}] REQUEST_DETAIL_NOT_FOUND - IP: ${clientIP}, ID: ${req.params.id}, ResponseTime: ${responseTime}ms`,
      );
      return res.status(404).json({ error: 'Request not found' });
    }

    console.log(
      `[${timestamp}] REQUEST_DETAIL_SUCCESS - IP: ${clientIP}, ID: ${req.params.id}, ResponseTime: ${responseTime}ms`,
    );
    res.json(request);
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error(
      `[${timestamp}] REQUEST_DETAIL_ERROR - IP: ${clientIP}, ID: ${req.params.id}, ResponseTime: ${responseTime}ms, Error: ${error.message}`,
    );
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to fetch request', details: error.message });
  }
});

export default router;
