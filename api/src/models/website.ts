import mongoose, {
  Schema,
  InferSchemaType,
  model,
} from 'mongoose';

const websiteSchema = new Schema(
  {
    url: {
      type: String,
      trim: true,
      required: true,
      unique: true,
    },
    track: {
      period: { type: Number, default: 0 },
      counter: { type: Number, default: 0 },
      option: {
        type: Object,
      },
    },
    tag: {
      type: [Object],
    },
    gsb: {
      lookup: {
        type: Object,
      },
    },
    group: [String],
    last: { type: mongoose.Schema.Types.ObjectId, ref: 'Webpage' },
  },
  { timestamps: true },
);

type websiteModelType = InferSchemaType<typeof websiteSchema>;

websiteSchema.index({ updatedAt: -1 });

const WebsiteModel = model<websiteModelType>(
  'Website',
  websiteSchema,
);
export default WebsiteModel;
export { websiteModelType };
