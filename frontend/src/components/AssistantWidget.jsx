import React, { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, Sparkles, MessageSquare, Shield, HelpCircle, Loader2 } from 'lucide-react';
import { apiRequest } from '../api';

export default function AssistantWidget({ userRole = 'citizen', onSelectComplaint }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: userRole === 'citizen'
        ? "Hello! I am your Legal Grievance AI Assistant. You can ask me about your complaint status, filing procedures, or which department handles your dispute."
        : "Officer Intelligence Assistant active. Ask me to summarize critical complaints, query queue workloads, or inspect precedent rulings."
    }
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const quickPrompts = userRole === 'citizen'
    ? [
        "What is the status of CMP-2026-1002?",
        "How is urgency score calculated?",
        "Which cell handles online banking fraud?"
      ]
    : [
        "Summarize all critical complaints this week",
        "Explain XAI rationale behind domestic abuse",
        "Overview of cybercrime queue load"
      ];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  const handleSend = async (queryText = inputQuery) => {
    const q = queryText.trim();
    if (!q || loading) return;

    const newMessages = [...messages, { role: 'user', content: q }];
    setMessages(newMessages);
    setInputQuery('');
    setLoading(true);

    try {
      const res = await apiRequest('/assistant/chat', 'POST', {
        query: q,
        user_role: userRole
      });

      setMessages([
        ...newMessages,
        {
          role: 'assistant',
          content: res.response,
          relevant_complaints: res.relevant_complaints,
          action_suggested: res.action_suggested
        }
      ]);
    } catch (err) {
      setMessages([
        ...newMessages,
        {
          role: 'assistant',
          content: "I could not reach the legal intelligence backend at this moment. Please ensure the FastAPI server is active."
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      
      {/* Floating Launcher Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="group relative flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-600 to-indigo-600 text-white shadow-xl shadow-sky-600/30 hover:scale-105 active:scale-95 transition-all"
          title="Open Legal AI Assistant"
        >
          <Bot className="w-7 h-7" />
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900" />
        </button>
      )}

      {/* Expanded Chat Drawer */}
      {isOpen && (
        <div className="w-[360px] sm:w-[420px] h-[540px] flex flex-col rounded-2xl shadow-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in slide-in-from-bottom-5">
          
          {/* Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-sky-600 to-indigo-600 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-white/20">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-sm tracking-tight flex items-center gap-1.5">
                  Legal AI Assistant
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                </h3>
                <p className="text-[11px] text-sky-100">
                  {userRole.toUpperCase()} Support • Ollama LLM + DB Interop
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Prompt Pills */}
          <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto">
            {quickPrompts.map((p, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(p)}
                className="whitespace-nowrap text-[11px] font-medium px-2.5 py-1 rounded-full bg-white dark:bg-slate-700 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-slate-600 hover:bg-sky-50 dark:hover:bg-slate-600 transition-colors"
              >
                {p}
              </button>
            ))}
          </div>

          {/* Message Stream */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3.5 text-xs sm:text-sm">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-sky-600 text-white rounded-br-none shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-none border border-slate-200/70 dark:border-slate-700/70'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.content}</p>

                  {/* Render relevant complaints if returned */}
                  {m.relevant_complaints && m.relevant_complaints.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-slate-200 dark:border-slate-700 space-y-1.5">
                      <span className="font-bold text-[10px] text-slate-500 uppercase tracking-wider block">
                        Referenced Grievances:
                      </span>
                      {m.relevant_complaints.map((rc, rIdx) => (
                        <div
                          key={rIdx}
                          onClick={() => onSelectComplaint && onSelectComplaint(rc.id)}
                          className="cursor-pointer p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-sky-400 flex items-center justify-between text-[11px]"
                        >
                          <span className="font-mono font-bold text-sky-600 dark:text-sky-400">{rc.id}</span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400">
                            {rc.urgency}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs">
                <Loader2 className="w-4 h-4 animate-spin text-sky-500" />
                <span>Consulting legal classification knowledge store...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Footer */}
          <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2">
            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask status, category rules, or summaries..."
              className="flex-1 text-xs bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl px-3.5 py-2.5 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            <button
              onClick={() => handleSend()}
              disabled={loading || !inputQuery.trim()}
              className="p-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>

        </div>
      )}

    </div>
  );
}
