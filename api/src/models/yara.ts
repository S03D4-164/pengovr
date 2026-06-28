import mongoose, {
  Schema,
  InferSchemaType,
  model,
} from 'mongoose';

const yaraSchema = new Schema(
  {
    rule: {
      type: String,
    },
    name: {
      type: String,
      unique: true,
    },
    actions: {
      type: String,
    },
    valid: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

type yaraModelType = InferSchemaType<typeof yaraSchema>;

yaraSchema.index({ updatedAt: -1 });

const YaraModel = model<yaraModelType>(
  'Yara',
  yaraSchema,
);
export default YaraModel;
export { yaraModelType };
