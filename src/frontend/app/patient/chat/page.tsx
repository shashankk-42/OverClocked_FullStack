'use client';

import { useState, useRef, useEffect } from 'react';
import { aiApi } from '@/lib/api';
import { Send, Bot, User, Loader2, MessageSquare } from 'lucide-react';

interface Message {
  role: 'user' | 'ai';
  content: string;
  time: Date;
}

const SUGGESTIONS = [
  'What are the visiting hours?',
  'How do I read my lab report?',
  'Why am I taking Metformin?',
  'When is my next appointment?',
  'What are the side effects of my medicines?',
];

export default function AIChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'ai',
      content: "Hello! I'm MediFlow AI, your personal health assistant. I can help you understand your medications, explain your reports, answer health questions, and guide you through hospital services. How can I help you today?",
      time: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text?: string) => {
    const msg = text || input.trim();
    if (!msg || loading) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: msg, time: new Date() }]);
    setLoading(true);

    try {
      const res = await aiApi.chat(msg);
      const reply = res.data?.response?.trim();
      setMessages((prev) => [...prev, {
        role: 'ai',
        content: reply || "I couldn't generate a response just now. Please try again or contact reception for help.",
        time: new Date(),
      }]);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      const message = status === 403 || status === 401
        ? 'Your session expired. Please sign out and log in again, then retry.'
        : detail || "I'm having trouble connecting right now. Please try again or speak with our staff.";
      setMessages((prev) => [...prev, { role: 'ai', content: message, time: new Date() }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto flex flex-col h-[calc(100vh-5rem)]">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-neutral-900 flex items-center gap-2">
          <Bot className="w-6 h-6 text-neutral-900" />
          AI Health Assistant
        </h1>
        <p className="text-neutral-500 text-sm mt-1">Powered by Google Gemini — ask me anything about your health</p>
      </div>

      {/* Chat Area */}
      <div className="flex-1 bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center
                ${msg.role === 'ai' ? 'bg-neutral-900' : 'bg-neutral-200'}`}>
                {msg.role === 'ai' ? <Bot className="w-4 h-4 text-white" /> : <User className="w-4 h-4 text-neutral-600" />}
              </div>
              <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed
                ${msg.role === 'ai' ? 'bg-neutral-100 text-neutral-900 rounded-tl-sm' : 'bg-neutral-900 text-white rounded-tr-sm'}`}>
                {msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-neutral-900 flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="bg-neutral-100 px-4 py-3 rounded-2xl rounded-tl-sm">
                <Loader2 className="w-4 h-4 text-neutral-500 animate-spin" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Suggestions */}
        {messages.length === 1 && (
          <div className="px-4 pb-3">
            <p className="text-xs text-neutral-500 mb-2">Suggested questions:</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => sendMessage(s)}
                  className="text-xs px-3 py-1.5 bg-white hover:bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-600 transition-colors">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="p-4 border-t border-neutral-200">
          <div className="flex gap-3">
            <input
              id="chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder="Ask me about your health, medications, appointments..."
              className="flex-1 px-4 py-2.5 bg-white border border-neutral-300 rounded-xl text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent text-sm"
            />
            <button
              id="chat-send-btn"
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              className="w-10 h-10 bg-neutral-900 hover:bg-neutral-700 disabled:opacity-40 text-white rounded-xl flex items-center justify-center flex-shrink-0 transition-all">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
