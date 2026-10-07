import React, { useState, useEffect } from 'react';
import { Quote, X, Plus, Trash2, Sparkles, Bookmark } from 'lucide-react';

interface PhraseItem {
  id: string;
  phrase: string;
  context: string;
  authorOrSpeaker?: string;
  createdAt: string;
}

interface PhrasesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const DEFAULT_PHRASES: PhraseItem[] = [
  {
    id: '1',
    phrase: 'Action speaks louder than words.',
    context: 'Proverb used for emphasis on results.',
    authorOrSpeaker: 'Idiom',
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    phrase: 'Brief is the soul of wit.',
    context: 'Use when emphasizing clear, concise presentation.',
    authorOrSpeaker: 'Shakespeare',
    createdAt: new Date().toISOString(),
  },
];

export const PhrasesDrawer: React.FC<PhrasesDrawerProps> = ({ isOpen, onClose }) => {
  const [phrases, setPhrases] = useState<PhraseItem[]>(() => {
    const stored = localStorage.getItem('fluentlens_phrases');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        return DEFAULT_PHRASES;
      }
    }
    return DEFAULT_PHRASES;
  });

  const [showAddForm, setShowAddForm] = useState(false);
  const [newPhrase, setNewPhrase] = useState('');
  const [newContext, setNewContext] = useState('');
  const [newAuthor, setNewAuthor] = useState('');

  useEffect(() => {
    localStorage.setItem('fluentlens_phrases', JSON.stringify(phrases));
  }, [phrases]);

  const handleAddPhrase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPhrase.trim()) return;

    const item: PhraseItem = {
      id: Date.now().toString(),
      phrase: newPhrase.trim(),
      context: newContext.trim() || 'Saved quote / expression',
      authorOrSpeaker: newAuthor.trim() || 'Custom',
      createdAt: new Date().toISOString(),
    };

    setPhrases((prev) => [item, ...prev]);
    setNewPhrase('');
    setNewContext('');
    setNewAuthor('');
    setShowAddForm(false);
  };

  const handleDeletePhrase = (id: string) => {
    setPhrases((prev) => prev.filter((p) => p.id !== id));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/30 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white border-l border-slate-200 shadow-2xl flex flex-col justify-between">
          
          {/* Header */}
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
                <Quote className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Phrases / Quotes</h2>
                <p className="text-xs text-slate-500 font-medium">Saved Expressions & Inspiring Quotes</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Action Bar */}
          <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              {phrases.length} Saved {phrases.length === 1 ? 'Item' : 'Items'}
            </span>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Add Phrase</span>
            </button>
          </div>

          {/* Add Form */}
          {showAddForm && (
            <form onSubmit={handleAddPhrase} className="p-4 bg-amber-50/50 border-b border-amber-100 space-y-3">
              <div className="text-xs font-bold text-amber-900">Save a New Phrase or Quote</div>
              <input
                type="text"
                placeholder="Phrase or Quote (e.g. Fortune favors the bold)"
                value={newPhrase}
                onChange={(e) => setNewPhrase(e.target.value)}
                required
                className="w-full px-3 py-1.5 text-xs bg-white border border-amber-200 rounded-lg focus:outline-none"
              />
              <input
                type="text"
                placeholder="Context or Note (Optional)"
                value={newContext}
                onChange={(e) => setNewContext(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-white border border-amber-200 rounded-lg focus:outline-none"
              />
              <input
                type="text"
                placeholder="Speaker / Author (Optional)"
                value={newAuthor}
                onChange={(e) => setNewAuthor(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-white border border-amber-200 rounded-lg focus:outline-none"
              />
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-3 py-1 text-xs text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg"
                >
                  Save Phrase
                </button>
              </div>
            </form>
          )}

          {/* Content List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {phrases.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <Sparkles className="w-8 h-8 text-amber-400/60 mx-auto" />
                <p className="text-xs font-medium text-slate-600">No phrases saved yet.</p>
                <p className="text-[11px] text-slate-400">Click "Add Phrase" above to save quotes or expressions.</p>
              </div>
            ) : (
              phrases.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs hover:border-amber-200 transition-all flex flex-col justify-between gap-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900 leading-snug italic">
                      "{item.phrase}"
                    </p>
                    <button
                      onClick={() => handleDeletePhrase(item.id)}
                      className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors shrink-0"
                      title="Delete phrase"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {item.context && (
                    <p className="text-xs text-slate-500">{item.context}</p>
                  )}

                  {item.authorOrSpeaker && (
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-400">
                      <span>&mdash; {item.authorOrSpeaker}</span>
                      <Bookmark className="w-3 h-3 text-amber-500" />
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-100 bg-slate-50/50 text-center text-[11px] text-slate-400">
            FluentLens Saved Phrases & Quotes
          </div>

        </div>
      </div>
    </div>
  );
};
