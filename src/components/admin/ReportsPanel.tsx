import React, { useEffect, useRef, useState } from 'react';
import { API_URL } from '../../config/api';
import { motion } from 'motion/react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell
} from 'recharts';
import {
  FileText, Users, HandHeart, CheckCircle, Activity, TrendingUp, Loader2, Clock
} from 'lucide-react';

const COLORS = ['#06b6d4', '#0ea5e9', '#3b82f6', '#8b5cf6', '#a855f7', '#ec4899', '#f43f5e'];

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card-sm p-3 shadow-xl">
      <p className="text-xs font-semibold text-zinc-200 mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-xs font-mono" style={{ color: entry.color || '#06b6d4' }}>
          Count: <span className="font-bold">{entry.value}</span>
        </p>
      ))}
    </div>
  );
}

function ChartFrame({
  children,
}: {
  children: (size: { width: number; height: number }) => React.ReactNode;
}) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    let frameId = 0;
    const updateSize = () => {
      const rect = frameRef.current?.getBoundingClientRect();
      if (!rect) return;

      const nextSize = {
        width: Math.floor(rect.width),
        height: Math.floor(rect.height),
      };

      if (nextSize.width <= 0 || nextSize.height <= 0) return;

      setSize((current) =>
        current.width === nextSize.width && current.height === nextSize.height
          ? current
          : nextSize
      );
    };

    frameId = requestAnimationFrame(updateSize);
    const resizeObserver = new ResizeObserver(updateSize);
    if (frameRef.current) resizeObserver.observe(frameRef.current);

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div ref={frameRef} className="h-[250px] min-h-[250px] w-full min-w-0">
      {size.width > 0 && size.height > 0 ? (
        children(size)
      ) : (
        <div className="h-full w-full shimmer rounded-xl opacity-30" />
      )}
    </div>
  );
}

interface ReportData {
  summary: {
    totalVisitors: number;
    totalVisits: number;
    completedVisits: number;
    totalVolunteers: number;
    activeVolunteers: number;
    totalAssignments: number;
    completedAssignments: number;
  };
  purposeDistribution: { name: string; value: number }[];
  recentVisits: {
    visitId: number;
    purpose: string;
    status: string;
    checkInTime: string;
    completionTime: string | null;
    visitorName: string;
    visitorRegion: string | null;
  }[];
}

export default function ReportsPanel({ token }: { token: string }) {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const res = await fetch(`${API_URL}/api/reports`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        const json = await res.json();
        if (json.success) setData(json.data);
      } catch (err) {
        console.error('Failed to fetch reports', err);
      } finally {
        setLoading(false);
      }
    };
    fetchReports();
  }, []);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-cyan-500 animate-spin" />
      </div>
    );
  }

  const { summary, purposeDistribution, recentVisits } = data;

  const kpis = [
    { label: 'Total Visitors', value: summary.totalVisitors, icon: Users, color: 'text-cyan-400' },
    { label: 'Total Visits', value: summary.totalVisits, icon: Activity, color: 'text-blue-400' },
    { label: 'Completed', value: summary.completedVisits, icon: CheckCircle, color: 'text-emerald-400' },
    { label: 'Volunteers', value: summary.totalVolunteers, icon: HandHeart, color: 'text-violet-400' },
    { label: 'Active Volunteers', value: summary.activeVolunteers, icon: TrendingUp, color: 'text-amber-400' },
    { label: 'Assignments', value: summary.totalAssignments, icon: FileText, color: 'text-rose-400' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <FileText className="w-5 h-5 text-violet-400" /> Reports & Analytics
        </h3>
        <p className="text-sm text-zinc-500 mt-0.5">Comprehensive operational overview</p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpis.map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-zinc-900/70 border border-zinc-800/60 rounded-xl p-4 text-center group card-hover"
          >
            <kpi.icon className={`w-5 h-5 mx-auto mb-2 ${kpi.color} opacity-60 group-hover:opacity-100 transition-opacity`} />
            <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
            <p className="text-[9px] uppercase text-zinc-500 font-bold tracking-wider mt-1">{kpi.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Purpose Distribution Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-zinc-900/70 border border-zinc-800/60 rounded-xl p-6 backdrop-blur-sm"
      >
        <h4 className="text-sm font-semibold text-zinc-300 mb-6 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-cyan-500" />
          Visit Purpose Distribution
        </h4>
        <div className="h-[250px] w-full">
          {purposeDistribution.length > 0 ? (
            <ChartFrame>
              {({ width, height }) => (
              <BarChart width={width} height={height} data={purposeDistribution} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} stroke="#a1a1aa" />
                <YAxis fontSize={10} tickLine={false} axisLine={false} stroke="#71717a" />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(6, 182, 212, 0.03)' }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={36}>
                  {purposeDistribution.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
              )}
            </ChartFrame>
          ) : (
            <div className="h-full flex items-center justify-center text-zinc-600 text-sm">No data yet</div>
          )}
        </div>
      </motion.div>

      {/* Recent Visits Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-zinc-900/60 border border-zinc-800/60 rounded-xl overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-zinc-800/50 bg-zinc-900/40">
          <h4 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-500" />
            Recent Visits
            <span className="ml-2 px-2 py-0.5 bg-zinc-800/50 rounded-full text-[9px] text-zinc-400 font-mono border border-zinc-700/40">
              Last {recentVisits.length}
            </span>
          </h4>
        </div>
        <div className="max-h-[400px] overflow-y-auto">
          <div className="grid grid-cols-12 px-5 py-2.5 bg-zinc-950/40 text-[10px] font-bold text-zinc-500 border-b border-zinc-800/50 uppercase tracking-widest sticky top-0">
            <div className="col-span-3">Visitor</div>
            <div className="col-span-2">Region</div>
            <div className="col-span-2 text-center">Purpose</div>
            <div className="col-span-2 text-center">Status</div>
            <div className="col-span-3 text-right">Check-in</div>
          </div>
          {recentVisits.map((visit) => (
            <div key={visit.visitId} className="grid grid-cols-12 px-5 py-3 items-center border-b border-zinc-800/30 text-sm row-glow">
              <div className="col-span-3 text-zinc-300 font-medium">{visit.visitorName}</div>
              <div className="col-span-2 text-zinc-500">{visit.visitorRegion || 'Unknown'}</div>
              <div className="col-span-2 text-center">
                <span className="px-2 py-0.5 bg-zinc-800/70 rounded-full text-[9px] text-zinc-400 border border-zinc-700/50">
                  {visit.purpose}
                </span>
              </div>
              <div className="col-span-2 text-center">
                <span className={`px-2 py-0.5 text-[9px] rounded-md font-bold border ${
                  visit.status === 'COMPLETED'
                    ? 'bg-emerald-900/30 text-emerald-300 border-emerald-800/40'
                    : visit.status === 'WAITING'
                    ? 'bg-amber-900/30 text-amber-300 border-amber-800/40'
                    : 'bg-cyan-900/30 text-cyan-300 border-cyan-800/40'
                }`}>
                  {visit.status}
                </span>
              </div>
              <div className="col-span-3 text-right text-zinc-500 text-xs font-mono">
                {new Date(visit.checkInTime).toLocaleDateString()} {new Date(visit.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
