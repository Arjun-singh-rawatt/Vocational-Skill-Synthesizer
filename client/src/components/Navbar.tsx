import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Flame, ChevronDown, LogOut, User as UserIcon, Check } from 'lucide-react';

const LANGUAGES = [
  { code: 'English', label: 'English', flag: '🇬🇧' },
  { code: 'Spanish', label: 'Spanish', flag: '🇪🇸' },
  { code: 'French', label: 'French', flag: '🇫🇷' },
  { code: 'German', label: 'German', flag: '🇩🇪' },
  { code: 'Mandarin Chinese', label: 'Mandarin Chinese', flag: '🇨🇳' },
  { code: 'Japanese', label: 'Japanese', flag: '🇯🇵' },
  { code: 'Italian', label: 'Italian', flag: '🇮🇹' },
  { code: 'Portuguese', label: 'Portuguese', flag: '🇵🇹' },
  { code: 'Hindi', label: 'Hindi', flag: '🇮🇳' },
];

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [selectedLang, setSelectedLang] = useState(() => {
    return localStorage.getItem('fluentlens_selected_lang') || 'English';
  });
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const langRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(event.target as Node)) {
        setLangDropdownOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectLanguage = (lang: string) => {
    setSelectedLang(lang);
    localStorage.setItem('fluentlens_selected_lang', lang);
    setLangDropdownOpen(false);
    // Dispatch a custom event so Dashboard/Practice area re-renders if needed
    window.dispatchEvent(new CustomEvent('fluentlens_lang_change', { detail: lang }));
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const currentLangObj = LANGUAGES.find((l) => l.code === selectedLang) || LANGUAGES[0];
  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : 'A';

  return (
    <header className="sticky top-0 z-50 shrink-0 bg-white border-b border-slate-200/80 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* LEFT: Logo & Language Selector */}
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-2xl bg-brand-600 flex items-center justify-center shadow-md shadow-brand-600/20 group-hover:scale-105 transition-transform">
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                  <line x1="12" y1="19" x2="12" y2="22"/>
                </svg>
              </div>
              <span className="text-xl font-bold text-slate-900 tracking-tight">
                FluentLens
              </span>
            </Link>

            {/* Language Selector Dropdown */}
            {user && (
              <div className="relative ml-2" ref={langRef}>
                <button
                  onClick={() => setLangDropdownOpen(!langDropdownOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100/90 hover:bg-slate-200/80 border border-slate-200 text-slate-700 text-xs font-semibold transition-all"
                >
                  <span className="text-base leading-none">{currentLangObj.flag}</span>
                  <span>{currentLangObj.label}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                </button>

                {langDropdownOpen && (
                  <div className="absolute left-0 mt-2 w-48 bg-white border border-slate-200 rounded-2xl shadow-lg py-1 z-50">
                    <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Target Language
                    </div>
                    {LANGUAGES.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => handleSelectLanguage(lang.code)}
                        className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left transition-colors ${
                          selectedLang === lang.code
                            ? 'bg-brand-50 text-brand-700 font-bold'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span className="text-base leading-none">{lang.flag}</span>
                          <span>{lang.label}</span>
                        </span>
                        {selectedLang === lang.code && <Check className="w-3.5 h-3.5 text-brand-600" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* RIGHT: Streak Indicator & Profile Avatar */}
          {user ? (
            <div className="flex items-center gap-4">
              {/* Streak indicator */}
              <div className="flex items-center gap-1.5 text-slate-700 text-xs sm:text-sm font-semibold">
                <Flame className="w-4 h-4 fill-amber-500 text-amber-500" />
                <span>{user.currentStreak || 12} day streak</span>
              </div>

              {/* Profile Avatar */}
              <div className="relative" ref={profileRef}>
                <button
                  onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                  className="w-9 h-9 rounded-full bg-brand-600 text-white font-bold text-sm flex items-center justify-center hover:opacity-90 shadow-sm transition-all"
                  title={user.name}
                >
                  {userInitial}
                </button>

                {profileMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl py-2 z-50">
                    <div className="px-4 py-2 border-b border-slate-100">
                      <div className="text-sm font-bold text-slate-900">{user.name}</div>
                      <div className="text-xs text-slate-500 truncate">{user.email}</div>
                      {user.timezone && (
                        <div className="text-[11px] text-slate-400 mt-0.5">{user.timezone}</div>
                      )}
                    </div>
                    <div className="py-1">
                      <Link
                        to="/my-words"
                        onClick={() => setProfileMenuOpen(false)}
                        className="w-full flex items-center gap-2 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        <UserIcon className="w-4 h-4 text-slate-400" />
                        <span>Saved Vocabulary</span>
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 transition-colors font-medium"
                      >
                        <LogOut className="w-4 h-4 text-rose-500" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link
                to="/login"
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-brand-600 text-white hover:bg-brand-700 transition-all shadow-sm"
              >
                Get Started
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
