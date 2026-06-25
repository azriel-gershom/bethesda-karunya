import React, { useEffect, useState } from 'react';
import { API_URL } from '../../config/api';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users, UserPlus, Trash2, Edit3, X, Eye, EyeOff, Loader2, CheckCircle2, Languages, Clock
} from 'lucide-react';

interface VolunteerRow {
  id: number;
  userId: number;
  name: string;
  email: string;
  phone: string | null;
  department: string | null;
  status: string;
  maxTasksPerDay: number;
  languages: string[];
  availability: any[];
  activeAssignmentCount: number;
}

export default function ManageVolunteersPanel({ token }: { token: string }) {
  const [volunteers, setVolunteers] = useState<VolunteerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingVolunteer, setEditingVolunteer] = useState<VolunteerRow | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [createForm, setCreateForm] = useState({
    name: '', email: '', password: '', phone: '', department: 'General',
    maxTasksPerDay: 5,
    languages: ''
  });

  const fetchVolunteers = async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/volunteers`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success) setVolunteers(json.data);
    } catch (err) {
      console.error('Failed to fetch volunteers', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchVolunteers(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const payload = {
        ...createForm,
        languages: createForm.languages.split(',').map(s => s.trim()).filter(Boolean)
      };
      const res = await fetch(`${API_URL}/api/admin/volunteers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.success) {
        await fetchVolunteers();
        setShowCreateModal(false);
        setCreateForm({ name: '', email: '', password: '', phone: '', department: 'General', maxTasksPerDay: 5, languages: '' });
      }
    } catch (err) {
      console.error('Failed to create volunteer', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVolunteer) return;
    setActionLoading(true);
    try {
      await fetch(`${API_URL}/api/admin/volunteers/${editingVolunteer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          name: editingVolunteer.name,
          email: editingVolunteer.email,
          phone: editingVolunteer.phone,
          department: editingVolunteer.department,
          status: editingVolunteer.status,
          maxTasksPerDay: editingVolunteer.maxTasksPerDay,
          languages: typeof editingVolunteer.languages === 'string' ? (editingVolunteer.languages as unknown as string).split(',').map(s => s.trim()).filter(Boolean) : editingVolunteer.languages
        }),
      });
      await fetchVolunteers();
      setEditingVolunteer(null);
    } catch (err) {
      console.error('Failed to update volunteer', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeactivate = async (id: number) => {
    if (!confirm('Are you sure you want to deactivate this volunteer?')) return;
    try {
      await fetch(`${API_URL}/api/admin/volunteers/${id}/deactivate`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      await fetchVolunteers();
    } catch (err) {
      console.error('Failed to deactivate volunteer', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-500" /> Manage Volunteers
          </h3>
          <p className="text-sm text-zinc-500 mt-0.5">{volunteers.length} registered volunteers</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-black text-sm font-bold rounded-xl flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-900/20"
        >
          <UserPlus className="w-4 h-4" /> New Volunteer
        </motion.button>
      </div>

      {/* Table */}
      <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-xl overflow-hidden">
        <div className="grid grid-cols-12 px-5 py-3 bg-zinc-950/40 text-[10px] font-bold text-zinc-500 border-b border-zinc-800/50 uppercase tracking-widest">
          <div className="col-span-3">Name / Email</div>
          <div className="col-span-2 text-center">Status</div>
          <div className="col-span-2 text-center">Workload</div>
          <div className="col-span-3 text-center">Languages</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>
        <AnimatePresence>
          {volunteers.map((v, i) => (
            <motion.div
              key={v.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.03 }}
              className="grid grid-cols-12 px-5 py-3.5 items-center border-b border-zinc-800/30 row-glow group"
            >
              <div className="col-span-3">
                <span className="text-sm text-zinc-200 font-medium block">{v.name}</span>
                <span className="text-[10px] text-zinc-500 font-mono">{v.email}</span>
              </div>
              <div className="col-span-2 text-center">
                <span className={`px-2 py-0.5 text-[9px] rounded-md font-bold border ${v.status === 'active' ? 'bg-emerald-900/30 text-emerald-400 border-emerald-800/40' : 'bg-red-900/30 text-red-400 border-red-800/40'}`}>
                  {v.status.toUpperCase()}
                </span>
              </div>
              <div className="col-span-2 text-center">
                <div className="flex flex-col items-center gap-1">
                  <span className="text-sm font-bold text-zinc-300">{v.activeAssignmentCount} / {v.maxTasksPerDay}</span>
                  <div className="w-full max-w-[60px] h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, (v.activeAssignmentCount / v.maxTasksPerDay) * 100)}%` }}></div>
                  </div>
                </div>
              </div>
              <div className="col-span-3 text-center flex flex-wrap justify-center gap-1">
                {v.languages && v.languages.length > 0 ? v.languages.map((l, idx) => (
                  <span key={idx} className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-[9px] text-zinc-400">{l}</span>
                )) : <span className="text-xs text-zinc-600">—</span>}
              </div>
              <div className="col-span-2 flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => setEditingVolunteer({ ...v })} className="p-1.5 rounded-lg bg-zinc-800/50 hover:bg-emerald-900/30 text-zinc-500 hover:text-emerald-400 transition-all cursor-pointer border border-zinc-700/50 hover:border-emerald-800/50">
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleDeactivate(v.id)} className="p-1.5 rounded-lg bg-zinc-800/50 hover:bg-red-900/30 text-zinc-500 hover:text-red-400 transition-all cursor-pointer border border-zinc-700/50 hover:border-red-800/50">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Create/Edit Modals (Simplified for brevity) */}
      <AnimatePresence>
        {(showCreateModal || editingVolunteer) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="w-full max-w-md glass-card p-6 relative">
              <button onClick={() => { setShowCreateModal(false); setEditingVolunteer(null); }} className="absolute top-4 right-4 text-zinc-500 hover:text-white cursor-pointer"><X className="w-5 h-5" /></button>
              <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                {editingVolunteer ? <Edit3 className="w-5 h-5 text-emerald-500" /> : <UserPlus className="w-5 h-5 text-emerald-500" />}
                {editingVolunteer ? 'Edit Volunteer' : 'New Volunteer'}
              </h3>
              <form onSubmit={editingVolunteer ? handleUpdate : handleCreate} className="space-y-4">
                <input type="text" placeholder="Full Name" required value={editingVolunteer ? editingVolunteer.name : createForm.name} onChange={e => editingVolunteer ? setEditingVolunteer({...editingVolunteer, name: e.target.value}) : setCreateForm({...createForm, name: e.target.value})} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 text-white" />
                <input type="email" placeholder="Email" required value={editingVolunteer ? editingVolunteer.email : createForm.email} onChange={e => editingVolunteer ? setEditingVolunteer({...editingVolunteer, email: e.target.value}) : setCreateForm({...createForm, email: e.target.value})} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 text-white" />
                {!editingVolunteer && (
                  <input type="password" placeholder="Password" required value={createForm.password} onChange={e => setCreateForm({...createForm, password: e.target.value})} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 text-white" />
                )}
                <div className="grid grid-cols-2 gap-4">
                  <input type="text" placeholder="Phone" value={editingVolunteer ? editingVolunteer.phone || '' : createForm.phone} onChange={e => editingVolunteer ? setEditingVolunteer({...editingVolunteer, phone: e.target.value}) : setCreateForm({...createForm, phone: e.target.value})} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 text-white" />
                  <input type="number" placeholder="Max Tasks/Day" required value={editingVolunteer ? editingVolunteer.maxTasksPerDay : createForm.maxTasksPerDay} onChange={e => editingVolunteer ? setEditingVolunteer({...editingVolunteer, maxTasksPerDay: parseInt(e.target.value)}) : setCreateForm({...createForm, maxTasksPerDay: parseInt(e.target.value)})} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 text-white" />
                </div>
                <input type="text" placeholder="Languages (comma separated)" value={editingVolunteer ? (editingVolunteer.languages as any) : createForm.languages} onChange={e => editingVolunteer ? setEditingVolunteer({...editingVolunteer, languages: e.target.value as any}) : setCreateForm({...createForm, languages: e.target.value})} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 text-white" />
                
                {editingVolunteer && (
                  <select value={editingVolunteer.status} onChange={e => setEditingVolunteer({...editingVolunteer, status: e.target.value})} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 text-white">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                )}

                <button type="submit" disabled={actionLoading} className="w-full py-3 mt-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2">
                  {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingVolunteer ? 'Save Changes' : 'Create Volunteer'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
