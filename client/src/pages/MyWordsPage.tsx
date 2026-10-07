import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { BookMarked, CheckCircle, Trash2, Search, Calendar, Sparkles, ArrowLeft } from 'lucide-react';

export const MyWordsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'saved' | 'learned'>('saved');
  const [words, setWords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchWords();
  }, [activeTab]);

  const fetchWords = async () => {
    try {
      setLoading(true);
      const data = await api.vocab.list(activeTab);
      setWords(data);
    } catch (err: any) {
      console.error('Failed to fetch vocabulary words:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Remove this word from your vocabulary notebook?')) return;
    try {
      await api.vocab.delete(id);
      setWords((prev) => prev.filter((w) => w._id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete word');
    }
  };

  const filteredWords = words.filter((w) =>
    w.word.toLowerCase().includes(searchQuery.toLowerCase()) ||
    w.meaning.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (w.language && w.language.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      
      {/* Top Back Nav */}
      <div>
        <Link to="/" className="inline-flex items-center gap-2 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-xl transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Home Workspace</span>
        </Link>
      </div>

      {/* Header */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">
            <BookMarked className="w-4 h-4" />
            <span>Vocabulary Notebook</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900">Saved & Learned Words</h1>
          <p className="text-xs text-slate-500 mt-1">
            Words saved from coaching reports are automatically marked as "Learned" when you speak them in future sessions!
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
          <button
            onClick={() => setActiveTab('saved')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'saved' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <BookMarked className="w-3.5 h-3.5" />
            Saved Words
          </button>
          <button
            onClick={() => setActiveTab('learned')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'learned' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
            Learned Words
          </button>
        </div>
      </div>

      {/* Search Filter Bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter words by keyword, meaning, or language..."
          className="w-full bg-white border border-slate-200 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all shadow-xs"
        />
      </div>

      {/* Words Grid */}
      {loading ? (
        <div className="min-h-[40vh] flex flex-col items-center justify-center p-6 text-center">
          <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-3" />
          <p className="text-slate-500 text-xs">Loading vocabulary notebook...</p>
        </div>
      ) : filteredWords.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-3xl border border-slate-200 text-slate-500 shadow-sm">
          <Sparkles className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-700">No {activeTab} words found.</p>
          <p className="text-xs text-slate-500 mt-1">
            {activeTab === 'saved'
              ? 'Save vocabulary suggestions from your coaching reports or diary to view them here!'
              : 'Keep practicing! When you use saved words in new recordings, they will be auto-marked as learned here.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredWords.map((item) => (
            <div
              key={item._id}
              className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex flex-col justify-between gap-4 hover:border-blue-200 transition-all"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-extrabold text-slate-900">{item.word}</span>
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                      {item.language || 'English'}
                    </span>
                  </div>

                  <button
                    onClick={() => handleDelete(item._id)}
                    title="Delete word"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <p className="text-xs text-slate-700 font-medium leading-relaxed">{item.meaning}</p>
                {item.example && (
                  <p className="text-xs text-slate-500 italic mt-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    "{item.example}"
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-[11px] text-slate-400 font-medium">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>
                    {item.status === 'learned' && item.learnedAt
                      ? `Learned on ${new Date(item.learnedAt).toLocaleDateString()}`
                      : `Saved on ${new Date(item.createdAt).toLocaleDateString()}`}
                  </span>
                </div>
                <span
                  className={`font-bold uppercase px-2 py-0.5 rounded-full text-[10px] ${
                    item.status === 'learned'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : 'bg-blue-100 text-blue-800 border border-blue-200'
                  }`}
                >
                  {item.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
};
