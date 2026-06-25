import React, { useEffect, useState } from 'react';
import { API_URL } from '../../config/api';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users, UserPlus, Trash2, Edit3, Shield, X, Save, Eye, EyeOff, Loader2
} from 'lucide-react';
import { ALL_ROLES, ROLE_META, type Role } from '../../shared/roles';

// Use ALL_ROLES from the shared roles file — single source of truth.
const ROLES = [...ALL_ROLES];
const CATEGORIES = ['Prayer', 'Counseling', 'Fellowship', 'First Visit', 'Follow-up', 'Business Consultation'];

interface UserRow {
  id: number;
  name: string;
  email: string;
  role: string;
  assignedRoom: string | null;
  createdAt: string;
}

export default function ManageUsersPanel({ token }: { token: string }) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Create form state
  const [createForm, setCreateForm] = useState({
    name: '', email: '', password: '', role: 'RECEPTIONIST', assignedRoom: '',
    languages: [] as string[], categories: [] as string[],
  });
  const [showPassword, setShowPassword] = useState(false);

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_URL}/api/users`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success) setUsers(json.data);
    } catch (err) {
      console.error('Failed to fetch users', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleCreate = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(createForm),
      });
      const json = await res.json();
      if (json.success) {
        await fetchUsers();
        setShowCreateModal(false);
        setCreateForm({ name: '', email: '', password: '', role: 'RECEPTIONIST', assignedRoom: '', languages: [], categories: [] });
      }
    } catch (err) {
      console.error('Failed to create user', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingUser) return;
    setActionLoading(true);
    try {
      await fetch(`${API_URL}/api/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name: editingUser.name, email: editingUser.email, role: editingUser.role, assignedRoom: editingUser.assignedRoom }),
      });
      await fetchUsers();
      setEditingUser(null);
    } catch (err) {
      console.error('Failed to update user', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      await fetch(`${API_URL}/api/users/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      await fetchUsers();
    } catch (err) {
      console.error('Failed to delete user', err);
    }
  };

  const roleBadgeColor = (role: string) => {
    switch (role) {
      case 'ADMIN': return 'bg-red-900/30 text-red-400 border-red-800/40';
      case 'EMPLOYEE': return 'bg-sky-900/30 text-sky-400 border-sky-800/40';
      case 'RECEPTIONIST': return 'bg-blue-900/30 text-blue-400 border-blue-800/40';
      case 'COUNSELOR': return 'bg-violet-900/30 text-violet-400 border-violet-800/40';
      case 'COUNSELOR_YOUNG_PARTNER': return 'bg-violet-900/30 text-violet-400 border-violet-800/40';
      case 'COUNSELOR_BUSINESS': return 'bg-amber-900/30 text-amber-400 border-amber-800/40';
      case 'VOLUNTEER': return 'bg-emerald-900/30 text-emerald-400 border-emerald-800/40';
      default: return 'bg-zinc-800/50 text-zinc-400 border-zinc-700/40';
    }
  };

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
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-cyan-500" /> Manage Users
          </h3>
          <p className="text-sm text-zinc-500 mt-0.5">{users.length} total users in the system</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-black text-sm font-bold rounded-xl flex items-center gap-2 cursor-pointer shadow-lg shadow-cyan-900/20"
        >
          <UserPlus className="w-4 h-4" /> New User
        </motion.button>
      </div>

      {/* Users Table */}
      <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-xl overflow-hidden">
        <div className="grid grid-cols-12 px-5 py-3 bg-zinc-950/40 text-[10px] font-bold text-zinc-500 border-b border-zinc-800/50 uppercase tracking-widest">
          <div className="col-span-3">Name</div>
          <div className="col-span-2">Username</div>
          <div className="col-span-2 text-center">Role</div>
          <div className="col-span-2 text-center">Room</div>
          <div className="col-span-1 text-center">Created</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>
        <AnimatePresence>
          {users.map((u, i) => (
            <motion.div
              key={u.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.03 }}
              className="grid grid-cols-12 px-5 py-3.5 items-center border-b border-zinc-800/30 row-glow group"
            >
              <div className="col-span-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-300 border border-zinc-600/50">
                  {u.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                </div>
                <span className="text-sm text-zinc-200 font-medium">{u.name}</span>
              </div>
              <div className="col-span-2 text-sm text-zinc-400 font-mono">{u.email}</div>
              <div className="col-span-2 text-center">
                <span className={`px-2 py-0.5 text-[9px] rounded-md font-bold border ${roleBadgeColor(u.role)}`}>
                  {u.role}
                </span>
              </div>
              <div className="col-span-2 text-center text-sm text-zinc-500">{u.assignedRoom || '—'}</div>
              <div className="col-span-1 text-center text-xs text-zinc-600 font-mono">
                {new Date(u.createdAt).toLocaleDateString()}
              </div>
              <div className="col-span-2 flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => setEditingUser({ ...u })}
                  className="p-1.5 rounded-lg bg-zinc-800/50 hover:bg-cyan-900/30 text-zinc-500 hover:text-cyan-400 transition-all cursor-pointer border border-zinc-700/50 hover:border-cyan-800/50"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(u.id)}
                  className="p-1.5 rounded-lg bg-zinc-800/50 hover:bg-red-900/30 text-zinc-500 hover:text-red-400 transition-all cursor-pointer border border-zinc-700/50 hover:border-red-800/50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Create User Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-lg glass-card gradient-border p-6 space-y-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-white text-lg flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-cyan-500" /> Create New User
                </h3>
                <button onClick={() => setShowCreateModal(false)} className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase text-zinc-500 tracking-[0.15em]">Full Name *</label>
                  <input
                    value={createForm.name}
                    onChange={(e) => setCreateForm(p => ({ ...p, name: e.target.value }))}
                    className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600/50 transition-all hover:border-zinc-700 placeholder:text-zinc-600"
                    placeholder="John Doe"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase text-zinc-500 tracking-[0.15em]">Username/Email *</label>
                  <input
                    value={createForm.email}
                    onChange={(e) => setCreateForm(p => ({ ...p, email: e.target.value }))}
                    className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600/50 transition-all hover:border-zinc-700 placeholder:text-zinc-600 font-mono"
                    placeholder="username"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase text-zinc-500 tracking-[0.15em]">Password *</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={createForm.password}
                      onChange={(e) => setCreateForm(p => ({ ...p, password: e.target.value }))}
                      className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-4 py-2.5 pr-10 text-sm text-zinc-200 focus:outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600/50 transition-all hover:border-zinc-700 placeholder:text-zinc-600 font-mono"
                      placeholder="••••••"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-600 hover:text-zinc-400 cursor-pointer">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase text-zinc-500 tracking-[0.15em]">Role *</label>
                  <select
                    value={createForm.role}
                    onChange={(e) => setCreateForm(p => ({ ...p, role: e.target.value }))}
                    className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600/50 transition-all hover:border-zinc-700 cursor-pointer appearance-none"
                  >
                    {ROLES.map(r => <option key={r} value={r} className="bg-zinc-900">{r}</option>)}
                  </select>
                </div>
              </div>

              {createForm.role === 'VOLUNTEER' && (
                <div className="space-y-1.5 p-3 bg-emerald-950/10 border border-emerald-800/30 rounded-xl">
                  <p className="text-[10px] font-bold uppercase text-emerald-500 tracking-wider">Volunteer Profile</p>
                  <p className="text-xs text-zinc-500">Languages and categories can be updated later by the volunteer.</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 bg-zinc-800/50 hover:bg-zinc-800 text-zinc-400 text-sm font-medium rounded-xl border border-zinc-700/50 cursor-pointer"
                >
                  Cancel
                </button>
                <motion.button
                  onClick={handleCreate}
                  disabled={actionLoading || !createForm.name || !createForm.email || !createForm.password}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex-[2] py-2.5 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-black text-sm font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-cyan-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  CREATE USER
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit User Modal */}
      <AnimatePresence>
        {editingUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop"
            onClick={() => setEditingUser(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-lg glass-card gradient-border p-6 space-y-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-white text-lg flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-cyan-500" /> Edit User
                </h3>
                <button onClick={() => setEditingUser(null)} className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase text-zinc-500 tracking-[0.15em]">Full Name</label>
                  <input
                    value={editingUser.name}
                    onChange={(e) => setEditingUser(p => p ? { ...p, name: e.target.value } : p)}
                    className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600/50 transition-all hover:border-zinc-700"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase text-zinc-500 tracking-[0.15em]">Role</label>
                  <select
                    value={editingUser.role}
                    onChange={(e) => setEditingUser(p => p ? { ...p, role: e.target.value } : p)}
                    className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600/50 transition-all hover:border-zinc-700 cursor-pointer appearance-none"
                  >
                    {ROLES.map(r => <option key={r} value={r} className="bg-zinc-900">{r}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setEditingUser(null)} className="flex-1 py-2.5 bg-zinc-800/50 hover:bg-zinc-800 text-zinc-400 text-sm font-medium rounded-xl border border-zinc-700/50 cursor-pointer">
                  Cancel
                </button>
                <motion.button
                  onClick={handleUpdate}
                  disabled={actionLoading}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex-[2] py-2.5 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-black text-sm font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-cyan-900/20 disabled:opacity-50"
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  SAVE CHANGES
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
