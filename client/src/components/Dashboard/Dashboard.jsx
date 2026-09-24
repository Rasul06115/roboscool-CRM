import { useState, useEffect, useMemo } from 'react';
import { AlertTriangle, Eye, EyeOff, Search } from 'lucide-react';
import { dashboardAPI, achievementsAPI } from '../../utils/api';
import { formatMoney } from '../../utils/helpers';

// Yashirish holati brauzerda eslab qolinadi (default: yashirin)
const HIDE_KEY = 'dashboard_hide_stats';
const HIDDEN = '••••••';

function readHidden() {
  try {
    const v = localStorage.getItem(HIDE_KEY);
    return v === null ? true : v === '1';
  } catch (_) {
    return true;
  }
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [nominations, setNominations] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hidden, setHidden] = useState(readHidden);
  const [search, setSearch] = useState('');
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    Promise.all([
      dashboardAPI.getOverview().then(r => setData(r.data)).catch(() => {}),
      achievementsAPI.getNominations().then(r => setNominations(r.data)).catch(() => {}),
      achievementsAPI.getLeaderboard().then(r => setLeaderboard(Array.isArray(r.data) ? r.data : [])).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const toggleHidden = () => {
    setHidden(prev => {
      const next = !prev;
      try { localStorage.setItem(HIDE_KEY, next ? '1' : '0'); } catch (_) { /* ignore */ }
      return next;
    });
  };

  const filteredBoard = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? leaderboard.filter(s =>
          s.fullName?.toLowerCase().includes(q) ||
          s.group?.name?.toLowerCase().includes(q))
      : leaderboard;
    return showAll || q ? list : list.slice(0, 10);
  }, [leaderboard, search, showAll]);

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" /></div>;
  if (!data) return <p className="text-center text-gray-500 py-10">Ma'lumot yuklanmadi</p>;

  const cards = [
    { label: "Faol o'quvchilar", value: data.students.active, emoji: '👨‍🎓', color: 'text-teal-600' },
    { label: 'Oylik daromad', value: formatMoney(data.payments.thisMonth), emoji: '💰', color: 'text-blue-600', suffix: " so'm" },
    { label: 'Foyda', value: formatMoney(data.payments.profit), emoji: '📈', color: data.payments.profit >= 0 ? 'text-green-600' : 'text-red-600', suffix: " so'm" },
    { label: 'Konversiya', value: `${data.leads.conversionRate}%`, emoji: '🎯', color: 'text-purple-600' },
  ];

  const rankMedals = ['🥇', '🥈', '🥉'];

  // Global reytingdagi o'rin (qidiruvda ham to'g'ri raqam chiqishi uchun)
  const rankOf = (id) => leaderboard.findIndex(s => s.id === id) + 1;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Statistika + ko'z tugmasi */}
      <div>
        <div className="flex justify-end mb-2">
          <button
            onClick={toggleHidden}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-semibold border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-all"
            title={hidden ? "Ko'rsatish" : 'Yashirish'}
          >
            {hidden ? <EyeOff size={16} /> : <Eye size={16} />}
            {hidden ? "Ko'rsatish" : 'Yashirish'}
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((c, i) => (
            <div key={i} className="bg-white rounded-2xl p-5 border border-gray-200">
              <div className="text-3xl mb-2">{c.emoji}</div>
              <p className="text-sm text-gray-500 font-medium">{c.label}</p>
              <p className={`text-2xl font-extrabold ${hidden ? 'text-gray-300 tracking-widest' : c.color} mt-1`}>
                {hidden ? HIDDEN : c.value}
                {!hidden && c.suffix && <span className="text-xs font-medium">{c.suffix}</span>}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Nominatsiyalar */}
      {nominations && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Oyning eng yaxshi o'quvchisi */}
          <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-2xl border border-amber-200 overflow-hidden">
            <div className="p-5 bg-gradient-to-r from-amber-500 to-yellow-500 text-white">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-2xl">🏆</div>
                <div>
                  <h3 className="font-extrabold text-lg">Oyning eng yaxshi o'quvchisi</h3>
                  <p className="text-amber-100 text-sm">{nominations.monthLabel}</p>
                </div>
              </div>
            </div>
            <div className="p-5">
              {nominations.monthly.length === 0 ? (
                <p className="text-center text-gray-400 py-6">Bu oyda ball berilmagan</p>
              ) : (
                <div className="space-y-2">
                  {nominations.monthly.slice(0, 5).map((s, i) => (
                    <div key={s.studentId} className={`flex items-center justify-between p-3 rounded-xl transition-all ${
                      i === 0 ? 'bg-amber-100 border-2 border-amber-300 shadow-sm' : 'bg-white border border-gray-100'
                    }`}>
                      <div className="flex items-center gap-3">
                        <span className="text-xl w-8 text-center">{rankMedals[i] || `${i + 1}.`}</span>
                        <div>
                          <p className={`font-bold text-sm ${i === 0 ? 'text-amber-800' : 'text-gray-700'}`}>
                            {s.fullName}
                            <span className="ml-1.5 text-xs">{s.levelEmoji}</span>
                          </p>
                          <p className="text-[10px] text-gray-400">{s.courseIcon} {s.groupName}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-extrabold ${i === 0 ? 'text-amber-700 text-lg' : 'text-gray-600 text-sm'}`}>
                          +{s.monthlyPoints} ⭐
                        </p>
                        <p className="text-[10px] text-gray-400">jami: {s.totalPoints}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Yilning eng yaxshi o'quvchisi */}
          <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl border border-purple-200 overflow-hidden">
            <div className="p-5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-2xl">👑</div>
                <div>
                  <h3 className="font-extrabold text-lg">Yilning eng yaxshi o'quvchisi</h3>
                  <p className="text-purple-200 text-sm">{nominations.yearLabel}-yil</p>
                </div>
              </div>
            </div>
            <div className="p-5">
              {nominations.yearly.length === 0 ? (
                <p className="text-center text-gray-400 py-6">Bu yilda ball berilmagan</p>
              ) : (
                <div className="space-y-2">
                  {nominations.yearly.slice(0, 5).map((s, i) => (
                    <div key={s.studentId} className={`flex items-center justify-between p-3 rounded-xl transition-all ${
                      i === 0 ? 'bg-purple-100 border-2 border-purple-300 shadow-sm' : 'bg-white border border-gray-100'
                    }`}>
                      <div className="flex items-center gap-3">
                        <span className="text-xl w-8 text-center">{rankMedals[i] || `${i + 1}.`}</span>
                        <div>
                          <p className={`font-bold text-sm ${i === 0 ? 'text-purple-800' : 'text-gray-700'}`}>
                            {s.fullName}
                            <span className="ml-1.5 text-xs">{s.levelEmoji}</span>
                          </p>
                          <p className="text-[10px] text-gray-400">{s.courseIcon} {s.groupName}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-extrabold ${i === 0 ? 'text-purple-700 text-lg' : 'text-gray-600 text-sm'}`}>
                          +{s.yearlyPoints} ⭐
                        </p>
                        <p className="text-[10px] text-gray-400">jami: {s.totalPoints}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Faol o'quvchilar reytingi (umumiy ball bo'yicha) */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="p-5 bg-gradient-to-r from-teal-600 to-emerald-600 text-white">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-2xl">📊</div>
              <div>
                <h3 className="font-extrabold text-lg">Faol o'quvchilar reytingi</h3>
                <p className="text-teal-100 text-sm">Umumiy ball bo'yicha • {leaderboard.length} ta o'quvchi</p>
              </div>
            </div>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Ism yoki guruh..."
                className="pl-9 pr-3 py-2 rounded-xl text-sm text-gray-800 w-full sm:w-64 outline-none"
              />
            </div>
          </div>
        </div>

        <div className="p-5">
          {leaderboard.length === 0 ? (
            <p className="text-center text-gray-400 py-6">Hali ball to'plagan o'quvchi yo'q</p>
          ) : filteredBoard.length === 0 ? (
            <p className="text-center text-gray-400 py-6">"{search}" bo'yicha topilmadi</p>
          ) : (
            <>
              <div className="space-y-2">
                {filteredBoard.map((s) => {
                  const rank = rankOf(s.id);
                  const top = rank <= 3;
                  return (
                    <div key={s.id} className={`flex items-center justify-between p-3 rounded-xl ${
                      top ? 'bg-teal-50 border border-teal-200' : 'bg-white border border-gray-100'
                    }`}>
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xl w-8 text-center shrink-0">{rankMedals[rank - 1] || `${rank}.`}</span>
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-gray-800 truncate">
                            {s.fullName}
                            <span className="ml-1.5 text-xs">{s.levelEmoji}</span>
                            <span className="ml-1 text-[10px] font-semibold text-gray-400">{s.level}</span>
                          </p>
                          <p className="text-[10px] text-gray-400 truncate">{s.group?.course?.icon} {s.group?.name || '—'}</p>
                        </div>
                      </div>
                      <p className={`font-extrabold shrink-0 ${top ? 'text-teal-700 text-lg' : 'text-gray-600 text-sm'}`}>
                        {s.totalPoints} ⭐
                      </p>
                    </div>
                  );
                })}
              </div>
              {!search && leaderboard.length > 10 && (
                <button
                  onClick={() => setShowAll(v => !v)}
                  className="mt-4 w-full py-2 rounded-xl text-sm font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 transition-all"
                >
                  {showAll ? "Qisqartirish" : `Hammasini ko'rsatish (${leaderboard.length})`}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Qarzdorlar va Guruhlar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-gray-900 flex items-center gap-2"><AlertTriangle size={18} className="text-red-500" /> Qarzdorlar</h3>
            <span className="text-xs px-3 py-1 bg-red-50 text-red-600 rounded-full font-semibold">{hidden ? '•' : data.debtors.length} ta</span>
          </div>
          {hidden ? (
            <p className="text-center text-gray-300 py-8 tracking-widest">{HIDDEN}</p>
          ) : data.debtors.length === 0 ? <p className="text-center text-gray-400 py-8">Qarzdor yo'q 🎉</p> : (
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
