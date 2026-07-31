import React, { useState } from 'react';
import { Eye, EyeOff, Copy, Check } from 'lucide-react';

interface SecurePasswordDisplayProps {
  itemId: string;
  maskedPlaceholder: string;     // E.g. '••••••••' or '••••••••••••'
  revealedPassword?: string;      // The actual decrypted password from state cache
  isVisible: boolean;            // State showing if it's currently revealed
  onToggleVisibility: () => void; // Callback when eye icon is clicked
  onRevealRequest?: () => void;   // Callback when action is requested but password not yet revealed
  theme?: 'light' | 'dark';      // UI theme
  onCopySuccess?: () => void;     // Optional callback after copying
}

export const SecurePasswordDisplay: React.FC<SecurePasswordDisplayProps> = ({
  itemId,
  maskedPlaceholder,
  revealedPassword,
  isVisible,
  onToggleVisibility,
  onRevealRequest,
  theme = 'light',
  onCopySuccess,
}) => {
  const [copied, setCopied] = useState(false);

  const displayPassword = isVisible && revealedPassword ? revealedPassword : (maskedPlaceholder || '••••••••');

  const handleToggleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (revealedPassword === undefined && onRevealRequest) {
      onRevealRequest();
    } else {
      onToggleVisibility();
    }
  };

  const handleCopyClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (revealedPassword === undefined && onRevealRequest) {
      onRevealRequest();
      return;
    }

    const textToCopy = revealedPassword || maskedPlaceholder;
    if (!textToCopy) return;

    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    if (onCopySuccess) onCopySuccess();
    setTimeout(() => setCopied(false), 2000);
  };

  const isDark = theme === 'dark';

  return (
    <div className="flex items-center justify-between w-full">
      <span className={`font-mono break-all pr-4 ${
        isDark ? 'text-white text-[13px]' : 'text-slate-900 text-sm font-semibold'
      }`}>
        {displayPassword}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleToggleClick}
          className={`p-2 rounded-xl transition-all shadow-sm ${
            isDark 
              ? 'text-white/20 hover:text-white hover:bg-white/5' 
              : 'text-slate-400 hover:text-indigo-600 hover:bg-slate-100 bg-slate-50'
          }`}
          title={isVisible && revealedPassword ? "Hide Password" : "Show Password"}
        >
          {isVisible && revealedPassword ? (
            <EyeOff className={isDark ? 'w-4 h-4' : 'w-4 h-4'} />
          ) : (
            <Eye className={isDark ? 'w-4 h-4' : 'w-4 h-4'} />
          )}
        </button>
        <button
          type="button"
          onClick={handleCopyClick}
          className={`p-2 rounded-xl transition-all shadow-sm ${
            isDark 
              ? 'text-white/20 hover:text-white hover:bg-white/5' 
              : 'text-slate-400 hover:text-blue-600 hover:bg-slate-100 bg-slate-50'
          }`}
          title="Copy Password"
        >
          {copied ? (
            <Check className="text-emerald-500 w-4 h-4" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
};
