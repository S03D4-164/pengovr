import mongoose, { Schema, Document, Model } from 'mongoose';

interface ITaskOptions {
  userAgent?: string | null;
  referrer?: string | null;
  language?: string | null;
  disableScript?: boolean;
  proxy?: string | null;
  actions?: string | null;
  timeout?: number;
  delay?: number;
  pptr?: string | null;
  cloudflare?: boolean;
  extraHeaders?: string | null;
  track?: string | null;
}

interface ITask extends Document {
  id: string;
  url: string;
  options: ITaskOptions;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  webpageId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const taskSchema = new Schema<ITask>({
  id: { type: String, required: true, unique: true },
  url: { type: String, required: true },
  options: {
    userAgent: { type: String, default: null },
    referrer: { type: String, default: null },
    language: { type: String, default: null },
    disableScript: { type: Boolean, default: false },
    proxy: { type: String, default: null },
    actions: { type: String, default: null },
    timeout: { type: Number, default: 30 },
    delay: { type: Number, default: 5 },
    pptr: { type: String, default: null },
    cloudflare: { type: Boolean, default: false },
    extraHeaders: { type: String, default: null },
    track: { type: String, default: null },
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending',
  },
  error: { type: String },
  webpageId: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

taskSchema.pre('save', async function () {
  const date = new Date();
  this.updatedAt = date;
});

const Task = mongoose.model<ITask>('Task', taskSchema);

export default Task;
