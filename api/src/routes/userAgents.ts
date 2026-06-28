import { Router, Request, Response } from 'express';
import UserAgentModel from '../models/userAgent';

const userAgentsRouter: Router = Router();

interface UserAgentResponse {
  _id: string;
  name: string;
  userAgent: string;
  createdAt: Date;
  updatedAt: Date;
}

// Create a new user agent
userAgentsRouter.post('/', async (req: any, res: any) => {
  try {
    const { name, userAgent } = req.body;

    if (!name || !userAgent) {
      return res.status(400).json({ error: 'Name and userAgent are required' });
    }

    const existingAgent = await UserAgentModel.findOne({ name });
    if (existingAgent) {
      return res.status(400).json({ error: 'User agent with this name already exists' });
    }

    const newUserAgent = new UserAgentModel({
      name,
      userAgent,
    });

    await newUserAgent.save();

    res.status(201).json({
      message: 'User agent created successfully',
      userAgent: {
        _id: newUserAgent._id,
        name: newUserAgent.name,
        userAgent: newUserAgent.userAgent,
        createdAt: newUserAgent.createdAt,
        updatedAt: newUserAgent.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error creating user agent:', error);
    res.status(500).json({ error: 'Failed to create user agent' });
  }
});

// Get all user agents
userAgentsRouter.get('/', async (req: any, res: any) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const total = await UserAgentModel.countDocuments();
    const userAgents = await UserAgentModel.find().sort({ name: 1 }).skip(skip).limit(limit);

    res.json({
      results: userAgents.map(
        (agent: any): UserAgentResponse => ({
          _id: agent._id,
          name: agent.name,
          userAgent: agent.userAgent,
          createdAt: agent.createdAt,
          updatedAt: agent.updatedAt,
        }),
      ),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Error fetching user agents:', error);
    res.status(500).json({ error: 'Failed to fetch user agents' });
  }
});

// Get all user agents for dropdown (no pagination)
userAgentsRouter.get('/all', async (req: any, res: any) => {
  try {
    const userAgents = await UserAgentModel.find().sort({ name: 1 });

    res.json({
      results: userAgents.map(
        (agent: any): UserAgentResponse => ({
          _id: agent._id,
          name: agent.name,
          userAgent: agent.userAgent,
          createdAt: agent.createdAt,
          updatedAt: agent.updatedAt,
        }),
      ),
    });
  } catch (error) {
    console.error('Error fetching all user agents:', error);
    res.status(500).json({ error: 'Failed to fetch user agents' });
  }
});

// Get a single user agent by ID
userAgentsRouter.get('/:id', async (req: any, res: any) => {
  try {
    const userAgent = await UserAgentModel.findById(req.params.id);

    if (!userAgent) {
      return res.status(404).json({ error: 'User agent not found' });
    }

    res.json({
      _id: userAgent._id,
      name: userAgent.name,
      userAgent: userAgent.userAgent,
      createdAt: userAgent.createdAt,
      updatedAt: userAgent.updatedAt,
    });
  } catch (error) {
    console.error('Error fetching user agent:', error);
    res.status(500).json({ error: 'Failed to fetch user agent' });
  }
});

// Update a user agent
userAgentsRouter.put('/:id', async (req: any, res: any) => {
  try {
    const { name, userAgent } = req.body;

    if (!name || !userAgent) {
      return res.status(400).json({ error: 'Name and userAgent are required' });
    }

    const existingAgent = await UserAgentModel.findOne({
      name,
      _id: { $ne: req.params.id },
    });
    if (existingAgent) {
      return res.status(400).json({ error: 'User agent with this name already exists' });
    }

    const updatedUserAgent = await UserAgentModel.findByIdAndUpdate(
      req.params.id,
      { name, userAgent },
      { returnDocument: 'after' },
    );

    if (!updatedUserAgent) {
      return res.status(404).json({ error: 'User agent not found' });
    }

    res.json({
      message: 'User agent updated successfully',
      userAgent: {
        _id: updatedUserAgent._id,
        name: updatedUserAgent.name,
        userAgent: updatedUserAgent.userAgent,
        createdAt: updatedUserAgent.createdAt,
        updatedAt: updatedUserAgent.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error updating user agent:', error);
    res.status(500).json({ error: 'Failed to update user agent' });
  }
});

// Delete a user agent
userAgentsRouter.delete('/:id', async (req: any, res: any) => {
  try {
    const deletedUserAgent = await UserAgentModel.findByIdAndDelete(req.params.id);

    if (!deletedUserAgent) {
      return res.status(404).json({ error: 'User agent not found' });
    }

    res.json({
      message: 'User agent deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting user agent:', error);
    res.status(500).json({ error: 'Failed to delete user agent' });
  }
});

export default userAgentsRouter;
