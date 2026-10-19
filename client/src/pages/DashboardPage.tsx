import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { MyDiaryDrawer } from '../components/MyDiaryDrawer';
import { PhrasesDrawer } from '../components/PhrasesDrawer';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getChatUi, routeChatMessage } from '../lib/chatRouter';
import { ALLOWED_AUDIO_FORMATS, ALLOWED_VIDEO_FORMATS, MAX_FILE_SIZE_MB } from '../data/uploadLimits';
import {
  Sparkles,
  Video,
  Mic,
  Upload,
  BarChart2,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Send,
  Thermometer,
  BookMarked,
  Quote,
  CheckCircle2,
  AlertCircle,
  Square,
  RefreshCw,
  BookOpen,
  Layers,
  RotateCcw,
  Bookmark,
  Check,
  Trash2,
} from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'assistant' | 'error';
  text: string;
  timestamp: string;
}

type Phase = 'idle' | 'analyzing' | 'done' | 'error';

interface ImprovementsData {
  word_choices: Array<{ original: string; better: string; reason: string }>;
  vocabulary_upgrades: Array<{ word: string; meaning: string; example: string; replaces: string | null }>;
  phrase_upgrades: Array<{ original_sentence: string; upgraded: string; idiom_or_phrase: string; meaning: string }>;
  sentence_structure: Array<{ original: string; improved: string; explanation: string }>;
  tone: {
    label:
      | 'neutral'
      | 'emotional'
      | 'suspenseful'
      | 'comedic'
      | 'serious'
      | 'enthusiastic'
      | 'nervous'
      | 'sad'
      | 'angry'
      | 'inspirational';
    reason: string;
  };
}

const TONE_CONFIG: Record<string, { bg: string; text: string; border: string; emoji: string }> = {
  neutral: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200', emoji: '😐' },
  emotional: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', emoji: '🥺' },
  suspenseful: { bg: 'bg-brand-50', text: 'text-brand-700', border: 'border-brand-200', emoji: '🤫' },
  comedic: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', emoji: '😄' },
  serious: { bg: 'bg-brand-50', text: 'text-brand-700', border: 'border-brand-200', emoji: '🧐' },
  enthusiastic: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', emoji: '🔥' },
  nervous: { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', emoji: '😬' },
  sad: { bg: 'bg-brand-50', text: 'text-brand-700', border: 'border-brand-200', emoji: '😢' },
  angry: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', emoji: '😠' },
  inspirational: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', emoji: '✨' },
};

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const chatUi = getChatUi();

  // Selected language state (synced with Navbar)
  const [selectedLanguage, setSelectedLanguage] = useState(() => {
    return localStorage.getItem('fluentlens_selected_lang') || 'English';
  });

  useEffect(() => {
    const handleLangChange = (e: any) => {
      setSelectedLanguage(e.detail || 'English');
    };
    window.addEventListener('fluentlens_lang_change', handleLangChange);
    return () => window.removeEventListener('fluentlens_lang_change', handleLangChange);
  }, []);

  // Workspace & API State
  const [progressData, setProgressData] = useState<any>(null);
  const [latestSession, setLatestSession] = useState<any>(null);
  const [, setLoading] = useState(true);

  // Improvements analysis state
  const [phase, setPhase] = useState<Phase>('idle');
  const [improvements, setImprovements] = useState<ImprovementsData | null>(null);
  const [savedReportItems, setSavedReportItems] = useState<Set<string>>(new Set());
  const [savingReportItems, setSavingReportItems] = useState<Set<string>>(new Set());
  const [reportSaveError, setReportSaveError] = useState<string | null>(null);
  const [submittedTemperature, setSubmittedTemperature] = useState<number | null>(null);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [temperature, setTemperature] = useState(0.7);
  const [chatWidth, setChatWidth] = useState(() => {
    try {
      const saved = Number(localStorage.getItem('fluentlens.chatWidth'));
      return Number.isFinite(saved) && saved >= 290 ? saved : 290;
    } catch { return 290; }
  });
  const [isDraggingChatWidth, setIsDraggingChatWidth] = useState(false);
  const dashboardGridRef = useRef<HTMLDivElement | null>(null);
  const chatDragStartRef = useRef<{ x: number; width: number } | null>(null);
  const chatWidthBounds = () => {
    const gridWidth = dashboardGridRef.current?.clientWidth || window.innerWidth - 64;
    const max = Math.floor(Math.min(window.innerWidth * 0.5, gridWidth - 260 - 40 - 340));
    return { min: 290, max: Math.max(290, max) };
  };
  const clampChatWidth = (width: number) => {
    const bounds = chatWidthBounds();
    return Math.max(bounds.min, Math.min(bounds.max, width));
  };

  useEffect(() => {
    const resize = () => setChatWidth((width) => clampChatWidth(width));
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => {
    try { localStorage.setItem('fluentlens.chatWidth', String(chatWidth)); } catch { /* UI preference storage is optional. */ }
  }, [chatWidth]);

  // Practice Input Mode ('video' | 'audio')
  const [mediaType, setMediaType] = useState<'video' | 'audio'>('video');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);
  const sendingChatRef = useRef(false);

  // Submitting / Polling state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pollingStep, setPollingStep] = useState('Uploading media clip...');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isReevaluating, setIsReevaluating] = useState(false);
  const [reevalError, setReevalError] = useState<string | null>(null);
  const reevalInFlightRef = useRef(false);
  const reevalPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Drawers open state
  const [isDiaryOpen, setIsDiaryOpen] = useState(false);
  const [isPhrasesOpen, setIsPhrasesOpen] = useState(false);

  useEffect(() => {
    fetchWorkspaceData();
  }, []);

  const fetchWorkspaceData = async () => {
    try {
      setLoading(true);
      const progRes = await api.progress.get().catch(() => null);
      if (progRes) setProgressData(progRes);
    } catch (err) {
      console.error('Error fetching workspace data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Scroll chat to bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Clean up media streams
  useEffect(() => {
    return () => {
      stopMediaStream();
      if (timerRef.current) clearInterval(timerRef.current);
      if (reevalPollRef.current) clearInterval(reevalPollRef.current);
    };
  }, []);

  const stopMediaStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const startLiveRecording = async () => {
    setPermissionError(null);
    setRecordedBlob(null);
    setUploadedFile(null);
    setRecordingSeconds(0);

    try {
      const constraints: MediaStreamConstraints = {
        audio: true,
        video: mediaType === 'video' ? { width: 1280, height: 720 } : false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      const chunks: Blob[] = [];
      const mimeType = mediaType === 'video' ? 'video/webm;codecs=vp8,opus' : 'audio/webm;codecs=opus';
      const options = MediaRecorder.isTypeSupported(mimeType) ? { mimeType } : undefined;

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, {
          type: mediaType === 'video' ? 'video/webm' : 'audio/webm',
        });
        setRecordedBlob(blob);
        stopMediaStream();
      };

      mediaRecorder.start(1000);
      setIsRecording(true);

      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev >= 179) {
            stopLiveRecording();
            return 180;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err: any) {
      setPermissionError(`Microphone / camera access required for live recording.`);
    }
  };

  const stopLiveRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false);
  };

  const handleSendChatMessage = async (messageText = inputMessage) => {
    if (!messageText.trim() || sendingChatRef.current) return;
    const hasCompletedSession = phase === 'done' && latestSession?.status === 'done';
    const localReply = routeChatMessage(messageText, { hasSession: hasCompletedSession });
    const query = messageText.trim();
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const userMsg: ChatMessage = { role: 'user', text: query, timestamp: nowStr };
    sendingChatRef.current = true;
    setChatMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setIsSendingChat(true);

    try {
      if (!hasCompletedSession || localReply) {
        const reply = localReply?.reply || "Please upload or record a video or audio first. Then I can give feedback on your own speaking. Your saved words are in **My Diary**.";
        setChatMessages((prev) => [
          ...prev,
          { role: 'assistant', text: reply, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
        ]);
      } else {
        const res = await api.sessions.ask(latestSession._id, query, temperature);
        setChatMessages((prev) => [
          ...prev,
          { role: 'assistant', text: res.answer || chatUi.emptyAnswerFallback, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
        ]);
      }
    } catch (err: any) {
      setChatMessages((prev) => [
        ...prev,
        {
          role: 'error',
          text: err.message || 'The request failed. Please try again.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      sendingChatRef.current = false;
      setIsSendingChat(false);
    }
  };

  const finishReevaluate = (session?: any) => {
    if (reevalPollRef.current) {
      clearInterval(reevalPollRef.current);
      reevalPollRef.current = null;
    }
    reevalInFlightRef.current = false;
    setIsReevaluating(false);

    if (!session) return;

    if (session.errorMessage) {
      setReevalError(session.errorMessage);
      return;
    }

    setLatestSession(session);
    if (session.report?.improvements) {
      setImprovements(session.report.improvements);
    }
    if (typeof session.temperature === 'number') {
      setSubmittedTemperature(session.temperature);
    }
  };

  const handleReevaluate = async () => {
    if (reevalInFlightRef.current || isReevaluating || isSubmitting) return;
    if (!latestSession?._id || latestSession.isDemo || latestSession.canReevaluate === false) return;

    reevalInFlightRef.current = true;
    setReevalError(null);
    setIsReevaluating(true);

    try {
      await api.sessions.reevaluate(latestSession._id, temperature);
      reevalPollRef.current = setInterval(async () => {
        try {
          const session = await api.sessions.get(latestSession._id);
          if (!session.isReevaluating) {
            finishReevaluate(session);
          }
        } catch (err: any) {
          finishReevaluate();
          setReevalError(err.message || 'Error checking re-evaluation status.');
        }
      }, 3000);
    } catch (err: any) {
      reevalInFlightRef.current = false;
      setIsReevaluating(false);
      setReevalError(err.message || 'Failed to start re-evaluation.');
    }
  };

  const handleSubmitSession = async (useDemo: boolean = false) => {
    setChatMessages([]);
    setLatestSession(null);
    setSubmitError(null);
    setReevalError(null);

    // Validate inputs
    if (!useDemo && !recordedBlob && !uploadedFile) {
      setSubmitError('Please select or record a video/audio clip first.');
      setPhase('error');
      return;
    }

    setSubmittedTemperature(temperature);
    setPhase('analyzing');
    setIsSubmitting(true);
    setPollingStep('Uploading practice clip...');

    try {
      const formData = new FormData();
      formData.append('language', selectedLanguage);
      formData.append('goal', 'interview');
      formData.append('temperature', temperature.toString());

      if (useDemo) {
        formData.append('isDemo', 'true');
      } else if (recordedBlob) {
        formData.append('file', recordedBlob, 'recording.webm');
      } else if (uploadedFile) {
        formData.append('file', uploadedFile);
      }

      const createRes = await api.sessions.create(formData);
      const sessionId = createRes.id;

      setPollingStep('Evaluating fluency, pause ratio & clarity...');

      const pollInterval = setInterval(async () => {
        try {
          const session = await api.sessions.get(sessionId);
          if (session.status === 'done') {
            clearInterval(pollInterval);
            setIsSubmitting(false);
            setLatestSession(session);
            if (session.report?.improvements) {
              setImprovements(session.report.improvements);
            }
            setPhase('done');
            fetchWorkspaceData();
          } else if (session.status === 'failed') {
            clearInterval(pollInterval);
            setIsSubmitting(false);
            setSubmitError(session.errorMessage || 'Analysis failed. Please try again.');
            setPhase('error');
          }
        } catch (err: any) {
          clearInterval(pollInterval);
          setIsSubmitting(false);
          setSubmitError(err.message || 'Error checking session analysis status.');
          setPhase('error');
        }
      }, 3000);
    } catch (err: any) {
      setIsSubmitting(false);
      setSubmitError(err.message || 'Failed to submit practice clip.');
      setPhase('error');
    }
  };

  const handleResetToIdle = () => {
    setChatMessages([]);
    setLatestSession(null);
    setPhase('idle');
    setImprovements(null);
    setUploadedFile(null);
    setRecordedBlob(null);
    setRecordingSeconds(0);
    setSubmitError(null);
    setReevalError(null);
    setIsReevaluating(false);
    reevalInFlightRef.current = false;
    if (reevalPollRef.current) {
      clearInterval(reevalPollRef.current);
      reevalPollRef.current = null;
    }
  };

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getClipSummaryName = () => {
    if (uploadedFile) return uploadedFile.name;
    if (recordedBlob) return `Recorded ${mediaType} clip`;
    return 'Sample demo clip';
  };

  const renderWithHighlightedPhrase = (sentence: string, phrase: string) => {
    if (!phrase) return sentence;
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    const parts = sentence.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="bg-brand-100 text-brand-900 font-semibold px-1 py-0.5 rounded">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  const getTemperatureModeText = (temp: number | null): string => {
    if (temp === null || temp === undefined) return '';
    if (temp < 0.35) return `Accurate mode (${temp.toFixed(2)})`;
    if (temp <= 0.7) return `Balanced mode (${temp.toFixed(2)})`;
    return `Creative mode (${temp.toFixed(2)})`;
  };

  const reportItemKey = (kind: 'word' | 'phrase', value: string) => `${kind}:${value.trim().toLocaleLowerCase()}`;
  const saveReportWord = async (item: { word: string; meaning: string; example: string }) => {
    const key = reportItemKey('word', item.word);
    if (!item.word?.trim() || savingReportItems.has(key) || savedReportItems.has(key)) return;
    setSavingReportItems((prev) => new Set(prev).add(key));
    setReportSaveError(null);
    try {
      await api.vocab.save({ ...item, language: latestSession?.language || selectedLanguage, sourceSessionId: latestSession?._id });
      setSavedReportItems((prev) => new Set(prev).add(key));
    } catch (error: any) {
      setReportSaveError(error.message || 'Could not save vocabulary item. Please try again.');
    } finally {
      setSavingReportItems((prev) => { const next = new Set(prev); next.delete(key); return next; });
    }
  };
  const saveReportPhrase = async (phrase: string, context?: string) => {
    const key = reportItemKey('phrase', phrase);
    if (!phrase?.trim() || savingReportItems.has(key) || savedReportItems.has(key)) return;
    setSavingReportItems((prev) => new Set(prev).add(key));
    setReportSaveError(null);
    try {
      await api.phrases.save({ phrase, context });
      setSavedReportItems((prev) => new Set(prev).add(key));
    } catch (error: any) {
      setReportSaveError(error.message || 'Could not save phrase. Please try again.');
    } finally {
      setSavingReportItems((prev) => { const next = new Set(prev); next.delete(key); return next; });
    }
  };

  useEffect(() => {
    if (!latestSession?._id) return;
    let cancelled = false;
    Promise.all([api.vocab.list(), api.phrases.list()]).then(([words, phrases]) => {
      if (cancelled) return;
      const fetchedKeys = [
        ...words.map((item) => reportItemKey('word', item.word)),
        ...phrases.map((item) => reportItemKey('phrase', item.phrase)),
      ];
      setSavedReportItems((prev) => new Set([...prev, ...fetchedKeys]));
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [latestSession?._id]);

  // Calendar calculations
  const activeDaysCount = progressData?.currentStreak || 12;
  const isCompact = phase === 'analyzing' || phase === 'done';
  const vocabularyReportItems = [
    ...(improvements?.vocabulary_upgrades || []),
    ...(latestSession?.report?.vocabulary_suggestions || []),
  ].filter((item, index, all) => all.findIndex((candidate) => candidate.word?.toLocaleLowerCase() === item.word?.toLocaleLowerCase()) === index);
  const phraseReportItems = [
    ...(improvements?.phrase_upgrades || []),
    ...(latestSession?.report?.idiom_suggestions || []).map((item: any) => ({
      idiom_or_phrase: item.idiom,
      meaning: item.meaning,
      example: item.example,
      upgraded: item.example,
      original_sentence: '',
    })),
  ].filter((item, index, all) => all.findIndex((candidate) => candidate.idiom_or_phrase?.toLocaleLowerCase() === item.idiom_or_phrase?.toLocaleLowerCase()) === index);
  const canChat = phase === 'done' && latestSession?.status === 'done';
  const chatMaxWidth = chatWidthBounds().max;

  return (
    <div className={`w-full min-w-0 max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-3 lg:py-4 min-h-full lg:h-full lg:min-h-0 lg:overflow-hidden overflow-x-hidden flex flex-col ${isDraggingChatWidth ? 'select-none' : ''}`}>
      
      {/* MAIN 3-COLUMN DESKTOP GRID (Resizable Chat, Flexible Center, 260px Right) */}
      <div
        ref={dashboardGridRef}
        style={{ ['--chat-w' as any]: `${chatWidth}px` }}
        className={`relative grid grid-cols-1 lg:grid-cols-[var(--chat-w)_minmax(340px,1fr)_260px] gap-4 lg:gap-5 items-start flex-1 min-h-0 min-w-0 lg:h-full lg:items-stretch ${isDraggingChatWidth ? 'select-none' : ''}`}
      >
        
        {/* ================================================== */}
        {/* LEFT COLUMN: CHATBOT & TEMPERATURE (Separate Cards)*/}
        {/* ================================================== */}
        <div className="space-y-3.5 min-w-0 min-h-0 lg:h-full lg:overflow-y-auto lg:overflow-x-hidden thin-scrollbar">
          
          {/* CARD 1: AI CHATBOT */}
          <div className="w-full min-w-0 bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col justify-between">
            
            {/* Header */}
            <div className="pb-2.5 border-b border-slate-100">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-600">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <h2 className="text-sm font-bold text-slate-900">AI Chatbot</h2>
                </div>
                <button type="button" onClick={() => setChatMessages([])} aria-label="Clear chat" title="Clear chat" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                {chatUi.headerHint}
              </p>
            </div>

            {/* Chat Message History */}
            <div className="max-h-[170px] xl:max-h-[210px] overflow-y-auto py-2 space-y-2 pr-1 thin-scrollbar">
              {chatMessages.length === 0 && (
                <div className="min-h-[96px] flex flex-col items-center justify-center text-center gap-2 py-3">
                  <p className="text-[11px] text-slate-400">{canChat ? chatUi.hintAfterAnalysis : chatUi.hintBeforeAnalysis}</p>
                  <div className="flex flex-wrap justify-center gap-1.5">{(canChat ? chatUi.chipsAfterAnalysis : chatUi.chipsBeforeAnalysis).map((quickReply) => <button key={quickReply} type="button" disabled={isSendingChat} onClick={() => void handleSendChatMessage(quickReply)} className="rounded-full border border-brand-100 bg-brand-50 px-2.5 py-1 text-[10px] font-medium text-brand-700 hover:bg-brand-100 disabled:opacity-50">{quickReply}</button>)}</div>
                </div>
              )}
              {chatMessages.map((msg, idx) => (
                <div key={idx} className={`flex items-start gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  {msg.role !== 'user' ? (
                    <div className="w-6 h-6 rounded-lg bg-brand-600 text-white flex items-center justify-center shrink-0 text-[10px] shadow-xs">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="11" width="18" height="10" rx="2" />
                        <circle cx="12" cy="5" r="2" />
                        <path d="M12 7v4" />
                        <line x1="8" y1="15" x2="8" y2="15.01" />
                        <line x1="16" y1="15" x2="16" y2="15.01" />
                      </svg>
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-brand-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0 shadow-xs">
                      {user?.name ? user.name.charAt(0).toUpperCase() : 'A'}
                    </div>
                  )}

                  <div className={`max-w-[85%] min-w-0 rounded-xl px-3 py-2 text-[11px] leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-brand-600 text-white rounded-tr-xs shadow-xs'
                      : msg.role === 'error'
                      ? 'bg-rose-50 border border-rose-200 text-rose-800 rounded-tl-xs'
                      : 'bg-slate-100 text-slate-800 rounded-tl-xs'
                  }`}>
                    {msg.role === 'assistant' ? <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                      strong: (props) => <strong className="font-semibold text-slate-900" {...props} />,
                      ul: (props) => <ul className="list-disc pl-4 space-y-1" {...props} />,
                      ol: (props) => <ol className="list-decimal pl-4" {...props} />,
                      p: (props) => <p className="mb-1 last:mb-0" {...props} />,
                      table: (props) => <div className="max-w-full overflow-x-auto"><table className="text-[11px] border border-slate-200" {...props} /></div>,
                      th: (props) => <th className="bg-slate-50 px-2 py-1 text-left" {...props} />,
                      td: (props) => <td className="px-2 py-1" {...props} />,
                    }}>{msg.text}</ReactMarkdown> : <p>{msg.text}</p>}
                    <span className={`block text-[9px] mt-0.5 ${msg.role === 'user' ? 'text-brand-100 text-right' : 'text-slate-400'}`}>
                      {msg.timestamp}
                    </span>
                  </div>
                </div>
              ))}
              {isSendingChat && <div className="flex items-center gap-2"><div className="w-6 h-6 rounded-lg bg-brand-600 text-white flex items-center justify-center shrink-0"><Sparkles className="w-3.5 h-3.5" /></div><div className="rounded-xl rounded-tl-xs bg-slate-100 px-3 py-2.5 flex gap-1"><span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.2s]" /><span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.1s]" /><span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" /></div></div>}
              <div ref={chatBottomRef} />
            </div>

            {/* Input & Send Bar */}
            <div className="pt-2 border-t border-slate-100">
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleSendChatMessage(); } }}
                  placeholder="Ask a question…"
                  className="w-full min-w-0 bg-slate-50 border border-slate-200 rounded-full pl-3.5 pr-10 py-1.5 text-[11px] text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-500 transition-colors"
                />
                <button
                  onClick={() => void handleSendChatMessage()}
                  disabled={!inputMessage.trim() || isSendingChat}
                  className="absolute right-1 p-1.5 rounded-full bg-brand-600 hover:bg-brand-700 text-white transition-all disabled:opacity-40"
                >
                  <Send className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>

          {/* CARD 2: TEMPERATURE (SEPARATE CARD) */}
          <div className="w-[290px] max-w-full self-start bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-xs space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <Thermometer className="w-3.5 h-3.5 text-brand-600" />
                <span>Temperature</span>
              </div>
              <button
                type="button"
                onClick={handleReevaluate}
                disabled={
                  isReevaluating ||
                  isSubmitting ||
                  phase !== 'done' ||
                  !latestSession?._id ||
                  latestSession.isDemo ||
                  latestSession.canReevaluate === false
                }
                className="px-2.5 py-1 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-[10px] font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              >
                {isReevaluating ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Evaluating…</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3 h-3" />
                    <span>Re-evaluate</span>
                  </>
                )}
              </button>
            </div>

            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={temperature}
              disabled={isReevaluating || isSubmitting}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className={`w-full accent-brand-600 h-1.5 bg-slate-200 rounded-lg ${
                isReevaluating || isSubmitting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
              }`}
            />

            <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
              <span>More Accurate<br />(Deterministic)</span>
              <span className="text-right">More Creative<br />(Diverse)</span>
            </div>

            {reevalError && (
              <div className="p-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-[10px] leading-relaxed">
                {reevalError}
              </div>
            )}
          </div>

        </div>

        <div
          role="separator"
          aria-label="Resize chatbot column"
          aria-orientation="vertical"
          aria-valuemin={290}
          aria-valuemax={chatMaxWidth}
          aria-valuenow={chatWidth}
          tabIndex={0}
          onPointerDown={(event) => {
            if (event.pointerType === 'mouse' && event.button !== 0) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            chatDragStartRef.current = { x: event.clientX, width: chatWidth };
            setIsDraggingChatWidth(true);
          }}
          onPointerMove={(event) => {
            if (chatDragStartRef.current) setChatWidth(clampChatWidth(chatDragStartRef.current.width + event.clientX - chatDragStartRef.current.x));
          }}
          onPointerUp={(event) => {
            chatDragStartRef.current = null;
            setIsDraggingChatWidth(false);
            if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
          }}
          onPointerCancel={() => { chatDragStartRef.current = null; setIsDraggingChatWidth(false); }}
          onDoubleClick={() => setChatWidth(clampChatWidth(290))}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft') { event.preventDefault(); setChatWidth((width) => clampChatWidth(width - 16)); }
            if (event.key === 'ArrowRight') { event.preventDefault(); setChatWidth((width) => clampChatWidth(width + 16)); }
          }}
          className="hidden lg:flex absolute z-20 top-0 bottom-0 w-2 items-center justify-center cursor-col-resize touch-none outline-none group"
          style={{ left: 'calc(var(--chat-w) + 6px)' }}
        >
          <span className={`h-full w-px transition-colors ${isDraggingChatWidth ? 'bg-brand-400' : 'bg-slate-200 group-hover:bg-brand-300 group-focus:bg-brand-400'}`} />
          <span className={`absolute flex flex-col gap-1 rounded-full bg-white border border-slate-200 px-1 py-2 shadow-sm transition-opacity ${isDraggingChatWidth ? 'opacity-100' : 'opacity-40 group-hover:opacity-100 group-focus:opacity-100'}`} aria-hidden="true"><i className="w-0.5 h-0.5 rounded-full bg-slate-500" /><i className="w-0.5 h-0.5 rounded-full bg-slate-500" /><i className="w-0.5 h-0.5 rounded-full bg-slate-500" /></span>
        </div>

        {/* ================================================== */}
        {/* CENTER COLUMN: PRACTICE AREA & IMPROVEMENTS (Wide) */}
        {/* ================================================== */}
        <div className="flex flex-col min-h-0 min-w-0 lg:h-full lg:self-stretch lg:overflow-y-auto lg:overflow-x-hidden thin-scrollbar space-y-3.5">
          
          {/* Record or Upload Practice Card (Collapsible) */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 sm:p-5 shrink-0 transition-all duration-500 ease-in-out">
            
            {/* COMPACT SUMMARY ROW: Visible in analyzing and done */}
            <div
              className={`transition-all duration-500 ease-in-out overflow-hidden motion-reduce:transition-none ${
                isCompact ? 'max-h-24 opacity-100' : 'max-h-0 opacity-0 pointer-events-none'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-600 shrink-0">
                    {mediaType === 'video' ? <Video className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 truncate">
                      {getClipSummaryName()}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {selectedLanguage} &bull;{' '}
                      {phase === 'analyzing'
                        ? 'Processing analysis'
                        : isReevaluating
                        ? 'Re-evaluating with new temperature'
                        : 'Analysis complete'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {phase === 'analyzing' && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-brand-50 border border-brand-100 text-brand-700 text-xs font-medium">
                      <div className="w-3.5 h-3.5 border-2 border-brand-600/30 border-t-brand-600 rounded-full animate-spin" />
                      <span className="hidden sm:inline text-[11px]">{pollingStep}</span>
                    </div>
                  )}

                  {phase === 'done' && (
                    <button
                      type="button"
                      onClick={handleResetToIdle}
                      disabled={isReevaluating}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-brand-50 hover:text-brand-600 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-200/80 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Analyze another clip</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* FULL UPLOAD CONTROLS: Visible in idle and error */}
            <div
              className={`transition-all duration-500 ease-in-out overflow-hidden motion-reduce:transition-none space-y-4 ${
                isCompact ? 'max-h-0 opacity-0 pointer-events-none' : 'max-h-[600px] opacity-100'
              }`}
            >
              <div>
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                  Record or Upload Your Practice
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Get AI-powered feedback on your speaking in{' '}
                  <span className="font-semibold text-brand-600">{selectedLanguage}</span>.
                </p>
              </div>

              {/* Action Buttons: Upload Video / Upload Audio */}
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => {
                    setMediaType('video');
                    setUploadedFile(null);
                    setRecordedBlob(null);
                  }}
                  className={`flex-1 py-2 px-3.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                    mediaType === 'video'
                      ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Video className="w-3.5 h-3.5" />
                  <span>Upload Video</span>
                </button>

                <button
                  onClick={() => {
                    setMediaType('audio');
                    setUploadedFile(null);
                    setRecordedBlob(null);
                  }}
                  className={`flex-1 py-2 px-3.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                    mediaType === 'audio'
                      ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Mic className="w-3.5 h-3.5" />
                  <span>Upload Audio</span>
                </button>
              </div>

              {/* Dropzone Container (Wide & Compact) */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-brand-200/80 hover:border-brand-400 bg-brand-50/20 hover:bg-brand-50/40 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition-all min-h-[135px] text-center group"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={mediaType === 'video' ? 'video/*' : 'audio/*'}
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setUploadedFile(e.target.files[0]);
                      setRecordedBlob(null);
                    }
                  }}
                />

                {uploadedFile ? (
                  <div className="space-y-1">
                    <div className="w-9 h-9 rounded-xl bg-brand-100 text-brand-600 flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div className="text-xs font-bold text-slate-800">{uploadedFile.name}</div>
                    <div className="text-[10px] text-slate-500">
                      {(uploadedFile.size / (1024 * 1024)).toFixed(2)} MB &bull; Click to change file
                    </div>
                  </div>
                ) : recordedBlob ? (
                  <div className="space-y-1">
                    <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div className="text-xs font-bold text-slate-800">
                      Recorded Live Clip ({formatTimer(recordingSeconds)})
                    </div>
                    <div className="text-[10px] text-slate-500">Ready for AI speech analysis</div>
                  </div>
                ) : (
                  <>
                    <div className="w-9 h-9 rounded-xl bg-brand-100/70 text-brand-600 flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
                      <Upload className="w-4.5 h-4.5" />
                    </div>
                    <div className="text-xs font-bold text-slate-900">
                      Drag and drop a {mediaType} file here
                    </div>
                    <div className="text-[11px] text-slate-400">or click to browse</div>
                    <div className="text-[10px] text-slate-400 mt-1.5 font-medium">
                      Supports {mediaType === 'video' ? ALLOWED_VIDEO_FORMATS : ALLOWED_AUDIO_FORMATS} (Max {MAX_FILE_SIZE_MB}MB)
                    </div>
                  </>
                )}
              </div>

              {/* Optional Live Recording Toggle */}
              <div className="flex items-center justify-between">
                {!isRecording ? (
                  <button
                    type="button"
                    onClick={startLiveRecording}
                    className="text-xs text-brand-600 hover:text-brand-700 font-semibold flex items-center gap-1.5"
                  >
                    <Mic className="w-3.5 h-3.5" />
                    <span>Or Record Live with Microphone/Camera</span>
                  </button>
                ) : (
                  <div className="flex items-center justify-between w-full p-2 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs">
                    <div className="flex items-center gap-2 font-mono font-bold text-xs">
                      <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />
                      Recording: {formatTimer(recordingSeconds)}
                    </div>
                    <button
                      onClick={stopLiveRecording}
                      className="px-2.5 py-1 bg-rose-600 text-white rounded-lg font-semibold text-xs flex items-center gap-1"
                    >
                      <Square className="w-3 h-3 fill-white" />
                      Stop
                    </button>
                  </div>
                )}

                {(uploadedFile || recordedBlob) && (
                  <button
                    type="button"
                    onClick={() => {
                      setUploadedFile(null);
                      setRecordedBlob(null);
                    }}
                    className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Clear
                  </button>
                )}
              </div>

              {permissionError && (
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>{permissionError}</span>
                </div>
              )}

              {submitError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                  {submitError}
                </div>
              )}

              {/* Submit Action Buttons */}
              <div className="pt-0.5 flex flex-col sm:flex-row items-center gap-2.5">
                <button
                  onClick={() => handleSubmitSession(false)}
                  disabled={(!uploadedFile && !recordedBlob) || isSubmitting}
                  className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl shadow-md shadow-brand-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Analyze Practice Session</span>
                </button>

                <button
                  onClick={() => handleSubmitSession(true)}
                  disabled={isSubmitting}
                  className="w-full sm:w-auto text-xs font-semibold text-brand-600 hover:text-brand-700 bg-brand-50 hover:bg-brand-100 px-3.5 py-2.5 rounded-xl transition-colors shrink-0 disabled:opacity-50"
                >
                  ⚡ Sample Demo Report
                </button>
              </div>

            </div>

          </div>

          {/* Improvements Card */}
          <div
            className={`bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col transition-all duration-500 ease-in-out ${
              isCompact ? 'flex-1 min-h-0' : 'flex-initial'
            } max-h-[520px] lg:max-h-none`}
          >
            {/* Fixed Header */}
            <div className="p-4 pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-600">
                  <BarChart2 className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Improvements</h2>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                    {isReevaluating
                      ? 'Evaluating… regenerating suggestions at the selected temperature.'
                      : phase === 'done' && submittedTemperature !== null
                      ? getTemperatureModeText(submittedTemperature)
                      : phase === 'analyzing'
                      ? 'Analyzing speech improvements...'
                      : 'Your personalized improvement areas will appear after analysis.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Scrollable Body (Internal scroll only) */}
            <div className="flex-1 min-h-0 overflow-y-auto thin-scrollbar p-4 space-y-3 pb-6">
              
              {/* SKELETON STATE: analyzing */}
              {phase === 'analyzing' && (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-brand-50/60 border border-brand-100 flex items-center gap-2.5">
                    <div className="w-3.5 h-3.5 border-2 border-brand-600/30 border-t-brand-600 rounded-full animate-spin shrink-0" />
                    <span className="text-xs text-brand-900 font-medium">{pollingStep}</span>
                  </div>

                  {/* Section 1 Skeleton */}
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60 space-y-2 animate-pulse">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-slate-200 rounded" />
                      <div className="w-28 h-3.5 bg-slate-200 rounded" />
                    </div>
                    <div className="space-y-1.5 pt-1">
                      <div className="w-3/4 h-3 bg-slate-200 rounded" />
                      <div className="w-1/2 h-2.5 bg-slate-100 rounded" />
                    </div>
                  </div>

                  {/* Section 2 Skeleton */}
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60 space-y-2 animate-pulse">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-slate-200 rounded" />
                      <div className="w-32 h-3.5 bg-slate-200 rounded" />
                    </div>
                    <div className="space-y-1.5 pt-1">
                      <div className="w-2/3 h-3 bg-slate-200 rounded" />
                      <div className="w-5/6 h-2.5 bg-slate-100 rounded" />
                    </div>
                  </div>

                  {/* Section 3 Skeleton */}
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60 space-y-2 animate-pulse">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-slate-200 rounded" />
                      <div className="w-28 h-3.5 bg-slate-200 rounded" />
                    </div>
                    <div className="space-y-1.5 pt-1">
                      <div className="w-4/5 h-3 bg-slate-200 rounded" />
                      <div className="w-2/3 h-2.5 bg-slate-100 rounded" />
                    </div>
                  </div>

                  {/* Section 4 Skeleton */}
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60 space-y-2 animate-pulse">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-slate-200 rounded" />
                      <div className="w-32 h-3.5 bg-slate-200 rounded" />
                    </div>
                    <div className="space-y-1.5 pt-1">
                      <div className="w-3/4 h-3 bg-slate-200 rounded" />
                      <div className="w-1/2 h-2.5 bg-slate-100 rounded" />
                    </div>
                  </div>

                  {/* Section 5 Skeleton */}
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60 space-y-2 animate-pulse">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-slate-200 rounded" />
                      <div className="w-36 h-3.5 bg-slate-200 rounded" />
                    </div>
                    <div className="w-24 h-6 bg-slate-200 rounded-full mt-1" />
                  </div>
                </div>
              )}

              {/* DONE STATE: 5 sections in exact order with stagger */}
              {phase === 'done' && improvements && (
                <div className="space-y-3">
                  {latestSession?.report?.transcript && (
                    <section className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2">
                      <h3 className="text-xs font-bold text-slate-900">Original Transcript</h3>
                      <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-700">{latestSession.report.transcript}</p>
                      <h3 className="pt-2 border-t border-slate-200 text-xs font-bold text-slate-900">Improved Version</h3>
                      {latestSession.report.improved_transcript ? (
                        <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-700">{latestSession.report.improved_transcript}</p>
                      ) : (
                        <p className="text-xs text-slate-500">A complete improved transcript is not available for this older report.</p>
                      )}
                    </section>
                  )}
                  {reportSaveError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{reportSaveError}</p>}
                  {(() => {
                    let staggerIdx = 0;
                    return (
                      <>
                        {/* 1. Choice of Words */}
                        {improvements.word_choices && improvements.word_choices.length > 0 && (
                          <div
                            className="animate-fadeInUp bg-white rounded-xl p-3.5 border border-slate-200/80 shadow-2xs space-y-2.5 motion-reduce:animate-none"
                            style={{ animationDelay: `${staggerIdx++ * 80}ms` }}
                          >
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-brand-600" />
                              <h3 className="text-xs font-bold text-slate-900">Choice of Words</h3>
                            </div>
                            <div className="space-y-2">
                              {improvements.word_choices.map((item: any, idx: number) => (
                                <div key={idx} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                                  <div className="flex items-center gap-2 flex-wrap text-xs">
                                    <span className="line-through text-slate-400 font-medium">"{item.original}"</span>
                                    <span className="text-slate-400 text-xs">→</span>
                                    <span className="font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded-md border border-brand-200/60">
                                      "{item.better}"
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-500 leading-relaxed">{item.reason}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 2. Better Vocabulary */}
                        {vocabularyReportItems.length > 0 && (
                          <div
                            className="animate-fadeInUp bg-white rounded-xl p-3.5 border border-slate-200/80 shadow-2xs space-y-2.5 motion-reduce:animate-none"
                            style={{ animationDelay: `${staggerIdx++ * 80}ms` }}
                          >
                            <div className="flex items-center gap-2">
                              <BookOpen className="w-4 h-4 text-brand-600" />
                              <h3 className="text-xs font-bold text-slate-900">Better Vocabulary</h3>
                            </div>
                            <div className="space-y-2">
                              {vocabularyReportItems.map((item: any, idx: number) => (
                                <div key={idx} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                                  <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <span className="text-xs font-bold text-brand-900">{item.word}</span>
                                    {item.replaces && (
                                      <span className="text-[10px] text-slate-500 bg-slate-200/70 px-2 py-0.5 rounded-full">
                                        replaces: <span className="font-semibold text-slate-700">{item.replaces}</span>
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-slate-600 leading-snug">{item.meaning}</p>
                                  <p className="text-[11px] text-slate-500 italic">"{item.example}"</p>
                                  <button onClick={() => saveReportWord(item)} disabled={savingReportItems.has(reportItemKey('word', item.word)) || savedReportItems.has(reportItemKey('word', item.word))} className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-800 disabled:opacity-70">
                                    {savedReportItems.has(reportItemKey('word', item.word)) ? <Check className="h-3 w-3" /> : <Bookmark className="h-3 w-3" />}
                                    {savedReportItems.has(reportItemKey('word', item.word)) ? 'Saved to Diary' : savingReportItems.has(reportItemKey('word', item.word)) ? 'Saving…' : 'Save to Diary'}
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 3. Idioms & Phrases */}
                        {phraseReportItems.length > 0 && (
                          <div
                            className="animate-fadeInUp bg-white rounded-xl p-3.5 border border-slate-200/80 shadow-2xs space-y-2.5 motion-reduce:animate-none"
                            style={{ animationDelay: `${staggerIdx++ * 80}ms` }}
                          >
                            <div className="flex items-center gap-2">
                              <Quote className="w-4 h-4 text-amber-600" />
                              <h3 className="text-xs font-bold text-slate-900">Idioms & Phrases</h3>
                            </div>
                            <div className="space-y-2">
                              {phraseReportItems.map((item: any, idx: number) => (
                                <div key={idx} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                                  {item.original_sentence && <div className="text-xs text-slate-600 flex items-start gap-1.5">
                                    <span className="text-[10px] uppercase font-bold text-slate-400 shrink-0 mt-0.5">Original:</span>
                                    <span className="text-slate-500 line-through">"{item.original_sentence}"</span>
                                  </div>}
                                  <div className="text-xs text-slate-800 flex items-start gap-1.5">
                                    <span className="text-[10px] uppercase font-bold text-brand-600 shrink-0 mt-0.5">{item.original_sentence ? 'Upgraded:' : 'Example:'}</span>
                                    <span className="font-medium text-slate-900">
                                      {item.original_sentence ? renderWithHighlightedPhrase(item.upgraded, item.idiom_or_phrase) : item.example}
                                    </span>
                                  </div>
                                  <div className="pt-1 border-t border-slate-200/60 flex items-baseline gap-1.5 text-[11px]">
                                    <span className="font-semibold text-brand-700 bg-brand-50 px-1.5 py-0.5 rounded border border-brand-100">
                                      {item.idiom_or_phrase}
                                    </span>
                                    <span className="text-slate-500">{item.meaning}</span>
                                  </div>
                                  <button onClick={() => saveReportPhrase(item.idiom_or_phrase, item.meaning)} disabled={savingReportItems.has(reportItemKey('phrase', item.idiom_or_phrase)) || savedReportItems.has(reportItemKey('phrase', item.idiom_or_phrase))} className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-800 disabled:opacity-70">
                                    {savedReportItems.has(reportItemKey('phrase', item.idiom_or_phrase)) ? <Check className="h-3 w-3" /> : <Bookmark className="h-3 w-3" />}
                                    {savedReportItems.has(reportItemKey('phrase', item.idiom_or_phrase)) ? 'Saved to Phrases' : savingReportItems.has(reportItemKey('phrase', item.idiom_or_phrase)) ? 'Saving…' : 'Save to Phrases'}
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 4. Sentence Structure */}
                        {improvements.sentence_structure && improvements.sentence_structure.length > 0 && (
                          <div
                            className="animate-fadeInUp bg-white rounded-xl p-3.5 border border-slate-200/80 shadow-2xs space-y-2.5 motion-reduce:animate-none"
                            style={{ animationDelay: `${staggerIdx++ * 80}ms` }}
                          >
                            <div className="flex items-center gap-2">
                              <Layers className="w-4 h-4 text-emerald-600" />
                              <h3 className="text-xs font-bold text-slate-900">Sentence Structure</h3>
                            </div>
                            <div className="space-y-2">
                              {improvements.sentence_structure.map((item: any, idx: number) => (
                                <div key={idx} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                                  <div className="text-xs text-slate-500">
                                    <span className="text-[10px] uppercase font-bold text-slate-400 mr-1.5">Original:</span>
                                    <span className="italic">"{item.original}"</span>
                                  </div>
                                  <div className="text-xs text-slate-800">
                                    <span className="text-[10px] uppercase font-bold text-emerald-600 mr-1.5">Improved:</span>
                                    <span className="font-semibold text-slate-900">"{item.improved}"</span>
                                  </div>
                                  <p className="text-[11px] text-slate-500 pt-0.5">{item.explanation}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 5. Tone of Your Delivery */}
                        {improvements.tone && (
                          <div
                            className="animate-fadeInUp bg-white rounded-xl p-3.5 border border-slate-200/80 shadow-2xs space-y-2.5 motion-reduce:animate-none"
                            style={{ animationDelay: `${staggerIdx++ * 80}ms` }}
                          >
                            <div className="flex items-center gap-2">
                              <Sparkles className="w-4 h-4 text-brand-600" />
                              <h3 className="text-xs font-bold text-slate-900">Tone of Your Delivery</h3>
                            </div>
                            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border capitalize ${
                                    TONE_CONFIG[improvements.tone.label]?.bg || 'bg-slate-100'
                                  } ${TONE_CONFIG[improvements.tone.label]?.text || 'text-slate-700'} ${
                                    TONE_CONFIG[improvements.tone.label]?.border || 'border-slate-200'
                                  }`}
                                >
                                  <span>{TONE_CONFIG[improvements.tone.label]?.emoji || '🎙️'}</span>
                                  <span>{improvements.tone.label}</span>
                                </span>
                              </div>
                              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                                {improvements.tone.reason}
                              </p>
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}

              {/* EMPTY STATE: idle or error */}
              {(phase === 'idle' || phase === 'error' || (!improvements && phase !== 'analyzing')) && (
                <div className="py-6 border border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-center p-4 space-y-2">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center">
                    <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="20" x2="18" y2="10" />
                      <line x1="12" y1="20" x2="12" y2="4" />
                      <line x1="6" y1="20" x2="6" y2="14" />
                    </svg>
                  </div>
                  <p className="text-xs text-slate-500 max-w-xs leading-relaxed font-medium">
                    Your personalized improvement areas will appear after analysis.
                  </p>
                </div>
              )}

            </div>

          </div>

        </div>

        {/* ================================================== */}
        {/* RIGHT COLUMN: CALENDAR, DIARY, PHRASES             */}
        {/* ================================================== */}
        <div className="space-y-3.5 min-w-0 min-h-0 lg:h-full lg:overflow-y-auto lg:overflow-x-hidden thin-scrollbar">
          
          {/* Calendar Card */}
          <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex min-w-0 items-center justify-between gap-1.5">
              <div className="flex min-w-0 items-center gap-1.5">
                <CalendarIcon className="w-3.5 h-3.5 text-brand-600" />
                <h3 className="text-xs font-bold text-slate-900">Calendar</h3>
              </div>
              <span className="min-w-0 shrink text-right text-[10px] font-semibold leading-tight text-slate-500">{activeDaysCount} active days</span>
            </div>

            {/* Month Header */}
            <div className="flex items-center justify-between text-xs font-bold text-slate-800">
              <button className="p-0.5 rounded text-slate-400 hover:text-slate-600">
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span>October 2026</span>
              <button className="p-0.5 rounded text-slate-400 hover:text-slate-600">
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-[repeat(7,minmax(0,1fr))] gap-0.5 text-center text-[10px]">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div key={d} className="text-slate-400 font-semibold py-0.5">{d}</div>
              ))}
              
              <div /><div /><div /><div />

              {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
                const isActiveDay = [3, 6, 9, 14, 20].includes(day);
                const isInactiveDay = [10, 16, 28].includes(day);

                return (
                  <div key={day} className="min-w-0 py-0.5 flex items-center justify-center">
                    {isActiveDay ? (
                      <span className="size-6 mx-auto rounded-full bg-emerald-400 text-white font-bold text-[10px] flex items-center justify-center shadow-2xs">
                        {day}
                      </span>
                    ) : isInactiveDay ? (
                      <span className="size-6 mx-auto rounded-full bg-amber-400 text-white font-bold text-[10px] flex items-center justify-center shadow-2xs">
                        {day}
                      </span>
                    ) : (
                      <span className="text-slate-700 font-medium">{day}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* My Diary Card */}
          <div
            onClick={() => setIsDiaryOpen(true)}
            className="bg-white hover:bg-slate-50 border border-slate-200/80 rounded-2xl p-3 shadow-xs flex items-center justify-between cursor-pointer group transition-all"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-brand-100 text-brand-600 flex items-center justify-center shrink-0">
                <BookMarked className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 group-hover:text-brand-600 transition-colors">
                  My Diary
                </h4>
                <p className="text-[10px] text-slate-500 leading-tight">
                  View and manage your saved words, idioms and phrases.
                </p>
              </div>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-brand-600 group-hover:translate-x-0.5 transition-all shrink-0" />
          </div>

          {/* Phrases / Quote Card */}
          <div
            onClick={() => setIsPhrasesOpen(true)}
            className="bg-amber-50/40 hover:bg-amber-50/80 border border-amber-200/80 rounded-2xl p-3 shadow-xs flex items-center justify-between cursor-pointer group transition-all"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                <Quote className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 group-hover:text-amber-700 transition-colors">
                  Phrases / Quote
                </h4>
                <p className="text-[10px] text-slate-500 leading-tight">
                  View and manage your saved phrases and quotes.
                </p>
              </div>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-amber-500 group-hover:translate-x-0.5 transition-all shrink-0" />
          </div>

        </div>

      </div>

      {/* DRAWERS FOR DIARY & PHRASES */}
      <MyDiaryDrawer isOpen={isDiaryOpen} onClose={() => setIsDiaryOpen(false)} />
      <PhrasesDrawer isOpen={isPhrasesOpen} onClose={() => setIsPhrasesOpen(false)} />

    </div>
  );
};
