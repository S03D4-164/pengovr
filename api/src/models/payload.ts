import mongoose, {
  Schema,
  InferSchemaType,
  model,
} from 'mongoose';

// Define the schema
const payloadSchema = new Schema(
  {
    payload: {
      type: Buffer,
      required: true,
    },
    md5: {
      type: String,
      unique: true,
      required: true,
    },
    fileType: {
      type: String,
    },
    vt: {
      type: Object,
    },
    tag: {
      type: [Object],
    },
    yara: {
      type: Object,
    },
  },
  { timestamps: true, read: 'secondaryPreferred' },
);

type payloadModelType = InferSchemaType<typeof payloadSchema>;

payloadSchema.index({ createdAt: -1 });
const PayloadModel = model<payloadModelType>(
  'Payload',
  payloadSchema,
);

export default PayloadModel;
export { payloadModelType };
