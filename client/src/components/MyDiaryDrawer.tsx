import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { BookMarked, CheckCircle, Trash2, Search, X, Plus, Sparkles } from 'lucide-react';

interface MyDiaryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MyDiaryDrawer: React.FC<MyDiaryDrawerProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'saved' | 'learned'>('saved');
  const [words, setWords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Add word form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newWord, setNewWord] = useState('');
  const [newMeaning, setNewMeaning] = useState('');
  const [newExample, setNewExample] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchWords();
    }
  }, [isOpen, activeTab]);

  const fetchWords = async () => {
    try {
      setLoading(true);
      const data = await api.vocab.list(activeTab);
      setWords(data);
    } catch (err) {
      console.error('Failed to load words in diary:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteWord = async (id: string) => {
    if (!window.confirm('Delete this word from your vocabulary notebook?')) return;
    try {
      await api.vocab.delete(id);
      setWords((prev) => prev.filter((w) => w._id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete word');
    }
  };

  const handleAddWord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWord.trim() || !newMeaning.trim()) return;
    try {
      const saved = await api.vocab.save({
        word: newWord.trim(),
        meaning: newMeaning.trim(),
        example: newExample.trim() || `Used in practice session`,
        language: localStorage.getItem('fluentlens_selected_lang') || 'English',
      });
      setWords((prev) => [saved, ...prev]);
      setNewWord('');
      setNewMeaning('');
      setNewExample('');
      setShowAddForm(false);
    } catch (err: any) {
      alert(err.message || 'Failed to save new word');
    }
  };

  if (!isOpen) return null;

  const filteredWords = words.filter(
    (w) =>
      w.word.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.meaning.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                <BookMarked className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">My Diary</h2>
                <p className="text-xs text-slate-500">Vocabulary & Saved Expressions</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tabs & Actions */}
          <div className="p-4 bg-slate-50/50 border-b border-slate-100 space-y-3">
            <div className="flex bg-slate-200/60 p-1 rounded-xl">
              <button
                onClick={() => setActiveTab('saved')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'saved' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <BookMarked className="w-3.5 h-3.5" />
                Saved Words
              </button>
              <button
                onClick={() => setActiveTab('learned')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'learned' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                Learned Words
              </button>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search saved vocabulary..."
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                />
              </div>

              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="px-3 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold flex items-center gap-1 hover:bg-indigo-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Add</span>
              </button>
            </div>
          </div>

          {/* Add Word Form */}
          {showAddForm && (
            <form onSubmit={handleAddWord} className="p-4 bg-indigo-50/60 border-b border-indigo-100 space-y-3">
              <div className="text-xs font-bold text-indigo-900">Add New Word / Expression</div>
              <input
                type="text"
                placeholder="Word or Phrase (e.g. Eloquent)"
                value={newWord}
                onChange={(e) => setNewWord(e.target.value)}
                required
                className="w-full px-3 py-1.5 text-xs bg-white border border-indigo-200 rounded-lg focus:outline-none"
              />
              <input
                type="text"
                placeholder="Meaning (e.g. Fluent and persuasive in speaking)"
                value={newMeaning}
                onChange={(e) => setNewMeaning(e.target.value)}
                required
                className="w-full px-3 py-1.5 text-xs bg-white border border-indigo-200 rounded-lg focus:outline-none"
              />
              <input
                type="text"
                placeholder="Example Sentence (Optional)"
                value={newExample}
                onChange={(e) => setNewExample(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-white border border-indigo-200 rounded-lg focus:outline-none"
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
                  className="px-3 py-1 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700"
                >
                  Save Word
                </button>
              </div>
            </form>
          )}

          {/* Content List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loading ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-2" />
                Loading diary entries...
              </div>
            ) : filteredWords.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <Sparkles className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs font-medium text-slate-600">No {activeTab} words in your diary.</p>
                <p className="text-[11px] text-slate-400">Save words from reports or add them manually above.</p>
              </div>
            ) : (
              filteredWords.map((item) => (
                <div
                  key={item._id}
                  className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs hover:border-indigo-200 transition-all flex flex-col justify-between gap-2"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-sm font-bold text-indigo-950">{item.word}</span>
                      <span className="ml-2 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                        {item.language || 'English'}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDeleteWord(item._id)}
                      className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                      title="Delete word"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <p className="text-xs text-slate-700 font-medium">{item.meaning}</p>
                  
                  {item.example && (
                    <p className="text-[11px] text-slate-500 italic bg-slate-50 p-2 rounded-lg border border-slate-100">
                      "{item.example}"
                    </p>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-100 bg-slate-50/50 text-center text-[11px] text-slate-400">
            FluentLens Notebook &bull; Auto-syncs with practice sessions
          </div>

        </div>
      </div>
    </div>
  );
};
