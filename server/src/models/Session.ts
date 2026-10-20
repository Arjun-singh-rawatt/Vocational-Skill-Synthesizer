import mongoose, { Schema, Document } from 'mongoose';
import { IReport } from '../services/gemini';
import { FluencyMetrics } from '../services/fluency';

export interface IChatMessage {
  role: 'user' | 'model';
  text: string;
  createdAt: Date;
}

export interface ISession extends Document {
  userId: mongoose.Types.ObjectId;
  language: string;
  goal: 'conversation' | 'interview' | 'ielts' | 'presentation';
  mediaType: 'video' | 'audio';
  durationSec: number;
  status: 'processing' | 'done' | 'failed';
  errorMessage?: string;
  report?: IReport;
  fluency?: FluencyMetrics;
  interactionId?: string;
  mimeType?: string;
  mediaFilename?: string;
  temperature?: number;
  isReevaluating?: boolean;
  chat: IChatMessage[];
  createdAt: Date;
}

const ChatMessageSchema = new Schema<IChatMessage>(
  {
    role: { type: String, enum: ['user', 'model'], required: true },
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const SessionSchema = new Schema<ISession>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    language: { type: String, required: true },
    goal: { type: String, enum: ['conversation', 'interview', 'ielts', 'presentation'], required: true },
    mediaType: { type: String, enum: ['video', 'audio'], required: true },
    durationSec: { type: Number, required: true, default: 0 },
    status: { type: String, enum: ['processing', 'done', 'failed'], default: 'processing', index: true },
    errorMessage: { type: String },
    report: { type: Schema.Types.Mixed },
    fluency: { type: Schema.Types.Mixed },
    interactionId: { type: String },
    mimeType: { type: String },
    mediaFilename: { type: String },
    temperature: { type: Number, min: 0, max: 1, default: 0.7 },
    isReevaluating: { type: Boolean, default: false },
    chat: [ChatMessageSchema],
  },
  { timestamps: true }
);

SessionSchema.set('toJSON', {
  transform: (doc, ret: any) => {
    ret.canReevaluate = Boolean(doc.mediaFilename);
    delete ret.mediaFilename;
    return ret;
  },
});

export const Session = mongoose.model<ISession>('Session', SessionSchema);
