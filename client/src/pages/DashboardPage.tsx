import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  Flame,
  BookMarked,
  Mic,
  Calendar,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Award,
  Layers,
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const [progressData, setProgressData] = useState<any>(null);
  const [recentSessions, setRecentSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Toggle chart view between "Fluency Index" and "Detailed Gemini Scores"
  const [chartMode, setChartMode] = useState<'fluency' | 'scores'>('fluency');

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [progRes, sessRes] = await Promise.all([
        api.progress.get(),
        api.sessions.list(),
      ]);
      setProgressData(progRes);
      setRecentSessions(sessRes);
    } catch (err: any) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mb-4" />
        <p className="text-slate-400 text-sm">Loading your fluency metrics...</p>
      </div>
    );
  }

  const chartData = (progressData?.history || []).map((item: any, idx: number) => ({
    sessionLabel: `S${idx + 1}`,
    date: new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    fluencyIndex: item.fluencyIndex || 0,
    vocabulary: item.scores?.vocabulary || 0,
    grammar: item.scores?.grammar || 0,
    delivery: item.scores?.delivery || 0,
    clarity: item.scores?.clarity || 0,
  }));

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      
      {/* Welcome Banner */}
      <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-teal-400 uppercase tracking-wider mb-1">
            <Sparkles className="w-4 h-4" />
            <span>AI Spoken-Language Coach</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white">Your Fluency Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">
            Track your deterministic Fluency Index, saved vocabulary, and speaking streak over time.
          </p>
        </div>

        <Link
          to="/new-session"
          className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-teal-400 hover:opacity-95 text-white font-bold shadow-xl shadow-indigo-500/25 flex items-center gap-2 transition-all hover:scale-105 shrink-0"
        >
          <Mic className="w-5 h-5" />
          <span>New Practice Session</span>
        </Link>
      </div>

      {/* Top Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Streak Card */}
        <div className="glass-card p-5 rounded-2xl border border-amber-500/20 bg-amber-950/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Practice Streak</span>
            <Flame className="w-6 h-6 fill-amber-500 text-amber-500 animate-pulse" />
          </div>
          <div className="text-3xl font-black text-amber-400">
            {progressData?.currentStreak || 0} <span className="text-sm font-normal text-amber-500/80">days</span>
          </div>
          <p className="text-xs text-slate-400 mt-2">Personal longest: {progressData?.longestStreak || 0} days</p>
        </div>

        {/* Learned Words Card */}
        <div className="glass-card p-5 rounded-2xl border border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Learned Words</span>
            <BookMarked className="w-6 h-6 text-teal-400" />
          </div>
          <div className="text-3xl font-black text-teal-300">
            {progressData?.learnedCount || 0}
          </div>
          <p className="text-xs text-slate-400 mt-2">Saved in vocabulary: {progressData?.savedCount || 0} words</p>
        </div>

        {/* Total Sessions Card */}
        <div className="glass-card p-5 rounded-2xl border border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Completed Sessions</span>
            <Mic className="w-6 h-6 text-indigo-400" />
          </div>
          <div className="text-3xl font-black text-indigo-300">
            {progressData?.totalSessions || 0}
          </div>
          <p className="text-xs text-slate-400 mt-2">Total analyzed recordings</p>
        </div>

        {/* Average Fluency Index Card */}
        <div className="glass-card p-5 rounded-2xl border border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Latest Fluency</span>
            <TrendingUp className="w-6 h-6 text-emerald-400" />
          </div>
          <div className="text-3xl font-black text-emerald-300">
            {chartData.length > 0 ? chartData[chartData.length - 1].fluencyIndex : 0} <span className="text-sm font-normal text-emerald-400/80">/ 100</span>
          </div>
          <p className="text-xs text-slate-400 mt-2">Based on latest analysis</p>
        </div>
      </div>

      {/* Progress Line Chart */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-400" />
              Fluency & Skill Assessment Chart
            </h3>
            <p className="text-xs text-slate-400">Progress trajectory across completed practice sessions</p>
          </div>

          <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setChartMode('fluency')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                chartMode === 'fluency' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              Fluency Index
            </button>
            <button
              onClick={() => setChartMode('scores')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                chartMode === 'scores' ? 'bg-teal-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              Gemini Skill Scores
            </button>
          </div>
        </div>

        {chartData.length === 0 ? (
          <div className="p-12 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl">
            No completed sessions yet. Start a new session to begin tracking your progress chart!
          </div>
        ) : (
          <div className="w-full h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} stroke="#94a3b8" tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#f8fafc' }}
                />
                <Legend />
                {chartMode === 'fluency' ? (
                  <Line
                    type="monotone"
                    dataKey="fluencyIndex"
                    name="Fluency Index"
                    stroke="#6366f1"
                    strokeWidth={3}
                    dot={{ fill: '#818cf8', r: 5 }}
                    activeDot={{ r: 8 }}
                  />
                ) : (
                  <>
                    <Line type="monotone" dataKey="vocabulary" name="Vocabulary" stroke="#6366f1" strokeWidth={2} />
                    <Line type="monotone" dataKey="grammar" name="Grammar" stroke="#14b8a6" strokeWidth={2} />
                    <Line type="monotone" dataKey="delivery" name="Delivery" stroke="#f59e0b" strokeWidth={2} />
                    <Line type="monotone" dataKey="clarity" name="Clarity" stroke="#10b981" strokeWidth={2} />
                  </>
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Recent Sessions List */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-teal-400" />
            Recent Practice Sessions
          </h3>
          <Link to="/new-session" className="text-xs text-indigo-400 hover:text-indigo-300 font-medium">
            + New Practice
          </Link>
        </div>

        {recentSessions.length === 0 ? (
          <div className="p-8 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl">
            You haven't recorded any sessions yet. Click "New Practice Session" to get started!
          </div>
        ) : (
          <div className="space-y-3">
            {recentSessions.slice(0, 5).map((sess: any) => (
              <Link
                key={sess._id}
                to={`/sessions/${sess._id}`}
                className="block p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-indigo-500/50 transition-all group"
              >
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors">
                        {sess.language} — {sess.goal.toUpperCase()}
                      </span>
                      <span
                        className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                          sess.status === 'done'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : sess.status === 'processing'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse'
                            : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {sess.status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      {new Date(sess.createdAt).toLocaleDateString()} at {new Date(sess.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} &bull; {sess.durationSec}s
                    </div>
                  </div>

                  {sess.status === 'done' && (
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-xs text-slate-400 font-semibold">Fluency Index</div>
                        <div className="text-lg font-extrabold text-teal-300">{sess.fluency?.index || 0}</div>
                      </div>
                      <ArrowRight className="w-5 h-5 text-slate-500 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};
