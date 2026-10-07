import React, { useState, useEffect } from 'react';
import { 
  CheckSquare, 
  BarChart2, 
  Cpu, 
  RefreshCw, 
  Award, 
  Layers, 
  FileText, 
  ShieldCheck, 
  AlertCircle 
} from 'lucide-react';
import { apiRequest } from '../api';

export default function EvaluationPage() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const res = await apiRequest('/admin/evaluation');
      setMetrics(res);
    } catch (err) {
      console.error("Evaluation fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center text-slate-500">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-sky-500" />
        <p className="text-sm font-semibold">Running inference over 50 ground-truth legal benchmark cases...</p>
      </div>
    );
  }

  if (!metrics) return null;

  const urgCM = metrics.confusion_matrix_urgency || { labels: [], matrix: [] };
  const emoCM = metrics.confusion_matrix_emotion || { labels: [], matrix: [] };
  const perLang = metrics.per_language_accuracy || {};

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Title */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 text-xs font-semibold mb-2">
            <Award className="w-3.5 h-3.5" />
            Official Project Report Benchmark
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <span>Model Performance & Evaluation Benchmark</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Empirical validation across 50 expert-labeled multilingual ground-truth cases
          </p>
        </div>

        <button
          onClick={fetchMetrics}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow-md transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Re-Run Live Evaluation
        </button>
      </div>

      {/* Primary Metric Score Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Urgency Accuracy</span>
          <div className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
            {metrics.urgency_accuracy}%
          </div>
          <span className="text-[11px] font-mono font-bold text-slate-500 mt-1 block">
            Macro-F1: {metrics.urgency_f1_macro}
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Category Routing</span>
          <div className="text-3xl font-extrabold text-sky-600 dark:text-sky-400 mt-1">
            {metrics.category_accuracy}%
          </div>
          <span className="text-[11px] font-semibold text-slate-500 mt-1 block">
            Across 8 Legal Divisions
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Emotion Accuracy</span>
          <div className="text-3xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-1">
            {metrics.emotion_accuracy}%
          </div>
          <span className="text-[11px] font-mono font-bold text-slate-500 mt-1 block">
            Macro-F1: {metrics.emotion_f1_macro}
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Benchmark Dataset</span>
          <div className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1">
            {metrics.total_samples}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">
            Multilingual Ground-Truth
          </span>
        </div>

      </div>

      {/* Row 2: Confusion Matrix for Urgency */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-emerald-500" />
              Confusion Matrix: 4-Tier Urgency Classification
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Rows represent True Ground-Truth labels; Columns represent Model Predictions
            </p>
          </div>
          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono">
            Accuracy: {metrics.urgency_accuracy}%
          </span>
        </div>

        <div className="overflow-x-auto pt-2">
          <table className="w-full text-center text-xs border-collapse font-mono">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                <th className="py-3 px-4 text-left font-sans font-bold">True \ Pred</th>
                {urgCM.labels.map((l) => (
                  <th key={l} className="py-3 px-4 font-bold">{l}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {urgCM.matrix.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                  <td className="py-3 px-4 text-left font-sans font-bold text-slate-800 dark:text-slate-200">
                    {urgCM.labels[rIdx]}
                  </td>
                  {row.map((val, cIdx) => {
                    const isDiagonal = rIdx === cIdx;
                    return (
                      <td
                        key={cIdx}
                        className={`py-3 px-4 text-sm font-bold transition-colors ${
                          isDiagonal
                            ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300'
                            : val > 0
                            ? 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400'
                            : 'text-slate-400'
                        }`}
                      >
                        {val}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Row 3: Per-Language Accuracy Breakdown */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
        <h3 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
          <Layers className="w-4 h-4 text-sky-500" />
          Per-Language Benchmark Performance
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2">
          {Object.entries(perLang).map(([code, p]) => (
            <div key={code} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-center space-y-1">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase block font-mono">
                {code.toUpperCase()}
              </span>
              <div className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                {p.urgency_accuracy}%
              </div>
              <p className="text-[10px] text-slate-400">Urgency Acc ({p.total} cases)</p>
            </div>
          ))}
        </div>
      </div>

      {/* Row 4: Confusion Matrix for Emotion (7 Classes) */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
        <div>
          <h3 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-indigo-500" />
            Confusion Matrix: 7 Affective Emotion Classes
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Evaluates accuracy across anger, fear, distress, neutral, desperation, frustration, and sadness
          </p>
        </div>

        <div className="overflow-x-auto pt-2">
          <table className="w-full text-center text-xs border-collapse font-mono">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                <th className="py-2.5 px-3 text-left font-sans font-bold">True \ Pred</th>
                {emoCM.labels.map((l) => (
                  <th key={l} className="py-2.5 px-3 font-bold capitalize">{l}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {emoCM.matrix.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                  <td className="py-2.5 px-3 text-left font-sans font-bold text-slate-800 dark:text-slate-200 capitalize">
                    {emoCM.labels[rIdx]}
                  </td>
                  {row.map((val, cIdx) => {
                    const isDiagonal = rIdx === cIdx;
                    return (
                      <td
                        key={cIdx}
                        className={`py-2.5 px-3 font-bold transition-colors ${
                          isDiagonal
                            ? 'bg-indigo-100 dark:bg-indigo-950/70 text-indigo-800 dark:text-indigo-300'
                            : val > 0
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                            : 'text-slate-300 dark:text-slate-700'
                        }`}
                      >
                        {val}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
