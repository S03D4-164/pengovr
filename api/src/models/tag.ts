import mongoose, { Schema, InferSchemaType, model } from 'mongoose';

const tagSchema = new Schema(
  {
    key: {
      type: String,
      lowercase: true,
      trim: true,
      required: true,
    },
    value: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
  },
  { timestamps: true },
);

type tagModelType = InferSchemaType<typeof tagSchema>;

tagSchema.index({ createdAt: -1 });
tagSchema.index({ key: 1, value: 1 }, { unique: true } as any);

const TagModel = model<tagModelType>('Tag', tagSchema);

export default TagModel;
export { tagModelType };
