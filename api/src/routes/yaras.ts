import { Router, Request, Response } from 'express';
import YaraModel from '../models/yara';
import s3Client from '../utils/s3';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import config from '../config';

const yarasRouter: Router = Router();

interface YaraResponse {
  _id: string;
  name: string;
  rule: string;
  actions?: string;
  valid: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Synchronize all valid YARA rules from MongoDB to S3 as a JSON file.
 */
export async function syncYaraRulesToS3() {
  try {
    const rules = await YaraModel.find({ valid: true });
    const rulesJson = JSON.stringify(rules);

    await s3Client.send(
      new PutObjectCommand({
        Bucket: config.s3.bucket,
        Key: 'rules/yara.json',
        Body: rulesJson,
        ContentType: 'application/json',
      }),
    );
    console.log(
      '[YARA] Successfully synchronized rules to S3 (rules/yara.json)',
    );
  } catch (error: any) {
    console.error('[YARA] Failed to sync rules to S3:', error.message);
  }
}

// Get the synchronized YARA rules JSON directly from S3
yarasRouter.get('/json', async (req: any, res: any) => {
  try {
    const data = await s3Client.send(
      new GetObjectCommand({
        Bucket: config.s3.bucket,
        Key: 'rules/yara.json',
      }),
    );

    const body = await data.Body?.transformToString();
    if (!body) {
      return res
        .status(404)
        .json({ error: 'YARA rules JSON not found in storage' });
    }

    res.setHeader('Content-Type', 'application/json');
    res.send(body);
  } catch (error: any) {
    console.error('Error fetching YARA rules from S3:', error.message);
    res
      .status(500)
      .json({ error: 'Failed to retrieve YARA rules from storage' });
  }
});

// Create a new YARA rule
yarasRouter.post('/', async (req: any, res: any) => {
  try {
    const { name, rule, actions, valid } = req.body;

    if (!name || !rule) {
      return res.status(400).json({ error: 'Name and rule are required' });
    }

    const existingRule = await YaraModel.findOne({ name });
    if (existingRule) {
      return res
        .status(400)
        .json({ error: 'Rule with this name already exists' });
    }

    const total = await YaraModel.countDocuments();
    if (total >= 1000) {
      return res
        .status(400)
        .json({ error: 'Cannot create more than 1,000 Rules' });
    }

    const yaraRule = new YaraModel({
      name,
      rule,
      actions: actions || undefined,
      valid: valid !== undefined ? valid : true,
    });

    await yaraRule.save();

    // Sync to S3 in background
    syncYaraRulesToS3();

    res.status(201).json({
      message: 'YARA rule created successfully',
      yaraRule: {
        _id: yaraRule._id,
        name: yaraRule.name,
        rule: yaraRule.rule,
        actions: yaraRule.actions,
        valid: yaraRule.valid,
        createdAt: yaraRule.createdAt,
        updatedAt: yaraRule.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error creating YARA rule:', error);
    res.status(500).json({ error: 'Failed to create YARA rule' });
  }
});

// Get all YARA rules
yarasRouter.get('/', async (req: any, res: any) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = (req.query.search as string) || '';
    const skip = (page - 1) * limit;

    const query: any = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { rule: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await YaraModel.countDocuments(query);
    const yaraRules = await YaraModel.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      results: yaraRules.map(
        (rule: any): YaraResponse => ({
          _id: rule._id,
          name: rule.name,
          rule: rule.rule,
          actions: rule.actions,
          valid: rule.valid,
          createdAt: rule.createdAt,
          updatedAt: rule.updatedAt,
        }),
      ),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Error fetching YARA rules:', error);
    res.status(500).json({ error: 'Failed to fetch YARA rules' });
  }
});

// Get a specific YARA rule
yarasRouter.get('/:id', async (req: any, res: any) => {
  try {
    const yaraRule = await YaraModel.findById(req.params.id);

    if (!yaraRule) {
      return res.status(404).json({ error: 'YARA rule not found' });
    }

    res.json({
      _id: yaraRule._id,
      name: yaraRule.name,
      rule: yaraRule.rule,
      actions: yaraRule.actions,
      valid: yaraRule.valid,
      createdAt: yaraRule.createdAt,
      updatedAt: yaraRule.updatedAt,
    });
  } catch (error) {
    console.error('Error fetching YARA rule:', error);
    res.status(500).json({ error: 'Failed to fetch YARA rule' });
  }
});

// Update a YARA rule
yarasRouter.put('/:id', async (req: any, res: any) => {
  try {
    const { name, rule, actions, valid } = req.body;

    const yaraRule = await YaraModel.findById(req.params.id);

    if (!yaraRule) {
      return res.status(404).json({ error: 'YARA rule not found' });
    }

    if (name && name !== yaraRule.name) {
      const existingRule = await YaraModel.findOne({ name });
      if (existingRule) {
        return res
          .status(400)
          .json({ error: 'Rule with this name already exists' });
      }
      yaraRule.name = name;
    }

    if (rule) yaraRule.rule = rule;
    if (actions !== undefined) yaraRule.actions = actions;
    if (valid !== undefined) yaraRule.valid = valid;

    await yaraRule.save();

    // Sync to S3 in background
    syncYaraRulesToS3();

    res.json({
      message: 'YARA rule updated successfully',
      yaraRule: {
        _id: yaraRule._id,
        name: yaraRule.name,
        rule: yaraRule.rule,
        actions: yaraRule.actions,
        valid: yaraRule.valid,
        createdAt: yaraRule.createdAt,
        updatedAt: yaraRule.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error updating YARA rule:', error);
    res.status(500).json({ error: 'Failed to update YARA rule' });
  }
});

// Delete a YARA rule
yarasRouter.delete('/:id', async (req: any, res: any) => {
  try {
    const yaraRule = await YaraModel.findByIdAndDelete(req.params.id);

    if (!yaraRule) {
      return res.status(404).json({ error: 'YARA rule not found' });
    }

    // Sync to S3 in background
    syncYaraRulesToS3();

    res.json({ message: 'YARA rule deleted successfully' });
  } catch (error) {
    console.error('Error deleting YARA rule:', error);
    res.status(500).json({ error: 'Failed to delete YARA rule' });
  }
});

export default yarasRouter;
