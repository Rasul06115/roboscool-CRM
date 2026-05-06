import { useState, useEffect } from 'react';
import { Search, Plus, Pencil, Trash2, MessageSquare, Phone, Eye, X, Filter, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';
import { studentsAPI, groupsAPI, smsAPI, attendanceAPI } from '../../utils/api';
import { formatMoney, getStudentLevel, getPointsToNextLevel } from '../../utils/helpers';

export default function Students() {
  const [students, setStudents] = useState([]);
  const [groups, setGroups] = useState([]);
  const [search, setSearch] = useState('');
  const [filterGroup, setFilterGroup] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showSmsModal, setSmsModal] = useState(null);
  const [showProfile, setShowProfile] = useState(null);
  const [editItem, setEditItem] = useState(null);

  useEffect(() => { loadData(); }, []);
  const loadData = async () => {
    try { const [s, g] = await Promise.all([studentsAPI.getAll(), groupsAPI.getAll()]); setStudents(s.data); setGroups(g.data); } catch (e) {} finally { setLoading(false); }
  };

  // Filtrlanagan o'quvchilar
  const filtered = students.filter(s => {
    const matchSearch = !search || s.fullName.toLowerCase().includes(search.toLowerCase()) ||
      s.parentPhone?.includes(search) || s.fatherName?.toLowerCase().includes(search.toLowerCase()) ||
      s.motherName?.toLowerCase().includes(search.toLowerCase()) || s.fatherPhone?.includes(search) || s.motherPhone?.includes(search);
    const matchGroup = !filterGroup || s.groupId === filterGroup;
    return matchSearch && matchGroup;
  });

  const handleSave = async (form) => {
    try {
      if (editItem) { await studentsAPI.update(editItem.id, form); toast.success("Yangilandi!"); }
      else {
        await studentsAPI.create(form); toast.success("Qo'shildi!");
        if (form.parentPhone) {
          try { await smsAPI.send({ phone: form.parentPhone, message: `Assalomu alaykum! Farzandingiz ${form.fullName} Roboschool o'quv markaziga qabul qilindi. Telegram: https://t.me/roboschool_chinoz ROBOSCHOOL` }); toast.success("Xush kelibsiz SMS yuborildi!"); } catch (e) {}
        }
      }
      setShowModal(false); setEditItem(null); loadData();
    } catch (e) {}
  };
  const handleDelete = async (id) => { if (!confirm("O'chirishni xohlaysizmi?")) return; await studentsAPI.delete(id); toast.success("O'chirildi!"); loadData(); };

  return (
    <div className="space-y-4 animate-fadeIn">
      <div className="flex flex-col sm:flex-row justify-between gap-3">
        <div className="flex gap-3 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:border-teal-500 focus:outline-none"
              placeholder="Ism, telefon, ota-ona bo'yicha qidirish..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {/* GURUH FILTRI */}
          <div className="relative">
            <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <select value={filterGroup} onChange={e => setFilterGroup(e.target.value)}
              className="pl-9 pr-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:border-teal-500 focus:outline-none appearance-none bg-white min-w-[180px]">
              <option value="">Barcha guruhlar</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.course?.icon} {g.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-2">
          <span className="flex items-center text-sm text-gray-500 bg-gray-100 px-3 rounded-xl">{filtered.length} ta</span>
          <button onClick={() => { setEditItem(null); setShowModal(true); }} className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700"><Plus size={18} /> Yangi o'quvchi</button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50">
              {["#", "Ism", "Yosh", "Guruh", "Otasi", "Onasi", "Telefon", "Amallar"].map(h =>
                <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>)}
            </tr></thead>
            <tbody>{filtered.map((s, i) => {
              const c = s.group?.course;
              return (
                <tr key={s.id} className="border-t border-gray-50 hover:bg-gray-50/50">
                  <td className="px-3 py-3 text-gray-400 font-semibold text-center">{i + 1}</td>
                  <td className="px-3 py-3"><div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ background: c?.color || '#6B7280' }}>{s.fullName.charAt(0)}</div>
                    <div><p className="font-semibold">{s.fullName} <span className="text-xs" title={`${s.totalPoints || 0} ball`}>{getStudentLevel(s.totalPoints).emoji}</span></p><div className="flex items-center gap-1">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${s.status === 'ACTIVE' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{s.status === 'ACTIVE' ? 'Faol' : 'Nofaol'}</span>
                      {s.metrikaNumber && <span className="text-xs text-gray-400">• {s.metrikaNumber}</span>}
                    </div></div></div></td>
                  <td className="px-3 py-3 text-gray-600">{s.age}</td>
                  <td className="px-3 py-3"><span className="text-xs px-2 py-1 rounded-lg font-semibold" style={{ background: `${c?.color}15`, color: c?.color }}>{c?.icon} {s.group?.name || '—'}</span></td>
                  <td className="px-3 py-3"><div><p className="text-sm text-gray-800">{s.fatherName || '—'}</p>{s.fatherPhone && <p className="text-xs text-gray-400 font-mono">{s.fatherPhone}</p>}</div></td>
                  <td className="px-3 py-3"><div><p className="text-sm text-gray-800">{s.motherName || '—'}</p>{s.motherPhone && <p className="text-xs text-gray-400 font-mono">{s.motherPhone}</p>}</div></td>
                  <td className="px-3 py-3 font-mono text-xs">{s.parentPhone}</td>
                  <td className="px-3 py-3"><div className="flex gap-1">
                    <button onClick={() => setShowProfile(s)} title="Ko'rish" className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100"><Eye size={14} /></button>
                    <button onClick={() => setSmsModal(s)} title="SMS" className="p-1.5 rounded-lg bg-purple-50 text-purple-600 hover:bg-purple-100"><MessageSquare size={14} /></button>
                    <button onClick={() => { setEditItem(s); setShowModal(true); }} title="Tahrirlash" className="p-1.5 rounded-lg bg-teal-50 text-teal-600 hover:bg-teal-100"><Pencil size={14} /></button>
                    <button onClick={() => handleDelete(s.id)} title="O'chirish" className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100"><Trash2 size={14} /></button>
                  </div></td>
                </tr>);
            })}</tbody>
          </table>
        </div>
        {filtered.length === 0 && !loading && <p className="text-center text-gray-400 py-10">Topilmadi</p>}
      </div>

      {showModal && <StudentFormModal student={editItem} groups={groups} onSave={handleSave} onClose={() => { setShowModal(false); setEditItem(null); }} />}
      {showSmsModal && <SmsModal student={showSmsModal} onClose={() => setSmsModal(null)} />}
      {showProfile && <ProfileModal student={showProfile} onClose={() => setShowProfile(null)} />}
    </div>
  );
}

function StudentFormModal({ student, groups, onSave, onClose }) {
  // Ism va familiyani ajratish
  const nameParts = (student?.fullName || '').split(' ');
  const [f, setF] = useState({
    firstName: student ? (nameParts.slice(1).join(' ') || '') : '',
    lastName: student ? (nameParts[0] || '') : '',
    fullName: student?.fullName || '', age: student?.age || '', metrikaNumber: student?.metrikaNumber || '',
    fatherName: student?.fatherName || '', fatherPhone: student?.fatherPhone || '',
    motherName: student?.motherName || '', motherPhone: student?.motherPhone || '',
    parentPhone: student?.parentPhone || '', address: student?.address || '',
    groupId: student?.groupId || '', balance: student?.balance || 0, progress: student?.progress || 0,
    status: student?.status || 'ACTIVE', notes: student?.notes || '',
  });

  // Ism o'zgarganda fullName yangilanadi
  const updateName = (field, value) => {
    const updated = { ...f, [field]: value };
    updated.fullName = `${updated.lastName} ${updated.firstName}`.trim();
    setF(updated);
  };

  const ic = "w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:border-teal-500 focus:outline-none";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl mx-4 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center px-6 py-4 border-b sticky top-0 bg-white z-10">
          <h3 className="text-lg font-bold">{student ? "Tahrirlash" : "Yangi o'quvchi"}</h3><button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100">✕</button>
        </div>
        <div className="p-6 space-y-5">
          <div><h4 className="text-sm font-bold text-gray-700 mb-3">👤 Asosiy</h4><div className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs font-semibold text-gray-600 mb-1">Familiya *</label><input className={ic} value={f.lastName} onChange={e => updateName('lastName', e.target.value)} placeholder="Karimov" /></div>
            <div><label className="block text-xs font-semibold text-gray-600 mb-1">Ism *</label><input className={ic} value={f.firstName} onChange={e => updateName('firstName', e.target.value)} placeholder="Aziz" /></div>
            <div><label className="block text-xs font-semibold text-gray-600 mb-1">Yoshi</label><input className={ic} type="number" value={f.age} onChange={e => setF({...f, age: e.target.value})} /></div>
            <div><label className="block text-xs font-semibold text-gray-600 mb-1">Metrika</label><input className={ic} value={f.metrikaNumber} onChange={e => setF({...f, metrikaNumber: e.target.value})} placeholder="I-TM 1234567" /></div>
            <div className="col-span-2"><label className="block text-xs font-semibold text-gray-600 mb-1">Manzil</label><input className={ic} value={f.address} onChange={e => setF({...f, address: e.target.value})} /></div>
          </div></div>
          <div><h4 className="text-sm font-bold text-gray-700 mb-3">👨‍👩‍👦 Ota-ona</h4><div className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs font-semibold text-gray-600 mb-1">👨 Otasi</label><input className={ic} value={f.fatherName} onChange={e => setF({...f, fatherName: e.target.value})} /></div>
            <div><label className="block text-xs font-semibold text-gray-600 mb-1">📱 Otasi tel</label><input className={ic} value={f.fatherPhone} onChange={e => setF({...f, fatherPhone: e.target.value})} placeholder="+998..." /></div>
            <div><label className="block text-xs font-semibold text-gray-600 mb-1">👩 Onasi</label><input className={ic} value={f.motherName} onChange={e => setF({...f, motherName: e.target.value})} /></div>
            <div><label className="block text-xs font-semibold text-gray-600 mb-1">📱 Onasi tel</label><input className={ic} value={f.motherPhone} onChange={e => setF({...f, motherPhone: e.target.value})} placeholder="+998..." /></div>
            <div className="col-span-2"><label className="block text-xs font-semibold text-gray-600 mb-1">📞 Asosiy tel (SMS) *</label><input className={ic} value={f.parentPhone} onChange={e => setF({...f, parentPhone: e.target.value})} /></div>
          </div></div>
          <div><h4 className="text-sm font-bold text-gray-700 mb-3">📚 O'qish</h4><div className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs font-semibold text-gray-600 mb-1">Guruh</label><select className={ic} value={f.groupId} onChange={e => setF({...f, groupId: e.target.value})}><option value="">Tanlang</option>{groups.map(g => <option key={g.id} value={g.id}>{g.course?.icon} {g.name}</option>)}</select></div>
            <div><label className="block text-xs font-semibold text-gray-600 mb-1">Status</label><select className={ic} value={f.status} onChange={e => setF({...f, status: e.target.value})}><option value="ACTIVE">Faol</option><option value="INACTIVE">Nofaol</option><option value="GRADUATED">Bitirgan</option></select></div>
          </div></div>
          <div><label className="block text-xs font-semibold text-gray-600 mb-1">📝 Izoh</label><textarea className={`${ic} min-h-[60px]`} value={f.notes} onChange={e => setF({...f, notes: e.target.value})} /></div>
          <div className="flex justify-end gap-3">
            <button onClick={onClose} className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold">Bekor</button>
            <button onClick={() => { if (!f.fullName || !f.parentPhone) { toast.error("Ism va telefon kerak!"); return; } onSave({ ...f, age: f.age ? Number(f.age) : null, balance: Number(f.balance), progress: Number(f.progress), groupId: f.groupId || null }); }}
              className="px-5 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700">{student ? 'Saqlash' : "Qo'shish"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SmsModal({ student, onClose }) {
  const [phone, setPhone] = useState(student.parentPhone);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState('');
  const today = new Date().toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const parentName = student.fatherName || student.motherName || 'ota-ona';
  const courseName = student.group?.course?.name || 'kurs';
  const templates = [
    { id: 'payment', label: "💰 To'lov eslatma", color: 'bg-yellow-50 text-yellow-700 border-yellow-200', text: `Hurmatli ${parentName}! Shartnoma bo'yicha ${courseName} kursi uchun 15-sanagacha to'lov qilishingizni so'raymiz. ROBOSCHOOL` },
    { id: 'absent', label: '❌ Darsga kelmadi', color: 'bg-red-50 text-red-700 border-red-200', text: `Farzandingiz ${student.fullName} bugungi ${today} ${courseName} darsiga kelmadi. Sababini aniqlashingizni so'raymiz. ROBOSCHOOL` },
    { id: 'welcome', label: '🎉 Yangi qabul', color: 'bg-green-50 text-green-700 border-green-200', text: `Assalomu alaykum! Farzandingiz ${student.fullName} Roboschool o'quv markaziga qabul qilindi. Telegram: https://t.me/roboschool_chinoz ROBOSCHOOL` },
    { id: 'achievement', label: '🏆 Muvaffaqiyat', color: 'bg-purple-50 text-purple-700 border-purple-200', text: `Farzandingiz ${student.fullName} loyiha ishlarini muvaffaqiyatli topshirdi. Tabriklaymiz! Hurmat bilan ROBOSCHOOL` },
    { id: 'warning', label: '⚠️ Ogohlantirish', color: 'bg-orange-50 text-orange-700 border-orange-200', text: `Farzandingiz ${student.fullName} bugungi darsda kechikib keldi. Iltimos e'tibor bering. Hurmat bilan ROBOSCHOOL` },
    { id: 'debt', label: '🔴 Qarz eslatma', color: 'bg-red-50 text-red-700 border-red-200', text: `Hurmatli ${parentName}! Farzandingiz uchun o'tgan oy to'lovi qilinmagan. To'lov qilishingizni so'raymiz. ROBOSCHOOL` },
    { id: 'thanks', label: '✅ Tashakkur', color: 'bg-teal-50 text-teal-700 border-teal-200', text: `Hurmatli ${parentName}! To'lovni o'z vaqtida qilganingiz uchun tashakkur. Hurmat bilan ROBOSCHOOL` },
  ];
  const warningReasons = ['kechikib keldi', 'darsga tayyor emas holda keldi', 'daftar ruchka qoldirgan', 'uy vazifalarni qilmagan', 'loyiha ishlarini topshirmagan'];
  const handleSend = async () => {
    if (!phone || !message) { toast.error("Xabar yozing!"); return; }
    setSending(true);
    try { await smsAPI.send({ phone, message }); toast.success(`SMS yuborildi: ${phone}`); onClose(); } catch (e) { toast.error("SMS xatolik"); } finally { setSending(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg mx-4 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center px-6 py-4 border-b"><h3 className="text-lg font-bold">📱 SMS</h3><button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100">✕</button></div>
        <div className="p-6 space-y-4">
          <div className="p-3 bg-gray-50 rounded-xl"><p className="font-semibold">{student.fullName}</p><p className="text-xs text-gray-400">{student.group?.course?.icon} {student.group?.name || 'Guruhsiz'}</p></div>
          <div><label className="block text-xs font-semibold text-gray-600 mb-2">📞 Kimga:</label>
            <div className="space-y-1.5">
              {student.fatherPhone && <label className={`flex items-center gap-2 p-2.5 rounded-xl cursor-pointer border-2 ${phone === student.fatherPhone ? 'border-teal-500 bg-teal-50' : 'border-gray-100'}`}><input type="radio" name="ph" value={student.fatherPhone} checked={phone === student.fatherPhone} onChange={e => setPhone(e.target.value)} /><span className="text-sm">👨 {student.fatherName} — {student.fatherPhone}</span></label>}
              {student.motherPhone && <label className={`flex items-center gap-2 p-2.5 rounded-xl cursor-pointer border-2 ${phone === student.motherPhone ? 'border-teal-500 bg-teal-50' : 'border-gray-100'}`}><input type="radio" name="ph" value={student.motherPhone} checked={phone === student.motherPhone} onChange={e => setPhone(e.target.value)} /><span className="text-sm">👩 {student.motherName} — {student.motherPhone}</span></label>}
              <label className={`flex items-center gap-2 p-2.5 rounded-xl cursor-pointer border-2 ${phone === student.parentPhone ? 'border-teal-500 bg-teal-50' : 'border-gray-100'}`}><input type="radio" name="ph" value={student.parentPhone} checked={phone === student.parentPhone} onChange={e => setPhone(e.target.value)} /><span className="text-sm">📞 Asosiy: {student.parentPhone}</span></label>
            </div></div>
          <div><label className="block text-xs font-semibold text-gray-600 mb-2">Shablon:</label>
            <div className="grid grid-cols-2 gap-2">{templates.map(t => (
              <button key={t.id} onClick={() => { setMessage(t.text); setActiveTemplate(t.id); }}
                className={`text-xs p-2 rounded-xl font-semibold text-left border ${activeTemplate === t.id ? t.color + ' border-current' : 'bg-gray-50 text-gray-600 border-transparent hover:bg-gray-100'}`}>{t.label}</button>
            ))}</div></div>
          {activeTemplate === 'warning' && <div><div className="flex flex-wrap gap-1.5">{warningReasons.map(r => (
            <button key={r} onClick={() => setMessage(`Farzandingiz ${student.fullName} bugungi darsda ${r}. Iltimos e'tibor bering. Hurmat bilan ROBOSCHOOL`)}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200">{r}</button>
          ))}</div></div>}
          <div><textarea className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:border-teal-500 focus:outline-none min-h-[80px]" value={message} onChange={e => setMessage(e.target.value)} />
            <p className={`text-xs mt-1 ${message.length > 160 ? 'text-red-500 font-bold' : 'text-gray-400'}`}>{message.length}/160</p></div>
          <button onClick={handleSend} disabled={sending || !message} className="w-full py-3 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700 disabled:opacity-50">
            {sending ? 'Yuborilmoqda...' : `SMS yuborish (${phone})`}</button>
        </div>
      </div>
    </div>
  );
}

function ProfileModal({ student, onClose }) {
  const s = student;
  const c = s.group?.course;
  const [tab, setTab] = useState('info');
  const [attendance, setAttendance] = useState([]);
  const [loadingAtt, setLoadingAtt] = useState(false);
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7));

  const level = getStudentLevel(s.totalPoints);
  const nextInfo = getPointsToNextLevel(s.totalPoints);

  useEffect(() => {
    if (tab === 'attendance') {
      setLoadingAtt(true);
      attendanceAPI.getByStudent(s.id)
        .then(r => {
          let arr = [];
          if (Array.isArray(r?.data?.records)) arr = r.data.records;
          else if (Array.isArray(r?.data)) arr = r.data;
          else if (Array.isArray(r?.records)) arr = r.records;
          else if (Array.isArray(r)) arr = r;
          setAttendance(arr);
        })
        .catch((err) => {
          console.error('Attendance yuklashda xato:', err);
          setAttendance([]);
        })
        .finally(() => setLoadingAtt(false));
    }
  }, [tab, s.id]);

  // Xavfsiz array
  const safeAttendance = Array.isArray(attendance) ? attendance : [];

  // Tanlangan oy bo'yicha filter
  const filteredAtt = safeAttendance.filter(a => {
    if (!a?.date) return false;
    const d = new Date(a.date).toISOString().slice(0, 7);
    return d === filterMonth;
  });

  // Foiz hisobi
  const total = filteredAtt.length;
  const present = filteredAtt.filter(a => a.status === 'PRESENT').length;
  const absent = filteredAtt.filter(a => a.status === 'ABSENT').length;
  const excused = filteredAtt.filter(a => a.status === 'EXCUSED').length;
  const late = filteredAtt.filter(a => a.status === 'LATE').length;
  const percent = total > 0 ? Math.round((present / total) * 100) : 0;

  // Oylar ro'yxati
  const availableMonths = [...new Set(safeAttendance.map(a => {
    if (!a?.date) return null;
    return new Date(a.date).toISOString().slice(0, 7);
  }).filter(Boolean))].sort().reverse();
  if (!availableMonths.includes(filterMonth)) availableMonths.unshift(filterMonth);

  const statusLabel = {
    PRESENT: { label: '✅ Keldi', color: 'bg-green-50 text-green-700' },
    ABSENT: { label: '❌ Kelmadi', color: 'bg-red-50 text-red-700' },
    EXCUSED: { label: '📝 Sababli', color: 'bg-yellow-50 text-yellow-700' },
    LATE: { label: '⏰ Kech', color: 'bg-orange-50 text-orange-700' },
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg mx-4 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="relative">
          <div className="h-20 rounded-t-2xl" style={{ background: `linear-gradient(135deg, ${c?.color || '#6B7280'}, ${c?.color || '#6B7280'}88)` }} />
          <button onClick={onClose} className="absolute top-3 right-3 p-2 rounded-lg bg-white/20 text-white hover:bg-white/30"><X size={18} /></button>
          <div className="px-6 -mt-10">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-white text-2xl font-bold border-4 border-white shadow-lg" style={{ background: c?.color || '#6B7280' }}>{s.fullName.charAt(0)}</div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-xl font-extrabold">{s.fullName}</h2>
                <p className="text-sm text-gray-500">{c?.icon} {s.group?.name || 'Guruhsiz'} • {s.age} yosh</p>
              </div>
              <div className="text-right">
                <span className="text-lg font-bold" style={{ color: level.color }}>{level.emoji} {level.name}</span>
                <p className="text-xs text-gray-500">⭐ {s.totalPoints || 0} ball</p>
              </div>
            </div>
            {/* Level progress */}
            <div className="mt-2 p-2.5 rounded-xl" style={{ background: `${level.color}10` }}>
              <div className="flex justify-between text-[10px] text-gray-500 mb-0.5">
                <span>{level.emoji} {level.name}</span>
                <span>{nextInfo.next ? `${nextInfo.next.emoji} ${nextInfo.next.name} gacha ${nextInfo.remaining} ball` : '🏆 Eng yuqori daraja!'}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div className="h-1.5 rounded-full transition-all" style={{ width: `${nextInfo.progress}%`, background: level.color }} />
              </div>
            </div>
          </div>

          <div className="flex gap-2 border-b">
            <button onClick={() => setTab('info')}
              className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${tab === 'info' ? 'border-teal-600 text-teal-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              👤 Ma'lumotlar
            </button>
            <button onClick={() => setTab('attendance')}
              className={`px-4 py-2 text-sm font-semibold border-b-2 transition flex items-center gap-1.5 ${tab === 'attendance' ? 'border-teal-600 text-teal-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              <Calendar size={14} /> Davomat tarixi
            </button>
          </div>

          {tab === 'info' && (
            <div className="space-y-3">
              {s.metrikaNumber && (
                <div className="p-3 bg-blue-50 rounded-xl">
                  <p className="text-xs text-blue-500 font-semibold">📋 Metrika</p>
                  <p className="text-sm font-bold text-blue-800">{s.metrikaNumber}</p>
                </div>
              )}
              <div className="space-y-2">
                <h4 className="text-sm font-bold">👨‍👩‍👦 Ota-ona</h4>
                {s.fatherName && (
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                    <div><p className="text-sm font-semibold">👨 {s.fatherName}</p><p className="text-xs text-gray-400">{s.fatherPhone}</p></div>
                    {s.fatherPhone && <a href={`tel:${s.fatherPhone}`} className="p-2 rounded-lg bg-green-50 text-green-600"><Phone size={16} /></a>}
                  </div>
                )}
                {s.motherName && (
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                    <div><p className="text-sm font-semibold">👩 {s.motherName}</p><p className="text-xs text-gray-400">{s.motherPhone}</p></div>
                    {s.motherPhone && <a href={`tel:${s.motherPhone}`} className="p-2 rounded-lg bg-green-50 text-green-600"><Phone size={16} /></a>}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'attendance' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Oyni tanlang</label>
                <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
                  className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:border-teal-500 focus:outline-none">
                  {availableMonths.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              {loadingAtt ? (
                <div className="flex justify-center py-10">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
                </div>
              ) : (
                <>
                  <div className="p-4 bg-gradient-to-br from-teal-50 to-green-50 rounded-xl border border-teal-100">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-semibold text-gray-700">Davomat foizi</span>
                      <span className={`text-2xl font-extrabold ${percent >= 80 ? 'text-green-600' : percent >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {percent}%
                      </span>
                    </div>
                    <div className="bg-white rounded-full h-2.5 overflow-hidden">
                      <div className={`h-full rounded-full ${percent >= 80 ? 'bg-green-500' : percent >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                        style={{ width: `${percent}%` }} />
                    </div>
                    <div className="grid grid-cols-4 gap-2 mt-3">
                      <div className="text-center p-2 bg-white rounded-lg">
                        <p className="text-lg font-bold text-green-600">{present}</p>
                        <p className="text-[10px] text-gray-500">✅ Keldi</p>
                      </div>
                      <div className="text-center p-2 bg-white rounded-lg">
                        <p className="text-lg font-bold text-red-600">{absent}</p>
                        <p className="text-[10px] text-gray-500">❌ Kelmadi</p>
                      </div>
                      <div className="text-center p-2 bg-white rounded-lg">
                        <p className="text-lg font-bold text-yellow-600">{excused}</p>
                        <p className="text-[10px] text-gray-500">📝 Sababli</p>
                      </div>
                      <div className="text-center p-2 bg-white rounded-lg">
                        <p className="text-lg font-bold text-orange-600">{late}</p>
                        <p className="text-[10px] text-gray-500">⏰ Kech</p>
                      </div>
                    </div>
                  </div>

                  {filteredAtt.length > 0 ? (
                    <div className="space-y-1.5 max-h-64 overflow-y-auto">
                      {[...filteredAtt].sort((a, b) => new Date(b.date) - new Date(a.date)).map((a, i) => {
                        const info = statusLabel[a.status] || { label: a.status || '—', color: 'bg-gray-50 text-gray-700' };
                        return (
                          <div key={a.id || i} className="flex justify-between items-center p-2.5 bg-gray-50 rounded-xl">
                            <span className="text-sm font-medium text-gray-700">
                              {new Date(a.date).toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric', weekday: 'short' })}
                            </span>
                            <span className={`text-xs px-2.5 py-1 rounded-lg font-semibold ${info.color}`}>{info.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-center text-gray-400 py-6 text-sm">Bu oyda davomat yozuvi yo'q</p>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}