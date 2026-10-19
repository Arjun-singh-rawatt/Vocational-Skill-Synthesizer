import mongoose, { Schema, Document } from 'mongoose';

export interface ISavedPhrase extends Document {
  userId: mongoose.Types.ObjectId;
  phrase: string;
  context?: string;
  authorOrSpeaker?: string;
  createdAt: Date;
}

const SavedPhraseSchema = new Schema<ISavedPhrase>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    phrase: { type: String, required: true, trim: true },
    context: { type: String, trim: true },
    authorOrSpeaker: { type: String, trim: true },
  },
  { timestamps: true }
);

SavedPhraseSchema.index({ userId: 1, phrase: 1 }, { unique: true });

export const SavedPhrase = mongoose.model<ISavedPhrase>('SavedPhrase', SavedPhraseSchema);
