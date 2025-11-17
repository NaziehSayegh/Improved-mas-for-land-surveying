import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { askAssistant } from '../utils/api';

const Assistant = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hi! I am the Parcel Tools Assistant. Ask me about features, how to load points, calculate areas with curves, export PDF, or anything in the app. Press ESC to return to the main menu.' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        navigate('/');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  useEffect(() => {
    // Use requestAnimationFrame for smoother scrolling
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    });
  }, [messages, loading]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;
    setInput('');
    const newMessages = [...messages, { role: 'user', content: text }];
    setMessages(newMessages);
    setLoading(true);
    try {
      const res = await askAssistant({ messages: newMessages.slice(-6) });
      setMessages((prev) => [...prev, { role: 'assistant', content: res.answer || 'Sorry, I could not find an answer.' }]);
    } catch (e) {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Error contacting assistant. Please try again.' }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-dark-900 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-primary">🤖 Assistant</h2>
        <button
          onClick={() => navigate('/')}
          className="px-3 py-1 rounded-md border border-dark-600 text-dark-200 hover:text-dark-50 hover:border-primary"
        >
          ESC · Back
        </button>
      </div>

      <div className="flex-1 overflow-y-auto bg-dark-800 border border-dark-700 rounded-xl p-4 space-y-3">
        {messages.map((m, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`${m.role === 'assistant' ? 'bg-dark-700/60 border-dark-600' : 'bg-primary/10 border-primary/40'} border rounded-lg p-3`}
          >
            <div className="text-sm text-dark-300 mb-1">{m.role === 'assistant' ? 'Assistant' : 'You'}</div>
            <div className="whitespace-pre-wrap text-dark-50">{m.content}</div>
          </motion.div>
        ))}
        {loading && (
          <div className="text-dark-300 text-sm">Assistant is typing…</div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="mt-4 flex gap-2">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          placeholder="Ask how to load points, calculate area with curves, export PDF, etc."
          className="flex-1 resize-none bg-dark-800 border border-dark-700 rounded-xl p-3 text-dark-50 placeholder-dark-400 focus:outline-none focus:border-primary"
        />
        <button
          onClick={handleSend}
          disabled={loading}
          className="px-4 py-2 rounded-xl bg-primary text-dark-900 font-semibold hover:brightness-110 disabled:opacity-60"
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default Assistant;




