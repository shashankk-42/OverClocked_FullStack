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
      setMessages((prev) => [...prev, { role: 'ai', content: res.data.response, time: new Date() }]);
    } catch {
      setMessages((prev) => [...prev, {
        role: 'ai',
        content: "I'm having trouble connecting right now. Please try again or speak with our staff.",
        time: new Date()
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto flex flex-col h-[calc(100vh-5rem)]">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Bot className="w-6 h-6 text-blue-400" />
          AI Health Assistant
        </h1>
        <p className="text-slate-400 text-sm mt-1">Powered by Google Gemini — ask me anything about your health</p>
      </div>

      {/* Chat Area */}
      <div className="flex-1 glass-card rounded-2xl border border-slate-700/50 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center
                ${msg.role === 'ai' ? 'bg-blue-500' : 'bg-slate-600'}`}>
                {msg.role === 'ai' ? <Bot className="w-4 h-4 text-white" /> : <User className="w-4 h-4 text-white" />}
              </div>
              <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed
                ${msg.role === 'ai' ? 'bg-slate-800 text-slate-100 rounded-tl-sm' : 'bg-blue-600 text-white rounded-tr-sm'}`}>
                {msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="bg-slate-800 px-4 py-3 rounded-2xl rounded-tl-sm">
                <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Suggestions */}
        {messages.length === 1 && (
          <div className="px-4 pb-3">
            <p className="text-xs text-slate-500 mb-2">Suggested questions:</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => sendMessage(s)}
                  className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-300 transition-colors">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="p-4 border-t border-slate-700">
          <div className="flex gap-3">
            <input
              id="chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder="Ask me about your health, medications, appointments..."
              className="flex-1 px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm"
            />
            <button
              id="chat-send-btn"
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              className="w-10 h-10 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-xl flex items-center justify-center flex-shrink-0 transition-all">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
