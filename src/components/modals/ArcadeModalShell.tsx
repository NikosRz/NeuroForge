'use client';

import React, { useId } from 'react';
import { X } from 'lucide-react';
import { arcadeAudio } from '@/lib/arcadeAudio';

interface ArcadeModalShellProps {
  title: string;
  subtitle?: string;
  accentColor?: 'cyan' | 'yellow' | 'emerald' | 'rose';
  maxWidthClass?: string;
  onClose: () => void;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

const ACCENT_BORDER: Record<NonNullable<ArcadeModalShellProps['accentColor']>, string> = {
  cyan: 'border-cyan-400',
  yellow: 'border-yellow-400',
  emerald: 'border-emerald-400',
  rose: 'border-rose-400',
};

const ACCENT_TEXT: Record<NonNullable<ArcadeModalShellProps['accentColor']>, string> = {
  cyan: 'text-cyan-300',
  yellow: 'text-yellow-300',
  emerald: 'text-emerald-300',
  rose: 'text-rose-300',
};

export const ArcadeModalShell: React.FC<ArcadeModalShellProps> = ({
  title,
  subtitle,
  accentColor = 'cyan',
  maxWidthClass = 'max-w-2xl',
  onClose,
  footer,
  children,
}) => {
  const titleId = useId();

  const handleClose = (): void => {
    arcadeAudio.playUiClick();
    onClose();
  };

  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center bg-[#05070E]/80 backdrop-blur-[2px] p-3 sm:p-6"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        className={`relative w-full ${maxWidthClass} max-h-[88vh] flex flex-col bg-[#0F172A] border-2 ${ACCENT_BORDER[accentColor]} shadow-[0_0_0_2px_#020617,0_10px_0_#020617] text-slate-100 overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 bg-[#1E293B] border-b-2 border-slate-700 shrink-0">
          <div className="min-w-0">
            <h2
              id={titleId}
              className={`font-pixel text-sm sm:text-base tracking-wide truncate ${ACCENT_TEXT[accentColor]}`}
            >
              {title}
            </h2>
            {subtitle && (
              <p className="font-mono-code text-xs text-slate-400 truncate mt-0.5">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close modal"
            className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 border-2 border-slate-600 hover:border-slate-400 font-pixel text-[11px] text-slate-200 cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
            <span>ESC</span>
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">{children}</div>

        {/* Optional Fixed Footer */}
        {footer && (
          <div className="px-4 py-3 bg-[#1E293B] border-t-2 border-slate-700 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
