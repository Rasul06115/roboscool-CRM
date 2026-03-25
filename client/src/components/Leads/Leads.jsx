import { useState, useEffect } from 'react';
import { Search, Plus, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { leadsAPI, coursesAPI } from '../../utils/api';
import { getLeadStatusInfo, getSourceColor } from '../../utils/helpers';

export default function Leads() {
  const [leads, setLeads] = useState([]);
  const [courses, setCourses] = useState([]);
  const [stats, setStats] = useState(null);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);
  const loadData = async () => {
    try {
      const [l, s, c] = await Promise.all([leadsAPI.getAll({ search: search || undefined }), leadsAPI.getStats(), coursesAPI.getAll()]);
      setLeads(l.data); setStats(s.data); setCourses(c.data);
    } catch (e) {} finally { setLoading(false); }
  };

  const handleSave = async (form) => {
    try {
      if (editItem) { await leadsAPI.update(editItem.id, form); toast.success('Yangilandi!'); }
      else { await leadsAPI.create(form); toast.success("Qo'shildi!"); }
      setShowModal(false); setEditItem(null); loadData();
    } catch (e) {}
  };

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" /></div>;
  const ic = "w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:border-teal-500 focus:outline-none";

  return (
    <div className="space-y-4 animate-fadeIn">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { l: 'Jami', v: stats?.total || 0, c: 'text-gray-800' },
          { l: 'Yangi', v: stats?.byStatus?.find(s => s.status === 'NEW')?.count || 0, c: 'text-blue-600' },
          { l: 'Sinov', v: (stats?.byStatus?.find(s => s.status === 'TRIAL_SCHEDULED')?.count || 0) + (stats?.byStatus?.find(s => s.status === 'TRIAL_DONE')?.count || 0), c: 'text-yellow-600' },
          { l: 'Konversiya', v: `${stats?.conversionRate || 0}%`, c: 'text-green-600' },
        ].map((c, i) => <div key={i} className="bg-white rounded-xl p-4 border border-gray-200"><p className="text-xs text-gray-400">{c.l}</p><p className={`text-xl font-extrabold ${c.c}`}>{c.v}</p></div>)}
      </div>

      <div className="flex flex-col sm:flex-row justify-between gap-3">
        <div className="relative flex-1 max-w-md"><Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input className={`${ic} pl-10`} placeholder="Qidirish..." value={search} onChange={e => { setSearch(e.target.value); setTimeout(loadData, 300); }} /></div>
        <button onClick={() => { setEditItem(null); setShowModal(true); }} className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700"><Plus size={18} /> Yangi lead</button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50">{['Ism','Telefon','Qiziqish','Manba','Sinov','Status',''].map(h=><th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr></thead>
            <tbody>{leads.map(l => {
              const si = getLeadStatusInfo(l.status);
              return (<tr key={l.id} className="border-t border-gray-50 hover:bg-gray-50/50">
                <td className="px-4 py-3"><p className="font-semibold">{l.fullName}</p><p className="text-xs text-gray-400">{new Date(l.createdAt).toLocaleDateString()}</p></td>
                <td className="px-4 py-3 font-mono text-xs">{l.phone}</td>
                <td className="px-4 py-3 text-gray-600">{l.interest || '—'}</td>
                <td className="px-4 py-3"><span className={`text-xs px-2 py-1 rounded-lg font-semibold ${getSourceColor(l.source)}`}>{l.source}</span></td>
                <td className="px-4 py-3 text-gray-600">{l.trialDate ? new Date(l.trialDate).toLocaleDateString() : '—'}</td>
                <td className="px-4 py-3"><span className={`text-xs px-3 py-1 rounded-full font-semibold ${si.cls}`}>{si.label}</span></td>
                <td className="px-4 py-3"><div className="flex gap-1">
                  <button onClick={() => { setEditItem(l); setShowModal(true); }} className="p-2 rounded-lg bg-teal-50 text-teal-600"><Pencil size={14} /></button>
                  <button onClick={async () => { if (confirm("O'chirish?")) { await leadsAPI.delete(l.id); toast.success("O'chirildi!"); loadData(); } }} className="p-2 rounded-lg bg-red-50 text-red-600"><Trash2 size={14} /></button>
                </div></td>
              </tr>);
            })}</tbody>
          </table>
        </div>
        {leads.length === 0 && <p className="text-center text-gray-400 py-10">Lead topilmadi</p>}
      </div>

      {showModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowModal(false)}>
        <div className="bg-white rounded-2xl w-full max-w-lg mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
          <div className="flex justify-between items-center px-6 py-4 border-b"><h3 className="text-lg font-bold">{editItem ? 'Tahrirlash' : 'Yangi lead'}</h3><button onClick={() => { setShowModal(false); setEditItem(null); }} className="p-2 rounded-lg hover:bg-gray-100">✕</button></div>
          <div className="p-6 space-y-4">
            <LeadForm lead={editItem} courses={courses} onSave={handleSave} ic={ic} />
          </div>
        </div>
      </div>}
    </div>
  );
}

function LeadForm({ lead, courses, onSave, ic }) {
  const [f, setF] = useState({
    fullName: lead?.fullName || '', phone: lead?.phone || '', source: lead?.source || 'INSTAGRAM',
    interest: lead?.interest || '', status: lead?.status || 'NEW', trialDate: lead?.trialDate?.split('T')[0] || '', notes: lead?.notes || '',
  });
  return (<>
    <div className="grid grid-cols-2 gap-4">
      <div><label className="block text-xs font-semibold text-gray-600 mb-1">Ism *</label><input className={ic} value={f.fullName} onChange={e => setF({...f, fullName: e.target.value})} /></div>
      <div><label className="block text-xs font-semibold text-gray-600 mb-1">Telefon *</label><input className={ic} value={f.phone} onChange={e => setF({...f, phone: e.target.value})} placeholder="+998..." /></div>
      <div><label className="block text-xs font-semibold text-gray-600 mb-1">Manba</label><select className={ic} value={f.source} onChange={e => setF({...f, source: e.target.value})}><option value="INSTAGRAM">Instagram</option><option value="TELEGRAM">Telegram</option><option value="REFERRAL">Tavsiya</option><option value="WEBSITE">Veb-sayt</option><option value="OTHER">Boshqa</option></select></div>
      <div><label className="block text-xs font-semibold text-gray-600 mb-1">Qiziqish</label><select className={ic} value={f.interest} onChange={e => setF({...f, interest: e.target.value})}><option value="">Tanlang</option>{courses.map(c => <option key={c.id} value={c.name}>{c.icon} {c.name}</option>)}</select></div>
      <div><label className="block text-xs font-semibold text-gray-600 mb-1">Status</label><select className={ic} value={f.status} onChange={e => setF({...f, status: e.target.value})}><option value="NEW">Yangi</option><option value="CONTACTED">Bog'lanildi</option><option value="TRIAL_SCHEDULED">Sinov belgilangan</option><option value="TRIAL_DONE">Sinov o'tdi</option><option value="CONVERTED">O'quvchi bo'ldi</option><option value="LOST">Yo'qolgan</option></select></div>
      <div><label className="block text-xs font-semibold text-gray-600 mb-1">Sinov sanasi</label><input className={ic} type="date" value={f.trialDate} onChange={e => setF({...f, trialDate: e.target.value})} /></div>
    </div>
    <div><label className="block text-xs font-semibold text-gray-600 mb-1">Izoh</label><textarea className={`${ic} min-h-[60px]`} value={f.notes} onChange={e => setF({...f, notes: e.target.value})} /></div>
    <button onClick={() => { if (!f.fullName || !f.phone) { toast.error("To'ldiring!"); return; } onSave({ ...f, trialDate: f.trialDate || null }); }} className="w-full py-2.5 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700">{lead ? 'Saqlash' : "Qo'shish"}</button>
  </>);
}
