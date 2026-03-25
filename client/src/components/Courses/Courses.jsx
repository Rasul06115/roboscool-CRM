import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { coursesAPI, groupsAPI } from '../../utils/api';
import { formatMoney } from '../../utils/helpers';

export default function Courses() {
  const [courses, setCourses] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [c, g] = await Promise.all([coursesAPI.getAll(), groupsAPI.getAll()]);
      setCourses(c.data); setGroups(g.data);
    } catch (e) {} finally { setLoading(false); }
  };

  const handleSave = async (form) => {
    try {
      if (editItem) {
        await coursesAPI.update(editItem.id, form);
        toast.success('Kurs yangilandi!');
      } else {
        await coursesAPI.create(form);
        toast.success("Kurs qo'shildi!");
      }
      setShowModal(false); setEditItem(null); loadData();
    } catch (e) {}
  };

  const handleDelete = async (id) => {
    if (!confirm("Bu kursni o'chirishni xohlaysizmi? Barcha guruhlar ham o'chiriladi!")) return;
    try { await coursesAPI.delete(id); toast.success("Kurs o'chirildi!"); loadData(); }
    catch (e) {}
  };

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" /></div>;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">{courses.length} ta kurs</p>
        <button onClick={() => { setEditItem(null); setShowModal(true); }}
          className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700">
          <Plus size={18} /> Yangi kurs
        </button>
      </div>

      {/* Kurs kartochkalari */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {courses.map(c => (
          <div key={c.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow group">
            <div className="h-1.5" style={{ background: c.color }} />
            <div className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ background: `${c.color}15` }}>
                    {c.icon}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-gray-900">{c.name}</h3>
                    <p className="text-sm text-gray-500">{c.description}</p>
                  </div>
                </div>
                {/* Tahrirlash / O'chirish tugmalari */}
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => { setEditItem(c); setShowModal(true); }}
                    className="p-2 rounded-lg bg-teal-50 text-teal-600 hover:bg-teal-100">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => handleDelete(c.id)}
                    className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { l: 'Yosh', v: c.ageRange || '—' },
                  { l: 'Davomiylik', v: c.duration || '—' },
                  { l: 'Narx', v: `${formatMoney(c.price)} so'm` },
                  { l: "O'quvchilar", v: `${c.studentCount || 0} ta` },
                ].map((item, i) => (
                  <div key={i} className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-400">{item.l}</p>
                    <p className="font-bold text-sm text-gray-900">{item.v}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Guruhlar jadvali */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h3 className="font-bold text-gray-900 mb-4">Guruhlar ro'yxati</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                {['Guruh', 'Kurs', "O'qituvchi", 'Jadval', "O'quvchilar", 'Band'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map(g => {
                const fill = g.maxSize > 0 ? Math.round((g.studentCount / g.maxSize) * 100) : 0;
                return (
                  <tr key={g.id} className="border-t border-gray-50 hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-semibold">{g.course?.icon} {g.name}</td>
                    <td className="px-4 py-3 text-gray-600">{g.course?.name}</td>
                    <td className="px-4 py-3 text-gray-600">{g.teacher?.fullName}</td>
                    <td className="px-4 py-3 text-gray-600">{g.schedule}</td>
                    <td className="px-4 py-3 font-semibold">{g.studentCount}/{g.maxSize}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-[80px]">
                          <div className="h-2 rounded-full transition-all" style={{ width: `${fill}%`, background: g.course?.color }} />
                        </div>
                        <span className="text-xs font-semibold text-gray-500">{fill}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Kurs Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center px-6 py-4 border-b">
              <h3 className="text-lg font-bold">{editItem ? 'Kursni tahrirlash' : 'Yangi kurs'}</h3>
              <button onClick={() => { setShowModal(false); setEditItem(null); }} className="p-2 rounded-lg hover:bg-gray-100">✕</button>
            </div>
            <CourseForm course={editItem} onSave={handleSave} onClose={() => { setShowModal(false); setEditItem(null); }} />
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== KURS FORM ====================
function CourseForm({ course, onSave, onClose }) {
  const [form, setForm] = useState({
    name: course?.name || '',
    icon: course?.icon || '📚',
    color: course?.color || '#0D9488',
    ageRange: course?.ageRange || '',
    duration: course?.duration || '',
    price: course?.price || '',
    description: course?.description || '',
  });

  const ic = "w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:border-teal-500 focus:outline-none";

  const iconOptions = ['📚', '🧩', '⚡', '🤖', '🐍', '🎨', '💻', '🎮', '🔬', '🚀', '🧠', '🎯'];
  const colorOptions = ['#0D9488', '#FF6B35', '#00A6A6', '#E63946', '#2EC4B6', '#9B5DE5', '#F72585', '#4361EE', '#06D6A0'];

  return (
    <div className="p-6 space-y-4">
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Kurs nomi *</label>
        <input className={ic} value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Masalan: Web Design" />
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-2">Ikonka</label>
        <div className="flex gap-2 flex-wrap">
          {iconOptions.map(icon => (
            <button key={icon} onClick={() => setForm({...form, icon})}
              className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center border-2 transition-all ${form.icon === icon ? 'border-teal-500 bg-teal-50 scale-110' : 'border-gray-200 hover:border-gray-300'}`}>
              {icon}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-2">Rang</label>
        <div className="flex gap-2 flex-wrap">
          {colorOptions.map(color => (
            <button key={color} onClick={() => setForm({...form, color})}
              className={`w-8 h-8 rounded-lg border-2 transition-all ${form.color === color ? 'border-gray-900 scale-110' : 'border-transparent'}`}
              style={{ background: color }} />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Yosh oralig'i</label>
          <input className={ic} value={form.ageRange} onChange={e => setForm({...form, ageRange: e.target.value})} placeholder="7-9" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Davomiylik</label>
          <input className={ic} value={form.duration} onChange={e => setForm({...form, duration: e.target.value})} placeholder="3 oy" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Narx (so'm)</label>
          <input className={ic} type="number" value={form.price} onChange={e => setForm({...form, price: e.target.value})} placeholder="400000" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Tavsif</label>
          <input className={ic} value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Qisqacha tavsif" />
        </div>
      </div>

      {/* Preview */}
      <div className="p-4 rounded-xl border border-gray-200" style={{ borderTopColor: form.color, borderTopWidth: '3px' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl" style={{ background: `${form.color}15` }}>{form.icon}</div>
          <div>
            <p className="font-bold text-sm">{form.name || 'Kurs nomi'}</p>
            <p className="text-xs text-gray-400">{form.description || 'Tavsif'} • {form.ageRange || '?'} yosh • {formatMoney(form.price || 0)} so'm</p>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button onClick={onClose} className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-200">Bekor qilish</button>
        <button onClick={() => {
          if (!form.name) { toast.error('Kurs nomini kiriting!'); return; }
          onSave({ ...form, price: Number(form.price) || 0 });
        }} className="px-5 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700">
          {course ? 'Saqlash' : "Qo'shish"}
        </button>
      </div>
    </div>
  );
}
