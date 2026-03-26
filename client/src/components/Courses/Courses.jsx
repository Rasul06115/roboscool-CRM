import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import { coursesAPI, groupsAPI } from '../../utils/api';
import { formatMoney } from '../../utils/helpers';
import api from '../../utils/api';

export default function Courses() {
  const [courses, setCourses] = useState([]);
  const [groups, setGroups] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editCourse, setEditCourse] = useState(null);
  const [editGroup, setEditGroup] = useState(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [c, g] = await Promise.all([coursesAPI.getAll(), groupsAPI.getAll()]);
      setCourses(c.data); setGroups(g.data);
      const teacherMap = {};
      g.data.forEach(gr => { if (gr.teacher) teacherMap[gr.teacher.id] = gr.teacher; });
      setTeachers(Object.values(teacherMap));
    } catch (e) {} finally { setLoading(false); }
  };

  const handleSaveCourse = async (form) => {
    try {
      if (editCourse) { await coursesAPI.update(editCourse.id, form); toast.success('Kurs yangilandi!'); }
      else { await coursesAPI.create(form); toast.success("Kurs qo'shildi!"); }
      setShowCourseModal(false); setEditCourse(null); loadData();
    } catch (e) {}
  };

  const handleDeleteCourse = async (id) => {
    if (!confirm("Bu kursni o'chirishni xohlaysizmi?")) return;
    try { await coursesAPI.delete(id); toast.success("O'chirildi!"); loadData(); } catch (e) {}
  };

  const handleSaveGroup = async (form) => {
    try {
      if (editGroup) { await groupsAPI.update(editGroup.id, form); toast.success('Guruh yangilandi!'); }
      else { await groupsAPI.create(form); toast.success("Guruh qo'shildi!"); }
      setShowGroupModal(false); setEditGroup(null); loadData();
    } catch (e) {}
  };

  const handleDeleteGroup = async (id) => {
    if (!confirm("Bu guruhni o'chirishni xohlaysizmi?")) return;
    try { await groupsAPI.delete(id); toast.success("O'chirildi!"); loadData(); } catch (e) {}
  };

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" /></div>;

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">{courses.length} ta kurs</p>
        <button onClick={() => { setEditCourse(null); setShowCourseModal(true); }}
          className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700">
          <Plus size={18} /> Yangi kurs
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {courses.map(c => (
          <div key={c.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow group">
            <div className="h-1.5" style={{ background: c.color }} />
            <div className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ background: `${c.color}15` }}>{c.icon}</div>
                  <div><h3 className="font-bold text-lg">{c.name}</h3><p className="text-sm text-gray-500">{c.description}</p></div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => { setEditCourse(c); setShowCourseModal(true); }} className="p-2 rounded-lg bg-teal-50 text-teal-600 hover:bg-teal-100"><Pencil size={14} /></button>
                  <button onClick={() => handleDeleteCourse(c.id)} className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100"><Trash2 size={14} /></button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[{ l: 'Yosh', v: c.ageRange || '—' }, { l: 'Davomiylik', v: c.duration || '—' }, { l: 'Narx', v: `${formatMoney(c.price)} so'm` }, { l: "O'quvchilar", v: `${c.studentCount || 0} ta` }].map((item, i) => (
                  <div key={i} className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-400">{item.l}</p><p className="font-bold text-sm">{item.v}</p></div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold">Guruhlar ro'yxati</h3>
          <button onClick={() => { setEditGroup(null); setShowGroupModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700">
            <Plus size={16} /> Yangi guruh
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50">
              {['#', 'Guruh', 'Kurs', "O'qituvchi", 'Kunlar', 'Vaqt', "O'quvchilar", 'Band', 'Amallar'].map(h =>
                <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}
            </tr></thead>
            <tbody>
              {groups.map((g, i) => {
                const fill = g.maxSize > 0 ? Math.round((g.studentCount / g.maxSize) * 100) : 0;
                return (
                  <tr key={g.id} className="border-t border-gray-50 hover:bg-gray-50/50">
                    <td className="px-3 py-3 text-gray-400 text-xs">{i + 1}</td>
                    <td className="px-3 py-3 font-semibold">{g.course?.icon} {g.name}</td>
                    <td className="px-3 py-3 text-gray-600">{g.course?.name}</td>
                    <td className="px-3 py-3 text-gray-600">{g.teacher?.fullName}</td>
                    <td className="px-3 py-3"><span className="text-xs px-2 py-1 rounded-lg bg-blue-50 text-blue-700 font-semibold">{g.weekDays || '—'}</span></td>
                    <td className="px-3 py-3 text-gray-600 font-mono text-xs">{g.startTime || '—'} - {g.endTime || '—'}</td>
                    <td className="px-3 py-3 font-semibold">{g.studentCount}/{g.maxSize}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-[80px]"><div className="h-2 rounded-full" style={{ width: `${fill}%`, background: fill > 80 ? '#EF4444' : g.course?.color }} /></div>
                        <span className="text-xs font-semibold text-gray-500">{fill}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => { setEditGroup(g); setShowGroupModal(true); }} className="p-1.5 rounded-lg bg-teal-50 text-teal-600 hover:bg-teal-100"><Pencil size={14} /></button>
                        <button onClick={() => handleDeleteGroup(g.id)} className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showCourseModal && <CourseModal course={editCourse} onSave={handleSaveCourse} onClose={() => { setShowCourseModal(false); setEditCourse(null); }} />}
      {showGroupModal && <GroupModal group={editGroup} courses={courses} teachers={teachers} onSave={handleSaveGroup} onClose={() => { setShowGroupModal(false); setEditGroup(null); }} onTeachersChanged={loadData} />}
    </div>
  );
}

// ==================== KURS FORM ====================
function CourseModal({ course, onSave, onClose }) {
  const [form, setForm] = useState({
    name: course?.name || '', icon: course?.icon || '📚', color: course?.color || '#0D9488',
    ageRange: course?.ageRange || '', duration: course?.duration || '', price: course?.price || '', description: course?.description || '',
  });
  const ic = "w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:border-teal-500 focus:outline-none";
  const icons = ['📚', '🧩', '⚡', '🤖', '🐍', '🎨', '💻', '🎮', '🔬', '🚀', '🧠', '🎯'];
  const colors = ['#0D9488', '#FF6B35', '#00A6A6', '#E63946', '#2EC4B6', '#9B5DE5', '#F72585', '#4361EE', '#06D6A0'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg mx-4 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center px-6 py-4 border-b">
          <h3 className="text-lg font-bold">{course ? 'Kursni tahrirlash' : 'Yangi kurs'}</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100">✕</button>
        </div>
        <div className="p-6 space-y-4">
          <div><label className="block text-xs font-semibold text-gray-600 mb-1">Kurs nomi *</label>
            <input className={ic} value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Masalan: Web Design" /></div>
          <div><label className="block text-xs font-semibold text-gray-600 mb-2">Ikonka</label>
            <div className="flex gap-2 flex-wrap">{icons.map(icon => (
              <button key={icon} onClick={() => setForm({...form, icon})} className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center border-2 ${form.icon === icon ? 'border-teal-500 bg-teal-50 scale-110' : 'border-gray-200'}`}>{icon}</button>
            ))}</div></div>
          <div><label className="block text-xs font-semibold text-gray-600 mb-2">Rang</label>
            <div className="flex gap-2 flex-wrap">{colors.map(color => (
              <button key={color} onClick={() => setForm({...form, color})} className={`w-8 h-8 rounded-lg border-2 ${form.color === color ? 'border-gray-900 scale-110' : 'border-transparent'}`} style={{ background: color }} />
            ))}</div></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs font-semibold text-gray-600 mb-1">Yosh</label><input className={ic} value={form.ageRange} onChange={e => setForm({...form, ageRange: e.target.value})} placeholder="8-15" /></div>
            <div><label className="block text-xs font-semibold text-gray-600 mb-1">Davomiylik</label><input className={ic} value={form.duration} onChange={e => setForm({...form, duration: e.target.value})} placeholder="6 oy" /></div>
            <div><label className="block text-xs font-semibold text-gray-600 mb-1">Narx</label><input className={ic} type="number" value={form.price} onChange={e => setForm({...form, price: e.target.value})} placeholder="400000" /></div>
            <div><label className="block text-xs font-semibold text-gray-600 mb-1">Tavsif</label><input className={ic} value={form.description} onChange={e => setForm({...form, description: e.target.value})} /></div>
          </div>
          <div className="p-4 rounded-xl border" style={{ borderTopColor: form.color, borderTopWidth: '3px' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl" style={{ background: `${form.color}15` }}>{form.icon}</div>
              <div><p className="font-bold text-sm">{form.name || 'Kurs nomi'}</p><p className="text-xs text-gray-400">{form.ageRange || '?'} yosh • {formatMoney(form.price || 0)} so'm</p></div>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={onClose} className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold">Bekor</button>
            <button onClick={() => { if (!form.name) { toast.error('Nom kiriting!'); return; } onSave({ ...form, price: Number(form.price) || 0 }); }}
              className="px-5 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700">{course ? 'Saqlash' : "Qo'shish"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== GURUH FORM (O'QITUVCHI QO'SHISH BILAN) ====================
function GroupModal({ group, courses, teachers: initialTeachers, onSave, onClose, onTeachersChanged }) {
  const [teachers, setTeachers] = useState(initialTeachers);
  const [showNewTeacher, setShowNewTeacher] = useState(false);
  const [newTeacher, setNewTeacher] = useState({ fullName: '', phone: '', specialization: '' });
  const [savingTeacher, setSavingTeacher] = useState(false);

  const [form, setForm] = useState({
    name: group?.name || '',
    courseId: group?.courseId || '',
    teacherId: group?.teacherId || '',
    weekDays: group?.weekDays || 'Du,Cho,Ju',
    timeSlot: group?.timeSlot || 'MORNING',
    startTime: group?.startTime || '08:00',
    endTime: group?.endTime || '10:00',
    maxSize: group?.maxSize || 12,
    schedule: group?.schedule || '',
  });

  const ic = "w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:border-teal-500 focus:outline-none";

  const handleTimeSlot = (slot) => {
    if (slot === 'MORNING') setForm({ ...form, timeSlot: 'MORNING', startTime: '08:00', endTime: '10:00' });
    else setForm({ ...form, timeSlot: 'AFTERNOON', startTime: '15:00', endTime: '17:00' });
  };

  const getScheduleText = () => `${form.weekDays} ${form.startTime}-${form.endTime}`;

  // Yangi o'qituvchi qo'shish
  const handleAddTeacher = async () => {
    if (!newTeacher.fullName) { toast.error("O'qituvchi ismini kiriting!"); return; }
    setSavingTeacher(true);
    try {
      // API orqali yangi teacher yaratish
      const res = await api.post('/teachers', newTeacher);
      if (res.success && res.data) {
        setTeachers(prev => [...prev, res.data]);
        setForm({ ...form, teacherId: res.data.id });
        setShowNewTeacher(false);
        setNewTeacher({ fullName: '', phone: '', specialization: '' });
        toast.success("O'qituvchi qo'shildi!");
        if (onTeachersChanged) onTeachersChanged();
      }
    } catch (e) {
      // Agar /teachers endpoint yo'q bo'lsa, to'g'ridan-to'g'ri prisma orqali
      toast.error("O'qituvchi qo'shishda xatolik. Server route tekshiring.");
    } finally { setSavingTeacher(false); }
  };

  const weekDayOptions = [
    { label: 'Du, Cho, Ju (toq kunlar)', value: 'Du,Cho,Ju' },
    { label: 'Se, Pay, Sha (juft kunlar)', value: 'Se,Pay,Sha' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg mx-4 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center px-6 py-4 border-b">
          <h3 className="text-lg font-bold">{group ? 'Guruhni tahrirlash' : 'Yangi guruh'}</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100">✕</button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs font-semibold text-gray-600 mb-1">Guruh nomi *</label>
              <input className={ic} value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Arduino-B1" /></div>
            <div><label className="block text-xs font-semibold text-gray-600 mb-1">Max o'quvchilar</label>
              <input className={ic} type="number" value={form.maxSize} onChange={e => setForm({...form, maxSize: e.target.value})} /></div>
          </div>

          <div><label className="block text-xs font-semibold text-gray-600 mb-1">Kurs *</label>
            <select className={ic} value={form.courseId} onChange={e => setForm({...form, courseId: e.target.value})}>
              <option value="">Kurs tanlang</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select></div>

          {/* O'QITUVCHI — TANLASH YOKI YANGI QO'SHISH */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold text-gray-600">👨‍🏫 O'qituvchi *</label>
              <button onClick={() => setShowNewTeacher(!showNewTeacher)}
                className="flex items-center gap-1 text-xs text-teal-600 font-semibold hover:text-teal-700">
                <UserPlus size={14} /> {showNewTeacher ? 'Mavjuddan tanlash' : "Yangi qo'shish"}
              </button>
            </div>

            {!showNewTeacher ? (
              // Mavjud o'qituvchidan tanlash
              <select className={ic} value={form.teacherId} onChange={e => setForm({...form, teacherId: e.target.value})}>
                <option value="">O'qituvchi tanlang</option>
                {teachers.map(t => <option key={t.id} value={t.id}>{t.fullName} {t.specialization ? `(${t.specialization})` : ''}</option>)}
              </select>
            ) : (
              // Yangi o'qituvchi kiritish
              <div className="space-y-3 p-4 bg-teal-50 rounded-xl border border-teal-200">
                <p className="text-xs font-bold text-teal-700">➕ Yangi o'qituvchi qo'shish</p>
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Familiya va Ism *</label>
                    <input className={ic} value={newTeacher.fullName}
                      onChange={e => setNewTeacher({...newTeacher, fullName: e.target.value})}
                      placeholder="Masalan: Karimov Sardor" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Telefon</label>
                      <input className={ic} value={newTeacher.phone}
                        onChange={e => setNewTeacher({...newTeacher, phone: e.target.value})}
                        placeholder="+998..." />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Mutaxassisligi</label>
                      <input className={ic} value={newTeacher.specialization}
                        onChange={e => setNewTeacher({...newTeacher, specialization: e.target.value})}
                        placeholder="Arduino, Python..." />
                    </div>
                  </div>
                  <button onClick={handleAddTeacher} disabled={savingTeacher}
                    className="w-full py-2.5 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700 disabled:opacity-50 flex items-center justify-center gap-2">
                    {savingTeacher ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <UserPlus size={16} />}
                    {savingTeacher ? 'Saqlanmoqda...' : "O'qituvchini qo'shish"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Kunlar */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">📅 Dars kunlari</label>
            <div className="space-y-2">
              {weekDayOptions.map(opt => (
                <label key={opt.value} className={`flex items-center gap-2 p-2.5 rounded-xl cursor-pointer border-2 ${form.weekDays === opt.value ? 'border-teal-500 bg-teal-50' : 'border-gray-100 hover:bg-gray-50'}`}>
                  <input type="radio" name="weekDays" value={opt.value} checked={form.weekDays === opt.value}
                    onChange={e => setForm({...form, weekDays: e.target.value})} className="text-teal-600" />
                  <span className="text-sm font-medium">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Vaqt */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">⏰ Dars vaqti</label>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => handleTimeSlot('MORNING')}
                className={`p-3 rounded-xl border-2 text-center ${form.timeSlot === 'MORNING' ? 'border-teal-500 bg-teal-50' : 'border-gray-200'}`}>
                <p className="text-lg">🌅</p><p className="text-sm font-semibold">Ertalab</p><p className="text-xs text-gray-500">08:00 — 10:00</p>
              </button>
              <button onClick={() => handleTimeSlot('AFTERNOON')}
                className={`p-3 rounded-xl border-2 text-center ${form.timeSlot === 'AFTERNOON' ? 'border-teal-500 bg-teal-50' : 'border-gray-200'}`}>
                <p className="text-lg">🌤</p><p className="text-sm font-semibold">Kunduzi</p><p className="text-xs text-gray-500">15:00 — 17:00</p>
              </button>
            </div>
          </div>

          <div className="p-3 bg-gray-50 rounded-xl text-sm">
            <span className="font-semibold">📋 Jadval: </span>
            <span className="text-teal-700 font-mono">{getScheduleText()}</span>
          </div>

          <div className="flex justify-end gap-3">
            <button onClick={onClose} className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold">Bekor</button>
            <button onClick={() => {
              if (!form.name || !form.courseId || !form.teacherId) { toast.error("Barcha maydonlarni to'ldiring!"); return; }
              onSave({ ...form, maxSize: Number(form.maxSize), schedule: getScheduleText() });
            }} className="px-5 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700">
              {group ? 'Saqlash' : "Qo'shish"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
