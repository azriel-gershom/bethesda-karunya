import React, { useEffect, useState } from 'react';
import { API_URL } from '../../config/api';
import { motion } from 'motion/react';
import { Heart, Search, Clock, User, Phone, Loader2 } from 'lucide-react';

interface PrayerRequest {
  visitId: number;
  prayerRequest: string;
  purpose: string;
  status: string;
  checkInTime: string;
  visitorName: string;
  visitorPhone: string;
}

export default function PrayerRequestsPanel({ token }: { token: string }) {
  const [requests, setRequests] = useState<PrayerRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchRequests = async () => {
      try {
        const res = await fetch(`${API_URL}/api/prayer-requests`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        const json = await res.json();
        if (json.success) setRequests(json.data);
      } catch (err) {
        console.error('Failed to fetch prayer requests', err);
      } finally {
        setLoading(false);
      }
    };
    fetchRequests();
  }, []);

  const filtered = requests.filter(r =>
    r.visitorName.toLowerCase().includes(search.toLowerCase()) ||
    r.prayerRequest.toLowerCase().includes(search.toLowerCase()) ||
    r.purpose.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-cyan-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Heart className="w-5 h-5 text-rose-400" /> Prayer Requests
          </h3>
          <p className="text-sm text-zinc-500 mt-0.5">{requests.length} prayer requests recorded</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-zinc-950/80 border border-zinc-800 rounded-xl pl-10 pr-4 py-2 text-sm text-zinc-200 focus:outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600/50 transition-all hover:border-zinc-700 placeholder:text-zinc-600 w-64"
            placeholder="Search prayers, names..."
          />
        </div>
      </div>

      {/* Prayer Cards */}
      {filtered.length === 0 ? (
        <div className="py-16 flex flex-col items-center justify-center border-2 border-dashed border-zinc-800/40 rounded-2xl">
          <Heart className="w-8 h-8 text-zinc-700 mb-3" />
          <p className="text-zinc-400 font-medium">No prayer requests found</p>
          <p className="text-zinc-600 text-sm mt-1">Prayer requests from visitors will appear here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((req, i) => (
            <motion.div
              key={req.visitId}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="glass-card p-5 flex flex-col gap-3 card-hover group"
            >
              {/* Visitor Info */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-900/50 to-rose-950 flex items-center justify-center text-xs font-bold text-rose-300 border border-rose-800/40">
                    {req.visitorName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-zinc-200">{req.visitorName}</p>
                    <p className="text-[10px] text-zinc-500 font-mono flex items-center gap-1">
                      <Phone className="w-2.5 h-2.5" /> {req.visitorPhone}
                    </p>
                  </div>
                </div>
                <span className={`px-2 py-0.5 text-[9px] rounded-md font-bold border ${
                  req.status === 'COMPLETED'
                    ? 'bg-emerald-900/30 text-emerald-300 border-emerald-800/40'
                    : req.status === 'WAITING'
                    ? 'bg-amber-900/30 text-amber-300 border-amber-800/40'
                    : 'bg-cyan-900/30 text-cyan-300 border-cyan-800/40'
                }`}>
                  {req.status}
                </span>
              </div>

              {/* Prayer Request */}
              <div className="p-3 bg-zinc-950/50 rounded-xl border border-zinc-800/50 flex-1">
                <p className="text-[10px] uppercase text-rose-400/70 font-bold tracking-wider mb-1.5 flex items-center gap-1">
                  <Heart className="w-3 h-3" /> Prayer Request
                </p>
                <p className="text-sm text-zinc-300 italic leading-relaxed">"{req.prayerRequest}"</p>
              </div>

              {/* Meta */}
              <div className="flex items-center justify-between text-[10px] text-zinc-600">
                <span className="px-2 py-0.5 bg-zinc-800/70 rounded-full border border-zinc-700/50">{req.purpose}</span>
                <span className="font-mono flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" />
                  {new Date(req.checkInTime).toLocaleDateString()} {new Date(req.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
