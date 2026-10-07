import React, { useEffect } from 'react';
import { AlertTriangle, Clock, ArrowRight, X } from 'lucide-react';

export default function EscalationAlertBanner({ criticalComplaint, onDismiss, onViewDetail }) {
  if (!criticalComplaint) return null;

  const playChime = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
      osc.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);
    } catch (e) {
      // Audio chime muted or blocked
    }
  };

  useEffect(() => {
    playChime();
  }, [criticalComplaint?.id]);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-3 pb-1">
      <div className="rounded-2xl bg-gradient-to-r from-red-950/90 via-rose-900/90 to-red-950/90 text-white p-3 shadow-xl shadow-red-950/40 border border-red-600/70 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm animate-in fade-in slide-in-from-top-2">
        
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0 shadow-md critical-pulse">
            <AlertTriangle className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold uppercase tracking-wider bg-red-600 text-white text-[10px] px-2 py-0.5 rounded-full font-mono">
                CRITICAL EMERGENCY
              </span>
              <span className="font-mono font-bold text-red-200">
                #{criticalComplaint.id}
              </span>
            </div>
            <p className="text-xs text-slate-200 font-medium mt-0.5">
              Priority legal intervention triggered for <span className="text-white font-bold">{criticalComplaint.category || 'Emergency Case'}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 ml-auto">
          <div className="flex items-center gap-1.5 font-mono text-xs bg-black/40 text-amber-300 px-3 py-1.5 rounded-xl border border-amber-500/30">
            <Clock className="w-3.5 h-3.5" />
            <span>SLA: 4h Maximum Window</span>
          </div>

          <button
            onClick={() => onViewDetail(criticalComplaint.id)}
            className="flex items-center gap-1.5 bg-red-600 hover:bg-red-500 text-white font-bold px-3.5 py-1.5 rounded-xl text-xs transition-all shadow-md hover:shadow-red-600/30 active:scale-95"
          >
            <span>Review Case</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onDismiss}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
            title="Dismiss Alert"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );
}
