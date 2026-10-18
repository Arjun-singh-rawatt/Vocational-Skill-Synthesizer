import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Clock } from 'lucide-react';

export const ReportPage: React.FC = () => {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200/80 shadow-xs p-8 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mx-auto">
          <Clock className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">
          Session history and detailed reports are coming soon.
        </h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          Your feedback and improvement suggestions are now analyzed and displayed directly on your Home Workspace.
        </p>
        <div className="pt-2">
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Home Workspace</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
