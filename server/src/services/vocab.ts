import { VocabWord } from '../models/VocabWord';

const NO_SPACE_LANGUAGES = ['chinese', 'mandarin', 'japanese', 'thai', 'zh', 'ja', 'th'];

export async function checkAndMarkSavedWordsLearned(options: {
  userId: string;
  transcript: string;
  language: string;
}): Promise<string[]> {
  const { userId, transcript, language } = options;
  if (!transcript || !userId) return [];

  const savedWords = await VocabWord.find({
    userId,
    status: 'saved',
    language: { $regex: new RegExp(`^${language}$`, 'i') },
  });

  if (savedWords.length === 0) return [];

  const langLower = language.toLowerCase();
  const isNoSpaceLang = NO_SPACE_LANGUAGES.some((l) => langLower.includes(l));
  const lowerTranscript = transcript.toLowerCase();

  const newlyLearnedWordIds: string[] = [];

  for (const item of savedWords) {
    const cleanWord = item.word.toLowerCase().trim();
    if (!cleanWord) continue;

    let isMatch = false;
    if (isNoSpaceLang) {
      // Substring match for languages without spaces
      isMatch = lowerTranscript.includes(cleanWord);
    } else {
      // Case-insensitive whole-word match for space-separated languages
      const regex = new RegExp(`\\b${cleanWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      isMatch = regex.test(lowerTranscript);
    }

    if (isMatch) {
      item.status = 'learned';
      item.learnedAt = new Date();
      await item.save();
      newlyLearnedWordIds.push(item._id.toString());
      console.log(`[Vocab] Auto-marked saved word "${item.word}" as learned for user ${userId}`);
    }
  }

  return newlyLearnedWordIds;
}
