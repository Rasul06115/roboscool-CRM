import { useState, useEffect } from 'react';
import { dashboardAPI } from '../../utils/api';
import { formatMoney } from '../../utils/helpers';

export default function Reports() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { dashboardAPI.getOverview().then(r => setData(r.data)).finally(() => setLoading(false)); }, []);

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" /></div>;
  if (!data) return <p className="text-center text-gray-400 py-10">Ma'lumot yuklanmadi</p>;

  const monthly = data.monthlyRevenue || [];
  const maxRev = Math.max(...monthly.map(m => m.revenue), 1);
  const months = { '01':'Yan','02':'Fev','03':'Mar','04':'Apr','05':'May','06':'Iyn','07':'Iyl','08':'Avg','09':'Sen','10':'Okt','11':'Noy','12':'Dek' };

  return (
    <div className="space-y-6 animate-fadeIn">
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
    </div>
  );
}
