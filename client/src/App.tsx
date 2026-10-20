import React, { useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { AuthPage } from './pages/AuthPage';
import { DashboardPage } from './pages/DashboardPage';
import { NewSessionPage } from './pages/NewSessionPage';
import { ReportPage } from './pages/ReportPage';
import { MyWordsPage } from './pages/MyWordsPage';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f4f6fa] text-slate-500">
        <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const MainContent: React.FC = () => {
  const location = useLocation();
  const isHome = location.pathname === '/';
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!isHome) return;
    window.history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
    mainRef.current?.scrollTo(0, 0);
  }, [isHome]);

  return (
    <div className={`${isHome ? 'h-dvh w-full overflow-hidden overflow-x-hidden' : 'min-h-screen'} flex flex-col bg-[#f4f6fa] text-slate-800 font-sans selection:bg-brand-500 selection:text-white`}>
      <Navbar />
      <main ref={mainRef} className={`flex-1 min-w-0 ${isHome ? 'min-h-0 overflow-y-auto overflow-x-hidden lg:overflow-hidden' : ''}`}>
        <Routes>
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/register" element={<AuthPage mode="register" />} />
          
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/new-session"
            element={
              <ProtectedRoute>
                <NewSessionPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/sessions/:id"
            element={
              <ProtectedRoute>
                <ReportPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-words"
            element={
              <ProtectedRoute>
                <MyWordsPage />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {!isHome && <Footer />}
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <MainContent />
      </BrowserRouter>
    </AuthProvider>
  );
}
