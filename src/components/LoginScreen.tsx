import React, { useState, useEffect } from 'react';
import { Lock, User, ShieldAlert, Eye, EyeOff, Building2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { API_URL } from '../config/api';

export default function LoginScreen({ onLogin }: { onLogin: (token: string, user: any) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [subtitleText, setSubtitleText] = useState('');
  const fullSubtitle = 'AUTHENTICATION REQUIRED • SECURE GATEWAY';

  // Typing effect for subtitle
  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      setSubtitleText(fullSubtitle.slice(0, i + 1));
      i++;
      if (i >= fullSubtitle.length) clearInterval(interval);
    }, 40);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }

      onLogin(data.token, data.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center font-sans overflow-hidden select-none relative">
      {/* Animated Particle Background */}
      <div className="particles-container">
        <div className="particle particle-1"></div>
        <div className="particle particle-2"></div>
        <div className="particle particle-3"></div>
        <div className="particle particle-4"></div>
      </div>

      {/* Grid overlay pattern */}
      <div className="absolute inset-0 bg-grid-pattern opacity-30 pointer-events-none"></div>

      {/* Radial gradient overlay */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(circle at 50% 50%, rgba(6, 182, 212, 0.04) 0%, transparent 60%)'
      }}></div>

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md p-8 glass-card gradient-border flex flex-col gap-6 relative z-10"
      >
        {/* Top glow accent */}
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-40 h-40 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-20 h-20 bg-violet-500/10 rounded-full blur-2xl pointer-events-none"></div>
        
        <motion.div 
          className="flex flex-col items-center gap-3"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          <div className="relative">
            <div className="w-14 h-14 bg-gradient-to-br from-cyan-600 to-cyan-800 text-white rounded-2xl flex items-center justify-center border border-cyan-700/50 shadow-lg shadow-cyan-900/30">
              <Building2 className="w-7 h-7" />
            </div>
            {/* Pulse ring behind logo */}
            <div className="absolute inset-0 rounded-2xl bg-cyan-500/20 pulse-ring"></div>
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white tracking-tight">
              BETHESDA <span className="text-cyan-400">PORTAL</span>
            </h2>
            <p className="text-[10px] text-zinc-500 font-mono mt-1 h-4 tracking-widest">
              {subtitleText}
              <span className="animate-pulse text-cyan-400">|</span>
            </p>
          </div>
        </motion.div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="p-3 bg-red-950/30 border border-red-900/50 rounded-xl flex items-start gap-2 text-red-400 text-sm overflow-hidden"
            >
              <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
              <p>{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.form 
          onSubmit={handleSubmit} 
          className="flex flex-col gap-5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase text-zinc-500 tracking-[0.15em]">Username / Email</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-600 group-focus-within:text-cyan-500 transition-colors">
                <User className="w-4 h-4" />
              </div>
              <input 
                type="text" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl pl-11 pr-4 py-3 text-sm text-zinc-200 focus:outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600/50 transition-all font-mono placeholder:font-sans placeholder:text-zinc-600 hover:border-zinc-700"
                placeholder="admin"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase text-zinc-500 tracking-[0.15em]">Password</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-600 group-focus-within:text-cyan-500 transition-colors">
                <Lock className="w-4 h-4" />
              </div>
              <input 
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl pl-11 pr-12 py-3 text-sm text-zinc-200 focus:outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600/50 transition-all font-mono placeholder:font-sans placeholder:text-zinc-600 hover:border-zinc-700"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-zinc-600 hover:text-zinc-400 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <motion.button 
            type="submit" 
            disabled={loading}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            className="mt-1 w-full bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-black font-bold py-3.5 rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed text-sm tracking-wider shadow-lg shadow-cyan-900/30 relative overflow-hidden cursor-pointer"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                AUTHENTICATING...
              </span>
            ) : 'SECURE LOGIN'}
          </motion.button>
        </motion.form>

        <motion.div 
          className="pt-4 border-t border-zinc-800/50 space-y-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
        >
          <p className="text-[10px] text-center text-zinc-600 font-mono uppercase tracking-widest">Test Credentials</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { user: 'admin', pass: 'admin123', role: 'Admin' },
              { user: 'employee', pass: 'employee123', role: 'Employee' },
              { user: 'reception', pass: 'reception123', role: 'Reception' },
              { user: 'counselor', pass: 'counselor123', role: 'Counselor' },
              { user: 'counselor_yp', pass: 'counselor123', role: 'Young Partner' },
              { user: 'counselor_bb', pass: 'counselor123', role: 'Business' },
              { user: 'volunteer', pass: 'volunteer123', role: 'Volunteer' },
            ].map((cred) => (
              <button
                key={cred.user}
                type="button"
                onClick={() => { setEmail(cred.user); setPassword(cred.pass); }}
                className="p-2 bg-zinc-950/50 rounded-lg border border-zinc-800/50 hover:border-cyan-800/40 hover:bg-cyan-950/10 transition-all text-center group cursor-pointer"
              >
                <p className="text-[9px] text-zinc-600 group-hover:text-cyan-600 font-mono">{cred.role}</p>
                <p className="text-[10px] text-zinc-400 group-hover:text-zinc-300 font-mono mt-0.5">{cred.user}</p>
              </button>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
