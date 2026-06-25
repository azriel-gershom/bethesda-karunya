import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, UserPlus, Phone, MapPin, Calendar, Heart, BookOpen, CheckCircle, Languages } from 'lucide-react';

interface VisitorIntakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: any) => Promise<VisitorIntakeResponse>;
}

interface VisitorIntakeResponse {
  assignmentStatus?: string;
  assignedVolunteer?: {
    volunteerId?: number;
  } | null;
}

const REGIONS = ['North America', 'South America', 'Europe', 'Africa', 'Asia', 'Middle East', 'Oceania', 'Other'];
const PURPOSES = ['Counseling', 'Prayer', 'Fellowship', 'First Visit', 'Follow-up', 'Business Consultation', 'Other'];
const PLANS = ['Young Partner Plan', 'Business Blessing'];
const LANGUAGES = ['Tamil', 'English', 'Hindi', 'Malayalam', 'Telugu', 'Kannada', 'Other'];

export default function VisitorIntakeModal({ isOpen, onClose, onSubmit }: VisitorIntakeModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    age: '',
    region: '',
    language: '',
    purpose: '',
    prayerRequest: '',
    assignedPlan: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [assignmentInfo, setAssignmentInfo] = useState<{ status: string, volunteerId?: number } | null>(null);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!formData.name.trim()) errs.name = 'Name is required';
    if (!formData.phone.trim()) errs.phone = 'Phone is required';
    if (!formData.purpose) errs.purpose = 'Purpose is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      const response = await onSubmit({
        ...formData,
        age: formData.age ? parseInt(formData.age, 10) : null,
      });
      setSuccess(true);
      if (response) {
        setAssignmentInfo({
          status: response.assignmentStatus || 'UNASSIGNED',
          volunteerId: response.assignedVolunteer?.volunteerId
        });
      }
      setTimeout(() => {
        setSuccess(false);
        setAssignmentInfo(null);
        setFormData({ name: '', phone: '', age: '', region: '', language: '', purpose: '', prayerRequest: '', assignedPlan: '' });
        onClose();
      }, 3500);
    } catch (err) {
      console.error('Intake error', err);
    } finally {
      setSubmitting(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-xl glass-card gradient-border p-0 relative overflow-hidden max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Success Overlay */}
            <AnimatePresence>
              {success && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-zinc-950/90 backdrop-blur-sm"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 12 }}
                  >
                    <div className="w-20 h-20 rounded-full bg-emerald-900/30 border-2 border-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-900/40">
                      <CheckCircle className="w-10 h-10 text-emerald-400" />
                    </div>
                  </motion.div>
                  <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="mt-4 text-emerald-400 font-semibold text-lg"
                  >
                    Visitor Checked In!
                  </motion.p>
                  {assignmentInfo && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                      className="mt-3 p-3 bg-zinc-900/80 border border-zinc-800 rounded-xl flex items-center justify-center min-w-[250px]"
                    >
                      <span className="text-xs uppercase font-bold tracking-wider text-zinc-400">Queue Status:</span>
                      <span className={`ml-2 px-2 py-0.5 rounded text-[10px] font-bold ${
                        assignmentInfo.status === 'ASSIGNED' 
                          ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-800/40' 
                          : 'bg-amber-900/30 text-amber-400 border border-amber-800/40'
                      }`}>
                        {assignmentInfo.status}
                      </span>
                      {assignmentInfo.volunteerId && (
                         <span className="ml-2 text-xs text-zinc-500 font-mono">Vol #{assignmentInfo.volunteerId}</span>
                      )}
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Header */}
            <div className="px-6 py-5 border-b border-zinc-800/50 flex items-center justify-between bg-zinc-900/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-xl flex items-center justify-center">
                  <UserPlus className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-lg tracking-tight">New Visitor Intake</h3>
                  <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">Reception Check-In Form</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
              {/* Name & Phone Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase text-zinc-500 tracking-[0.15em] flex items-center gap-1.5">
                    <UserPlus className="w-3 h-3" /> Full Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => updateField('name', e.target.value)}
                    className={`w-full bg-zinc-950/80 border ${errors.name ? 'border-red-600' : 'border-zinc-800'} rounded-xl px-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600/50 transition-all hover:border-zinc-700 placeholder:text-zinc-600`}
                    placeholder="John Doe"
                  />
                  {errors.name && <p className="text-[10px] text-red-400">{errors.name}</p>}
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase text-zinc-500 tracking-[0.15em] flex items-center gap-1.5">
                    <Phone className="w-3 h-3" /> Phone *
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => updateField('phone', e.target.value)}
                    className={`w-full bg-zinc-950/80 border ${errors.phone ? 'border-red-600' : 'border-zinc-800'} rounded-xl px-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600/50 transition-all hover:border-zinc-700 placeholder:text-zinc-600 font-mono`}
                    placeholder="+1 555-000-0000"
                  />
                  {errors.phone && <p className="text-[10px] text-red-400">{errors.phone}</p>}
                </div>
              </div>

              {/* Age & Region Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase text-zinc-500 tracking-[0.15em] flex items-center gap-1.5">
                    <Calendar className="w-3 h-3" /> Age
                  </label>
                  <input
                    type="number"
                    value={formData.age}
                    onChange={(e) => updateField('age', e.target.value)}
                    min="1"
                    max="120"
                    className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600/50 transition-all hover:border-zinc-700 placeholder:text-zinc-600 font-mono"
                    placeholder="28"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase text-zinc-500 tracking-[0.15em] flex items-center gap-1.5">
                    <MapPin className="w-3 h-3" /> Region
                  </label>
                  <select
                    value={formData.region}
                    onChange={(e) => updateField('region', e.target.value)}
                    className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600/50 transition-all hover:border-zinc-700 cursor-pointer appearance-none"
                  >
                    <option value="" className="bg-zinc-900">Select region</option>
                    {REGIONS.map(r => <option key={r} value={r} className="bg-zinc-900">{r}</option>)}
                  </select>
                </div>
              </div>

              {/* Language Row */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-zinc-500 tracking-[0.15em] flex items-center gap-1.5">
                  <Languages className="w-3 h-3" /> Preferred Language
                </label>
                <select
                  value={formData.language}
                  onChange={(e) => updateField('language', e.target.value)}
                  className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600/50 transition-all hover:border-zinc-700 cursor-pointer appearance-none"
                >
                  <option value="" className="bg-zinc-900">Select language</option>
                  {LANGUAGES.map(l => <option key={l} value={l} className="bg-zinc-900">{l}</option>)}
                </select>
              </div>

              {/* Purpose & Plan Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase text-zinc-500 tracking-[0.15em] flex items-center gap-1.5">
                    <BookOpen className="w-3 h-3" /> Purpose *
                  </label>
                  <select
                    value={formData.purpose}
                    onChange={(e) => updateField('purpose', e.target.value)}
                    className={`w-full bg-zinc-950/80 border ${errors.purpose ? 'border-red-600' : 'border-zinc-800'} rounded-xl px-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600/50 transition-all hover:border-zinc-700 cursor-pointer appearance-none`}
                  >
                    <option value="" className="bg-zinc-900">Select purpose</option>
                    {PURPOSES.map(p => <option key={p} value={p} className="bg-zinc-900">{p}</option>)}
                  </select>
                  {errors.purpose && <p className="text-[10px] text-red-400">{errors.purpose}</p>}
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase text-zinc-500 tracking-[0.15em] flex items-center gap-1.5">
                    <Heart className="w-3 h-3" /> Assigned Plan
                  </label>
                  <select
                    value={formData.assignedPlan}
                    onChange={(e) => updateField('assignedPlan', e.target.value)}
                    className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600/50 transition-all hover:border-zinc-700 cursor-pointer appearance-none"
                  >
                    <option value="" className="bg-zinc-900">Select plan</option>
                    {PLANS.map(p => <option key={p} value={p} className="bg-zinc-900">{p}</option>)}
                  </select>
                </div>
              </div>

              {/* Prayer Request */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-zinc-500 tracking-[0.15em] flex items-center gap-1.5">
                  <Heart className="w-3 h-3 text-cyan-600" /> Prayer Request
                </label>
                <textarea
                  value={formData.prayerRequest}
                  onChange={(e) => updateField('prayerRequest', e.target.value)}
                  rows={3}
                  className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-200 focus:outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600/50 transition-all hover:border-zinc-700 placeholder:text-zinc-600 resize-none"
                  placeholder="Enter any prayer requests or special notes..."
                />
              </div>

              {/* Submit */}
              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 bg-zinc-800/50 hover:bg-zinc-800 text-zinc-400 text-sm font-medium rounded-xl transition-all border border-zinc-700/50 cursor-pointer"
                >
                  Cancel
                </button>
                <motion.button
                  type="submit"
                  disabled={submitting}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex-[2] py-3 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-black text-sm font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2 cursor-pointer tracking-wider"
                >
                  {submitting ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      PROCESSING...
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      CHECK IN VISITOR
                    </>
                  )}
                </motion.button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
