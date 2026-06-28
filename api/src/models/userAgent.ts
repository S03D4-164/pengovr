import mongoose, { Schema, InferSchemaType, model } from 'mongoose';

const userAgentSchema = new Schema(
  {
    name: {
      type: String,
      trim: true,
    },
    userAgent: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true },
);

type userAgentModelType = InferSchemaType<typeof userAgentSchema>;

const UserAgentModel = model<userAgentModelType>('UserAgent', userAgentSchema);

const data = [
  {
    name: '00_default',
    userAgent: '-',
  },
];

async function insertInitialData() {
  try {
    const count = await UserAgentModel.countDocuments();
    if (count === 0) {
      await UserAgentModel.insertMany(data);
      console.log('Initial user agent data inserted.');
    } else {
      console.log('User agent data already exists.');
    }
  } catch (err) {
    console.error('Error inserting user agent data:', err);
  }
}

//insertInitialData();

export default UserAgentModel;
export { userAgentModelType };
