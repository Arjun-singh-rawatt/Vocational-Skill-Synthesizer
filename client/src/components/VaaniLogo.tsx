import React from 'react';

interface VaaniLogoProps {
  size?: 'sm' | 'md' | 'lg';
  iconOnly?: boolean;
  className?: string;
}

const sizeStyles = {
  sm: { icon: 'h-9 w-9 rounded-xl', mark: 'h-5 w-5', word: 'text-xl' },
  md: { icon: 'h-11 w-11 rounded-2xl', mark: 'h-6 w-6', word: 'text-2xl' },
  lg: { icon: 'h-14 w-14 rounded-2xl', mark: 'h-8 w-8', word: 'text-3xl' },
};

export const VaaniLogo: React.FC<VaaniLogoProps> = ({ size = 'sm', iconOnly = false, className = '' }) => {
  const styles = sizeStyles[size];

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`} aria-label="Vaani">
      <span className={`${styles.icon} flex shrink-0 items-center justify-center bg-gradient-to-br from-violet-600 via-violet-700 to-indigo-950 shadow-md shadow-violet-900/20`}>
        <svg className={styles.mark} viewBox="0 0 48 48" fill="none" aria-hidden="true">
          <path d="M24 4.5a6 6 0 0 0-6 6v13a6 6 0 0 0 12 0v-13a6 6 0 0 0-6-6Z" fill="white" />
          <path d="M11 20v3.5a13 13 0 0 0 26 0V20M24 36.5v6M17.5 43h13" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M7 20v7M13 16v15M35 16v15M41 20v7" stroke="white" strokeWidth="3" strokeLinecap="round" />
          <path d="m35.5 3 .9 2.5 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9.9-2.5Z" fill="white" />
        </svg>
      </span>
      {!iconOnly && (
        <span className={`${styles.word} font-extrabold tracking-tight text-[#11102f] [font-family:Inter,ui-rounded,system-ui,sans-serif]`}>
          Vaan<span className="relative inline-block">ı<span className="absolute left-1/2 top-[0.24em] h-[0.1875em] w-[0.1875em] -translate-x-1/2 rounded-full bg-violet-600" /></span>
        </span>
      )}
    </span>
  );
};
