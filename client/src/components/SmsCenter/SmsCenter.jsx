import { useState, useEffect } from 'react';
import { Send, Users, Filter, CheckCircle, AlertCircle, MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';
import { groupsAPI, studentsAPI, smsAPI } from '../../utils/api';
import { getStudentLevel, formatMoney } from '../../utils/helpers';

const SMS_TEMPLATES = [
  {
    id: 'POINTS',
    label: '⭐ Ball xabari',
    description: "O'quvchi ball olganda ota-onaga xabar",
    template: 'RoboSchool: Hurmatli ota-ona! {ism} bugungi darsda "{title}" uchun {ball} ball qo\'lga kiritdi. Jami: {jami} ball ({daraja}). Zo\'r natija!',
    fields: ['title', 'ball'],
    color: 'purple',
  },
  {
    id: 'TELEGRAM_JOIN',
    label: '📱 Telegram guruhga kirish',
    description: "Ota-onalarga Telegram guruhga qo'shilish eslatmasi",
    template: 'RoboSchool: Hurmatli ota-ona! {ism} uchun Telegram guruhga kiring. Tezkor xabarlar bor. Izoh qoldiring.',
    fields: [],
    color: 'blue',
  },
  {
    id: 'PAYMENT_REMINDER',
    label: "💰 To'lov eslatmasi",
    description: "To'lov muddati haqida eslatma",
    template: 'RoboSchool: Hurmatli ota-ona! {ism} ning to\'lov muddati yaqinlashdi. Iltimos, to\'lovni amalga oshiring.',
    fields: [],
    color: 'yellow',
  },
  {
    id: 'MONTHLY_REPORT',
    label: '📊 Oylik natijalar',
    description: "O'quvchi oylik ball va daraja natijalarini yuborish",
    template: 'RoboSchool: Hurmatli ota-ona! {ism} ning oylik natijalari: {ball} ball, daraja: {daraja}. Batafsil: botga yozing.',
    fields: [],
    color: 'green',
  },
  {
    id: 'EVALUATION_REPORT',
    label: '📋 Baholash natijalari',
    description: "7 ta mezon bo'yicha baholash natijalarini yuborish",
    template: 'RoboSchool: Hurmatli ota-ona! {ism} ning {oy} oyi natijalari: Jamoaviy ish: {baho}, Xulq: {baho}, O\'zlashtirish: {baho}. Daraja: {daraja}. Batafsil: Telegram botimizga yozing.',
    fields: [],
    color: 'teal',
  },
];

export default function SmsCenter() {
  const [groups, setGroups] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customBall, setCustomBall] = useState('2');
  const [sentResults, setSentResults] = useState(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [g, s] = await Promise.all([groupsAPI.getAll(), studentsAPI.getAll()]);
      setGroups(g.data);
      setStudents(s.data);
    } catch (e) {} finally { setLoading(false); }
  };

  // Filtrlangan o'quvchilar
  const filteredStudents = selectedGroup
    ? students.filter(s => s.groupId === selectedGroup && s.status === 'ACTIVE')
    : students.filter(s => s.status === 'ACTIVE');

  // Hammani tanlash/bekor qilish
  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(filteredStudents.map(s => s.id));
    }
    setSelectAll(!selectAll);
  };

  // Bitta o'quvchini tanlash
  const toggleStudent = (id) => {
    setSelectedStudents(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // SMS preview
  const getPreview = (student) => {
    if (!selectedTemplate) return '';
    const level = getStudentLevel(student.totalPoints);
    let text = selectedTemplate.template;
    text = text.replace('{ism}', student.fullName);
    text = text.replace('{ball}', customBall || student.totalPoints || '0');
    text = text.replace('{jami}', student.totalPoints || '0');
    text = text.replace('{daraja}', `${level.emoji} ${level.name}`);
    text = text.replace('{title}', customTitle || 'Faollik');
    text = text.replace('{oy}', new Date().toLocaleDateString('uz-UZ', { month: 'long' }));
    text = text.replaceAll('{baho}', 'Yaxshi');
    return text;
  };

  // SMS yuborish
  const handleSend = async () => {
    if (!selectedTemplate) { toast.error('Shablon tanlang!'); return; }
    if (selectedStudents.length === 0) { toast.error("O'quvchi tanlang!"); return; }

    const confirmed = confirm(`${selectedStudents.length} ta o'quvchining ota-onasiga SMS yuboriladi. Davom etasizmi?`);
    if (!confirmed) return;

    setSending(true);
    let sent = 0, failed = 0;

    try {
      for (const studentId of selectedStudents) {
        const student = students.find(s => s.id === studentId);
        if (!student?.parentPhone) { failed++; continue; }

        const message = getPreview(student);
        try {
          await smsAPI.send({ phone: student.parentPhone, message });
          sent++;
        } catch (e) { failed++; }
      }

      setSentResults({ sent, failed, total: selectedStudents.length });
      toast.success(`${sent} ta SMS yuborildi!`);
      if (failed > 0) toast.error(`${failed} ta xatolik`);
    } catch (e) {
      toast.error('SMS yuborishda xatolik');
    } finally { setSending(false); }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" /></div>;

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Statistika */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="text-2xl mb-2">📱</div>
          <p className="text-xs text-gray-500">Jami o'quvchilar</p>
          <p className="text-2xl font-extrabold text-teal-600">{students.filter(s => s.status === 'ACTIVE').length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="text-2xl mb-2">👥</div>
          <p className="text-xs text-gray-500">Tanlangan</p>
          <p className="text-2xl font-extrabold text-purple-600">{selectedStudents.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="text-2xl mb-2">📋</div>
          <p className="text-xs text-gray-500">Shablonlar</p>
          <p className="text-2xl font-extrabold text-blue-600">5</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="text-2xl mb-2">{sentResults ? '✅' : '📨'}</div>
          <p className="text-xs text-gray-500">Yuborilgan</p>
          <p className="text-2xl font-extrabold text-green-600">{sentResults?.sent || 0}</p>
        </div>
      </div>

      {/* 1-QADAM: Shablon tanlash */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <h3 className="font-bold mb-3 flex items-center gap-2"><MessageSquare size={18} className="text-teal-600" /> 1. SMS shablon tanlang</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
          {SMS_TEMPLATES.map(t => (
            <button key={t.id} onClick={() => setSelectedTemplate(t)}
              className={`p-3 rounded-xl text-left transition-all border-2 ${
                selectedTemplate?.id === t.id
                  ? 'border-teal-500 bg-teal-50 shadow-sm'
                  : 'border-transparent bg-gray-50 hover:bg-gray-100'
              }`}>
              <p className="text-sm font-bold">{t.label}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">{t.description}</p>
            </button>
          ))}
        </div>

        {/* Ball shablon uchun qo'shimcha maydonlar */}
        {selectedTemplate?.id === 'POINTS' && (
          <div className="grid grid-cols-2 gap-4 mt-3 p-3 bg-purple-50 rounded-xl">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Nima uchun ball?</label>
              <input className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl text-sm focus:border-teal-500 focus:outline-none"
                value={customTitle} onChange={e => setCustomTitle(e.target.value)} placeholder="Masalan: Uy vazifa" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Necha ball?</label>
              <input className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl text-sm focus:border-teal-500 focus:outline-none"
                type="number" value={customBall} onChange={e => setCustomBall(e.target.value)} />
            </div>
          </div>
        )}

        {/* SMS preview */}
        {selectedTemplate && filteredStudents[0] && (
          <div className="mt-3 p-3 bg-gray-50 rounded-xl">
            <p className="text-[10px] text-gray-500 mb-1">📱 SMS ko'rinishi ({filteredStudents[0].fullName} misol):</p>
            <p className="text-xs text-gray-700 font-mono bg-white p-2 rounded-lg border">{getPreview(filteredStudents[0])}</p>
            <p className={`text-[10px] mt-1 ${getPreview(filteredStudents[0]).length > 160 ? 'text-red-500 font-bold' : 'text-gray-400'}`}>
              {getPreview(filteredStudents[0]).length}/160 belgi
            </p>
          </div>
        )}
      </div>

      {/* 2-QADAM: Guruh va o'quvchi tanlash */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <h3 className="font-bold mb-3 flex items-center gap-2"><Users size={18} className="text-teal-600" /> 2. Kimga yuborish?</h3>

        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <select value={selectedGroup} onChange={e => { setSelectedGroup(e.target.value); setSelectedStudents([]); setSelectAll(false); }}
              className="w-full pl-9 pr-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:border-teal-500 focus:outline-none bg-white">
              <option value="">Barcha guruhlar</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.course?.icon} {g.name} ({students.filter(s => s.groupId === g.id && s.status === 'ACTIVE').length} ta)</option>)}
            </select>
          </div>
          <button onClick={toggleSelectAll}
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${selectAll ? 'bg-red-50 text-red-700 hover:bg-red-100' : 'bg-teal-50 text-teal-700 hover:bg-teal-100'}`}>
            {selectAll ? `✕ Bekor (${selectedStudents.length})` : `✅ Hammasini tanlash (${filteredStudents.length})`}
          </button>
        </div>

        <div className="max-h-64 overflow-y-auto space-y-1">
          {filteredStudents.map(s => {
            const level = getStudentLevel(s.totalPoints);
            const isSelected = selectedStudents.includes(s.id);
            return (
              <label key={s.id}
                className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all ${isSelected ? 'bg-teal-50 border-2 border-teal-200' : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'}`}>
                <div className="flex items-center gap-3">
                  <input type="checkbox" checked={isSelected} onChange={() => toggleStudent(s.id)}
                    className="w-4 h-4 rounded text-teal-600" />
                  <div>
                    <p className="text-sm font-semibold">{s.fullName} <span className="text-xs">{level.emoji}</span></p>
                    <p className="text-[10px] text-gray-400">{s.group?.course?.icon} {s.group?.name} • {s.parentPhone}</p>
                  </div>
                </div>
                <span className="text-xs font-bold" style={{ color: level.color }}>{s.totalPoints || 0} ⭐</span>
              </label>
            );
          })}
        </div>
        {filteredStudents.length === 0 && <p className="text-center text-gray-400 py-6 text-sm">O'quvchi topilmadi</p>}
      </div>

      {/* 3-QADAM: Yuborish */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <h3 className="font-bold mb-3 flex items-center gap-2"><Send size={18} className="text-teal-600" /> 3. Yuborish</h3>

        {sentResults && (
          <div className="mb-4 p-4 rounded-xl bg-green-50 border border-green-200">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle size={18} className="text-green-600" />
              <p className="font-bold text-green-700">SMS yuborildi!</p>
            </div>
            <div className="flex gap-4 text-sm">
              <span className="text-green-600">✅ Yuborildi: {sentResults.sent}</span>
              {sentResults.failed > 0 && <span className="text-red-600">❌ Xatolik: {sentResults.failed}</span>}
              <span className="text-gray-500">Jami: {sentResults.total}</span>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-500">
            {selectedTemplate ? (
              <span>📋 <strong>{selectedTemplate.label}</strong> → {selectedStudents.length} ta o'quvchi</span>
            ) : (
              <span className="text-orange-500">⚠️ Avval shablon tanlang</span>
            )}
          </div>
          <button onClick={handleSend} disabled={sending || !selectedTemplate || selectedStudents.length === 0}
            className="flex items-center gap-2 px-6 py-3 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed">
            {sending ? (
              <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Yuborilmoqda...</>
            ) : (
              <><Send size={16} /> {selectedStudents.length} ta SMS yuborish</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
