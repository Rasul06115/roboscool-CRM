import { useState, useEffect } from 'react';
import { FileDown, X } from 'lucide-react';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { dashboardAPI, paymentsAPI, groupsAPI, studentsAPI } from '../../utils/api';
import { formatMoney } from '../../utils/helpers';

export default function Reports() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPdfModal, setShowPdfModal] = useState(false);

  useEffect(() => { dashboardAPI.getOverview().then(r => setData(r.data)).finally(() => setLoading(false)); }, []);

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" /></div>;
  if (!data) return <p className="text-center text-gray-400 py-10">Ma'lumot yuklanmadi</p>;

  const monthly = data.monthlyRevenue || [];
  const maxRev = Math.max(...monthly.map(m => m.revenue), 1);
  const months = { '01':'Yan','02':'Fev','03':'Mar','04':'Apr','05':'May','06':'Iyn','07':'Iyl','08':'Avg','09':'Sen','10':'Okt','11':'Noy','12':'Dek' };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* YANGI: PDF eksport tugmasi */}
      <div className="flex justify-end">
        <button onClick={() => setShowPdfModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700 shadow-sm">
          <FileDown size={18} /> Oylik PDF hisobot
        </button>
      </div>

      {/* --- QOLGAN BARCHA KOD O'ZGARMAS --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h3 className="font-bold mb-6">📈 Oylik daromad</h3>
          <div className="flex gap-4 items-end h-48">
            {[...monthly].reverse().map((m, i) => {
              const h = (m.revenue / maxRev) * 160;
              const mk = m.month.split('-')[1];
              return (<div key={i} className="flex-1 flex flex-col items-center">
                <p className="text-xs font-bold text-gray-700 mb-2">{formatMoney(m.revenue / 1000)}k</p>
                <div className="w-full max-w-[60px] rounded-t-lg bg-gradient-to-t from-teal-600 to-teal-400" style={{ height: Math.max(h, 8) }} />
                <p className="text-xs text-gray-500 mt-2 font-semibold">{months[mk] || mk}</p>
              </div>);
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h3 className="font-bold mb-6">📱 Lead manbalari</h3>
          <div className="space-y-4">
            {(data.leads.bySource || []).map((s, i) => {
              const colors = { INSTAGRAM: '#E1306C', TELEGRAM: '#229ED9', REFERRAL: '#10B981', WEBSITE: '#8B5CF6' };
              const pct = data.leads.total > 0 ? Math.round((s.count / data.leads.total) * 100) : 0;
              return (<div key={i}>
                <div className="flex justify-between mb-1"><span className="text-sm font-semibold capitalize">{s.source.toLowerCase()}</span><span className="text-sm text-gray-500">{s.count} ta ({s.converted} konversiya)</span></div>
                <div className="bg-gray-200 rounded-full h-2.5"><div className="h-2.5 rounded-full" style={{ width: `${pct}%`, background: colors[s.source] || '#6B7280' }} /></div>
              </div>);
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h3 className="font-bold mb-4">💰 Kurslar bo'yicha</h3>
          {data.courses.map(c => (
            <div key={c.id} className="flex items-center gap-3 py-3 border-b border-gray-50">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: `${c.color}15` }}>{c.icon}</div>
              <div className="flex-1"><p className="font-semibold text-sm">{c.name}</p><p className="text-xs text-gray-400">{c.studentCount || 0} o'quvchi • {c.groupCount || 0} guruh</p></div>
              <p className="font-bold text-green-600 text-sm">{formatMoney(c.price * (c.studentCount || 0))} so'm</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h3 className="font-bold mb-4">👨‍🎓 Umumiy statistika</h3>
          {[
            { l: "Jami o'quvchilar", v: data.students.total, i: '👥' },
            { l: 'Faol', v: data.students.active, i: '✅' },
            { l: 'Nofaol', v: data.students.inactive, i: '❌' },
            { l: "O'rtacha progress", v: `${data.students.avgProgress}%`, i: '📊' },
            { l: 'Qarzdorlar', v: data.students.debtors, i: '⚠️' },
            { l: 'Lead konversiya', v: `${data.leads.conversionRate}%`, i: '🎯' },
            { l: 'Oylik foyda', v: `${formatMoney(data.payments.profit)} so'm`, i: '💵' },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3 py-3 border-b border-gray-50">
              <span className="text-xl">{item.i}</span><span className="flex-1 text-sm text-gray-600">{item.l}</span><span className="font-bold">{item.v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* YANGI: PDF modal */}
      {showPdfModal && <PdfModal onClose={() => setShowPdfModal(false)} />}
    </div>
  );
}

// ==================== PDF MODAL ====================
function PdfModal({ onClose }) {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [generating, setGenerating] = useState(false);

  const generatePDF = async () => {
    setGenerating(true);
    try {
      // Barcha kerakli ma'lumotlarni yuklaymiz
      const [paymentsRes, studentsRes, groupsRes] = await Promise.all([
        paymentsAPI.getAll(),
        studentsAPI.getAll(),
        groupsAPI.getAll(),
      ]);
      const payments = paymentsRes.data || [];
      const students = studentsRes.data || [];
      const groups = groupsRes.data || [];

      // Tanlangan oy uchun to'lovlar
      const monthPayments = payments.filter(p => p.monthFor === month);

      // PDF yaratish
      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.text(`Oylik hisobot: ${month}`, 14, 18);
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Yaratilgan: ${new Date().toLocaleDateString('uz-UZ')}`, 14, 25);

      // Umumiy statistika
      const totalRevenue = monthPayments.reduce((s, p) => s + p.amount, 0);
      const paidStudentIds = new Set(monthPayments.map(p => p.studentId));
      const activeStudents = students.filter(s => s.status === 'ACTIVE');
      const debtors = activeStudents.filter(s => !paidStudentIds.has(s.id));

      doc.setFontSize(11);
      doc.setTextColor(0);
      doc.text(`Jami tushum: ${totalRevenue.toLocaleString()} so'm`, 14, 35);
      doc.text(`To'laganlar: ${paidStudentIds.size} ta  |  Qarzdorlar: ${debtors.length} ta`, 14, 42);

      // Har guruh uchun jadval
      let y = 50;
      groups.forEach(g => {
        const gStudents = activeStudents.filter(s => s.groupId === g.id);
        if (gStudents.length === 0) return;

        const rows = gStudents.map(s => {
          const paid = monthPayments.find(p => p.studentId === s.id);
          return [
            s.fullName,
            paid ? 'To\'landi' : 'Qarzdor',
            paid ? paid.amount.toLocaleString() + ' so\'m' : '—',
            paid ? new Date(paid.paymentDate).toLocaleDateString('uz-UZ') : '—',
          ];
        });

        autoTable(doc, {
          startY: y,
          head: [[`${g.name} (${gStudents.length} o'quvchi)`, 'Holat', 'Summa', 'Sana']],
          body: rows,
          theme: 'striped',
          headStyles: { fillColor: [13, 148, 136] },
          styles: { fontSize: 9 },
          margin: { left: 14, right: 14 },
        });
        y = doc.lastAutoTable.finalY + 8;
        if (y > 260) { doc.addPage(); y = 20; }
      });

      doc.save(`hisobot-${month}.pdf`);
      toast.success('PDF yuklandi!');
      onClose();
    } catch (e) {
      console.error(e);
      toast.error('Xatolik yuz berdi');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center px-6 py-4 border-b">
          <h3 className="text-lg font-bold">📄 Oylik PDF hisobot</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Oyni tanlang</label>
            <input type="month" value={month} onChange={e => setMonth(e.target.value)}
              className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:border-teal-500 focus:outline-none" />
          </div>
          <p className="text-xs text-gray-500">
            Hisobotda: har guruh bo'yicha o'quvchilar, to'lov holati, summa va sana ko'rsatiladi.
          </p>
          <div className="flex justify-end gap-3">
            <button onClick={onClose} disabled={generating}
              className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold">Bekor</button>
            <button onClick={generatePDF} disabled={generating}
              className="px-5 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700 disabled:opacity-50">
              {generating ? 'Yaratilmoqda...' : 'PDF yuklash'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}