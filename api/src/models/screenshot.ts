import mongoose, {
  Schema,
  InferSchemaType,
  model,
} from 'mongoose';

const screenshotSchema = new Schema(
  {
    screenshot: {
      type: String,
      required: true,
    },
    md5: {
      type: String,
      unique: true,
    },
    tag: {
      type: [Object],
    },
  },
  { timestamps: true },
);

type screenshotModelType = InferSchemaType<typeof screenshotSchema>;

screenshotSchema.index({ createdAt: -1 });

const ScreenshotModel = model<screenshotModelType>('Screenshot', screenshotSchema);

export default ScreenshotModel;
export { screenshotModelType };
