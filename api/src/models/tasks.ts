import mongoose, { Schema, Document, Model } from 'mongoose';

interface ITaskOptions {
  [key: string]: any; // 任意のオプションを受け入れ
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

const taskSchema = new Schema<ITask>(
  {
    id: { type: String, required: true, unique: true },
    url: { type: String, required: true },
    options: { type: Schema.Types.Mixed, default: {} },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
    },
    error: { type: String },
    webpageId: { type: String, default: null },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { strict: false },
);

taskSchema.pre('save', async function () {
  const date = new Date();
  this.updatedAt = date;
});

const Task = mongoose.model<ITask>('Task', taskSchema);

export default Task;
