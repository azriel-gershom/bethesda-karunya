import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { API_URL } from '../config/api';
import { motion } from 'motion/react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { Users, Activity, CheckCircle, Clock, RefreshCw, TrendingUp, Heart, FileText, Shield } from 'lucide-react';
import ManageUsersPanel from './admin/ManageUsersPanel';
import PrayerRequestsPanel from './admin/PrayerRequestsPanel';
import ReportsPanel from './admin/ReportsPanel';

const COLORS = ['#06b6d4', '#0ea5e9', '#3b82f6', '#8b5cf6', '#a855f7'];

// --- Animated Counter Hook ---
function useAnimatedCounter(target: number, duration: number = 1200) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (target === 0) { setCount(0); return; }
    const startTime = performance.now();
    const step = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration]);
  return count;
}

// --- KPI Card ---
function KPICard({ icon: Icon, label, value, color, glowClass, index }: { 
  icon: any; label: string; value: string | number; color: string; glowClass: string; index: number 
}) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.4 }}
      className={`bg-zinc-900/70 border border-zinc-800/60 rounded-xl p-5 flex flex-col gap-2 relative overflow-hidden group hover:${glowClass} transition-all card-hover backdrop-blur-sm`}
    >
      <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-15 transition-opacity duration-500">
        <Icon className={`w-20 h-20 ${color}`} />
      </div>
      <p className="text-[10px] uppercase text-zinc-500 font-bold tracking-wider">{label}</p>
      <h3 className={`text-4xl font-bold ${color} drop-shadow-[0_0_8px_rgba(0,0,0,0.3)]`}>{value}</h3>
      {/* Mini sparkline */}
      <div className="flex items-end gap-0.5 h-4 mt-1 opacity-30 group-hover:opacity-60 transition-opacity">
        {[3, 5, 4, 7, 6, 8, 5, 9, 7, 10, 8, 11].map((h, i) => (
          <div key={i} className={`flex-1 rounded-sm ${color.includes('cyan') ? 'bg-cyan-500' : color.includes('amber') ? 'bg-amber-400' : color.includes('emerald') ? 'bg-emerald-400' : 'bg-blue-400'}`} style={{ height: `${h * 10}%` }}></div>
        ))}
      </div>
    </motion.div>
  );
}

// --- Custom Tooltip ---
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card-sm p-3 shadow-xl">
      <p className="text-xs font-semibold text-zinc-200 mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-xs font-mono" style={{ color: entry.color || '#06b6d4' }}>
          {entry.name || 'Count'}: <span className="font-bold">{entry.value}</span>
        </p>
      ))}
    </div>
  );
}

export default function AdminDashboard({ token }: { token: string }) {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'prayers' | 'reports'>('overview');

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_URL}/api/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const json = await res.json();
      if (json.success) {
        setStats(json.data);
      }
    } catch (err) {
      console.error("Failed to fetch stats", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();

    const socket = io(API_URL);

    socket.on('VisitorAdded', () => {
      fetchStats();
    });

    socket.on('VisitorCompleted', () => {
      fetchStats();
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchStats();
  };

  if (loading || !stats) {
    return (
      <div className="flex-1 p-6 flex items-center justify-center bg-zinc-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-cyan-950/30 border border-cyan-800/30 flex items-center justify-center">
            <Activity className="w-6 h-6 text-cyan-500 animate-pulse" />
          </div>
          <div className="text-zinc-500 font-mono text-sm flex items-center gap-2">
             INITIALIZING COMMAND CENTER...
          </div>
          {/* Shimmer skeleton preview */}
          <div className="grid grid-cols-4 gap-4 w-full max-w-4xl mt-8">
            {[1,2,3,4].map(i => (
              <div key={i} className="h-28 shimmer rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const { metrics, regionStats, ageStats, planStats } = stats;
  
  const totalVisitors = useAnimatedCounter(metrics.totalVisitors);
  const activeWaiting = useAnimatedCounter(metrics.activeWaiting);
  const completedSessions = useAnimatedCounter(metrics.completedSessions);

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-zinc-950 flex flex-col gap-6">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-between items-end pb-4 border-b border-zinc-800/50"
      >
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Activity className="w-6 h-6 text-cyan-500" />
            Command Center
          </h2>
          <p className="text-sm text-zinc-400 mt-1">Real-time demographic and operational insights.</p>
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
          <div className="text-xs font-mono text-cyan-500 bg-cyan-950/20 px-3 py-1.5 rounded-xl border border-cyan-800/40 flex items-center gap-2 shadow-[0_0_10px_rgba(6,182,212,0.1)]">
            <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse"></span>
            LIVE DATA SYNC
          </div>
        </div>
      </motion.div>

      {/* Tab Navigation */}
      <div className="flex gap-1 p-1 bg-zinc-900/60 rounded-xl border border-zinc-800/50 w-fit">
        {[
          { key: 'overview' as const, label: 'Overview', icon: Activity },
          { key: 'users' as const, label: 'Manage Users', icon: Shield },
          { key: 'prayers' as const, label: 'Prayer Requests', icon: Heart },
          { key: 'reports' as const, label: 'Reports', icon: FileText },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === tab.key
                ? 'bg-cyan-900/30 text-cyan-400 border border-cyan-800/40 shadow-[0_0_10px_rgba(6,182,212,0.1)]'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 border border-transparent'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'users' ? (
        <ManageUsersPanel token={token} />
      ) : activeTab === 'prayers' ? (
        <PrayerRequestsPanel token={token} />
      ) : activeTab === 'reports' ? (
        <ReportsPanel token={token} />
      ) : (
      <>

      {/* Top Row: KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <KPICard icon={Users} label="Total Visitors" value={totalVisitors} color="text-cyan-400" glowClass="glow-cyan" index={0} />
        <KPICard icon={Activity} label="Active Queue" value={activeWaiting} color="text-amber-300" glowClass="glow-amber" index={1} />
        <KPICard icon={CheckCircle} label="Completed Sessions" value={completedSessions} color="text-emerald-400" glowClass="glow-emerald" index={2} />
        <KPICard icon={Clock} label="Avg Wait Time" value={metrics.averageWaitTime} color="text-blue-400" glowClass="glow-violet" index={3} />
      </div>

      {/* Middle Row: Demographics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="bg-zinc-900/70 border border-zinc-800/60 rounded-xl p-6 backdrop-blur-sm"
        >
          <h3 className="text-sm font-semibold text-zinc-300 mb-6 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-cyan-500" />
            Regional Breakdown
          </h3>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={regionStats} layout="vertical" margin={{ top: 0, right: 0, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#27272a" />
                <XAxis type="number" fontSize={10} tickLine={false} axisLine={false} stroke="#71717a" />
                <YAxis dataKey="name" type="category" fontSize={11} tickLine={false} axisLine={false} stroke="#a1a1aa" width={80} />
                <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(6, 182, 212, 0.03)'}} />
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#0891b2" />
                    <stop offset="100%" stopColor="#06b6d4" />
                  </linearGradient>
                </defs>
                <Bar dataKey="value" fill="url(#barGradient)" radius={[0, 6, 6, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="bg-zinc-900/70 border border-zinc-800/60 rounded-xl p-6 backdrop-blur-sm"
        >
          <h3 className="text-sm font-semibold text-zinc-300 mb-6 flex items-center gap-2">
            <Users className="w-4 h-4 text-violet-400" />
            Age Demographics
          </h3>
          <div className="h-[250px] w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={ageStats}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {ageStats.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px', color: '#a1a1aa' }}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Bottom Row: Plan Distribution */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.5 }}
        className="bg-zinc-900/70 border border-zinc-800/60 rounded-xl p-6 backdrop-blur-sm"
      >
        <h3 className="text-sm font-semibold text-zinc-300 mb-6 flex items-center gap-2">
          <BarChart className="w-4 h-4 text-violet-400" />
          Assigned Plan Distribution
        </h3>
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={planStats} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
              <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} stroke="#a1a1aa" />
              <YAxis fontSize={10} tickLine={false} axisLine={false} stroke="#71717a" />
              <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(139, 92, 246, 0.03)'}} />
              <defs>
                <linearGradient id="planGradient1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" />
                  <stop offset="100%" stopColor="#6d28d9" />
                </linearGradient>
                <linearGradient id="planGradient2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a855f7" />
                  <stop offset="100%" stopColor="#7c3aed" />
                </linearGradient>
              </defs>
              <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={40}>
                {planStats.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={index % 2 === 0 ? 'url(#planGradient1)' : 'url(#planGradient2)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>
      </>
      )}
    </div>
  );
}
