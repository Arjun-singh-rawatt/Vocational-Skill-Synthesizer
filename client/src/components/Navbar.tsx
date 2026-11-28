import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { VaaniLogo } from './VaaniLogo';
import { Flame, ChevronDown, LogOut, User as UserIcon, Check } from 'lucide-react';

const LANGUAGES = [
  { code: 'English', label: 'English', flag: '🇬🇧' },
  { code: 'Japanese', label: 'Japanese', flag: '🇯🇵' },
];

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const selectedLang = 'English';
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [comingSoon, setComingSoon] = useState(false);

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

  useEffect(() => {
    if (!comingSoon) return;
    const timeout = setTimeout(() => setComingSoon(false), 2500);
    return () => clearTimeout(timeout);
  }, [comingSoon]);

  const handleSelectLanguage = (lang: string) => {
    setLangDropdownOpen(false);
    if (lang !== 'English') {
      setComingSoon(true);
      return;
    }
    setComingSoon(false);
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
            <Link to="/" className="group rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">
              <VaaniLogo size="sm" className="transition-transform group-hover:scale-[1.02]" />
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
                {comingSoon && (
                  <div role="status" className="absolute left-0 top-full mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 shadow-lg">
                    Coming soon
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
                <span>{user.currentStreak ?? 0} day streak</span>
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
