import mongoose, {
  Schema,
  InferSchemaType,
  model,
} from 'mongoose';

const responseSchema = new Schema(
  {
    url: {
      type: String,
    },
    urlHash: {
      type: String,
    },
    status: {
      type: Number,
    },
    statusText: {
      type: String,
    },
    ok: {
      type: Boolean,
    },
    text: {
      type: String,
    },
    mimeType: {
      type: String,
    },
    encoding: {
      type: String,
    },
    remoteAddress: {
      ip: { type: String },
      port: { type: Number },
      reverse: { type: [String] },
      bgp: { type: [Object] },
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
    createdAt: {
      type: Date,
      default: Date.now,
    },
    wappalyzer: {
      type: [String],
    },
    yara: {
      type: Object,
    },
    interceptionId: {
      type: String,
    },
    geminiExplanation: {
      type: String,
    },
    webpage: { type: mongoose.Schema.Types.ObjectId, ref: 'Webpage' },
    request: { type: mongoose.Schema.Types.ObjectId, ref: 'Request' },
    payload: { type: mongoose.Schema.Types.ObjectId, ref: 'Payload' },
  },
  { timestamps: false },
);

type responseModelType = InferSchemaType<typeof responseSchema>;

responseSchema.index({ createdAt: -1 });
responseSchema.index({ urlHash: 1 });
responseSchema.index({ payload: 1 });
responseSchema.index({ text: 'text' });
responseSchema.index({ webpage: 1 });
responseSchema.index({ 'remoteAddress.ip': 1 });
responseSchema.index({ 'yara.rules.id': 1 });

const ResponseModel = model<responseModelType>('Response', responseSchema);

export default ResponseModel;
export { responseModelType };
