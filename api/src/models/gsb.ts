import mongoose, {
  Schema,
  InferSchemaType,
  model,
} from 'mongoose';

const gsbSchema = new Schema(
  {
    api: {
      type: String,
    },
    url: {
      type: String,
      trim: true,
      required: true,
      unique: true,
    },
    urlHash: {
      type: String,
    },
    result: {
      type: Object,
    },
  },
  { timestamps: true },
);

type gsbModelType = InferSchemaType<typeof gsbSchema>;

// Add plugins and indexes
gsbSchema.index({ createdAt: -1 });
gsbSchema.index({ urlHash: 1 });

// Export the model
const GSBModel = model<gsbModelType>(
  'GSB',
  gsbSchema,
);

export default GSBModel;
export { gsbModelType };
