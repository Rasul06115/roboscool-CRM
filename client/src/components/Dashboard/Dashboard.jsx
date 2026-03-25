import { useState, useEffect } from 'react';
import { Users, AlertTriangle } from 'lucide-react';
import { dashboardAPI } from '../../utils/api';
import { formatMoney } from '../../utils/helpers';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { dashboardAPI.getOverview().then(r => setData(r.data)).finally(() => setLoading(false)); }, []);

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" /></div>;
  if (!data) return <p className="text-center text-gray-500 py-10">Ma'lumot yuklanmadi</p>;

  const cards = [
    { label: "Faol o'quvchilar", value: data.students.active, emoji: '👨‍🎓', color: 'text-teal-600' },
    { label: 'Oylik daromad', value: formatMoney(data.payments.thisMonth), emoji: '💰', color: 'text-blue-600', suffix: " so'm" },
    { label: 'Foyda', value: formatMoney(data.payments.profit), emoji: '📈', color: data.payments.profit >= 0 ? 'text-green-600' : 'text-red-600', suffix: " so'm" },
    { label: 'Konversiya', value: `${data.leads.conversionRate}%`, emoji: '🎯', color: 'text-purple-600' },
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c, i) => (
          <div key={i} className="bg-white rounded-2xl p-5 border border-gray-200">
            <div className="text-3xl mb-2">{c.emoji}</div>
            <p className="text-sm text-gray-500 font-medium">{c.label}</p>
            <p className={`text-2xl font-extrabold ${c.color} mt-1`}>{c.value}{c.suffix && <span className="text-xs font-medium">{c.suffix}</span>}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-gray-900 flex items-center gap-2"><AlertTriangle size={18} className="text-red-500" /> Qarzdorlar</h3>
            <span className="text-xs px-3 py-1 bg-red-50 text-red-600 rounded-full font-semibold">{data.debtors.length} ta</span>
          </div>
          {data.debtors.length === 0 ? <p className="text-center text-gray-400 py-8">Qarzdor yo'q 🎉</p> : (
            <div className="space-y-3">{data.debtors.slice(0, 5).map(d => (
              <div key={d.id} className="flex justify-between items-center py-2 border-b border-gray-50">
                <div><p className="font-semibold text-sm">{d.fullName}</p><p className="text-xs text-gray-400">{d.group?.name || '—'}</p></div>
                <span className="font-bold text-red-600 text-sm">-{formatMoney(Math.abs(d.balance))} so'm</span>
              </div>
            ))}</div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h3 className="font-bold text-gray-900 mb-4">📚 Guruhlar holati</h3>
          <div className="space-y-3">{data.groups.map(g => {
            const fill = g.maxSize > 0 ? Math.round((g.studentCount / g.maxSize) * 100) : 0;
            return (
              <div key={g.id} className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{g.course?.icon}</span>
                    <div><p className="font-bold text-sm">{g.name}</p><p className="text-xs text-gray-400">{g.teacher?.fullName} • {g.schedule}</p></div>
                  </div>
                  <span className="text-xs font-semibold text-gray-500">{g.studentCount}/{g.maxSize}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className={`h-2 rounded-full transition-all ${fill > 80 ? 'bg-red-500' : fill > 50 ? 'bg-yellow-500' : 'bg-green-500'}`} style={{ width: `${fill}%` }} />
                </div>
              </div>
            );
          })}</div>
        </div>
      </div>
    </div>
  );
}
