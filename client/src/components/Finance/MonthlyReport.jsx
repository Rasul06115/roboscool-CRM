import { useState, useEffect } from 'react';
import { Download, Calendar, FileSpreadsheet } from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { groupsAPI, studentsAPI } from '../../utils/api';
import api from '../../utils/api';
import { formatMoney } from '../../utils/helpers';

const LESSONS_PER_MONTH = 13; // 1 oyda 13 ta dars

export default function MonthlyReport() {
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [selectedGroup, setSelectedGroup] = useState('');
  const [groups, setGroups] = useState([]);
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    groupsAPI.getAll().then(r => setGroups(r.data)).catch(() => {});
  }, []);

  // Hisobot yuklash
  const loadReport = async () => {
    setLoading(true);
    try {
      const [year, month] = period.split('-');
      const startDate = `${year}-${month}-01`;
      const endDate = new Date(year, parseInt(month), 0).toISOString().slice(0, 10);

      // O'quvchilar
      const studentsRes = await studentsAPI.getAll();
      let students = studentsRes.data.filter(s => s.status === 'ACTIVE');
      if (selectedGroup) students = students.filter(s => s.groupId === selectedGroup);

      // Har bir o'quvchi uchun davomat va to'lovlarni hisoblash
      const data = [];
      for (const student of students) {
        try {
          // Davomat
          const attRes = await api.get(`/attendance/student/${student.id}?limit=200`);
          const records = (attRes.data?.records || []).filter(r => {
            const d = new Date(r.date).toISOString().slice(0, 10);
            return d >= startDate && d <= endDate;
          });
          const presentCount = records.filter(r => r.status === 'PRESENT' || r.status === 'LATE').length;

          // 1 dars narxi = kurs narxi / 13
          const coursePrice = student.group?.course?.price || 0;
          const lessonPrice = Math.round(coursePrice / LESSONS_PER_MONTH);
          const earnedFromLessons = presentCount * lessonPrice;

          // To'lovlar
          const payRes = await api.get(`/students/${student.id}/payments`).catch(() => ({ data: [] }));
          const monthPayments = (payRes.data || []).filter(p => {
            const d = new Date(p.paymentDate).toISOString().slice(0, 10);
            return d >= startDate && d <= endDate;
          });
          const totalPaid = monthPayments.reduce((s, p) => s + p.amount, 0);

          data.push({
            fullName: student.fullName,
            groupName: student.group?.name || '—',
            courseName: student.group?.course?.name || '—',
            coursePrice,
            lessonPrice,
            attendedLessons: presentCount,
            earnedFromLessons,
            totalPaid,
            parentPhone: student.parentPhone,
          });
        } catch (e) { /* skip */ }
      }

      setReportData(data);
      toast.success(`${data.length} ta o'quvchi yuklandi`);
    } catch (e) {
      toast.error('Xatolik yuz berdi');
    } finally { setLoading(false); }
  };

  // Excel'ga export
  const exportToExcel = () => {
    if (reportData.length === 0) {
      toast.error('Avval hisobotni yuklang!');
      return;
    }

    const rows = reportData.map((r, i) => ({
      '№': i + 1,
      'F.I.Sh': r.fullName,
      'Guruh': r.groupName,
      'Kurs': r.courseName,
      'Kurs narxi': r.coursePrice,
      '1 dars narxi': r.lessonPrice,
      'Qatnashgan darslar': r.attendedLessons,
      'Davomat daromadi': r.earnedFromLessons,
      "To'langan summa": r.totalPaid,
      'Telefon': r.parentPhone,
    }));

    // Jami qator
    const totalAttended = reportData.reduce((s, r) => s + r.attendedLessons, 0);
    const totalEarned = reportData.reduce((s, r) => s + r.earnedFromLessons, 0);
    const totalPaid = reportData.reduce((s, r) => s + r.totalPaid, 0);

    rows.push({
      '№': '',
      'F.I.Sh': 'JAMI',
      'Guruh': '',
      'Kurs': '',
      'Kurs narxi': '',
      '1 dars narxi': '',
      'Qatnashgan darslar': totalAttended,
      'Davomat daromadi': totalEarned,
      "To'langan summa": totalPaid,
      'Telefon': '',
    });

    const ws = XLSX.utils.json_to_sheet(rows);

    // Ustun kengligi
    ws['!cols'] = [
      { wch: 5 },   // №
      { wch: 25 },  // F.I.Sh
      { wch: 15 },  // Guruh
      { wch: 20 },  // Kurs
      { wch: 12 },  // Kurs narxi
      { wch: 12 },  // 1 dars narxi
      { wch: 10 },  // Qatnashgan
      { wch: 15 },  // Davomat daromadi
      { wch: 15 },  // To'langan
      { wch: 15 },  // Telefon
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Hisobot ${period}`);

    const fileName = `RoboSchool_hisobot_${period}.xlsx`;
    XLSX.writeFile(wb, fileName);
    toast.success(`${fileName} yuklandi!`);
  };

  // Statistika
  const totals = reportData.length > 0 ? {
    students: reportData.length,
    attended: reportData.reduce((s, r) => s + r.attendedLessons, 0),
    earned: reportData.reduce((s, r) => s + r.earnedFromLessons, 0),
    paid: reportData.reduce((s, r) => s + r.totalPaid, 0),
  } : null;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <FileSpreadsheet size={20} className="text-green-600" />
        <h3 className="font-bold text-lg">📊 Oylik hisobot</h3>
      </div>

      {/* Filtrlar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">📅 Oy</label>
          <input type="month" value={period} onChange={e => setPeriod(e.target.value)}
            className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:border-teal-500 focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">📚 Guruh</label>
          <select value={selectedGroup} onChange={e => setSelectedGroup(e.target.value)}
            className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:border-teal-500 focus:outline-none">
            <option value="">Barcha guruhlar</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.course?.icon} {g.name}</option>)}
          </select>
        </div>
        <div className="flex items-end gap-2">
          <button onClick={loadReport} disabled={loading}
            className="flex-1 px-4 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700 disabled:opacity-50">
            {loading ? 'Yuklanmoqda...' : '🔄 Hisoblash'}
          </button>
          <button onClick={exportToExcel} disabled={reportData.length === 0}
            className="px-4 py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-50 flex items-center gap-2">
            <Download size={16} /> Excel
          </button>
        </div>
      </div>

      {/* Statistika kartalari */}
      {totals && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
            <p className="text-xs text-gray-500">O'quvchilar</p>
            <p className="text-xl font-extrabold text-blue-700">{totals.students}</p>
          </div>
          <div className="bg-purple-50 rounded-xl p-3 border border-purple-100">
            <p className="text-xs text-gray-500">Qatnashgan darslar</p>
            <p className="text-xl font-extrabold text-purple-700">{totals.attended} ta</p>
          </div>
          <div className="bg-green-50 rounded-xl p-3 border border-green-100">
            <p className="text-xs text-gray-500">Davomat daromadi</p>
            <p className="text-xl font-extrabold text-green-700">{formatMoney(totals.earned)}</p>
          </div>
          <div className="bg-teal-50 rounded-xl p-3 border border-teal-100">
            <p className="text-xs text-gray-500">To'langan</p>
            <p className="text-xl font-extrabold text-teal-700">{formatMoney(totals.paid)}</p>
          </div>
        </div>
      )}

      {/* Jadval */}
      {reportData.length > 0 && (
        <div className="overflow-x-auto border border-gray-200 rounded-xl">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">#</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">F.I.Sh</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Guruh</th>
                <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500">Darslar</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">1 dars</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Daromad</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">To'langan</th>
              </tr>
            </thead>
            <tbody>
              {reportData.map((r, i) => (
                <tr key={i} className="border-t border-gray-100 hover:bg-gray-50/50">
                  <td className="px-3 py-2 text-gray-400 text-xs">{i + 1}</td>
                  <td className="px-3 py-2 font-semibold">{r.fullName}</td>
                  <td className="px-3 py-2 text-xs text-gray-600">{r.groupName}</td>
                  <td className="px-3 py-2 text-center font-bold text-purple-600">{r.attendedLessons}</td>
                  <td className="px-3 py-2 text-right text-xs">{formatMoney(r.lessonPrice)}</td>
                  <td className="px-3 py-2 text-right font-bold text-green-600">{formatMoney(r.earnedFromLessons)}</td>
                  <td className="px-3 py-2 text-right font-bold text-teal-600">{formatMoney(r.totalPaid)}</td>
                </tr>
              ))}
              <tr className="bg-gray-50 font-extrabold border-t-2 border-gray-300">
                <td colSpan="3" className="px-3 py-3">JAMI</td>
                <td className="px-3 py-3 text-center text-purple-700">{totals.attended} ta</td>
                <td></td>
                <td className="px-3 py-3 text-right text-green-700">{formatMoney(totals.earned)} so'm</td>
                <td className="px-3 py-3 text-right text-teal-700">{formatMoney(totals.paid)} so'm</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {reportData.length === 0 && !loading && (
        <p className="text-center text-gray-400 py-6 text-sm">
          📊 Oy va guruhni tanlab "Hisoblash" tugmasini bosing
        </p>
      )}
    </div>
  );
}
