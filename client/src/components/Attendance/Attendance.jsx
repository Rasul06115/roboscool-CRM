import { useState, useEffect } from 'react';
import { Check, X, Clock, MessageSquare, Trophy, Send, AlertTriangle, Star } from 'lucide-react';
import toast from 'react-hot-toast';
import { groupsAPI, attendanceAPI, smsAPI } from '../../utils/api';
import api from '../../utils/api';

export default function Attendance() {
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendSms, setSendSms] = useState(true);
  const [showAchievementModal, setShowAchievementModal] = useState(null);

  useEffect(() => {
    groupsAPI.getAll().then(r => setGroups(r.data));
  }, []);

  useEffect(() => {
    if (selectedGroup && date) loadAttendance();
  }, [selectedGroup, date]);

  const loadAttendance = async () => {
    setLoading(true);
    try {
      const res = await attendanceAPI.get({ groupId: selectedGroup, date });
      setData(res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const toggleStatus = (studentId, status) => {
    if (!data) return;
    setData(prev => ({
      ...prev,
      attendance: prev.attendance.map(a =>
        a.studentId === studentId ? { ...a, status: a.status === status ? null : status } : a
      ),
    }));
  };

  const handleSave = async () => {
    if (!data) return;
    const records = data.attendance
      .filter(a => a.status)
      .map(a => ({ studentId: a.studentId, status: a.status, note: a.note || null }));

    if (records.length === 0) { toast.error("Kamida 1 ta o'quvchini belgilang!"); return; }

    setSaving(true);
    try {
      const res = await api.post('/attendance/bulk', {
        groupId: selectedGroup, date, records, sendSms,
      });
      toast.success(res.message || 'Davomat saqlandi!');
      loadAttendance();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const markAllPresent = () => {
    if (!data) return;
    setData(prev => ({
      ...prev,
      attendance: prev.attendance.map(a => ({ ...a, status: 'PRESENT' })),
    }));
  };

  const getDayName = (dateStr) => {
    const days = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
    return days[new Date(dateStr).getDay()];
  };

  const stats = data ? {
    total: data.attendance.length,
    present: data.attendance.filter(a => a.status === 'PRESENT').length,
    absent: data.attendance.filter(a => a.status === 'ABSENT').length,
    late: data.attendance.filter(a => a.status === 'LATE').length,
    unmarked: data.attendance.filter(a => !a.status).length,
  } : null;

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Header: Guruh va Sana tanlash */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">📚 Guruh tanlang</label>
            <select value={selectedGroup} onChange={e => setSelectedGroup(e.target.value)}
              className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:border-teal-500 focus:outline-none">
              <option value="">Guruhni tanlang</option>
              {groups.map(g => (
                <option key={g.id} value={g.id}>
                  {g.course?.icon} {g.name} — {g.teacher?.fullName} ({g.schedule})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">📅 Sana</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:border-teal-500 focus:outline-none" />
            <p className="text-xs text-gray-400 mt-1">{getDayName(date)}</p>
          </div>
          <div className="flex items-end">
            {data && (
              <button onClick={markAllPresent}
                className="w-full px-4 py-2.5 bg-green-50 text-green-700 rounded-xl text-sm font-semibold hover:bg-green-100 border border-green-200">
                ✅ Hammasini "Keldi" qilish
              </button>
            )}
          </div>
        </div>

        {/* Guruh ma'lumoti */}
        {data?.group && (
          <div className="mt-4 p-3 bg-gray-50 rounded-xl flex flex-wrap gap-4 text-sm">
            <span className="font-semibold">{data.group.course?.icon} {data.group.name}</span>
            <span className="text-gray-500">👨‍🏫 {data.group.teacher?.fullName}</span>
            <span className="text-gray-500">⏰ {data.group.startTime || '8:00'} — {data.group.endTime || '10:00'}</span>
            <span className="text-gray-500">📅 {data.group.weekDays || data.group.schedule}</span>
          </div>
        )}
      </div>

      {/* Statistika */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { l: 'Jami', v: stats.total, c: 'text-gray-800', bg: 'bg-gray-50' },
            { l: 'Keldi', v: stats.present, c: 'text-green-700', bg: 'bg-green-50' },
            { l: 'Kelmadi', v: stats.absent, c: 'text-red-700', bg: 'bg-red-50' },
            { l: 'Kechikdi', v: stats.late, c: 'text-yellow-700', bg: 'bg-yellow-50' },
            { l: 'Belgilanmagan', v: stats.unmarked, c: 'text-gray-500', bg: 'bg-gray-50' },
          ].map((s, i) => (
            <div key={i} className={`${s.bg} rounded-xl p-3 border border-gray-100`}>
              <p className="text-xs text-gray-500">{s.l}</p>
              <p className={`text-xl font-extrabold ${s.c}`}>{s.v}</p>
            </div>
          ))}
        </div>
      )}

      {/* Davomat jadvali */}
      {!selectedGroup ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
          <p className="text-4xl mb-3">📋</p>
          <p className="text-gray-400">Davomat belgilash uchun guruhni tanlang</p>
        </div>
      ) : loading ? (
        <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" /></div>
      ) : data ? (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">O'quvchi</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Ota-ona</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Keldi</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Kelmadi</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Kechikdi</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Sababli</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Ball</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">SMS</th>
                </tr>
              </thead>
              <tbody>
                {data.attendance.map((a, i) => (
                  <tr key={a.studentId} className={`border-t border-gray-50 ${a.status === 'ABSENT' ? 'bg-red-50/30' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 text-xs">{i + 1}</span>
                        <div>
                          <p className="font-semibold text-gray-900">{a.studentName}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs text-gray-600">{a.fatherName && `👨 ${a.fatherName}`}</p>
                      <p className="text-xs text-gray-400">{a.parentPhone}</p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => toggleStatus(a.studentId, 'PRESENT')}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center mx-auto transition-all ${a.status === 'PRESENT' ? 'bg-green-500 text-white shadow-lg scale-110' : 'bg-gray-100 text-gray-400 hover:bg-green-100'}`}>
                        <Check size={18} />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => toggleStatus(a.studentId, 'ABSENT')}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center mx-auto transition-all ${a.status === 'ABSENT' ? 'bg-red-500 text-white shadow-lg scale-110' : 'bg-gray-100 text-gray-400 hover:bg-red-100'}`}>
                        <X size={18} />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => toggleStatus(a.studentId, 'LATE')}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center mx-auto transition-all ${a.status === 'LATE' ? 'bg-yellow-500 text-white shadow-lg scale-110' : 'bg-gray-100 text-gray-400 hover:bg-yellow-100'}`}>
                        <Clock size={18} />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => toggleStatus(a.studentId, 'EXCUSED')}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center mx-auto transition-all ${a.status === 'EXCUSED' ? 'bg-blue-500 text-white shadow-lg scale-110' : 'bg-gray-100 text-gray-400 hover:bg-blue-100'}`}>
                        <AlertTriangle size={16} />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => setShowAchievementModal(a)}
                        className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto bg-purple-50 text-purple-600 hover:bg-purple-100 transition-all" title="Ball berish">
                        <Trophy size={16} />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      {a.smsSent && <span className="text-xs px-2 py-1 bg-green-50 text-green-600 rounded-lg font-semibold">✅ Yuborildi</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Saqlash bo'limi */}
          <div className="p-4 bg-gray-50 border-t flex flex-col sm:flex-row justify-between items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={sendSms} onChange={e => setSendSms(e.target.checked)}
                className="w-4 h-4 rounded text-teal-600" />
              <span className="text-sm font-medium text-gray-700">
                📱 Kelmagan o'quvchi ota-onasiga SMS yuborish
              </span>
            </label>
            <div className="flex gap-3">
              <button onClick={loadAttendance}
                className="px-5 py-2.5 bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-300">
                Yangilash
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700 disabled:opacity-50">
                {saving ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <Send size={16} />}
                {saving ? 'Saqlanmoqda...' : 'Davomatni saqlash'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Ball berish modali */}
      {showAchievementModal && (
        <AchievementModal
          student={showAchievementModal}
          onClose={() => setShowAchievementModal(null)}
          onSaved={loadAttendance}
        />
      )}
    </div>
  );
}

// ==================== BALL BERISH MODAL ====================
function AchievementModal({ student, onClose, onSaved }) {
  const [form, setForm] = useState({
    type: 'PROJECT_DONE',
    title: '',
    description: '',
    points: 10,
    sendSms: true,
  });
  const [saving, setSaving] = useState(false);

  const types = [
    { value: 'PROJECT_DONE', label: '🏆 Loyiha topshirdi', defaultPoints: 20 },
    { value: 'HOMEWORK_DONE', label: '📝 Uy vazifasini bajardi', defaultPoints: 5 },
    { value: 'CONTEST_WIN', label: '🥇 Musobaqada g\'alaba', defaultPoints: 50 },
    { value: 'GOOD_BEHAVIOR', label: '⭐ Yaxshi xulq', defaultPoints: 10 },
    { value: 'ATTENDANCE_STREAK', label: '📅 Muntazam davomat', defaultPoints: 15 },
    { value: 'OTHER', label: '🎯 Boshqa', defaultPoints: 10 },
  ];

  const ic = "w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:border-teal-500 focus:outline-none";

  const handleSave = async () => {
    if (!form.title) { toast.error('Sarlavha kiriting!'); return; }
    setSaving(true);
    try {
      await api.post('/achievements', {
        studentId: student.studentId,
        ...form,
        points: Number(form.points),
      });
      toast.success(`${student.studentName} ga ${form.points} ball berildi! 🎉`);
      onSaved();
      onClose();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center px-6 py-4 border-b">
          <h3 className="text-lg font-bold">🏆 Ball berish</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100">✕</button>
        </div>
        <div className="p-6 space-y-4">
          <div className="p-3 bg-purple-50 rounded-xl">
            <p className="font-semibold">{student.studentName}</p>
            <p className="text-xs text-gray-500">Ota-ona: {student.parentPhone}</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">Yutuq turi</label>
            <div className="grid grid-cols-2 gap-2">
              {types.map(t => (
                <button key={t.value} onClick={() => setForm({ ...form, type: t.value, points: t.defaultPoints })}
                  className={`p-2 rounded-xl text-xs font-semibold text-left transition-all ${form.type === t.value ? 'bg-purple-100 text-purple-700 border-2 border-purple-300' : 'bg-gray-50 text-gray-600 border-2 border-transparent hover:bg-gray-100'}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Sarlavha *</label>
            <input className={ic} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder="Masalan: Arduino loyiha — Traffic Light" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">⭐ Ball</label>
              <input className={ic} type="number" min="1" max="100" value={form.points}
                onChange={e => setForm({ ...form, points: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Izoh</label>
              <input className={ic} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="Qo'shimcha" />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer p-3 bg-green-50 rounded-xl">
            <input type="checkbox" checked={form.sendSms} onChange={e => setForm({ ...form, sendSms: e.target.checked })}
              className="w-4 h-4 rounded text-teal-600" />
            <span className="text-sm font-medium text-green-700">📱 Ota-onaga tabrik SMS yuborish</span>
          </label>

          <button onClick={handleSave} disabled={saving}
            className="w-full py-3 bg-purple-600 text-white rounded-xl text-sm font-semibold hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <Star size={16} />}
            {saving ? 'Saqlanmoqda...' : `${form.points} ball berish`}
          </button>
        </div>
      </div>
    </div>
  );
}
