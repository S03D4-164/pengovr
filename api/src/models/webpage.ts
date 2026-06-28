import mongoose, {
  Schema,
  InferSchemaType,
  model,
} from 'mongoose';

const webpageSchema = new Schema(
  {
    input: {
      type: String,
      trim: true,
      required: true,
    },
    option: {
      type: Object,
    },
    url: {
      type: String,
      trim: true,
    },
    title: {
      type: String,
    },
    error: {
      type: String,
    },
    thumbnail: {
      type: String,
    },
    content: {
      type: String,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: Number,
    },
    remoteAddress: {
      ip: { type: String, index: true },
      port: { type: Number },
      reverse: { type: [String] },
      bgp: { type: [Object] },
      whois: { type: String },
      geoip: { type: [Object] },
      dns: { 
        domain: { type: String },
        records: { 
          A: [{ type: String }],
          AAAA: [{ type: String }],
          MX: [{ type: Object }],
          NS: [{ type: String }],
          TXT: [{ type: String }],
          CNAME: [{ type: String }],
          SOA: { type: Object },
          PTR: [{ type: String }]
        },
        lookupTime: { type: Number },
        errors: [{ type: String }]
      },
    },
    headers: {
      type: Object,
    },
    securityDetails: {
      issuer: { type: String },
      protocol: { type: String },
      subjectName: { type: String },
      validFrom: { type: Number },
      validTo: { type: Number },
    },
    wappalyzer: {
      type: [String],
    },
    yara: {
      type: Object,
    },
    geminiExplanation: {
      type: String,
    },
    requests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Request' }],
    responses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Response' }],
    screenshot: { type: mongoose.Schema.Types.ObjectId, ref: 'Screenshot' },
    screenshots: [
      {
        thumbnail: {
          type: String,
        },
        full: { type: mongoose.Schema.Types.ObjectId, ref: 'Screenshot' },
      },
    ],
    payload: { type: mongoose.Schema.Types.ObjectId, ref: 'Payload' },
    payloads: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Payload' }],
    harfile: { type: mongoose.Schema.Types.ObjectId, ref: 'Harfile' },
    favicon: [
      {
        url: String,
        favicon: String,
      },
    ],
  },
  { timestamps: false },
);

type webpageModelType = InferSchemaType<typeof webpageSchema>;

webpageSchema.index({ createdAt: -1 });
webpageSchema.index({ content: 'text' });
webpageSchema.index({ input: 1, createdAt: -1 });
webpageSchema.index({ 'yara.rules.id': 1 });

const WebpageModel = model<webpageModelType>(
  'Webpage',
  webpageSchema,
);
export default WebpageModel;
export { webpageModelType };
