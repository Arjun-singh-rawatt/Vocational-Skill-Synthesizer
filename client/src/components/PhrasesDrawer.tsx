import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api';
import { Quote, X, Plus, Trash2, Sparkles, Search } from 'lucide-react';

interface PhraseItem { _id: string; phrase: string; context?: string; authorOrSpeaker?: string; createdAt: string; }
interface PhrasesDrawerProps { isOpen: boolean; onClose: () => void; }

export const PhrasesDrawer: React.FC<PhrasesDrawerProps> = ({ isOpen, onClose }) => {
  const [phrases, setPhrases] = useState<PhraseItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPhrase, setNewPhrase] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchPhrases = useCallback(async () => {
    setLoading(true); setError('');
    try {
      let saved = await api.phrases.list();
      const legacy = localStorage.getItem('fluentlens_phrases');
      if (legacy) {
        const oldItems = JSON.parse(legacy) as Array<{ phrase?: string; context?: string; authorOrSpeaker?: string }>;
        // Older drawer versions prefilled these samples. Keep user-created local entries,
        // but never migrate the generated sample rows into a real account diary.
        const samples = new Set(['action speaks louder than words.', 'brief is the soul of wit.']);
        const toMigrate = (Array.isArray(oldItems) ? oldItems : []).filter((item) => item.phrase?.trim() && !samples.has(item.phrase.trim().toLowerCase()));
        if (toMigrate.length) {
          await Promise.all(toMigrate.map((item) => api.phrases.save({ phrase: item.phrase!.trim(), context: item.context, authorOrSpeaker: item.authorOrSpeaker })));
          saved = await api.phrases.list();
        }
        localStorage.removeItem('fluentlens_phrases');
      }
      setPhrases(saved);
    }
    catch (err: any) { setError(err.message || 'Could not load saved phrases.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { if (isOpen) void fetchPhrases(); }, [isOpen, fetchPhrases]);

  const handleAddPhrase = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newPhrase.trim() || saving) return;
    setSaving(true); setError('');
    try {
      const saved = await api.phrases.save({ phrase: newPhrase.trim() });
      setPhrases((prev) => [saved, ...prev.filter((phrase) => phrase._id !== saved._id)]);
      setNewPhrase(''); setShowAddForm(false);
    } catch (err: any) { setError(err.message || 'Could not save phrase.'); }
    finally { setSaving(false); }
  };
  const handleDeletePhrase = async (id: string) => {
    try { await api.phrases.delete(id); setPhrases((prev) => prev.filter((phrase) => phrase._id !== id)); }
    catch (err: any) { setError(err.message || 'Could not delete phrase.'); }
  };
  if (!isOpen) return null;
  const filtered = phrases.filter((item) => `${item.phrase} ${item.context || ''} ${item.authorOrSpeaker || ''}`.toLowerCase().includes(search.toLowerCase()));

  return <div className="fixed inset-0 z-50 overflow-hidden">
    <div className="absolute inset-0 bg-stone-900/30 backdrop-blur-xs" onClick={onClose} />
    <div className="absolute inset-y-0 right-0 max-w-full flex pl-5 sm:pl-10">
      <div className="w-screen max-w-md bg-[#faf8f3] border-l border-[#e7dfd3] shadow-2xl flex flex-col">
        <header className="p-5 border-b border-[#e7dfd3] flex items-center justify-between bg-[#faf8f3]">
          <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-800"><Quote className="w-5 h-5" /></div><div><h2 className="text-lg font-semibold text-stone-900">Phrases & Idioms</h2><p className="text-xs text-stone-500">Your saved expressions folio</p></div></div>
          <button onClick={onClose} aria-label="Close phrases" className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100"><X className="w-5 h-5" /></button>
        </header>
        <div className="p-4 border-b border-[#e7dfd3] space-y-3">
          <div className="flex items-center justify-between"><span className="text-xs font-medium text-stone-500">{phrases.length} saved {phrases.length === 1 ? 'phrase' : 'phrases'}</span><button onClick={() => setShowAddForm((show) => !show)} className="px-3 py-2 bg-emerald-900 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1"><Plus className="w-4 h-4" /> Add Phrase</button></div>
          <div className="flex items-center gap-2 rounded-lg border border-[#e7dfd3] bg-white px-3"><Search className="w-4 h-4 text-stone-400" /><input aria-label="Search phrases" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search phrases..." className="w-full py-2 text-xs outline-none bg-transparent" /></div>
        </div>
        {showAddForm && <form onSubmit={handleAddPhrase} className="p-4 bg-[#f3efe6] border-b border-[#e7dfd3] space-y-3"><label className="block text-xs font-semibold text-stone-800" htmlFor="new-phrase">Enter an idiom or phrase</label><input id="new-phrase" type="text" placeholder="Enter an idiom or phrase" value={newPhrase} onChange={(e) => setNewPhrase(e.target.value)} required className="w-full px-3 py-2.5 text-sm bg-white border border-[#d9cfbf] rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-800/20" /><div className="flex justify-end gap-2"><button type="button" onClick={() => { setShowAddForm(false); setNewPhrase(''); }} className="px-3 py-2 text-xs text-stone-600">Cancel</button><button type="submit" disabled={!newPhrase.trim() || saving} className="px-3 py-2 bg-emerald-900 text-white text-xs font-semibold rounded-lg disabled:opacity-60">{saving ? 'Saving…' : 'Save'}</button></div></form>}
        <main className="flex-1 overflow-y-auto p-4 space-y-3">
          {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
          {loading ? <p className="py-12 text-center text-xs text-stone-500">Loading phrases…</p> : filtered.length === 0 ? <div className="py-12 text-center space-y-2 text-stone-500"><Sparkles className="w-8 h-8 text-amber-500/70 mx-auto" /><p className="text-sm font-medium text-stone-700">{search ? 'No matching phrases.' : 'No phrases saved yet.'}</p><p className="text-xs">Save an expression from a report or add one above.</p></div> : filtered.map((item) => <article key={item._id} className="p-4 rounded-xl bg-[#f5f1e9] border border-[#e7dfd3] shadow-sm space-y-2"><div className="flex items-start justify-between gap-3"><p className="text-sm font-semibold text-stone-900 leading-relaxed">{item.phrase}</p><button onClick={() => void handleDeletePhrase(item._id)} aria-label={`Delete ${item.phrase}`} className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50"><Trash2 className="w-3.5 h-3.5" /></button></div>{item.context && <p className="text-xs text-stone-600">{item.context}</p>}{item.authorOrSpeaker && <p className="pt-2 border-t border-[#e7dfd3] text-[11px] text-stone-500">— {item.authorOrSpeaker}</p>}</article>)}
        </main>
        <footer className="p-3 border-t border-[#e7dfd3] text-center text-[11px] text-stone-500">FluentLens • Saved expressions</footer>
      </div>
    </div>
  </div>;
};
