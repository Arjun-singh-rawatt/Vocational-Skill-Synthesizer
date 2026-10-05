import mongoose, { Schema, Document } from 'mongoose';

export interface IVocabWord extends Document {
  userId: mongoose.Types.ObjectId;
  word: string;
  meaning: string;
  example: string;
  language: string;
  status: 'saved' | 'learned';
  sourceSessionId?: mongoose.Types.ObjectId;
  learnedAt?: Date;
  createdAt: Date;
}

const VocabWordSchema = new Schema<IVocabWord>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    word: { type: String, required: true, trim: true },
    meaning: { type: String, required: true },
    example: { type: String, required: true },
    language: { type: String, required: true, trim: true },
    status: { type: String, enum: ['saved', 'learned'], default: 'saved' },
    sourceSessionId: { type: Schema.Types.ObjectId, ref: 'Session' },
    learnedAt: { type: Date },
  },
  { timestamps: true }
);

// Compound unique index on (userId, word, language)
VocabWordSchema.index({ userId: 1, word: 1, language: 1 }, { unique: true });

export const VocabWord = mongoose.model<IVocabWord>('VocabWord', VocabWordSchema);
