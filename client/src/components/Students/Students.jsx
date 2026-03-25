import { useState, useEffect } from 'react';
import { Search, Plus, Pencil, Trash2, MessageSquare, Phone, Eye, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { studentsAPI, groupsAPI, smsAPI } from '../../utils/api';
import { formatMoney } from '../../utils/helpers';

export default function Students() {
  const [students, setStudents] = useState([]);
  const [groups, setGroups] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showSmsModal, setSmsModal] = useState(null); // student object
  const [showProfile, setShowProfile] = useState(null); // student object
  const [editItem, setEditItem] = useState(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [s, g] = await Promise.all([studentsAPI.getAll({ search: search || undefined }), groupsAPI.getAll()]);
      setStudents(s.data); setGroups(g.data);
    } catch (e) {} finally { setLoading(false); }
  };

  const handleSave = async (form) => {
    try {
      if (editItem) { await studentsAPI.update(editItem.id, form); toast.success("Yangilandi!"); }
      else { await studentsAPI.create(form); toast.success("O'quvchi qo'shildi!"); }
      setShowModal(false); setEditItem(null); loadData();
    } catch (e) {}
  };

  const handleDelete = async (id) => {
    if (!confirm("O'chirishni xohlaysizmi?")) return;
    await studentsAPI.delete(id); toast.success("O'chirildi!"); loadData();
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:border-teal-500 focus:outline-none"
            placeholder="Ism, telefon yoki ota-ona bo'yicha qidirish..."
            value={search} onChange={e => { setSearch(e.target.value); clearTimeout(window._st); window._st = setTimeout(loadData, 300); }} />
        </div>
        <button onClick={() => { setEditItem(null); setShowModal(true); }}
          className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700">
          <Plus size={18} /> Yangi o'quvchi
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50">
              {["Ism", "Yosh", "Guruh", "Otasi", "Onasi", "Telefon", "Balans", "Progress", "Amallar"].map(h =>
                <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>)}
            </tr></thead>
            <tbody>{students.map(s => {
              const c = s.group?.course;
              return (
                <tr key={s.id} className="border-t border-gray-50 hover:bg-gray-50/50">
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ background: c?.color || '#6B7280' }}>
                        {s.fullName.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{s.fullName}</p>
                        <div className="flex items-center gap-1">
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${s.status === 'ACTIVE' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                            {s.status === 'ACTIVE' ? 'Faol' : 'Nofaol'}
                          </span>
                          {s.metrikaNumber && <span className="text-xs text-gray-400">• {s.metrikaNumber}</span>}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-gray-600">{s.age}</td>
                  <td className="px-3 py-3">
                    <span className="text-xs px-2 py-1 rounded-lg font-semibold" style={{ background: `${c?.color}15`, color: c?.color }}>
                      {c?.icon} {s.group?.name || '—'}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div>
                      <p className="text-sm text-gray-800">{s.fatherName || '—'}</p>
                      {s.fatherPhone && <p className="text-xs text-gray-400 font-mono">{s.fatherPhone}</p>}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div>
                      <p className="text-sm text-gray-800">{s.motherName || '—'}</p>
                      {s.motherPhone && <p className="text-xs text-gray-400 font-mono">{s.motherPhone}</p>}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-gray-600 font-mono text-xs">{s.parentPhone}</td>
                  <td className={`px-3 py-3 font-bold ${s.balance < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {s.balance < 0 ? '-' : ''}{formatMoney(Math.abs(s.balance))}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-1.5 max-w-[50px]">
                        <div className={`h-1.5 rounded-full ${s.progress > 80 ? 'bg-green-500' : s.progress > 50 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${s.progress}%` }} />
                      </div>
                      <span className="text-xs font-semibold text-gray-500">{s.progress}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => setShowProfile(s)} title="Ko'rish"
                        className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100"><Eye size={14} /></button>
                      <button onClick={() => setSmsModal(s)} title="SMS yuborish"
                        className="p-1.5 rounded-lg bg-purple-50 text-purple-600 hover:bg-purple-100"><MessageSquare size={14} /></button>
                      <button onClick={() => { setEditItem(s); setShowModal(true); }} title="Tahrirlash"
                        className="p-1.5 rounded-lg bg-teal-50 text-teal-600 hover:bg-teal-100"><Pencil size={14} /></button>
                      <button onClick={() => handleDelete(s.id)} title="O'chirish"
                        className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
        {students.length === 0 && !loading && <p className="text-center text-gray-400 py-10">O'quvchi topilmadi</p>}
      </div>

      {/* Student Form Modal */}
      {showModal && <StudentFormModal student={editItem} groups={groups} onSave={handleSave} onClose={() => { setShowModal(false); setEditItem(null); }} />}

      {/* SMS Modal */}
      {showSmsModal && <SmsModal student={showSmsModal} onClose={() => setSmsModal(null)} />}

      {/* Profile Modal */}
      {showProfile && <ProfileModal student={showProfile} onClose={() => setShowProfile(null)} />}
    </div>
  );
}

// ==================== STUDENT FORM MODAL ====================
function StudentFormModal({ student, groups, onSave, onClose }) {
  const [f, setF] = useState({
    fullName: student?.fullName || '',
    age: student?.age || '',
    metrikaNumber: student?.metrikaNumber || '',
    fatherName: student?.fatherName || '',
    fatherPhone: student?.fatherPhone || '',
    motherName: student?.motherName || '',
    motherPhone: student?.motherPhone || '',
    parentPhone: student?.parentPhone || '',
    address: student?.address || '',
    groupId: student?.groupId || '',
    balance: student?.balance || 0,
    progress: student?.progress || 0,
    status: student?.status || 'ACTIVE',
    notes: student?.notes || '',
  });

  const ic = "w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:border-teal-500 focus:outline-none";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl mx-4 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center px-6 py-4 border-b sticky top-0 bg-white z-10">
          <h3 className="text-lg font-bold">{student ? "O'quvchini tahrirlash" : "Yangi o'quvchi"}</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100">✕</button>
        </div>
        <div className="p-6 space-y-5">
          {/* Asosiy ma'lumotlar */}
          <div>
            <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">👤 Asosiy ma'lumotlar</h4>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-xs font-semibold text-gray-600 mb-1">Ism *</label>
                <input className={ic} value={f.fullName} onChange={e => setF({...f, fullName: e.target.value})} placeholder="To'liq ism" /></div>
              <div><label className="block text-xs font-semibold text-gray-600 mb-1">Yoshi</label>
                <input className={ic} type="number" value={f.age} onChange={e => setF({...f, age: e.target.value})} /></div>
              <div><label className="block text-xs font-semibold text-gray-600 mb-1">📋 Metrika raqami</label>
                <input className={ic} value={f.metrikaNumber} onChange={e => setF({...f, metrikaNumber: e.target.value})} placeholder="I-TM 1234567" /></div>
              <div><label className="block text-xs font-semibold text-gray-600 mb-1">Manzil</label>
                <input className={ic} value={f.address} onChange={e => setF({...f, address: e.target.value})} placeholder="Toshkent sh." /></div>
            </div>
          </div>

          {/* Ota-ona ma'lumotlari */}
          <div>
            <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">👨‍👩‍👦 Ota-ona ma'lumotlari</h4>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-xs font-semibold text-gray-600 mb-1">👨 Otasining ismi</label>
                <input className={ic} value={f.fatherName} onChange={e => setF({...f, fatherName: e.target.value})} placeholder="Otasining to'liq ismi" /></div>
              <div><label className="block text-xs font-semibold text-gray-600 mb-1">📱 Otasining telefoni</label>
                <input className={ic} value={f.fatherPhone} onChange={e => setF({...f, fatherPhone: e.target.value})} placeholder="+998..." /></div>
              <div><label className="block text-xs font-semibold text-gray-600 mb-1">👩 Onasining ismi</label>
                <input className={ic} value={f.motherName} onChange={e => setF({...f, motherName: e.target.value})} placeholder="Onasining to'liq ismi" /></div>
              <div><label className="block text-xs font-semibold text-gray-600 mb-1">📱 Onasining telefoni</label>
                <input className={ic} value={f.motherPhone} onChange={e => setF({...f, motherPhone: e.target.value})} placeholder="+998..." /></div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-600 mb-1">📞 Asosiy telefon raqam (SMS uchun) *</label>
                <input className={ic} value={f.parentPhone} onChange={e => setF({...f, parentPhone: e.target.value})} placeholder="+998901234567" />
              </div>
            </div>
          </div>

          {/* O'qish ma'lumotlari */}
          <div>
            <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">📚 O'qish ma'lumotlari</h4>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-xs font-semibold text-gray-600 mb-1">Guruh</label>
                <select className={ic} value={f.groupId} onChange={e => setF({...f, groupId: e.target.value})}>
                  <option value="">Tanlang</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.course?.icon} {g.name} ({g.teacher?.fullName})</option>)}
                </select></div>
              <div><label className="block text-xs font-semibold text-gray-600 mb-1">Status</label>
                <select className={ic} value={f.status} onChange={e => setF({...f, status: e.target.value})}>
                  <option value="ACTIVE">Faol</option><option value="INACTIVE">Nofaol</option>
                  <option value="GRADUATED">Bitirgan</option><option value="EXPELLED">Chiqarilgan</option>
                </select></div>
              <div><label className="block text-xs font-semibold text-gray-600 mb-1">Balans</label>
                <input className={ic} type="number" value={f.balance} onChange={e => setF({...f, balance: e.target.value})} /></div>
              <div><label className="block text-xs font-semibold text-gray-600 mb-1">Progress (%)</label>
                <input className={ic} type="number" min="0" max="100" value={f.progress} onChange={e => setF({...f, progress: e.target.value})} /></div>
            </div>
          </div>

          {/* Izoh */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">📝 Izoh</label>
            <textarea className={`${ic} min-h-[60px]`} value={f.notes} onChange={e => setF({...f, notes: e.target.value})} placeholder="Qo'shimcha ma'lumot..." />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={onClose} className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-200">Bekor qilish</button>
            <button onClick={() => {
              if (!f.fullName || !f.parentPhone) { toast.error("Ism va asosiy telefon kiritilishi shart!"); return; }
              onSave({ ...f, age: f.age ? Number(f.age) : null, balance: Number(f.balance), progress: Number(f.progress), groupId: f.groupId || null });
            }} className="px-5 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700">
              {student ? 'Saqlash' : "Qo'shish"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== SMS MODAL ====================
function SmsModal({ student, onClose }) {
  const [phone, setPhone] = useState(student.parentPhone);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [template, setTemplate] = useState('');

  const templates = [
    { label: "To'lov eslatmasi", text: `RoboSchool: Hurmatli ota-ona, ${student.fullName} ning to'lov muddati yaqinlashmoqda. Summa: ${formatMoney(Math.abs(student.balance))} so'm. Tel: +998901234567` },
    { label: 'Qarz eslatmasi', text: `RoboSchool: ${student.fullName} bo'yicha ${formatMoney(Math.abs(student.balance))} so'm qarz mavjud. Iltimos to'lovni amalga oshiring.` },
    { label: 'Dars eslatmasi', text: `RoboSchool: Hurmatli ota-ona, ${student.fullName} ning darsi bugun. Iltimos vaqtida keling.` },
    { label: "Tabrik", text: `RoboSchool: ${student.fullName} darsda a'lo natija ko'rsatdi! Tabriklaymiz! 🎉` },
  ];

  const handleSend = async () => {
    if (!phone || !message) { toast.error("Telefon va xabar yozing!"); return; }
    setSending(true);
    try {
      await smsAPI.send({ phone, message });
      toast.success(`SMS yuborildi: ${phone}`);
      onClose();
    } catch (e) {
      toast.error("SMS yuborishda xatolik");
    } finally { setSending(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center px-6 py-4 border-b">
          <h3 className="text-lg font-bold">📱 SMS yuborish</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100">✕</button>
        </div>
        <div className="p-6 space-y-4">
          <div className="p-3 bg-gray-50 rounded-xl">
            <p className="text-sm font-semibold">{student.fullName}</p>
            <p className="text-xs text-gray-400">{student.group?.name || 'Guruhsiz'}</p>
          </div>

          {/* Kimga yuborish */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">Kimga yuborish:</label>
            <div className="space-y-2">
              {student.fatherPhone && (
                <label className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input type="radio" name="phone" value={student.fatherPhone} checked={phone === student.fatherPhone}
                    onChange={e => setPhone(e.target.value)} className="text-teal-600" />
                  <span className="text-sm">👨 Otasi — {student.fatherName} ({student.fatherPhone})</span>
                </label>
              )}
              {student.motherPhone && (
                <label className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input type="radio" name="phone" value={student.motherPhone} checked={phone === student.motherPhone}
                    onChange={e => setPhone(e.target.value)} className="text-teal-600" />
                  <span className="text-sm">👩 Onasi — {student.motherName} ({student.motherPhone})</span>
                </label>
              )}
              <label className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input type="radio" name="phone" value={student.parentPhone} checked={phone === student.parentPhone}
                  onChange={e => setPhone(e.target.value)} className="text-teal-600" />
                <span className="text-sm">📞 Asosiy — {student.parentPhone}</span>
              </label>
            </div>
          </div>

          {/* Shablonlar */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">Tayyor shablonlar:</label>
            <div className="flex flex-wrap gap-2">
              {templates.map((t, i) => (
                <button key={i} onClick={() => { setMessage(t.text); setTemplate(t.label); }}
                  className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all ${template === t.label ? 'bg-teal-100 text-teal-700 border border-teal-300' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Xabar matni */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Xabar matni</label>
            <textarea className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:border-teal-500 focus:outline-none min-h-[100px]"
              value={message} onChange={e => setMessage(e.target.value)} placeholder="Xabar matnini yozing..." />
            <p className="text-xs text-gray-400 mt-1">{message.length}/160 belgi</p>
          </div>

          <button onClick={handleSend} disabled={sending}
            className="w-full py-3 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700 disabled:opacity-50 flex items-center justify-center gap-2">
            {sending ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <MessageSquare size={16} />}
            {sending ? 'Yuborilmoqda...' : 'SMS yuborish'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== PROFILE MODAL ====================
function ProfileModal({ student, onClose }) {
  const s = student;
  const c = s.group?.course;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg mx-4 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="relative">
          <div className="h-20 rounded-t-2xl" style={{ background: `linear-gradient(135deg, ${c?.color || '#6B7280'}, ${c?.color || '#6B7280'}88)` }} />
          <button onClick={onClose} className="absolute top-3 right-3 p-2 rounded-lg bg-white/20 text-white hover:bg-white/30"><X size={18} /></button>
          <div className="px-6 -mt-10">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-white text-2xl font-bold border-4 border-white shadow-lg" style={{ background: c?.color || '#6B7280' }}>
              {s.fullName.charAt(0)}
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <h2 className="text-xl font-extrabold text-gray-900">{s.fullName}</h2>
            <p className="text-sm text-gray-500">{c?.icon} {s.group?.name || 'Guruhsiz'} • {s.age} yosh</p>
          </div>

          {s.metrikaNumber && (
            <div className="p-3 bg-blue-50 rounded-xl">
              <p className="text-xs text-blue-500 font-semibold">📋 Metrika raqami</p>
              <p className="text-sm font-bold text-blue-800">{s.metrikaNumber}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-gray-50"><p className="text-xs text-gray-400">Balans</p>
              <p className={`text-lg font-extrabold ${s.balance < 0 ? 'text-red-600' : 'text-green-600'}`}>{formatMoney(s.balance)} so'm</p></div>
            <div className="p-3 rounded-xl bg-gray-50"><p className="text-xs text-gray-400">Progress</p>
              <p className="text-lg font-extrabold text-gray-900">{s.progress}%</p></div>
          </div>

          {/* Ota-ona */}
          <div className="space-y-2">
            <h4 className="text-sm font-bold text-gray-700">👨‍👩‍👦 Ota-ona</h4>
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

          {s.address && (
            <div><p className="text-xs text-gray-400">📍 Manzil</p><p className="text-sm">{s.address}</p></div>
          )}
          {s.notes && (
            <div><p className="text-xs text-gray-400">📝 Izoh</p><p className="text-sm">{s.notes}</p></div>
          )}
        </div>
      </div>
    </div>
  );
}
