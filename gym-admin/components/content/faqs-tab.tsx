'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2, Eye, EyeOff, Check, X, Loader2, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';
import type { GymFaq } from '@/app/dashboard/content/page';
import { can, type Permission } from '@/lib/get-permissions';

interface Props { initialFaqs: GymFaq[]; permissions: Permission[] | null }

const emptyForm = { question: '', answer: '' };

export default function FaqsTab({ initialFaqs, permissions }: Props) {
  const [faqs,       setFaqs]       = useState<GymFaq[]>(initialFaqs);
  const [showForm,   setShowForm]   = useState(false);
  const [editId,     setEditId]     = useState<string | null>(null);
  const [form,       setForm]       = useState(emptyForm);
  const [saving,     setSaving]     = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const inp = 'w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500';

  const openCreate = () => { setEditId(null); setForm(emptyForm); setShowForm(true); };
  const openEdit   = (faq: GymFaq) => { setEditId(faq.id); setForm({ question: faq.question, answer: faq.answer }); setShowForm(true); };
  const cancel     = () => { setShowForm(false); setEditId(null); setForm(emptyForm); };

  const save = async () => {
    if (!form.question.trim() || !form.answer.trim()) { toast.error('Question and answer are required'); return; }
    setSaving(true);
    try {
      const isEdit = !!editId;
      const res = await fetch(isEdit ? `/api/content/faqs/${editId}` : '/api/content/faqs', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: form.question.trim(), answer: form.answer.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Failed'); return; }
      setFaqs(prev => isEdit
        ? prev.map(f => f.id === editId ? data.faq : f)
        : [...prev, data.faq]
      );
      toast.success(isEdit ? 'FAQ updated' : 'FAQ added');
      cancel();
    } catch { toast.error('Network error'); }
    finally { setSaving(false); }
  };

  const toggleVisible = async (faq: GymFaq) => {
    setTogglingId(faq.id);
    try {
      const res = await fetch(`/api/content/faqs/${faq.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isVisible: !faq.is_visible }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Failed'); return; }
      setFaqs(prev => prev.map(f => f.id === faq.id ? data.faq : f));
    } catch { toast.error('Network error'); }
    finally { setTogglingId(null); }
  };

  const deleteFaq = async (faq: GymFaq) => {
    if (!confirm('Delete this FAQ?')) return;
    setDeletingId(faq.id);
    try {
      const res = await fetch(`/api/content/faqs/${faq.id}`, { method: 'DELETE' });
      if (!res.ok) { toast.error('Failed to delete'); return; }
      setFaqs(prev => prev.filter(f => f.id !== faq.id));
      toast.success('FAQ deleted');
    } catch { toast.error('Network error'); }
    finally { setDeletingId(null); }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">{faqs.length} FAQ{faqs.length !== 1 ? 's' : ''}</p>
        {can(permissions, 'content', 'create') && (
          <button onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition-colors">
            <Plus className="w-4 h-4" /> Add FAQ
          </button>
        )}
      </div>

      {/* Create / Edit Form */}
      {showForm && (
        <div className="bg-gray-800 border border-purple-600/40 rounded-xl p-5 space-y-3">
          <p className="text-sm font-medium text-white">{editId ? 'Edit FAQ' : 'New FAQ'}</p>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Question <span className="text-red-400">*</span></label>
            <input value={form.question} onChange={e => setForm(p => ({ ...p, question: e.target.value }))}
              placeholder="e.g. What are your opening hours?" className={inp} />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Answer <span className="text-red-400">*</span></label>
            <textarea value={form.answer} onChange={e => setForm(p => ({ ...p, answer: e.target.value }))}
              placeholder="Provide a clear answer…" rows={4}
              className={inp + ' resize-none'} />
          </div>
          <div className="flex gap-2">
            <button onClick={cancel} className="flex-1 py-2 rounded-lg border border-gray-600 text-gray-300 text-sm hover:bg-gray-700 transition-colors">
              Cancel
            </button>
            <button onClick={save} disabled={saving}
              className="flex-1 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
              {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</> : <><Check className="w-3.5 h-3.5" /> Save</>}
            </button>
          </div>
        </div>
      )}

      {/* FAQ List */}
      {faqs.length === 0 ? (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-12 text-center">
          <HelpCircle className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-400">No FAQs yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {faqs.map(faq => (
            <div key={faq.id}
              className={`bg-gray-800 border rounded-xl overflow-hidden transition-colors ${
                faq.is_visible ? 'border-gray-700' : 'border-gray-700 opacity-60'
              }`}>
              <div className="flex items-center gap-3 px-5 py-3.5">
                <button onClick={() => setExpandedId(expandedId === faq.id ? null : faq.id)}
                  className="flex-1 flex items-center gap-3 text-left">
                  <span className="flex-1 text-sm font-medium text-white">{faq.question}</span>
                  {expandedId === faq.id
                    ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                </button>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {!faq.is_visible && (
                    <span className="text-xs bg-gray-700 text-gray-400 px-2 py-0.5 rounded-full mr-1">Hidden</span>
                  )}
                  {can(permissions, 'content', 'edit') && (
                    <button onClick={() => openEdit(faq)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {can(permissions, 'content', 'edit') && (
                    <button onClick={() => toggleVisible(faq)} disabled={togglingId === faq.id}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
                      {faq.is_visible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  )}
                  {can(permissions, 'content', 'delete') && (
                    <button onClick={() => deleteFaq(faq)} disabled={deletingId === faq.id}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-400/10 transition-colors">
                      {deletingId === faq.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>
              </div>
              {expandedId === faq.id && (
                <div className="px-5 pb-4 border-t border-gray-700/60">
                  <p className="text-sm text-gray-400 mt-3 leading-relaxed">{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
