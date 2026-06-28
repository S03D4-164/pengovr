import mongoose, { Schema, InferSchemaType, model } from 'mongoose';

const harfileSchema = new Schema(
  {
    har: {
      type: Buffer,
      required: true,
    },
    webpage: { type: mongoose.Schema.Types.ObjectId, ref: 'Webpage' },
  },
  { timestamps: true },
);

type harfileModelType = InferSchemaType<typeof harfileSchema>;

const HarfileModel = model<harfileModelType>('Harfile', harfileSchema);

export { HarfileModel, harfileModelType };
