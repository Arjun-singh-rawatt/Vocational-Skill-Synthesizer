import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api';
import { MAX_FILE_SIZE_MB } from '../data/uploadLimits';
import {
  Video,
  Mic,
  Square,
  RefreshCw,
  UploadCloud,
  Sparkles,
  Shuffle,
  AlertCircle,
  CheckCircle2,
  Play,
  ArrowLeft,
} from 'lucide-react';

const COMMON_LANGUAGES = [
  'English',
  'Spanish',
  'French',
  'German',
  'Mandarin Chinese',
  'Japanese',
  'Italian',
  'Portuguese',
  'Hindi',
];

const SPEAKING_PROMPTS: Record<string, string[]> = {
  conversation: [
    'Describe your favorite travel memory and why it made a lasting impression on you.',
    'Share your opinion on how social media impacts modern relationships.',
    'Talk about a hobby or passion you could spend hours doing without getting bored.',
  ],
  interview: [
    'Introduce yourself for a job interview and highlight your key achievements and strengths.',
    'Describe a situation where you encountered a difficult problem at work and how you resolved it.',
    'Where do you see yourself professionally in the next 3 to 5 years?',
  ],
  ielts: [
    'Describe a traditional festival or celebration in your country. When does it happen and why is it important?',
    'Some people think online learning is more effective than traditional classroom learning. To what extent do you agree?',
    'Describe an influential mentor or teacher who inspired you.',
  ],
  presentation: [
    'Deliver a 2-minute pitch introducing an innovative tech product that solves a real-world problem.',
    'Present the main key findings and recommendations from your recent project quarterly review.',
    'Persuade your management team to adopt flexible hybrid remote work policies.',
  ],
};

export const NewSessionPage: React.FC = () => {
  const navigate = useNavigate();

  const [language, setLanguage] = useState(() => localStorage.getItem('fluentlens_selected_lang') || 'English');
  const [goal, setGoal] = useState<'conversation' | 'interview' | 'ielts' | 'presentation'>('interview');
  const [promptIndex, setPromptIndex] = useState(0);

  const [mediaType, setMediaType] = useState<'video' | 'audio'>('video');
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pollingStep, setPollingStep] = useState<string>('Uploading clip...');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<any>(null);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const currentPrompt = SPEAKING_PROMPTS[goal][promptIndex % SPEAKING_PROMPTS[goal].length];

  const handleShufflePrompt = () => {
    setPromptIndex((prev) => prev + 1);
  };

  useEffect(() => {
    return () => {
      stopMediaStream();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const stopMediaStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const startRecording = async () => {
    setPermissionError(null);
    setRecordedBlob(null);
    setPreviewUrl(null);
    chunksRef.current = [];
    setRecordingSeconds(0);

    try {
      const constraints: MediaStreamConstraints = {
        audio: true,
        video: mediaType === 'video' ? { width: 1280, height: 720 } : false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoPreviewRef.current && mediaType === 'video') {
        videoPreviewRef.current.srcObject = stream;
      }

      const mimeType = mediaType === 'video' ? 'video/webm;codecs=vp8,opus' : 'audio/webm;codecs=opus';
      const options = MediaRecorder.isTypeSupported(mimeType) ? { mimeType } : undefined;

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: mediaType === 'video' ? 'video/webm' : 'audio/webm',
        });
        setRecordedBlob(blob);
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        stopMediaStream();
      };

      mediaRecorder.start(1000);
      setIsRecording(true);

      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev >= 179) {
            stopRecording();
            return 180;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err: any) {
      setPermissionError(
        `Unable to access your ${mediaType === 'video' ? 'camera or microphone' : 'microphone'}. Please check browser permissions.`
      );
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setIsRecording(false);
  };

  const resetRecording = () => {
    stopRecording();
    stopMediaStream();
    setRecordedBlob(null);
    setPreviewUrl(null);
    setRecordingSeconds(0);
    setUploadedFile(null);
  };

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSubmitSession = async () => {
    setSubmitError(null);
    setIsSubmitting(true);
    setPollingStep('Uploading clip...');

    try {
      const formData = new FormData();
      formData.append('language', language);
      formData.append('goal', goal);

      if (recordedBlob) {
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
            navigate('/');
          } else if (session.status === 'failed') {
            clearInterval(pollInterval);
            setIsSubmitting(false);
            setSubmitError(session.errorMessage || 'Analysis failed. Please try again.');
          }
        } catch (err: any) {
          clearInterval(pollInterval);
          setIsSubmitting(false);
          setSubmitError(err.message || 'Failed to poll session status');
        }
      }, 3000);
    } catch (err: any) {
      setIsSubmitting(false);
      setSubmitError(err.message || 'Failed to initiate session analysis');
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      
      {/* Top Back Nav */}
      <div>
        <Link to="/" className="inline-flex items-center gap-2 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-xl transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Home Workspace</span>
        </Link>
      </div>

      {/* Page Header */}
      <div className="text-center mb-6">
        <h1 className="text-3xl font-extrabold text-slate-900">Start New Practice Session</h1>
        <p className="mt-1.5 text-slate-500 text-xs sm:text-sm max-w-xl mx-auto">
          Record a 1-3 minute clip speaking in ANY language. Get instant AI coaching on clarity, vocabulary, pause ratio & delivery.
        </p>
      </div>

      {/* Main Card */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-8">
        
        {/* Language & Goal Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Speaking Language
            </label>
            <input
              type="text"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              placeholder="e.g. English, Spanish, French..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 transition-all font-medium"
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {COMMON_LANGUAGES.map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setLanguage(lang)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    language === lang
                      ? 'bg-blue-50 border-blue-300 text-blue-700 font-semibold'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Learning Goal
            </label>
            <select
              value={goal}
              onChange={(e: any) => {
                setGoal(e.target.value);
                setPromptIndex(0);
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 transition-all cursor-pointer font-medium"
            >
              <option value="interview">Job Interview Practice</option>
              <option value="conversation">Casual Conversation</option>
              <option value="presentation">Presentation & Pitching</option>
              <option value="ielts">IELTS / TOEFL Speaking Exam</option>
            </select>
          </div>
        </div>

        {/* Prompt Card */}
        <div className="p-5 rounded-2xl bg-blue-50/70 border border-blue-200 relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-blue-700 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-4 h-4" />
              <span>Suggested Speaking Prompt</span>
            </div>
            <button
              onClick={handleShufflePrompt}
              className="flex items-center gap-1.5 text-xs text-blue-700 hover:text-blue-800 bg-white px-3 py-1 rounded-lg border border-blue-200 transition-all font-semibold shadow-2xs"
            >
              <Shuffle className="w-3.5 h-3.5" />
              <span>New Prompt</span>
            </button>
          </div>
          <p className="text-slate-800 text-sm font-medium italic">
            "{currentPrompt}"
          </p>
        </div>

        {/* Recording Mode & Box */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Recording Input Mode
            </label>
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                onClick={() => {
                  resetRecording();
                  setMediaType('video');
                }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  mediaType === 'video' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Video className="w-3.5 h-3.5" />
                Video + Audio
              </button>
              <button
                onClick={() => {
                  resetRecording();
                  setMediaType('audio');
                }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  mediaType === 'audio' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Mic className="w-3.5 h-3.5" />
                Audio Only
              </button>
            </div>
          </div>

          {permissionError && (
            <div className="mb-4 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>{permissionError}</div>
            </div>
          )}

          {/* Recorder Box */}
          <div className="relative bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden min-h-[260px] flex flex-col items-center justify-center p-6 text-center">
            
            {isRecording && mediaType === 'video' && (
              <video
                ref={videoPreviewRef}
                autoPlay
                muted
                playsInline
                className="absolute inset-0 w-full h-full object-cover transform -scale-x-100"
              />
            )}

            {!isRecording && previewUrl && (
              mediaType === 'video' ? (
                <video src={previewUrl} controls className="w-full max-h-[360px] rounded-xl object-contain bg-black" />
              ) : (
                <div className="w-full max-w-md p-6 rounded-2xl bg-white border border-slate-200 flex flex-col items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                    <Mic className="w-8 h-8" />
                  </div>
                  <audio src={previewUrl} controls className="w-full" />
                </div>
              )
            )}

            {isRecording && (
              <div className="z-10 flex flex-col items-center justify-center gap-4 bg-white/90 p-6 rounded-2xl backdrop-blur-sm border border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full bg-rose-600 animate-ping" />
                  <span className="text-3xl font-mono font-bold text-slate-900">
                    {formatTimer(recordingSeconds)}
                  </span>
                  <span className="text-xs text-slate-500">/ 03:00 max</span>
                </div>
                <button
                  onClick={stopRecording}
                  className="px-6 py-2.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs flex items-center gap-2 shadow-md"
                >
                  <Square className="w-4 h-4 fill-white" />
                  Stop Recording
                </button>
              </div>
            )}

            {!isRecording && !previewUrl && !uploadedFile && (
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center shadow-xs">
                  {mediaType === 'video' ? <Video className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Ready to record {mediaType === 'video' ? 'video' : 'audio'} clip
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">Speak clearly into your microphone (1-3 minutes recommended)</p>
                </div>
                <button
                  onClick={startRecording}
                  className="px-8 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/20 flex items-center gap-2 transition-all hover:scale-105"
                >
                  <Play className="w-4 h-4 fill-white" />
                  Start Recording
                </button>
              </div>
            )}

            {!isRecording && (previewUrl || uploadedFile) && (
              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={resetRecording}
                  className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold flex items-center gap-2 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Re-record Clip
                </button>
              </div>
            )}
          </div>
        </div>

        {/* File Upload Alternative */}
        {!isRecording && !previewUrl && (
          <div className="pt-4 border-t border-slate-100">
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 hover:border-blue-400 bg-slate-50 rounded-2xl p-6 cursor-pointer transition-all">
              <UploadCloud className="w-8 h-8 text-slate-400 mb-2" />
              <span className="text-xs font-bold text-slate-700">
                {uploadedFile ? uploadedFile.name : 'Click to upload MP4, WebM, MP3, WAV, or OGG'}
              </span>
              <span className="text-[11px] text-slate-400 mt-1">Max upload limit: {MAX_FILE_SIZE_MB}MB</span>
              <input
                type="file"
                accept="video/*,audio/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setUploadedFile(e.target.files[0]);
                  }
                }}
              />
            </label>
          </div>
        )}

        {submitError && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
            {submitError}
          </div>
        )}

        {/* Submit Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100">
          <button
            onClick={handleSubmitSession}
            disabled={(!recordedBlob && !uploadedFile) || isSubmitting}
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {isSubmitting ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>{pollingStep}</span>
              </div>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Submit for AI Analysis</span>
              </>
            )}
          </button>
        </div>

      </div>

      {/* Progress Modal overlay */}
      {isSubmitting && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full p-8 rounded-3xl border border-slate-200 text-center space-y-6 shadow-xl">
            <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin" />
              <Sparkles className="w-6 h-6 text-blue-600 animate-pulse" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-900">Analyzing Your Speech</h3>
              <p className="text-xs text-slate-500 mt-1">FluentLens AI is evaluating your delivery and feedback...</p>
            </div>

            <div className="space-y-3 text-left">
              <div className="flex items-center gap-3 text-xs text-emerald-700 font-medium">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>Uploaded media clip securely</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-blue-700 font-medium">
                <div className="w-4 h-4 rounded-full border-2 border-blue-600 border-t-transparent animate-spin shrink-0" />
                <span>{pollingStep}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
