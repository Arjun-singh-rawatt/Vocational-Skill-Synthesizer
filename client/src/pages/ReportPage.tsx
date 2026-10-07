import React, { useState, useEffect, useRef } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import { api } from '../services/api';
import {
  Award,
  Zap,
  TrendingUp,
  CheckCircle,
  Bookmark,
  Send,
  MessageSquare,
  Clock,
  Sparkles,
  PlayCircle,
  BookOpen,
  Lightbulb,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
} from 'lucide-react';

export const ReportPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();

  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showFluencyBreakdown, setShowFluencyBreakdown] = useState(false);
  const [savedWordsMap, setSavedWordsMap] = useState<Record<string, boolean>>({});

  // Chat state
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [chatList, setChatList] = useState<any[]>([]);

  // Video/audio player reference
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const localPreviewUrl = location.state?.previewUrl || null;

  useEffect(() => {
    if (id) {
      fetchSessionDetails();
    }
  }, [id]);

  const fetchSessionDetails = async () => {
    try {
      setLoading(true);
      const data = await api.sessions.get(id!);
      setSession(data);
      if (data.chat) {
        setChatList(data.chat);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load session report');
    } finally {
      setLoading(false);
    }
  };

  const handleSeekToTimestamp = (timestampStr: string) => {
    if (!mediaRef.current || !timestampStr) return;
    const parts = timestampStr.split(':');
    if (parts.length === 2) {
      const minutes = parseInt(parts[0], 10);
      const seconds = parseInt(parts[1], 10);
      if (!isNaN(minutes) && !isNaN(seconds)) {
        const totalSec = minutes * 60 + seconds;
        mediaRef.current.currentTime = totalSec;
        mediaRef.current.play().catch(() => {});
      }
    }
  };

  const handleSaveWord = async (word: string, meaning: string, example: string) => {
    if (!id || !session) return;
    try {
      await api.vocab.save({
        word,
        meaning,
        example,
        language: session.language || 'English',
        sourceSessionId: id,
      });
      setSavedWordsMap((prev) => ({ ...prev, [word.toLowerCase()]: true }));
    } catch (err: any) {
      alert(err.message || 'Failed to save word');
    }
  };

  const handleSendChat = async (inputQuestion?: string) => {
    const query = inputQuestion || question;
    if (!query.trim() || !id || asking) return;

    try {
      setAsking(true);
      const userMsg = { role: 'user', text: query, createdAt: new Date() };
      setChatList((prev) => [...prev, userMsg]);
      setQuestion('');

      const res = await api.sessions.ask(id, query);
      setChatList(res.chat || []);
    } catch (err: any) {
      alert(err.message || 'Failed to send follow-up question');
    } finally {
      setAsking(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4" />
        <p className="text-slate-500 text-sm">Loading your coaching report...</p>
      </div>
    );
  }

  if (error || !session || !session.report) {
    return (
      <div className="max-w-2xl mx-auto my-12 p-8 bg-white rounded-3xl border border-slate-200 text-center shadow-sm">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-900">Report Unavailable</h2>
        <p className="text-sm text-slate-500 mt-2">{error || 'Session report could not be found.'}</p>
        <Link to="/" className="inline-flex items-center gap-2 mt-6 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Workspace</span>
        </Link>
      </div>
    );
  }

  const report = session.report;
  const fluency = session.fluency || {};
  const scores = report.scores || {};

  // Highlight filler words in transcript
  const renderHighlightedTranscript = () => {
    if (!report.transcript) return null;
    const fillers = report.filler_words_detected || [];
    if (fillers.length === 0) return report.transcript;

    const regex = new RegExp(`\\b(${fillers.map((f: string) => f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'gi');
    const parts = report.transcript.split(regex);

    return parts.map((part: string, idx: number) => {
      const isFiller = fillers.some((f: string) => f.toLowerCase() === part.toLowerCase());
      if (isFiller) {
        return (
          <mark key={idx} className="bg-amber-100 text-amber-900 border border-amber-300 px-1 py-0.5 rounded text-xs font-semibold mx-0.5">
            {part}
          </mark>
        );
      }
      return part;
    });
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      
      {/* Top Back Nav */}
      <div>
        <Link to="/" className="inline-flex items-center gap-2 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-xl transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Home Workspace</span>
        </Link>
      </div>

      {/* Header Banner */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">
            <Sparkles className="w-4 h-4" />
            <span>AI Spoken-Language Coach Report</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900">
            {session.language} Practice — {session.goal.toUpperCase()}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Recorded on {new Date(session.createdAt).toLocaleDateString()} &bull; Duration: {session.durationSec}s
          </p>
        </div>

        {/* Level Badge */}
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 px-5 py-3 rounded-2xl shrink-0">
          <Award className="w-8 h-8 text-blue-600" />
          <div>
            <div className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">CEFR Level</div>
            <div className="text-2xl font-black text-blue-700">
              {report.detected_level}
            </div>
          </div>
        </div>
      </div>

      {/* Local Video/Audio Preview Player */}
      {localPreviewUrl && (
        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-3">
            <PlayCircle className="w-4 h-4 text-blue-600" />
            <span>Local Clip Preview (Click timestamps in Key Details to seek)</span>
          </div>
          {session.mediaType === 'video' ? (
            <video ref={mediaRef as any} src={localPreviewUrl} controls className="w-full max-h-[400px] rounded-2xl bg-black" />
          ) : (
            <audio ref={mediaRef as any} src={localPreviewUrl} controls className="w-full" />
          )}
        </div>
      )}

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Fluency Index Card */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Fluency Index</span>
            <Zap className="w-5 h-5 text-amber-500" />
          </div>
          <div className="text-3xl font-black text-slate-900">{fluency.index || 0} / 100</div>
          <p className="text-[11px] text-slate-500 mt-1">Deterministic pace, pause & filler score</p>

          <button
            onClick={() => setShowFluencyBreakdown(!showFluencyBreakdown)}
            className="mt-3 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-semibold"
          >
            <span>{showFluencyBreakdown ? 'Hide Breakdown' : 'View Breakdown'}</span>
            {showFluencyBreakdown ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Gemini Delivery Score */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Delivery</span>
            <TrendingUp className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-3xl font-black text-blue-600">{scores.delivery || 0}%</div>
          <div className="w-full bg-slate-100 h-2 rounded-full mt-3 overflow-hidden">
            <div className="bg-blue-600 h-full transition-all" style={{ width: `${scores.delivery || 0}%` }} />
          </div>
        </div>

        {/* Vocabulary Score */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Vocabulary</span>
            <BookOpen className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="text-3xl font-black text-indigo-600">{scores.vocabulary || 0}%</div>
          <div className="w-full bg-slate-100 h-2 rounded-full mt-3 overflow-hidden">
            <div className="bg-indigo-600 h-full transition-all" style={{ width: `${scores.vocabulary || 0}%` }} />
          </div>
        </div>

        {/* Clarity Score */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Clarity</span>
            <Sparkles className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="text-3xl font-black text-emerald-600">{scores.clarity || 0}%</div>
          <div className="w-full bg-slate-100 h-2 rounded-full mt-3 overflow-hidden">
            <div className="bg-emerald-600 h-full transition-all" style={{ width: `${scores.clarity || 0}%` }} />
          </div>
        </div>
      </div>

      {/* Expandable Fluency Breakdown Drawer */}
      {showFluencyBreakdown && (
        <div className="bg-amber-50/60 p-6 rounded-3xl border border-amber-200 grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div>
            <div className="text-xs text-amber-900 uppercase font-bold">Speaking Speed</div>
            <div className="text-xl font-extrabold text-slate-900 mt-1">{fluency.wpm || 0} WPM</div>
            <div className="text-xs text-slate-600 mt-1">Pace Score: {fluency.paceScore || 0}/100</div>
          </div>
          <div>
            <div className="text-xs text-amber-900 uppercase font-bold">Silence / Pause Ratio</div>
            <div className="text-xl font-extrabold text-slate-900 mt-1">{((fluency.pauseRatio || 0) * 100).toFixed(1)}%</div>
            <div className="text-xs text-slate-600 mt-1">Pause Score: {fluency.pauseScore || 0}/100</div>
          </div>
          <div>
            <div className="text-xs text-amber-900 uppercase font-bold">Fillers per 100 Words</div>
            <div className="text-xl font-extrabold text-slate-900 mt-1">{fluency.fillersPer100 || 0}</div>
            <div className="text-xs text-slate-600 mt-1">Filler Score: {fluency.fillerScore || 0}/100</div>
          </div>
        </div>
      )}

      {/* Plan Section */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 text-blue-600 text-xs font-bold uppercase tracking-wider mb-2">
          <Lightbulb className="w-4 h-4" />
          <span>Personalized Coaching Plan</span>
        </div>
        <p className="text-slate-800 text-sm font-medium leading-relaxed">{report.plan?.summary}</p>

        {report.plan?.focus_areas && report.plan.focus_areas.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Focus Areas</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {report.plan.focus_areas.map((area: string, idx: number) => (
                <div key={idx} className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-800 font-medium">
                  <CheckCircle className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>{area}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Key Details Timeline */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-600" />
          Key Details & Timestamped Observations
        </h3>

        <div className="space-y-4">
          {report.key_details?.map((detail: any, idx: number) => (
            <div key={idx} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 hover:border-blue-200 transition-all">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSeekToTimestamp(detail.timestamp)}
                    className="px-2.5 py-1 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-700 text-xs font-mono font-bold flex items-center gap-1 transition-all"
                  >
                    <PlayCircle className="w-3.5 h-3.5" />
                    {detail.timestamp}
                  </button>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700 uppercase">
                    {detail.category}
                  </span>
                </div>

                {detail.category === 'vocabulary' && detail.better_phrase && (
                  <button
                    onClick={() => handleSaveWord(detail.better_phrase, detail.suggestion, `Observed at ${detail.timestamp}`)}
                    className={`text-xs px-2.5 py-1 rounded-lg border font-semibold flex items-center gap-1 transition-all ${
                      savedWordsMap[detail.better_phrase.toLowerCase()]
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : 'bg-white hover:bg-blue-50 text-blue-700 border-blue-200'
                    }`}
                  >
                    <Bookmark className="w-3.5 h-3.5" />
                    {savedWordsMap[detail.better_phrase.toLowerCase()] ? 'Saved' : 'Save Word'}
                  </button>
                )}
              </div>

              <p className="text-xs sm:text-sm text-slate-800 font-medium">{detail.observation}</p>
              <p className="text-xs text-slate-600">
                <span className="font-bold text-slate-800">Suggestion:</span> {detail.suggestion}
              </p>

              {detail.better_phrase && (
                <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 font-medium">
                  <span className="font-bold text-blue-700">Better phrase:</span> "{detail.better_phrase}"
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Actions Checklist */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900 mb-4">Recommended Exercises & Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {report.actions?.map((act: any, idx: number) => (
            <div key={idx} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-900">{act.title}</h4>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-medium">
                  {act.duration_minutes} mins
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">{act.exercise}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Vocabulary & Idiom Suggestions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Vocab Suggestions */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <h3 className="text-md font-bold text-slate-900 mb-4 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-blue-600" />
            Suggested Vocabulary
          </h3>
          <div className="space-y-3">
            {report.vocabulary_suggestions?.map((item: any, idx: number) => (
              <div key={idx} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-indigo-900">{item.word}</div>
                  <div className="text-xs text-slate-700 font-medium mt-0.5">{item.meaning}</div>
                  <div className="text-xs text-slate-500 italic mt-1">"{item.example}"</div>
                </div>
                <button
                  onClick={() => handleSaveWord(item.word, item.meaning, item.example)}
                  className={`text-xs p-2 rounded-xl border transition-all ${
                    savedWordsMap[item.word.toLowerCase()]
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  <Bookmark className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Idiom Suggestions */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <h3 className="text-md font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-600" />
            Native Idiom Suggestions
          </h3>
          <div className="space-y-3">
            {report.idiom_suggestions?.map((item: any, idx: number) => (
              <div key={idx} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="text-sm font-bold text-blue-900">{item.idiom}</div>
                <div className="text-xs text-slate-700 font-medium mt-0.5">{item.meaning}</div>
                <div className="text-xs text-slate-500 italic mt-1">"{item.example}"</div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Transcript with Filler Highlights */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900 mb-2">Verbatim Transcript</h3>
        <p className="text-xs text-slate-500 mb-4">
          Filler words detected: {report.filler_words_detected?.length ? report.filler_words_detected.join(', ') : 'None'}
        </p>
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-800 leading-relaxed font-mono">
          {renderHighlightedTranscript()}
        </div>
      </div>

      {/* Follow-Up Chat Box */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-bold text-slate-900">Ask Follow-Up Questions</h3>
        </div>
        <p className="text-xs text-slate-500">
          Ask Gemini specific questions about your recording (e.g. "How was my intonation at 00:08?").
        </p>

        {/* Suggested Quick Questions */}
        <div className="flex flex-wrap gap-2">
          {[
            'How was my intonation at 00:08?',
            'How can I replace filler words in my next session?',
            'What were my main grammar mistakes?',
          ].map((q, idx) => (
            <button
              key={idx}
              onClick={() => handleSendChat(q)}
              className="text-xs px-3 py-1.5 rounded-full bg-slate-100 hover:bg-blue-50 border border-slate-200 text-slate-700 hover:text-blue-700 font-medium transition-all"
            >
              "{q}"
            </button>
          ))}
        </div>

        {/* Chat History */}
        <div className="space-y-3 max-h-96 overflow-y-auto p-2">
          {chatList.map((msg: any, idx: number) => (
            <div
              key={idx}
              className={`p-3.5 rounded-2xl text-xs sm:text-sm max-w-[85%] ${
                msg.role === 'user'
                  ? 'ml-auto bg-blue-600 text-white rounded-br-none'
                  : 'mr-auto bg-slate-100 border border-slate-200 text-slate-800 rounded-bl-none'
              }`}
            >
              <div className="text-[10px] opacity-70 mb-1 font-bold">{msg.role === 'user' ? 'You' : 'Coach Gemini'}</div>
              <div className="whitespace-pre-wrap leading-relaxed">{msg.text}</div>
            </div>
          ))}
        </div>

        {/* Chat Input */}
        <div className="flex items-center gap-2 pt-2">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
            placeholder="Ask a question about this recording..."
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all"
          />
          <button
            onClick={() => handleSendChat()}
            disabled={asking || !question.trim()}
            className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-all disabled:opacity-50"
          >
            {asking ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>

    </div>
  );
};
