import { useState, useEffect } from 'react';
import { Filter, Save, Send, ChevronDown, ChevronUp, Star } from 'lucide-react';
import toast from 'react-hot-toast';
import { groupsAPI, evaluationsAPI, smsAPI, achievementsAPI } from '../../utils/api';
import { getStudentLevel, EVALUATION_RATINGS, EVALUATION_FIELDS, ACHIEVEMENT_TYPES } from '../../utils/helpers';

const RATINGS = EVALUATION_RATINGS;
const FIELDS = EVALUATION_FIELDS;

export default function Evaluation() {
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [studentsData, setStudentsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingEvals, setLoadingEvals] = useState(false);
  const [expandedStudent, setExpandedStudent] = useState(null);
  const [saving, setSaving] = useState({});

  useEffect(() => { loadGroups(); }, []);

  const loadGroups = async () => {
    try {
      const g = await groupsAPI.getAll();
      setGroups(g.data);
      if (g.data.length > 0) {
        setSelectedGroup(g.data[0].id);
      }
    } catch (e) {} finally { setLoading(false); }
  };

  // Guruh va oy o'zgarganda baholashlarni yuklash
  useEffect(() => {
    if (selectedGroup && period) loadEvaluations();
  }, [selectedGroup, period]);

  const loadEvaluations = async () => {
    setLoadingEvals(true);
    try {
      const r = await evaluationsAPI.getByGroup({ groupId: selectedGroup, period });
      setStudentsData(r.data.map(s => ({
        ...s,
        // Agar baholash mavjud bo'lsa — oldingi qiymatlar
        form: {
          teamwork: s.evaluation?.teamwork || 'AVERAGE',
          thinking: s.evaluation?.thinking || 'AVERAGE',
          behavior: s.evaluation?.behavior || 'GOOD',
          mastery: s.evaluation?.mastery || 'AVERAGE',
          creativity: s.evaluation?.creativity || 'AVERAGE',
          decisionMaking: s.evaluation?.decisionMaking || 'AVERAGE',
          independence: s.evaluation?.independence || 'AVERAGE',
          note: s.evaluation?.note || '',
        },
        saved: !!s.evaluation,
        smsSent: s.evaluation?.smsSent || false,
      })));
    } catch (e) {
      console.error(e);
      setStudentsData([]);
    } finally { setLoadingEvals(false); }
  };

  // Bitta o'quvchining bahosini o'zgartirish
  const updateStudentField = (studentId, field, value) => {
    setStudentsData(prev => prev.map(s =>
      s.studentId === studentId
        ? { ...s, form: { ...s.form, [field]: value }, saved: false }
        : s
    ));
  };

  // Bitta o'quvchini saqlash
  const handleSave = async (studentId, sendSms = false) => {
    const student = studentsData.find(s => s.studentId === studentId);
    if (!student) return;

    setSaving(prev => ({ ...prev, [studentId]: true }));
    try {
      await evaluationsAPI.upsert({
        studentId,
        period,
        ...student.form,
        sendSms,
      });
      setStudentsData(prev => prev.map(s =>
        s.studentId === studentId ? { ...s, saved: true, smsSent: sendSms || s.smsSent } : s
      ));
      toast.success(`${student.fullName} baholandi! ${sendSms ? '📱 SMS yuborildi' : ''}`);
    } catch (e) {
      toast.error('Xatolik!');
    } finally {
      setSaving(prev => ({ ...prev, [studentId]: false }));
    }
  };

  // Hammasini saqlash
  const handleSaveAll = async () => {
    const unsaved = studentsData.filter(s => !s.saved);
    if (unsaved.length === 0) { toast('Hammasi saqlangan!'); return; }

    for (const s of unsaved) {
      await handleSave(s.studentId, false);
    }
    toast.success(`${unsaved.length} ta o'quvchi baholandi!`);
  };

  // Hammasiga SMS
  const handleSendAllSms = async () => {
    const saved = studentsData.filter(s => s.saved && !s.smsSent);
    if (saved.length === 0) { toast('SMS yuboriladigan o\'quvchi yo\'q'); return; }
    if (!confirm(`${saved.length} ta ota-onaga SMS yuboriladi. Davom etasizmi?`)) return;

    for (const s of saved) {
      await handleSave(s.studentId, true);
    }
    toast.success(`${saved.length} ta SMS yuborildi!`);
  };

  // Bahoni hisoblash (umumiy o'rtacha)
  const getOverallRating = (form) => {
    const scores = { POOR: 1, AVERAGE: 2, GOOD: 3, EXCELLENT: 4 };
    const values = FIELDS.map(f => scores[form[f.key]] || 2);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    if (avg >= 3.5) return { label: "A'lo", emoji: '⭐', color: '#F59E0B' };
    if (avg >= 2.5) return { label: 'Yaxshi', emoji: '🟢', color: '#22C55E' };
    if (avg >= 1.5) return { label: "O'rta", emoji: '🟡', color: '#EAB308' };
    return { label: 'Qoniqarsiz', emoji: '🔴', color: '#EF4444' };
  };

  const selectedGroupObj = groups.find(g => g.id === selectedGroup);

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" /></div>;

  return (
    <div className="space-y-5 animate-fadeIn">

      {/* Filtr */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <select value={selectedGroup} onChange={e => setSelectedGroup(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:border-teal-500 focus:outline-none bg-white">
            <option value="">Guruh tanlang</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.course?.icon} {g.name}</option>)}
          </select>
        </div>
        <input type="month" value={period} onChange={e => setPeriod(e.target.value)}
          className="px-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:border-teal-500 focus:outline-none bg-white" />
        <button onClick={handleSaveAll}
          className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700">
          <Save size={16} /> Hammasini saqlash
        </button>
        <button onClick={handleSendAllSms}
          className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-semibold hover:bg-purple-700">
          <Send size={16} /> SMS yuborish
        </button>
      </div>

      {/* Info banner */}
      {selectedGroupObj && (
        <div className="p-4 rounded-2xl border" style={{ background: `${selectedGroupObj.course?.color}08`, borderColor: `${selectedGroupObj.course?.color}30` }}>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{selectedGroupObj.course?.icon}</span>
              <div>
                <p className="font-bold" style={{ color: selectedGroupObj.course?.color }}>{selectedGroupObj.name}</p>
                <p className="text-xs text-gray-500">{selectedGroupObj.course?.name} • {period} • {studentsData.length} o'quvchi</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-green-600">{studentsData.filter(s => s.saved).length} / {studentsData.length} baholangan</p>
              <p className="text-xs text-gray-400">{studentsData.filter(s => s.smsSent).length} ta SMS yuborilgan</p>
            </div>
          </div>
        </div>
      )}

      {/* O'quvchilar ro'yxati */}
      {loadingEvals ? (
        <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" /></div>
      ) : studentsData.length === 0 ? (
        <div className="text-center text-gray-400 py-10 bg-white rounded-2xl border">
          {selectedGroup ? "Bu guruhda faol o'quvchi yo'q" : "Guruh tanlang"}
        </div>
      ) : (
        <div className="space-y-3">
          {studentsData.map((student) => {
            const level = getStudentLevel(student.totalPoints);
            const overall = getOverallRating(student.form);
            const isExpanded = expandedStudent === student.studentId;
            const isSaving = saving[student.studentId];

            return (
              <div key={student.studentId} className={`bg-white rounded-2xl border overflow-hidden transition-all ${student.saved ? 'border-green-200' : 'border-gray-200'}`}>
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50"
                  onClick={() => setExpandedStudent(isExpanded ? null : student.studentId)}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm"
                      style={{ background: selectedGroupObj?.course?.color || '#6B7280' }}>
                      {student.fullName.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">
                        {student.fullName}
                        <span className="ml-1.5 text-xs" style={{ color: level.color }}>{level.emoji} {level.name}</span>
                      </p>
                      <p className="text-xs text-gray-400">⭐ {student.totalPoints || 0} ball</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-sm font-bold" style={{ color: overall.color }}>{overall.emoji} {overall.label}</span>
                      {student.saved && <p className="text-[10px] text-green-600">✅ Saqlangan</p>}
                      {student.smsSent && <p className="text-[10px] text-purple-600">📱 SMS</p>}
                    </div>
                    {isExpanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
                  </div>
                </div>

                {/* Baholash formasi */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-100 pt-3">
                    {/* 7 ta mezon */}
                    <div className="space-y-2.5">
                      {FIELDS.map(field => (
                        <div key={field.key} className="flex items-center gap-3">
                          <div className="w-32 flex-shrink-0">
                            <p className="text-xs font-semibold text-gray-700">{field.icon} {field.label}</p>
                          </div>
                          <div className="flex gap-1.5 flex-1">
                            {RATINGS.map(r => (
                              <button key={r.value} onClick={() => updateStudentField(student.studentId, field.key, r.value)}
                                className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                                  student.form[field.key] === r.value
                                    ? 'text-white shadow-sm'
                                    : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                                }`}
                                style={student.form[field.key] === r.value ? { background: r.color } : {}}>
                                {r.emoji} {r.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Izoh */}
                    <div className="mt-3">
                      <input className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl text-sm focus:border-teal-500 focus:outline-none"
                        placeholder="Izoh (ixtiyoriy)..."
                        value={student.form.note}
                        onChange={e => updateStudentField(student.studentId, 'note', e.target.value)} />
                    </div>

                    {/* ⭐ Ball berish */}
                    <div className="mt-3 p-3 bg-purple-50/50 rounded-xl border border-purple-100">
                      <p className="text-xs font-bold text-purple-700 mb-2">⭐ Tezkor ball berish</p>
                      <div className="flex flex-wrap gap-1.5">
                        {ACHIEVEMENT_TYPES.map(t => (
                          <button key={t.value}
                            onClick={async () => {
                              try {
                                await achievementsAPI.add({
                                  studentId: student.studentId,
                                  type: t.value,
                                  title: t.label.replace(/^[^\s]+\s/, ''),
                                  points: t.defaultPoints,
                                  sendSms: false,
                                });
                                // Ballni yangilash
                                const newPoints = (student.totalPoints || 0) + t.defaultPoints;
                                setStudentsData(prev => prev.map(s =>
                                  s.studentId === student.studentId
                                    ? { ...s, totalPoints: newPoints }
                                    : s
                                ));
                                const emoji = t.defaultPoints < 0 ? '⛔' : '⭐';
                                toast.success(`${student.fullName}: ${t.defaultPoints > 0 ? '+' : ''}${t.defaultPoints} ball ${emoji}`);
                              } catch (e) { toast.error('Xatolik!'); }
                            }}
                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all hover:scale-105 ${
                              t.value === 'PENALTY'
                                ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                : 'bg-white text-purple-700 hover:bg-purple-100 border border-purple-200'
                            }`}>
                            {t.icon} {t.label.replace(/^[^\s]+\s/, '')} ({t.defaultPoints > 0 ? '+' : ''}{t.defaultPoints})
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Amallar */}
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => handleSave(student.studentId, false)} disabled={isSaving}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700 disabled:opacity-50">
                        {isSaving ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <Save size={14} />}
                        Saqlash
                      </button>
                      <button onClick={() => handleSave(student.studentId, true)} disabled={isSaving}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-semibold hover:bg-purple-700 disabled:opacity-50">
                        {isSaving ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <Send size={14} />}
                        Saqlash + SMS
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

