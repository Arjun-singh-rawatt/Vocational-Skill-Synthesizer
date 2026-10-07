import React from 'react';
import { ShieldAlert } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-slate-200 bg-white py-4 px-4 text-center text-xs text-slate-500">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-slate-500">
          <ShieldAlert className="w-4 h-4 text-amber-500" />
          <span>AI feedback on clarity and delivery; not a certified language assessment.</span>
        </div>
        <div>
          <span>FluentLens &copy; {new Date().getFullYear()} — Built for Hackathon Practical AI Education</span>
        </div>
      </div>
    </footer>
  );
};
