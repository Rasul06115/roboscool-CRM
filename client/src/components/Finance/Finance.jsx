import { useState, useEffect } from 'react';
import { Plus, Trash2, Filter, AlertTriangle, TrendingUp, TrendingDown, DollarSign, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';
import { paymentsAPI, groupsAPI, studentsAPI } from '../../utils/api';
import { formatMoney } from '../../utils/helpers';

export default function Finance() {
  const [payments, setPayments] = useState([]);
  const [groups, setGroups] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filterGroup, setFilterGroup] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [stats, setStats] = useState(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [p, g, s, st] = await Promise.all([paymentsAPI.getAll(), groupsAPI.getAll(), studentsAPI.getAll(), paymentsAPI.getStats()]);
      setPayments(p.data); setGroups(g.data); setStudents(s.data); setStats(st.data);
    } catch (e) {} finally { setLoading(false); }
  };

  // Dinamik narx: 5-sanagacha = 380,000 / keyin = 400,000
  const getDynamicPrice = () => {
    const day = new Date().getDate();
    return day <= 5 ? 380000 : 400000;
  };

  const handleDelete = async (id) => {
    if (!confirm("Bu to'lovni o'chirishni xohlaysizmi?")) return;
    try { await paymentsAPI.delete(id); toast.success("To'lov o'chirildi!"); loadData(); } catch (e) {}
  };

  // Filtrlangan to'lovlar
  const filtered = payments.filter(p => {
    const matchGroup = !filterGroup || p.student?.groupId === filterGroup;
    const matchMonth = !filterMonth || p.monthFor === filterMonth;
    return matchGroup && matchMonth;
  });

  const filteredTotal = filtered.reduce((s, p) => s + p.amount, 0);

  // Oylar ro'yxati
  const months = [...new Set(payments.map(p => p.monthFor).filter(Boolean))].sort().reverse();

  const currentPrice = getDynamicPrice();
  const today = new Date().getDate();

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" /></div>;

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Statistika */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="text-2xl mb-2">💰</div>
          <p className="text-xs text-gray-500">Umumiy daromad</p>
          <p className="text-2xl font-extrabold text-green-600">{formatMoney(stats?.totalRevenue || 0)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="text-2xl mb-2">📅</div>
          <p className="text-xs text-gray-500">Oylik daromad</p>
          <p className="text-2xl font-extrabold text-blue-600">{formatMoney(stats?.monthlyRevenue || 0)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="text-2xl mb-2">💵</div>
          <p className="text-xs text-gray-500">Hozirgi narx</p>
          <p className="text-2xl font-extrabold text-teal-600">{formatMoney(currentPrice)}</p>
          <p className="text-xs mt-1 text-gray-400">
            {today <= 5 ? `⏰ 5-sanagacha: 380 000 (${5 - today} kun qoldi)` : `📌 5-sanadan o'tgan: 400 000`}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="text-2xl mb-2">⚠️</div>
          <p className="text-xs text-gray-500">Umumiy qarz</p>
          <p className="text-2xl font-extrabold text-red-600">{stats?.totalDebt || 0}</p>
        </div>
      </div>

      {/* Narx info banner */}
      <div className={`p-4 rounded-2xl border ${today <= 5 ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'}`}>
        <div className="flex items-center gap-3">
          <Calendar size={20} className={today <= 5 ? 'text-green-600' : 'text-orange-600'} />
          <div>
            <p className="text-sm font-bold">{today <= 5 ? "🟢 Chegirmali muddat (5-sanagacha)" : "🟠 Chegirma muddati o'tgan"}</p>
            <p className="text-xs text-gray-600">5-sanagacha: <b>380 000 so'm</b> | 5-sanadan keyin: <b>400 000 so'm</b></p>
          </div>
        </div>
      </div>

      {/* Filtr va Qo'shish */}
      <div className="flex flex-col sm:flex-row justify-between gap-3">
        <div className="flex gap-3">
          <div className="relative">
            <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <select value={filterGroup} onChange={e => setFilterGroup(e.target.value)}
              className="pl-9 pr-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:border-teal-500 focus:outline-none bg-white min-w-[180px]">
              <option value="">Barcha guruhlar</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.course?.icon} {g.name}</option>)}
            </select>
          </div>
          <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
            className="px-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:border-teal-500 focus:outline-none bg-white">
            <option value="">Barcha oylar</option>
            {months.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          {(filterGroup || filterMonth) && (
            <div className="flex items-center text-sm font-semibold text-teal-600 bg-teal-50 px-3 rounded-xl">
              Jami: {formatMoney(filteredTotal)} so'm ({filtered.length} ta)
            </div>
          )}
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700">
          <Plus size={18} /> To'lov qabul qilish
        </button>
      </div>

      {/* To'lovlar jadvali */}
      <div className="bg-white rounded-2xl border border-gray-200">
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="font-bold">So'nggi to'lovlar</h3>
          <span className="text-sm text-gray-500">{filtered.length} ta to'lov</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50">
              {['#', "O'quvchi", 'Guruh', 'Summa', "To'lov turi", 'Sana', 'Oy uchun', 'Izoh', 'Amal'].map(h =>
                <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}
            </tr></thead>
            <tbody>{filtered.map((p, i) => (
              <tr key={p.id} className="border-t border-gray-50 hover:bg-gray-50/50">
                <td className="px-3 py-3 text-gray-400">{i + 1}</td>
                <td className="px-3 py-3 font-semibold">{p.student?.fullName || '—'}</td>
                <td className="px-3 py-3">
                  <span className="text-xs px-2 py-1 rounded-lg font-semibold" style={{ background: `${p.student?.group?.course?.color}15`, color: p.student?.group?.course?.color }}>
                    {p.student?.group?.course?.icon} {p.student?.group?.name || '—'}
                  </span>
                </td>
                <td className="px-3 py-3 font-bold text-green-600">+{formatMoney(p.amount)}</td>
                <td className="px-3 py-3">
                  <span className={`text-xs px-2 py-1 rounded-lg font-semibold ${
                    p.paymentMethod === 'CASH' ? 'bg-green-50 text-green-700' :
                    p.paymentMethod === 'CLICK' ? 'bg-blue-50 text-blue-700' :
                    p.paymentMethod === 'PAYME' ? 'bg-cyan-50 text-cyan-700' : 'bg-gray-50 text-gray-700'
                  }`}>{p.paymentMethod === 'CASH' ? 'Naqd' : p.paymentMethod}</span>
                </td>
                <td className="px-3 py-3 text-gray-500 text-xs">{new Date(p.paymentDate).toLocaleDateString('uz-UZ')}</td>
                <td className="px-3 py-3 text-gray-600">{p.monthFor || '—'}</td>
                <td className="px-3 py-3 text-gray-400 text-xs">{p.note || '—'}</td>
                <td className="px-3 py-3">
                  <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100" title="O'chirish"><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        {filtered.length === 0 && <p className="text-center text-gray-400 py-10">To'lov topilmadi</p>}
      </div>

      {/* Qarzdorlar */}
      {stats?.debtors && stats.debtors.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h3 className="font-bold mb-4 flex items-center gap-2"><AlertTriangle size={18} className="text-red-500" /> Qarzdorlar</h3>
          <div className="space-y-2">{stats.debtors.map(d => (
            <div key={d.id} className="flex justify-between items-center p-3 bg-red-50/50 rounded-xl">
              <div>
                <p className="font-semibold">{d.fullName}</p>
                <p className="text-xs text-gray-500">{d.group?.course?.icon} {d.group?.name || 'Guruhsiz'}</p>
              </div>
              <p className="font-bold text-red-600">{formatMoney(d.balance)} so'm</p>
            </div>
          ))}</div>
        </div>
      )}

      {showModal && <PaymentModal groups={groups} students={students} currentPrice={currentPrice} onSave={async (form) => {
        try { await paymentsAPI.create(form); toast.success("To'lov qabul qilindi!"); setShowModal(false); loadData(); } catch (e) {}
      }} onClose={() => setShowModal(false)} />}
    </div>
  );
}

// ==================== TO'LOV MODAL ====================
function PaymentModal({ groups, students, currentPrice, onSave, onClose }) {
  const [form, setForm] = useState({
    studentId: '', amount: currentPrice, paymentMethod: 'CASH',
    monthFor: new Date().toISOString().slice(0, 7), note: '',
  });
  const [filterGroup, setFilterGroup] = useState('');
  const ic = "w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:border-teal-500 focus:outline-none";

  const filteredStudents = filterGroup ? students.filter(s => s.groupId === filterGroup) : students;
  const today = new Date().getDate();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center px-6 py-4 border-b">
          <h3 className="text-lg font-bold">💰 To'lov qabul qilish</h3><button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100">✕</button>
        </div>
        <div className="p-6 space-y-4">
          {/* Narx info */}
          <div className={`p-3 rounded-xl text-sm ${today <= 5 ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'}`}>
            <p className="font-bold">{today <= 5 ? '🟢 Chegirmali narx: 380 000 so\'m' : '🟠 Oddiy narx: 400 000 so\'m'}</p>
            <p className="text-xs mt-1">5-sanagacha: 380 000 | 5-sanadan keyin: 400 000</p>
          </div>

          {/* Guruh filtr */}
          <div><label className="block text-xs font-semibold text-gray-600 mb-1">Guruh tanlang</label>
            <select className={ic} value={filterGroup} onChange={e => { setFilterGroup(e.target.value); setForm({...form, studentId: ''}); }}>
              <option value="">Barcha guruhlar</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.course?.icon} {g.name}</option>)}
            </select></div>

          <div><label className="block text-xs font-semibold text-gray-600 mb-1">O'quvchi *</label>
            <select className={ic} value={form.studentId} onChange={e => setForm({...form, studentId: e.target.value})}>
              <option value="">Tanlang</option>
              {filteredStudents.filter(s => s.status === 'ACTIVE').map(s => <option key={s.id} value={s.id}>{s.fullName} {s.group ? `(${s.group.name})` : ''}</option>)}
            </select></div>

          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs font-semibold text-gray-600 mb-1">Summa *</label>
              <input className={ic} type="number" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} />
              <div className="flex gap-1 mt-1">
                <button onClick={() => setForm({...form, amount: 380000})} className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded-lg hover:bg-green-100">380 000</button>
                <button onClick={() => setForm({...form, amount: 400000})} className="text-xs px-2 py-1 bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100">400 000</button>
              </div>
            </div>
            <div><label className="block text-xs font-semibold text-gray-600 mb-1">To'lov turi</label>
              <select className={ic} value={form.paymentMethod} onChange={e => setForm({...form, paymentMethod: e.target.value})}>
                <option value="CASH">💵 Naqd</option><option value="CLICK">📱 Click</option><option value="PAYME">📱 Payme</option><option value="BANK_TRANSFER">🏦 Bank</option>
              </select></div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs font-semibold text-gray-600 mb-1">Qaysi oy uchun</label>
              <input className={ic} type="month" value={form.monthFor} onChange={e => setForm({...form, monthFor: e.target.value})} /></div>
            <div><label className="block text-xs font-semibold text-gray-600 mb-1">Izoh</label>
              <input className={ic} value={form.note} onChange={e => setForm({...form, note: e.target.value})} placeholder="Qo'shimcha" /></div>
          </div>

          <div className="flex justify-end gap-3">
            <button onClick={onClose} className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold">Bekor</button>
            <button onClick={() => { if (!form.studentId) { toast.error("O'quvchi tanlang!"); return; } onSave({ ...form, amount: Number(form.amount) }); }}
              className="px-5 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700">Qabul qilish</button>
          </div>
        </div>
      </div>
    </div>
  );
}
