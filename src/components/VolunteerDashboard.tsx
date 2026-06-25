import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { API_URL } from '../config/api';
import { motion, AnimatePresence } from 'motion/react';
import {
  HandHeart,
  CheckCircle2,
  XCircle,
  Clock,
  Languages,
  Tag,
  Phone,
  User,
  Heart,
  ToggleLeft,
  ToggleRight,
  Inbox,
  RefreshCw,
  FileText,
  ChevronDown,
  ChevronUp,
  Loader2,
  BookOpen,
} from 'lucide-react';

interface Assignment {
  id: number;
  visitId: number | null;
  taskType: string;
  status: string;
  notes: string | null;
  assignedAt: string;
  acceptedAt: string | null;
  completedAt: string | null;
  visitorName: string | null;
  visitorPhone: string | null;
  visitorLanguage: string | null;
  visitPurpose: string | null;
  visitPrayerRequest: string | null;
  visitStatus: string | null;
}

interface VolunteerProfile {
  id: number;
  userId: number;
  languages: string[] | null;
  categories: string[] | null;
  isAvailable: boolean;
  isActive: boolean;
  currentWorkload: number;
  maxWorkload: number;
  notes: string | null;
}

// --- Time Elapsed Badge ---
function TimeElapsed({ since }: { since: string | Date }) {
  const [elapsed, setElapsed] = useState('');
  useEffect(() => {
    const calc = () => {
      const diff = Date.now() - new Date(since).getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return 'Just now';
      if (mins < 60) return `${mins}m ago`;
      const hrs = Math.floor(mins / 60);
      return `${hrs}h ${mins % 60}m`;
    };
    setElapsed(calc());
    const id = setInterval(() => setElapsed(calc()), 30000);
    return () => clearInterval(id);
  }, [since]);
  return (
    <span className="text-[9px] text-zinc-500 font-mono flex items-center gap-1">
      <Clock className="w-2.5 h-2.5" /> {elapsed}
    </span>
  );
}

export default function VolunteerDashboard({ token, user }: { token: string; user: any }) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [profile, setProfile] = useState<VolunteerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [completionNotes, setCompletionNotes] = useState<Record<number, string>>({});
  const [refreshing, setRefreshing] = useState(false);

  const fetchAssignments = async () => {
    try {
      const res = await fetch(`${API_URL}/api/volunteers/me/assignments`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success) setAssignments(json.data);
    } catch (err) {
      console.error('Failed to fetch assignments', err);
    }
  };

  const fetchProfile = async () => {
    try {
      // Profile data comes from availability endpoint (we can infer from toggle)
      // For now we read assignments and check if volunteer exists
      const res = await fetch(`${API_URL}/api/volunteers/me/assignments`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      // We don't have a direct profile GET endpoint, so we'll use availability toggle to sync
    } catch (err) {
      console.error('Failed to fetch profile', err);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchAssignments();
      setLoading(false);
    };
    init();

    const socket = io(API_URL);

    socket.on('VolunteerAssigned', (data) => {
      console.log('New assignment received:', data);
      fetchAssignments();
    });

    socket.on('AssignmentAccepted', () => fetchAssignments());
    socket.on('AssignmentCompleted', () => fetchAssignments());
    socket.on('AssignmentDeclined', () => fetchAssignments());

    return () => { socket.disconnect(); };
  }, [token]);

  const toggleAvailability = async (newState: boolean) => {
    try {
      await fetch(`${API_URL}/api/volunteers/me/availability`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ isAvailable: newState }),
      });
      setProfile(prev => prev ? { ...prev, isAvailable: newState } : prev);
    } catch (err) {
      console.error('Failed to toggle availability', err);
    }
  };

  const acceptAssignment = async (id: number) => {
    setActionLoading(id);
    try {
      await fetch(`${API_URL}/api/assignments/${id}/accept`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      await fetchAssignments();
    } catch (err) {
      console.error('Failed to accept assignment', err);
    } finally {
      setActionLoading(null);
    }
  };

  const completeAssignment = async (id: number) => {
    setActionLoading(id);
    try {
      await fetch(`${API_URL}/api/assignments/${id}/complete`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ notes: completionNotes[id] || '' }),
      });
      await fetchAssignments();
      setCompletionNotes(prev => { const n = { ...prev }; delete n[id]; return n; });
    } catch (err) {
      console.error('Failed to complete assignment', err);
    } finally {
      setActionLoading(null);
    }
  };

  const declineAssignment = async (id: number) => {
    setActionLoading(id);
    try {
      await fetch(`${API_URL}/api/assignments/${id}/decline`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      await fetchAssignments();
    } catch (err) {
      console.error('Failed to decline assignment', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAssignments();
    setRefreshing(false);
  };

  const activeAssignments = assignments.filter(a => ['PENDING', 'ACCEPTED', 'IN_PROGRESS'].includes(a.status));
  const completedAssignments = assignments.filter(a => ['COMPLETED', 'DECLINED'].includes(a.status));

  // Availability state — derive from profile or default to true for seed user
  const [isAvailable, setIsAvailable] = useState(true);

  const handleToggle = async () => {
    const newState = !isAvailable;
    setIsAvailable(newState);
    await toggleAvailability(newState);
  };

  if (loading) {
    return (
      <div className="flex-1 p-6 flex items-center justify-center bg-zinc-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-950/30 border border-emerald-800/30 flex items-center justify-center">
            <HandHeart className="w-6 h-6 text-emerald-500 animate-pulse" />
          </div>
          <div className="text-zinc-500 font-mono text-sm">LOADING VOLUNTEER HUB...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-zinc-950">
      <div className="max-w-5xl mx-auto flex flex-col gap-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
        >
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <HandHeart className="w-5 h-5 text-emerald-500" />
              Volunteer Hub
            </h2>
            <p className="text-sm text-zinc-400 mt-0.5">Welcome back, {user.name}. Manage your assignments here.</p>
          </div>
          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleRefresh}
              className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-cyan-400 hover:border-cyan-800/50 transition-all cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </motion.button>

            {/* Availability Toggle */}
            <motion.button
              onClick={handleToggle}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all cursor-pointer border ${
                isAvailable
                  ? 'bg-emerald-900/30 border-emerald-800/50 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-500'
              }`}
            >
              {isAvailable ? (
                <><ToggleRight className="w-5 h-5" /> AVAILABLE</>
              ) : (
                <><ToggleLeft className="w-5 h-5" /> UNAVAILABLE</>
              )}
            </motion.button>
          </div>
        </motion.div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Pending', value: assignments.filter(a => a.status === 'PENDING').length, color: 'text-amber-400', bg: 'bg-amber-900/20', border: 'border-amber-800/40' },
            { label: 'In Progress', value: assignments.filter(a => a.status === 'ACCEPTED' || a.status === 'IN_PROGRESS').length, color: 'text-cyan-400', bg: 'bg-cyan-900/20', border: 'border-cyan-800/40' },
            { label: 'Completed', value: assignments.filter(a => a.status === 'COMPLETED').length, color: 'text-emerald-400', bg: 'bg-emerald-900/20', border: 'border-emerald-800/40' },
            { label: 'Declined', value: assignments.filter(a => a.status === 'DECLINED').length, color: 'text-zinc-500', bg: 'bg-zinc-900/50', border: 'border-zinc-800/40' },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className={`${stat.bg} border ${stat.border} rounded-xl p-4 text-center`}
            >
              <p className="text-[10px] uppercase text-zinc-500 font-bold tracking-wider">{stat.label}</p>
              <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
            </motion.div>
          ))}
        </div>

        {/* Active Assignments */}
        <div>
          <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-400 mb-4 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(6,182,212,0.8)]"></div>
            Active Assignments
            <span className="ml-2 px-2 py-0.5 bg-cyan-900/20 border border-cyan-800/30 rounded-full text-[9px] text-cyan-400 font-mono">
              {activeAssignments.length}
            </span>
          </h3>

          {activeAssignments.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-16 flex flex-col items-center justify-center border-2 border-dashed border-zinc-800/40 rounded-2xl"
            >
              <div className="w-14 h-14 rounded-2xl bg-zinc-900/50 flex items-center justify-center mb-3 border border-zinc-800/50">
                <Inbox className="w-7 h-7 text-zinc-700" />
              </div>
              <p className="text-zinc-400 font-medium">No active assignments</p>
              <p className="text-zinc-600 text-sm mt-1">New tasks will appear here in real-time when assigned.</p>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <AnimatePresence>
                {activeAssignments.map((assignment, index) => (
                  <motion.div
                    key={assignment.id}
                    initial={{ opacity: 0, scale: 0.95, y: 15 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: -10 }}
                    transition={{ delay: index * 0.06, duration: 0.35 }}
                    className="glass-card p-5 flex flex-col gap-4 card-hover glow-cyan-hover group"
                  >
                    {/* Card Header */}
                    <div className="flex justify-between items-start">
                      <div className="flex gap-3">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-zinc-700 to-zinc-800 text-zinc-300 flex items-center justify-center font-bold text-sm border border-zinc-600/50 group-hover:border-cyan-700/50 group-hover:from-cyan-900 group-hover:to-cyan-950 group-hover:text-cyan-300 transition-all">
                          {assignment.visitorName?.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() || '??'}
                        </div>
                        <div>
                          <h3 className="font-semibold text-zinc-100 text-lg">{assignment.visitorName || 'Unknown'}</h3>
                          <div className="flex items-center gap-2">
                            <p className="text-[10px] text-zinc-500 font-mono">
                              <Phone className="w-2.5 h-2.5 inline mr-1" />
                              {assignment.visitorPhone || 'N/A'}
                            </p>
                            {assignment.assignedAt && <TimeElapsed since={assignment.assignedAt} />}
                          </div>
                        </div>
                      </div>
                      <span className={`px-2 py-1 text-[10px] rounded-lg font-bold border uppercase ${
                        assignment.status === 'PENDING'
                          ? 'bg-amber-900/30 text-amber-300 border-amber-800/40'
                          : 'bg-cyan-900/30 text-cyan-300 border-cyan-800/40'
                      }`}>
                        {assignment.status}
                      </span>
                    </div>

                    {/* Card Body */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-3.5 h-3.5 text-zinc-500" />
                        <span className="text-[10px] uppercase text-zinc-500 font-bold tracking-wider">Purpose</span>
                        <span className="text-sm text-zinc-300 ml-auto">{assignment.visitPurpose || 'N/A'}</span>
                      </div>
                      {assignment.visitorLanguage && (
                        <div className="flex items-center gap-2">
                          <Languages className="w-3.5 h-3.5 text-zinc-500" />
                          <span className="text-[10px] uppercase text-zinc-500 font-bold tracking-wider">Language</span>
                          <span className="text-sm text-zinc-300 ml-auto">{assignment.visitorLanguage}</span>
                        </div>
                      )}
                      {assignment.visitPrayerRequest && (
                        <div className="p-3 bg-zinc-950/50 rounded-xl border border-zinc-800/50">
                          <p className="text-[10px] uppercase text-cyan-500/70 font-bold tracking-wider mb-1 flex items-center gap-1">
                            <Heart className="w-3 h-3" /> Prayer Request
                          </p>
                          <p className="text-sm text-zinc-300 italic">"{assignment.visitPrayerRequest}"</p>
                        </div>
                      )}
                    </div>

                    {/* Completion Notes (shown for accepted tasks) */}
                    {assignment.status === 'ACCEPTED' && (
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase text-zinc-500 tracking-[0.15em] flex items-center gap-1">
                          <FileText className="w-3 h-3" /> Session Notes
                        </label>
                        <textarea
                          value={completionNotes[assignment.id] || ''}
                          onChange={(e) => setCompletionNotes(prev => ({ ...prev, [assignment.id]: e.target.value }))}
                          rows={2}
                          className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600/50 transition-all hover:border-zinc-700 placeholder:text-zinc-600 resize-none"
                          placeholder="Add notes before completing..."
                        />
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="mt-auto pt-4 border-t border-zinc-800/50 flex gap-2">
                      {assignment.status === 'PENDING' && (
                        <>
                          <motion.button
                            onClick={() => acceptAssignment(assignment.id)}
                            disabled={actionLoading === assignment.id}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.97 }}
                            className="flex-1 py-2.5 bg-emerald-900/30 hover:bg-emerald-800/50 text-emerald-400 text-sm font-bold rounded-xl transition-all border border-emerald-800/40 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                          >
                            {actionLoading === assignment.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                            ACCEPT
                          </motion.button>
                          <motion.button
                            onClick={() => declineAssignment(assignment.id)}
                            disabled={actionLoading === assignment.id}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.97 }}
                            className="flex-1 py-2.5 bg-zinc-900/50 hover:bg-red-900/30 text-zinc-500 hover:text-red-400 text-sm font-bold rounded-xl transition-all border border-zinc-800/40 hover:border-red-800/40 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                          >
                            <XCircle className="w-4 h-4" />
                            DECLINE
                          </motion.button>
                        </>
                      )}
                      {assignment.status === 'ACCEPTED' && (
                        <motion.button
                          onClick={() => completeAssignment(assignment.id)}
                          disabled={actionLoading === assignment.id}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.97 }}
                          className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-black text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-900/20 disabled:opacity-50"
                        >
                          {actionLoading === assignment.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                          MARK COMPLETED
                        </motion.button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Completed History */}
        {completedAssignments.length > 0 && (
          <div>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-4 flex items-center gap-2 hover:text-zinc-300 transition-colors cursor-pointer"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-zinc-600"></div>
              History ({completedAssignments.length})
              {showHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            <AnimatePresence>
              {showHistory && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-xl overflow-hidden">
                    <div className="grid grid-cols-12 px-5 py-3 bg-zinc-950/40 text-[10px] font-bold text-zinc-500 border-b border-zinc-800/50 uppercase tracking-widest">
                      <div className="col-span-3">Visitor</div>
                      <div className="col-span-2 text-center">Purpose</div>
                      <div className="col-span-2 text-center">Status</div>
                      <div className="col-span-3">Notes</div>
                      <div className="col-span-2 text-right">Completed</div>
                    </div>
                    {completedAssignments.map((a) => (
                      <div key={a.id} className="grid grid-cols-12 px-5 py-3 items-center border-b border-zinc-800/30 text-sm">
                        <div className="col-span-3 text-zinc-300">{a.visitorName || 'Unknown'}</div>
                        <div className="col-span-2 text-center">
                          <span className="px-2 py-0.5 bg-zinc-800/70 rounded-full text-[9px] text-zinc-400 border border-zinc-700/50">
                            {a.visitPurpose || 'N/A'}
                          </span>
                        </div>
                        <div className="col-span-2 text-center">
                          <span className={`px-2 py-0.5 text-[9px] rounded-md font-bold border ${
                            a.status === 'COMPLETED'
                              ? 'bg-emerald-900/30 text-emerald-300 border-emerald-800/40'
                              : 'bg-zinc-800/50 text-zinc-500 border-zinc-700/40'
                          }`}>
                            {a.status}
                          </span>
                        </div>
                        <div className="col-span-3 text-zinc-500 text-xs truncate">{a.notes || '—'}</div>
                        <div className="col-span-2 text-right text-zinc-500 text-xs font-mono">
                          {a.completedAt ? new Date(a.completedAt).toLocaleDateString() : '—'}
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
