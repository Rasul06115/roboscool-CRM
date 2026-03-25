import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { paymentsAPI, studentsAPI } from '../../utils/api';
import { formatMoney, getPaymentMethodLabel } from '../../utils/helpers';

export default function Finance() {
  const [payments, setPayments] = useState([]);
  const [stats, setStats] = useState(null);
  const [debtors, setDebtors] = useState([]);
  const [students, setStudents] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);
  const loadData = async () => {
    try {
      const [p, s, d, st] = await Promise.all([paymentsAPI.getAll(), paymentsAPI.getStats(), studentsAPI.getDebtors(), studentsAPI.getAll()]);
      setPayments(p.data); setStats(s.data); setDebtors(d.data); setStudents(st.data);
    } catch (e) {} finally { setLoading(false); }
  };

  const handlePayment = async (form) => {
    try { await paymentsAPI.create(form); toast.success("To'lov qabul qilindi!"); setShowModal(false); loadData(); } catch (e) {}
  };

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" /></div>;

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { l: 'Umumiy daromad', v: formatMoney(stats?.totalRevenue || 0), e: '💰', c: 'text-green-600' },
          { l: 'Oylik daromad', v: formatMoney(stats?.thisMonth || 0), e: '📅', c: 'text-blue-600' },
          { l: "O'sish", v: `${stats?.growth || 0}%`, e: '📈', c: stats?.growth >= 0 ? 'text-green-600' : 'text-red-600' },
          { l: 'Umumiy qarz', v: formatMoney(debtors.reduce((s, d) => s + Math.abs(d.balance), 0)), e: '⚠️', c: 'text-red-600' },
        ].map((c, i) => (
          <div key={i} className="bg-white rounded-2xl p-5 border border-gray-200">
            <div className="text-2xl mb-2">{c.e}</div><p className="text-sm text-gray-500">{c.l}</p><p className={`text-2xl font-extrabold ${c.c}`}>{c.v}</p>
          </div>
        ))}
      </div>

      <div className="flex justify-end"><button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700"><Plus size={18} /> To'lov qabul qilish</button></div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h3 className="font-bold mb-4">💳 So'nggi to'lovlar</h3>
          {payments.slice(0, 10).map(p => (
            <div key={p.id} className="flex justify-between items-center py-3 border-b border-gray-50">
              <div><p className="font-semibold text-sm">{p.student?.fullName}</p><p className="text-xs text-gray-400">{new Date(p.paymentDate).toLocaleDateString()} • {getPaymentMethodLabel(p.paymentMethod)} {p.note && `• ${p.note}`}</p></div>
              <span className="font-bold text-green-600">+{formatMoney(p.amount)}</span>
            </div>
          ))}
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h3 className="font-bold mb-4">🔴 Qarzdorlar</h3>
          {debtors.length === 0 ? <div className="text-center py-10"><p className="text-4xl mb-2">🎉</p><p className="text-gray-400">Qarz yo'q!</p></div> : debtors.map(d => (
            <div key={d.id} className="flex justify-between items-center p-3 mb-2 bg-red-50 rounded-xl border border-red-100">
              <div><p className="font-semibold text-sm">{d.fullName}</p><p className="text-xs text-gray-400">{d.parentPhone}</p></div>
              <span className="font-bold text-red-600">-{formatMoney(Math.abs(d.balance))} so'm</span>
            </div>
          ))}
        </div>
      </div>

      {showModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowModal(false)}>
        <div className="bg-white rounded-2xl w-full max-w-md mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
          <div className="flex justify-between items-center px-6 py-4 border-b"><h3 className="text-lg font-bold">To'lov qabul qilish</h3><button onClick={() => setShowModal(false)} className="p-2 rounded-lg hover:bg-gray-100">✕</button></div>
          <PaymentForm students={students} onSave={handlePayment} />
        </div>
      </div>}
    </div>
  );
}

function PaymentForm({ students, onSave }) {
  const [f, setF] = useState({ studentId: '', amount: '', paymentMethod: 'CASH', note: '' });
  const ic = "w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:border-teal-500 focus:outline-none";
  return (
    <div className="p-6 space-y-4">
      <div><label className="block text-xs font-semibold text-gray-600 mb-1">O'quvchi *</label><select className={ic} value={f.studentId} onChange={e => setF({...f, studentId: e.target.value})}><option value="">Tanlang</option>{students.map(s => <option key={s.id} value={s.id}>{s.fullName} ({s.group?.name || '—'})</option>)}</select></div>
      <div className="grid grid-cols-2 gap-4">
        <div><label className="block text-xs font-semibold text-gray-600 mb-1">Summa *</label><input className={ic} type="number" value={f.amount} onChange={e => setF({...f, amount: e.target.value})} placeholder="400000" /></div>
        <div><label className="block text-xs font-semibold text-gray-600 mb-1">To'lov turi</label><select className={ic} value={f.paymentMethod} onChange={e => setF({...f, paymentMethod: e.target.value})}><option value="CASH">Naqd</option><option value="CLICK">Click</option><option value="PAYME">Payme</option><option value="BANK_TRANSFER">Bank</option></select></div>
      </div>
      <div><label className="block text-xs font-semibold text-gray-600 mb-1">Izoh</label><input className={ic} value={f.note} onChange={e => setF({...f, note: e.target.value})} /></div>
      <button onClick={() => { if (!f.studentId || !f.amount) { toast.error("To'ldiring!"); return; } onSave({ ...f, amount: Number(f.amount) }); }} className="w-full py-2.5 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700">To'lov qabul qilish</button>
    </div>
  );
}
