/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { API_URL } from './config/api';
import { motion, AnimatePresence } from 'motion/react';
import AdminDashboard from './components/AdminDashboard';
import VolunteerDashboard from './components/VolunteerDashboard';
import LoginScreen from './components/LoginScreen';
import VisitorIntakeModal from './components/VisitorIntakeModal';
import {
  isCounselor,
  isFrontDesk,
  isVolunteer,
  isAdmin,
  getRoleLabel,
  getCounselorRoom,
  ROLE_ADMIN,
  ROLE_COUNSELOR_YOUNG_PARTNER,
  ROLE_COUNSELOR_BUSINESS,
} from './shared/roles';
import {
  Building2,
  LayoutDashboard,
  Users,
  ArrowRightLeft,
  BarChart2,
  Settings,
  ShieldAlert,
  Zap,
  UserPlus,
  Bell,
  Clock,
  Inbox,
  CheckCircle2
} from 'lucide-react';

// --- Animated Counter Hook ---
function useAnimatedCounter(target: number, duration: number = 1200) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (target === 0) { setCount(0); return; }
    let start = 0;
    const startTime = performance.now();
    const step = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration]);
  return count;
}

// --- Live Clock Component ---
function LiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const hours = time.getHours().toString().padStart(2, '0');
  const mins = time.getMinutes().toString().padStart(2, '0');
  const secs = time.getSeconds().toString().padStart(2, '0');
  return (
    <div className="flex items-center gap-1.5 font-mono text-xs">
      <Clock className="w-3.5 h-3.5 text-cyan-500" />
      <span className="text-zinc-300">{hours}:{mins}</span>
      <span className="text-cyan-500 animate-pulse">:</span>
      <span className="text-zinc-500">{secs}</span>
    </div>
  );
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

// --- Sidebar Nav Item ---
function SidebarItem({ icon: Icon, label, active, onClick }: { icon: any; label: string; active?: boolean; onClick?: () => void }) {
  return (
    <div className="tooltip-container">
      <button
        onClick={onClick}
        className={`p-2.5 rounded-xl transition-all relative cursor-pointer ${
          active 
            ? 'bg-cyan-950/40 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.15)]' 
            : 'text-zinc-600 hover:text-zinc-400 hover:bg-zinc-900'
        }`}
      >
        {active && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-[12px] w-1 h-5 bg-cyan-500 rounded-r-full shadow-[0_0_8px_rgba(6,182,212,0.6)]"></div>
        )}
        <Icon className="w-5 h-5" />
      </button>
      <span className="tooltip-text">{label}</span>
    </div>
  );
}

// --- Shimmer Loading Skeleton ---
function QueueSkeleton() {
  return (
    <div className="flex flex-col divide-y divide-zinc-800/30">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="grid grid-cols-12 px-6 py-4 items-center gap-4">
          <div className="col-span-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded shimmer"></div>
            <div className="flex flex-col gap-1.5">
              <div className="h-3 w-24 shimmer"></div>
              <div className="h-2 w-16 shimmer"></div>
            </div>
          </div>
          <div className="col-span-2 flex justify-center"><div className="h-3 w-16 shimmer"></div></div>
          <div className="col-span-2 flex justify-center"><div className="h-5 w-20 rounded-full shimmer"></div></div>
          <div className="col-span-3"><div className="h-3 w-28 shimmer"></div></div>
          <div className="col-span-2 flex justify-end"><div className="h-5 w-16 rounded shimmer"></div></div>
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeNav, setActiveNav] = useState('dashboard');
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [socketStatus, setSocketStatus] = useState<'connecting' | 'active' | 'offline'>('offline');
  const [systemHealth, setSystemHealth] = useState<{ dbStatus?: string; mode?: string } | null>(null);

  // ── Role-based view routing ──────────────────────────
  // Uses helpers from src/shared/roles.ts.
  // These determine which dashboard/view the user sees after login.
  //
  // View mapping:
  //   ADMIN                    → AdminDashboard (full command center)
  //   EMPLOYEE / RECEPTIONIST  → Receptionist view (intake + queue)
  //   COUNSELOR / COUNSELOR_*  → Counselor view (assigned cases)
  //   VOLUNTEER                → VolunteerDashboard (tasks + profile)
  // ────────────────────────────────────────────────────
  let roleUI = 'Receptionist';
  if (user) {
    if (isAdmin(user.role))      roleUI = 'Main Admin';
    else if (isVolunteer(user.role)) roleUI = 'Volunteer';
    else if (isCounselor(user.role)) {
      // Display a descriptive label based on the specific counselor sub-role
      if (user.role === ROLE_COUNSELOR_YOUNG_PARTNER) roleUI = 'Young Partner Room';
      else if (user.role === ROLE_COUNSELOR_BUSINESS)  roleUI = 'Business Blessing';
      else roleUI = 'Counselor'; // Generic COUNSELOR role
    }
    else if (isFrontDesk(user.role)) roleUI = 'Receptionist';
  }
  const counselorPlan = user && isCounselor(user.role)
    ? getCounselorRoom(user.role) || user.assignedRoom || null
    : null;
  const visibleCounselorQueue = counselorPlan
    ? queue.filter(visit => visit.assignedPlan === counselorPlan)
    : queue;

  const dbStatusLabel = systemHealth?.mode === 'demo' || systemHealth?.dbStatus === 'demo'
    ? 'Demo Data Mode'
    : systemHealth?.dbStatus === 'connected'
    ? 'PostgreSQL: Connected'
    : systemHealth?.dbStatus === 'error'
    ? 'PostgreSQL: Offline'
    : 'Database: Checking';
  const dbStatusDotClass = systemHealth?.mode === 'demo' || systemHealth?.dbStatus === 'demo'
    ? 'bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.55)]'
    : systemHealth?.dbStatus === 'connected'
    ? 'bg-emerald-500/70'
    : systemHealth?.dbStatus === 'error'
    ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.55)]'
    : 'bg-zinc-600';
  const socketStatusLabel = socketStatus === 'active'
    ? 'SOCKET.IO ACTIVE'
    : socketStatus === 'connecting'
    ? 'SOCKET.IO CONNECTING'
    : 'SOCKET.IO OFFLINE';
  const socketDotClass = socketStatus === 'active'
    ? 'bg-emerald-400'
    : socketStatus === 'connecting'
    ? 'bg-amber-400'
    : 'bg-red-500';

  // Fetch the live waitlist from the API
  const fetchQueue = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/queue`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.success) {
        setQueue(json.data);
      }
    } catch (err) {
      console.error("Failed to fetch queue", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;

    setSocketStatus('connecting');

    // 1. Initial Fetch (inlined to avoid stale closure / missing dep warning)
    const doFetch = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_URL}/api/queue`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const json = await res.json();
        if (json.success) {
          setQueue(json.data);
        }
      } catch (err) {
        console.error("Failed to fetch queue", err);
      } finally {
        setLoading(false);
      }
    };
    doFetch();

    const fetchHealth = async () => {
      try {
        const res = await fetch(`${API_URL}/api/health`);
        const json = await res.json();
        setSystemHealth({ dbStatus: json.dbStatus, mode: json.mode });
      } catch (err) {
        console.error("Failed to fetch system health", err);
        setSystemHealth({ dbStatus: 'error' });
      }
    };
    fetchHealth();

    // 2. Setup WebSocket Connection
    const socket = io(API_URL);

    socket.on('connect', () => {
      console.log('Connected to real-time sync server');
      setSocketStatus('active');
    });

    socket.on('disconnect', () => {
      setSocketStatus('offline');
    });

    socket.on('connect_error', () => {
      setSocketStatus('offline');
    });

    socket.on('VisitorAdded', (newVisit) => {
      console.log('New visit received over websocket:', newVisit);
      // Prepend the new visit to the top of the queue state
      setQueue((prevQueue) => [newVisit, ...prevQueue]);
    });

    socket.on('VisitorCompleted', ({ visitId }) => {
      console.log('Visit completed over websocket:', visitId);
      setQueue((prevQueue) => prevQueue.filter(v => v.visitId !== visitId));
    });

    // Cleanup on unmount
    return () => {
      socket.disconnect();
    };
  }, [token]);

  // Post real data to the API via the intake modal
  const handleAddVisitor = async (payload: any) => {
    try {
      const res = await fetch(`${API_URL}/api/visitors`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errorData = await res.json();
        console.error("Failed to add visitor", errorData);
        throw new Error(errorData.error || 'Failed to add visitor');
      }
      return await res.json();
    } catch (err) {
      console.error("Error posting visitor", err);
      throw err;
    }
  };

  const handleCompleteVisit = async (visitId: number) => {
    try {
      const res = await fetch(`${API_URL}/api/visits/${visitId}/complete`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
         console.error('Failed to complete visit');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Animated counters for stats
  const totalCount = useAnimatedCounter(queue.length > 0 ? 1428 : 0);
  const counselorCount = useAnimatedCounter(42);

  if (!token) {
    return <LoginScreen onLogin={(t, u) => { setToken(t); setUser(u); }} />;
  }

  return (
    <div className="w-full h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans overflow-hidden select-none">
      {/* Top Navigation / Header */}
      <motion.header 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="h-16 border-b border-zinc-800/70 flex items-center justify-between px-6 bg-zinc-900/40 backdrop-blur-md relative z-20"
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-cyan-700 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-900/20">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">
              BETHESDA <span className="text-cyan-400">PORTAL</span>
            </h1>
            <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-semibold">
              Intelligent Engagement Ecosystem
            </p>
          </div>
        </div>

        {/* Center: Live Clock */}
        <div className="hidden md:flex items-center gap-4">
          <LiveClock />
          <div className="h-4 w-px bg-zinc-800"></div>
          <div className="flex items-center p-1 bg-zinc-950/80 rounded-lg border border-zinc-800/70">
            <div className="px-3 py-1 text-[10px] font-medium rounded-md text-cyan-300 border border-cyan-800/40 bg-cyan-900/10 font-mono">
              {roleUI}
            </div>
            <button 
              onClick={() => { setToken(null); setUser(null); }}
              className="ml-2 px-3 py-1 text-[10px] text-red-400 hover:bg-red-900/30 rounded transition-all cursor-pointer"
            >
              Logout
            </button>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {/* Notification Bell */}
          <button className="relative p-2 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-cyan-500 rounded-full shadow-[0_0_6px_rgba(6,182,212,0.8)]"></span>
          </button>

          <div className="flex flex-col items-end">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                {socketStatus === 'active' && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                <span className={`relative inline-flex rounded-full h-2 w-2 ${socketDotClass}`}></span>
              </span>
              <span className={`text-[10px] font-mono ${
                socketStatus === 'active' ? 'text-emerald-400' : socketStatus === 'connecting' ? 'text-amber-400' : 'text-red-400'
              }`}>{socketStatusLabel}</span>
            </div>
            <span className="text-[9px] text-zinc-600">{dbStatusLabel}</span>
          </div>
          <div className="h-8 w-px bg-zinc-800"></div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs font-medium">{user.name}</p>
              <p className="text-[10px] text-zinc-500">{roleUI}</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-700 to-cyan-900 border border-cyan-700/50 flex items-center justify-center text-xs font-bold uppercase text-cyan-200 shadow-lg shadow-cyan-900/20">
              {user.name.substring(0,2)}
            </div>
          </div>
        </div>
      </motion.header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Navigation */}
        <motion.nav 
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="w-16 border-r border-zinc-800/50 flex flex-col items-center py-6 gap-3 bg-zinc-950/80"
        >
          <SidebarItem icon={LayoutDashboard} label="Dashboard" active={activeNav === 'dashboard'} onClick={() => setActiveNav('dashboard')} />
          <SidebarItem icon={Users} label="Visitors" active={activeNav === 'visitors'} onClick={() => setActiveNav('visitors')} />
          <SidebarItem icon={ArrowRightLeft} label="Transfers" active={activeNav === 'transfers'} onClick={() => setActiveNav('transfers')} />
          <SidebarItem icon={BarChart2} label="Analytics" active={activeNav === 'analytics'} onClick={() => setActiveNav('analytics')} />
          <div className="mt-auto">
            <SidebarItem icon={Settings} label="Settings" active={activeNav === 'settings'} onClick={() => setActiveNav('settings')} />
          </div>
        </motion.nav>

        {/* Main Content — routed by roleUI */}
        {roleUI === 'Main Admin' ? (
           <AdminDashboard token={token} />
        ) : roleUI === 'Volunteer' ? (
           <VolunteerDashboard token={token} user={user} />
        ) : roleUI === 'Receptionist' ? (
        <main className="flex-1 p-6 grid grid-cols-1 md:grid-cols-12 grid-rows-6 gap-6 overflow-y-auto">
          {/* Stats Row */}
          <section className="col-span-12 row-span-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 min-h-[100px]">
            {[
              { label: 'Total Visitors Today', value: totalCount.toLocaleString(), change: '+12%', changeColor: 'text-emerald-400', glow: 'glow-cyan-hover', delay: 'delay-1' },
              { label: 'Active Counselors', value: counselorCount.toString(), sub: '/ 50 total', glow: 'glow-emerald-hover', delay: 'delay-2' },
              { label: 'AI Routing Accuracy', value: '98.4%', sub: 'RF Model', valueColor: 'text-cyan-400', glow: 'glow-cyan-hover', delay: 'delay-3' },
              { label: 'Avg. Response Time', value: '3m 12s', change: '-22s', changeColor: 'text-blue-400', glow: 'glow-violet-hover', delay: 'delay-4' },
            ].map((stat, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08, duration: 0.4 }}
                className={`bg-zinc-900/80 border border-zinc-800/70 rounded-xl p-4 flex flex-col justify-center card-hover ${stat.glow} backdrop-blur-sm`}
              >
                <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest">
                  {stat.label}
                </p>
                <p className={`text-3xl font-light mt-1 ${stat.valueColor || 'text-white'}`}>
                  {stat.value}
                  {stat.change && <span className={`${stat.changeColor} text-sm font-medium ml-2`}>{stat.change}</span>}
                  {stat.sub && <span className="text-zinc-600 text-xs italic ml-2">{stat.sub}</span>}
                </p>
              </motion.div>
            ))}
          </section>

          {/* God-View Live Monitor */}
          <motion.section 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="col-span-12 lg:col-span-8 row-span-5 bg-zinc-900/60 border border-zinc-800/60 rounded-xl overflow-hidden flex flex-col min-h-[500px] backdrop-blur-sm"
          >
            <div className="px-5 py-4 border-b border-zinc-800/50 flex justify-between items-center bg-zinc-900/40">
              <h2 className="font-semibold text-sm flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-cyan-400" />
                LIVE ENGAGEMENT MONITOR
                <span className="ml-2 px-2 py-0.5 bg-cyan-900/20 border border-cyan-800/30 rounded-full text-[9px] text-cyan-400 font-mono">
                  {queue.length} ACTIVE
                </span>
              </h2>
              <div className="flex gap-2">
                <button 
                  onClick={() => setIntakeOpen(true)}
                  className="px-3 py-1.5 bg-emerald-900/30 border border-emerald-800/50 rounded-lg text-[10px] text-emerald-400 cursor-pointer hover:bg-emerald-900/50 transition-all flex items-center gap-1.5 font-semibold tracking-wider"
                >
                  <UserPlus className="w-3 h-3" />
                  NEW VISITOR
                </button>
                <div className="px-3 py-1.5 bg-zinc-800/50 border border-zinc-700/50 rounded-lg text-[10px] text-zinc-300 cursor-pointer hover:bg-zinc-700/50 transition-all">
                  ALL ZONES
                </div>
                <div className="px-3 py-1.5 bg-cyan-900/20 border border-cyan-800/40 rounded-lg text-[10px] text-cyan-400 cursor-pointer hover:bg-cyan-900/40 transition-all flex items-center gap-1.5">
                  <Zap className="w-3 h-3" />
                  AI SORTING: ON
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="grid grid-cols-12 px-6 py-3 bg-zinc-950/40 text-[10px] font-bold text-zinc-500 border-b border-zinc-800/50 uppercase tracking-widest">
                <div className="col-span-3">Visitor Name</div>
                <div className="col-span-2 text-center">Region</div>
                <div className="col-span-2 text-center">Category</div>
                <div className="col-span-3">Assigned Counselor</div>
                <div className="col-span-2 text-right">Status</div>
              </div>
              <div className="flex-1 flex flex-col overflow-y-auto w-full scrollbar-none">
                {loading && queue.length === 0 ? (
                  <QueueSkeleton />
                ) : queue.length === 0 ? (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex-1 flex flex-col items-center justify-center p-10"
                  >
                    <div className="w-16 h-16 rounded-2xl bg-zinc-800/50 flex items-center justify-center mb-4 border border-zinc-700/30">
                      <Inbox className="w-8 h-8 text-zinc-600" />
                    </div>
                    <p className="text-zinc-400 font-medium">No active engagements</p>
                    <p className="text-zinc-600 text-sm mt-1">Queue is empty — visitors will appear here in real-time</p>
                  </motion.div>
                ) : (
                  <AnimatePresence initial={false}>
                    {queue.map((visit, index) => {
                      // Extract initials
                      const initials = visit.visitor?.name
                        ? visit.visitor.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()
                        : '??';

                      return (
                        <motion.div 
                          key={visit.visitId} 
                          initial={{ opacity: 0, x: -20, height: 0 }}
                          animate={{ opacity: 1, x: 0, height: 'auto' }}
                          exit={{ opacity: 0, x: 20, height: 0 }}
                          transition={{ duration: 0.3 }}
                          className="grid grid-cols-12 px-6 py-4 items-center row-glow border-b border-zinc-800/30 group"
                        >
                          <div className="col-span-3 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-zinc-700 to-zinc-800 text-zinc-300 flex items-center justify-center font-bold text-[10px] border border-zinc-600/50 group-hover:border-cyan-700/50 transition-colors">
                              {initials}
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-zinc-200">{visit.visitor?.name}</p>
                              <div className="flex items-center gap-2">
                                <p className="text-[10px] text-zinc-500 font-mono">#{visit.visitor?.phone}</p>
                                {visit.checkInTime && <TimeElapsed since={visit.checkInTime} />}
                              </div>
                            </div>
                          </div>
                          <div className="col-span-2 text-center text-xs text-zinc-400">{visit.visitor?.region || 'Unknown'}</div>
                          <div className="col-span-2 text-center">
                            <span className="px-2.5 py-0.5 bg-zinc-800/70 rounded-full text-[9px] text-zinc-400 border border-zinc-700/50">
                              {visit.purpose}
                            </span>
                          </div>
                          <div className="col-span-3 flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.6)]"></div>
                            <p className="text-xs text-zinc-300">Pending Assignment</p>
                          </div>
                          <div className="col-span-2 text-right">
                            <span className="px-2.5 py-0.5 bg-amber-900/30 text-amber-300 text-[9px] rounded-md font-bold border border-amber-800/40">
                              {visit.status}
                            </span>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                )}
              </div>
              <div className="px-6 py-3 border-t border-zinc-800/50 bg-zinc-950/40 flex justify-center">
                <span className="text-[10px] text-zinc-600 font-mono tracking-tighter uppercase cursor-pointer hover:text-zinc-400 transition-colors">
                  Load More History • {queue.length > 0 ? `${queue.length} sessions in queue` : 'No sessions cached'}
                </span>
              </div>
            </div>
          </motion.section>

          {/* AI Intelligence Sidebar Content */}
          <motion.section 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="col-span-12 lg:col-span-4 row-span-5 flex flex-col gap-5 min-h-[500px]"
          >
            {/* AI Routing Card */}
            <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-5 flex flex-col gap-4 relative overflow-hidden flex-shrink-0 backdrop-blur-sm card-hover">
              <div className="absolute top-0 right-0 p-3 opacity-10 text-cyan-400">
                <Zap className="w-12 h-12" />
              </div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-cyan-400 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(6,182,212,0.8)]"></div>
                AI Strategy Optimizer
              </h3>

              <div className="space-y-4 relative z-10">
                <div className="p-3 bg-zinc-950/60 rounded-lg border border-zinc-800/50">
                  <p className="text-[10px] text-zinc-500 mb-1">Active Model</p>
                  <p className="text-xs font-medium">Random Forest Classification v2.4.1</p>
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] text-zinc-500">Routing Suggestions for Sarah Tan</p>
                  <div className="p-3 bg-cyan-900/10 border border-cyan-500/20 rounded-lg">
                    <div className="flex justify-between mb-1.5">
                      <span className="text-xs text-white">Business / Career Growth</span>
                      <span className="text-xs text-cyan-400 font-bold font-mono">94.2%</span>
                    </div>
                    <div className="w-full bg-zinc-800/70 h-1.5 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: '94%' }}
                        transition={{ delay: 0.8, duration: 1, ease: 'easeOut' }}
                        className="bg-gradient-to-r from-cyan-600 to-cyan-400 h-full rounded-full shadow-[0_0_8px_rgba(6,182,212,0.4)]"
                      ></motion.div>
                    </div>
                  </div>
                  <div className="p-3 bg-zinc-800/20 border border-zinc-700/30 rounded-lg">
                    <div className="flex justify-between mb-1.5">
                      <span className="text-xs text-zinc-400">Family Restoration</span>
                      <span className="text-xs text-zinc-500 font-mono">5.1%</span>
                    </div>
                    <div className="w-full bg-zinc-800/70 h-1.5 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: '5%' }}
                        transition={{ delay: 1, duration: 0.8, ease: 'easeOut' }}
                        className="bg-zinc-600 h-full rounded-full"
                      ></motion.div>
                    </div>
                  </div>
                </div>

                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-2.5 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-black text-xs font-bold rounded-xl transition-all uppercase tracking-wider cursor-pointer shadow-lg shadow-cyan-900/20"
                >
                  Execute Routing Strategy
                </motion.button>
              </div>
            </div>

            {/* Analytics Pulse */}
            <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-5 flex-1 flex flex-col backdrop-blur-sm">
              <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-4 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-violet-400 shadow-[0_0_6px_rgba(139,92,246,0.6)]"></div>
                Demographic Heatmap
              </h3>
              <div className="flex-1 flex flex-col gap-4 justify-end">
                <div className="flex justify-between items-end gap-1.5 h-32">
                  {[40, 60, 95, 30, 55, 75, 100].map((h, i) => (
                    <motion.div 
                      key={i}
                      initial={{ height: 0 }}
                      animate={{ height: `${h}%` }}
                      transition={{ delay: 0.5 + i * 0.08, duration: 0.6, ease: 'easeOut' }}
                      className={`flex-1 rounded-t cursor-pointer transition-all ${
                        h === 100 
                          ? 'bg-gradient-to-t from-cyan-600 to-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.4)]' 
                          : 'bg-zinc-800 hover:bg-cyan-600/70'
                      }`}
                    ></motion.div>
                  ))}
                </div>
                <div className="flex justify-between text-[8px] text-zinc-500 font-bold uppercase">
                  <span>08:00</span>
                  <span>12:00</span>
                  <span className="text-cyan-400">NOW</span>
                </div>
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between p-2 rounded-lg hover:bg-zinc-800/30 transition-colors">
                    <span className="text-xs text-zinc-400">Regional Conversion</span>
                    <span className="text-xs text-emerald-400 font-mono font-bold">+14.8%</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg hover:bg-zinc-800/30 transition-colors">
                    <span className="text-xs text-zinc-400">Follow-up Efficiency</span>
                    <span className="text-xs text-white font-mono font-bold">92.1%</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.section>
        </main>
        ) : isCounselor(user.role) ? (
          /* ============== COUNSELOR VIEW ============== */
          /* Counselors see visits filtered to their room/plan.              */
          /* Legacy sub-roles (YP, Business) filter by their fixed room.    */
          /* Generic COUNSELOR uses the user's assignedRoom.                */
          <main className="flex-1 p-6 overflow-y-auto bg-zinc-950">
             <div className="max-w-6xl mx-auto flex flex-col gap-6">
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-between items-center"
                >
                  <div>
                    <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                      <Users className="w-5 h-5 text-cyan-500" />
                      {roleUI} Queue
                    </h2>
                    <p className="text-sm text-zinc-400 mt-0.5">Manage your assigned engagements</p>
                  </div>
                  <div className="px-4 py-2 bg-zinc-900/80 border border-zinc-800 rounded-lg text-xs font-mono text-cyan-400 flex items-center gap-2 backdrop-blur-sm">
                    <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse"></span>
                    {visibleCounselorQueue.length} WAITING
                  </div>
                </motion.div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  <AnimatePresence>
                    {visibleCounselorQueue.map((visit, index) => (
                        <motion.div 
                          key={visit.visitId} 
                          initial={{ opacity: 0, scale: 0.95, y: 15 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.9, y: -10 }}
                          transition={{ delay: index * 0.06, duration: 0.35 }}
                          className="glass-card p-5 flex flex-col gap-4 card-hover glow-cyan-hover group"
                        >
                           <div className="flex justify-between items-start">
                              <div className="flex gap-3">
                                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-zinc-700 to-zinc-800 text-zinc-300 flex items-center justify-center font-bold text-sm border border-zinc-600/50 group-hover:border-cyan-700/50 group-hover:from-cyan-900 group-hover:to-cyan-950 group-hover:text-cyan-300 transition-all">
                                   {visit.visitor?.name?.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() || '??'}
                                </div>
                                <div>
                                  <h3 className="font-semibold text-zinc-100 text-lg">{visit.visitor?.name}</h3>
                                  <div className="flex items-center gap-2">
                                    <p className="text-xs text-zinc-500 font-mono">#{visit.visitor?.phone}</p>
                                    {visit.checkInTime && <TimeElapsed since={visit.checkInTime} />}
                                  </div>
                                </div>
                              </div>
                              <span className="px-2 py-1 bg-amber-900/30 text-amber-300 text-[10px] rounded-lg font-bold border border-amber-800/40 uppercase">
                                {visit.status}
                              </span>
                           </div>
                           <div className="space-y-3">
                              <div>
                                 <p className="text-[10px] uppercase text-zinc-500 font-bold tracking-wider mb-1">Purpose</p>
                                 <p className="text-sm text-zinc-300">{visit.purpose}</p>
                              </div>
                              {visit.prayerRequest && (
                                <div className="p-3 bg-zinc-950/50 rounded-xl border border-zinc-800/50">
                                   <p className="text-[10px] uppercase text-cyan-500/70 font-bold tracking-wider mb-1">Prayer Request</p>
                                   <p className="text-sm text-zinc-300 italic">"{visit.prayerRequest}"</p>
                                </div>
                              )}
                           </div>
                           <div className="mt-auto pt-4 border-t border-zinc-800/50">
                              <motion.button 
                                onClick={() => handleCompleteVisit(visit.visitId)}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.97 }}
                                className="w-full py-2.5 bg-emerald-900/30 hover:bg-emerald-800/50 text-emerald-400 text-sm font-bold rounded-xl transition-all border border-emerald-800/40 flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-900/10"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                                MARK COMPLETED
                              </motion.button>
                           </div>
                        </motion.div>
                    ))}
                  </AnimatePresence>
                  
                  {visibleCounselorQueue.length === 0 && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.2 }}
                      className="col-span-full py-20 flex flex-col items-center justify-center border-2 border-dashed border-zinc-800/40 rounded-2xl"
                    >
                       <div className="w-16 h-16 rounded-2xl bg-zinc-900/50 flex items-center justify-center mb-4 border border-zinc-800/50">
                         <Inbox className="w-8 h-8 text-zinc-700" />
                       </div>
                       <p className="text-zinc-400 font-medium text-lg text-center">No active visitors</p>
                       <p className="text-zinc-600 text-sm text-center mt-1">Your queue is completely clear.</p>
                    </motion.div>
                  )}
                </div>
             </div>
          </main>
        ) : null}
      </div>

      {/* Bottom Status Bar */}
      <footer className="h-8 border-t border-zinc-800/50 bg-zinc-950/80 backdrop-blur-md px-6 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
            <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold">
              System Core: Stable
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${dbStatusDotClass}`}></div>
            <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold">
              {dbStatusLabel}
            </span>
          </div>
        </div>
        <div className="text-[9px] text-zinc-600 font-mono tracking-wider hidden sm:block">
          BETHESDA ENGAGEMENT v4.0.2-ENTERPRISE • © 2026 Bethesda Global
        </div>
      </footer>

      {/* Visitor Intake Modal */}
      <VisitorIntakeModal 
        isOpen={intakeOpen} 
        onClose={() => setIntakeOpen(false)} 
        onSubmit={handleAddVisitor} 
      />
    </div>
  );
}
