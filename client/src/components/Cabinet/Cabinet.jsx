import { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine, LabelList } from 'recharts';

// ==================== SOZLAMALAR ====================
const API_BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api';
const BOT_URL = 'https://t.me/RoboSchoolCRM_bot';
const TG_SCRIPT = 'https://telegram.org/js/telegram-web-app.js';
const BRAND = '#0d9488';

const RATING = {
  POOR: { label: 'Qoniqarsiz', color: '#dc2626' },
  AVERAGE: { label: "O'rta", color: '#d97706' },
  GOOD: { label: 'Yaxshi', color: '#16a34a' },
  EXCELLENT: { label: "A'lo", color: '#0d9488' },
};

const ATTENDANCE = {
  PRESENT: { label: 'Keldi', color: '#16a34a' },
  LATE: { label: 'Kechikdi', color: '#d97706' },
  ABSENT: { label: 'Kelmadi', color: '#dc2626' },
  EXCUSED: { label: 'Sababli', color: '#9ca3af' },
};

const MONTHS = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'];

// ==================== YORDAMCHILAR ====================
function loadTelegramScript() {
  return new Promise((resolve) => {
    if (window.Telegram?.WebApp) return resolve(window.Telegram.WebApp);
    const existing = document.querySelector(`script[src="${TG_SCRIPT}"]`);
    const done = () => resolve(window.Telegram?.WebApp || null);
    if (existing) {
      existing.addEventListener('load', done);
      existing.addEventListener('error', done);
      return undefined;
    }
    const s = document.createElement('script');
    s.src = TG_SCRIPT;
    s.async = true;
    s.onload = done;
    s.onerror = done;
    document.head.appendChild(s);
    // Juda sekin tarmoqda ham osilib qolmasin
    setTimeout(done, 6000);
    return undefined;
  });
}

async function apiGet(path, initData) {
  const res = await fetch(`${API_BASE}/cabinet${path}`, {
    headers: { 'X-Telegram-Init-Data': initData },
  });
  let body = null;
  try { body = await res.json(); } catch (_) { /* ignore */ }
  if (!res.ok || !body?.success) {
    const err = new Error(body?.error || "Serverga ulanib bo'lmadi");
    err.status = res.status;
    throw err;
  }
  return body.data;
}

const fmtDate = (d) => {
  const x = new Date(d);
  return `${x.getDate()} ${MONTHS[x.getMonth()]}`;
};

const signed = (n) => (n > 0 ? `+${n}` : `${n}`);

function avatarSrc(avatar) {
  if (!avatar) return null;
  if (/^(https?:|data:)/.test(avatar)) return avatar;
  const base = import.meta.env.VITE_API_URL || '';
  return `${base}${avatar.startsWith('/') ? '' : '/'}${avatar}`;
}

// ==================== ASOSIY KOMPONENT ====================
export default function Cabinet() {
  const [tg, setTg] = useState(null);
  const [initData, setInitData] = useState('');
  const [phase, setPhase] = useState('loading'); // loading | outside | error | ready
  const [error, setError] = useState('');
  const [me, setMe] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');

  // 1) Telegram WebApp
  useEffect(() => {
    let alive = true;
    loadTelegramScript().then((webApp) => {
      if (!alive) return;
      if (!webApp || !webApp.initData) {
        setPhase('outside');
        return;
      }
      try {
        webApp.ready();
        webApp.expand();
        webApp.setHeaderColor?.(BRAND);
        webApp.setBackgroundColor?.('#f3f4f6');
      } catch (_) { /* eski Telegram versiyalari */ }
      setTg(webApp);
      setInitData(webApp.initData);
    });
    return () => { alive = false; };
  }, []);

  // 2) Foydalanuvchi va farzandlar
  useEffect(() => {
    if (!initData) return;
    apiGet('/me', initData)
      .then((data) => {
        setMe(data);
        if (data.children.length > 0) setSelectedId(data.children[0].id);
        setPhase('ready');
      })
      .catch((e) => {
        setError(e.message);
        setPhase('error');
      });
  }, [initData]);

  // 3) Tanlangan o'quvchi profili
  useEffect(() => {
    if (!selectedId || !initData) return;
    let alive = true;
    setProfileLoading(true);
    setProfileError('');
    apiGet(`/student/${selectedId}`, initData)
      .then((d) => { if (alive) setProfile(d); })
      .catch((e) => { if (alive) { setProfile(null); setProfileError(e.message); } })
      .finally(() => { if (alive) setProfileLoading(false); });
    return () => { alive = false; };
  }, [selectedId, initData]);

  const haptic = () => {
    try { tg?.HapticFeedback?.selectionChanged(); } catch (_) { /* ignore */ }
  };

  if (phase === 'loading') return <FullScreen><Spinner /></FullScreen>;

  if (phase === 'outside') {
    return (
      <FullScreen>
        <Message
          icon="📱"
          title="Kabinet Telegram orqali ochiladi"
          text="Bu sahifa Roboschool botidagi «📱 Kabinet» tugmasi orqali ishlaydi."
          action={{ label: 'Botni ochish', href: BOT_URL }}
        />
      </FullScreen>
    );
  }

  if (phase === 'error') {
    return (
      <FullScreen>
        <Message icon="⚠️" title="Kabinetni ochib bo'lmadi" text={error}
          action={{ label: 'Qayta urinish', onClick: () => window.location.reload() }} />
      </FullScreen>
    );
  }

  const children = me?.children || [];

  return (
    <div className="min-h-screen bg-gray-100 pb-8">
      <div className="max-w-md mx-auto px-4 pt-4 space-y-4">
        {me?.isAdmin && (
          <AdminSearch initData={initData} onPick={(id) => { haptic(); setSelectedId(id); }} />
        )}

        {children.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {children.map((c) => (
              <button
                key={c.id}
                onClick={() => { haptic(); setSelectedId(c.id); }}
                className={`shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                  selectedId === c.id ? 'bg-teal-600 text-white shadow' : 'bg-white text-gray-600 border border-gray-200'
                }`}
              >
                {c.fullName.split(' ')[0]}
              </button>
            ))}
          </div>
        )}

        {!selectedId && !me?.isAdmin && (
          <Message
            icon="👨‍👩‍👦"
            title="Farzandingiz hali bog'lanmagan"
            text="Botga farzandingizning to'liq ismini yozing (masalan: Aziz Karimov). Shundan so'ng kabinet avtomatik ochiladi."
            action={{ label: 'Botga qaytish', onClick: () => tg?.close() }}
          />
        )}

        {!selectedId && me?.isAdmin && (
          <p className="text-center text-sm text-gray-500 py-6">Yuqoridan o'quvchini qidiring</p>
        )}

        {selectedId && profileLoading && !profile && <div className="py-16"><Spinner /></div>}
        {selectedId && profileError && (
          <Message icon="⚠️" title="Ma'lumot yuklanmadi" text={profileError} />
        )}
        {profile && <Profile data={profile} dim={profileLoading} />}
      </div>
    </div>
  );
}

// ==================== PROFIL ====================
function Profile({ data, dim }) {
  const { student, points, ranks, evaluation, attendance, achievements, discounts } = data;
  const activeDiscount = discounts.find((d) => d.current && !d.applied);
  const monthRank = ranks.month?.rank;

  return (
    <div className={`space-y-4 transition-opacity ${dim ? 'opacity-60' : ''}`}>
      {/* Sarlavha */}
      <div className="rounded-3xl p-5 text-white bg-gradient-to-br from-teal-600 to-emerald-600 shadow-lg">
        <div className="flex items-center gap-4">
          <Avatar student={student} />
          <div className="min-w-0">
            <h1 className="text-xl font-extrabold leading-tight">{student.fullName}</h1>
            <p className="text-teal-100 text-sm truncate">
              {student.courseIcon} {student.courseName || 'Kurs'} • {student.groupName || '—'}
            </p>
            <span className="inline-block mt-2 text-xs font-bold bg-white/20 rounded-full px-3 py-1">
              {student.level.emoji} {student.level.name}
            </span>
          </div>
        </div>
        <div className="mt-5">
          <div className="flex justify-between text-xs text-teal-100 mb-1.5">
            <span>{student.level.name}</span>
            <span>
              {student.level.next
                ? `${student.level.next.emoji} ${student.level.next.name}gacha ${student.level.remaining} ball`
                : 'Eng yuqori daraja! 🏆'}
            </span>
          </div>
          <div className="h-2.5 bg-white/25 rounded-full overflow-hidden" role="progressbar"
            aria-valuenow={student.level.progress} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-white rounded-full" style={{ width: `${student.level.progress}%` }} />
          </div>
        </div>
      </div>

      {/* Asosiy ko'rsatkichlar */}
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Umumiy ball" value={points.total} unit="⭐" />
        <Stat label={`Bu oy (${points.monthLabel.split(' ')[0]})`} value={signed(points.thisMonth)} unit="ball" />
        <Stat label="Markaz reytingi" value={`${ranks.overall.rank}-o'rin`} hint={`${ranks.overall.total} o'quvchidan`} />
        <Stat
          label="Davomat"
          value={attendance.rate === null ? '—' : `${attendance.rate}%`}
          hint={attendance.total ? `oxirgi ${attendance.total} dars` : "hali dars yo'q"}
        />
      </div>
      {ranks.group && (
        <p className="text-center text-xs text-gray-500 -mt-1">
          {ranks.group.name} guruhida {ranks.group.rank}-o'rin ({ranks.group.total} o'quvchi)
        </p>
      )}

      {/* Chegirma / motivatsiya */}
      {activeDiscount ? (
        <div className="rounded-2xl p-4 bg-rose-50 border border-rose-200">
          <p className="font-extrabold text-rose-700">🎁 {activeDiscount.percent}% chegirma!</p>
          <p className="text-sm text-rose-800 mt-1">
            {activeDiscount.periodLabel}da markaz bo'yicha {activeDiscount.rank}-o'rin.
            {' '}{activeDiscount.validMonthLabel} to'lovi uchun {activeDiscount.percent}% chegirma beriladi.
          </p>
        </div>
      ) : monthRank && monthRank <= 5 ? (
        <div className="rounded-2xl p-4 bg-amber-50 border border-amber-200">
          <p className="font-extrabold text-amber-800">🔥 Oylik reytingda {monthRank}-o'rin!</p>
          <p className="text-sm text-amber-900 mt-1">
            Oy oxirigacha TOP-5 da qolsa — keyingi oy to'loviga 40% chegirma beriladi.
          </p>
        </div>
      ) : monthRank ? (
        <div className="rounded-2xl p-4 bg-white border border-gray-200">
          <p className="text-sm text-gray-700">
            📈 Oylik reytingda <b>{monthRank}-o'rin</b> ({ranks.month.total} o'quvchidan).
            TOP-5 ga kirsa, keyingi oyga <b>40% chegirma</b>!
          </p>
        </div>
      ) : null}

      {/* Baholash */}
      <Card title="📊 Baholash mezonlari" subtitle={evaluation ? evaluation.periodLabel : null}>
        {!evaluation ? (
          <p className="text-sm text-gray-400 py-4 text-center">Hali baholanmagan</p>
        ) : (
          <>
            <div className="space-y-3">
              {evaluation.items.map((it) => <RatingRow key={it.key} item={it} />)}
            </div>
            {evaluation.previousLabel && (
              <p className="text-[11px] text-gray-400 mt-3">↑↓ — {evaluation.previousLabel} bilan taqqoslash</p>
            )}
            {evaluation.note && (
              <div className="mt-3 p-3 rounded-xl bg-gray-50 text-sm text-gray-700">
                💬 <span className="italic">{evaluation.note}</span>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Oylik ballar */}
      <Card title="⭐ Oylik ballar" subtitle="oxirgi 6 oy">
        <PointsChart history={points.history} />
      </Card>

      {/* Davomat */}
      <Card title="📅 Davomat" subtitle={attendance.total ? `oxirgi ${attendance.total} dars` : null}>
        <AttendanceBlock attendance={attendance} />
      </Card>

      {/* Yutuqlar */}
      <Card title="🏆 So'nggi yutuqlar">
        {achievements.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">Hali yutuqlar yo'q</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {achievements.map((a, i) => (
              <li key={i} className="flex items-center gap-3 py-2.5">
                <span className="text-xl w-7 text-center shrink-0" aria-hidden>{a.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{a.title}</p>
                  <p className="text-[11px] text-gray-400">{fmtDate(a.date)}</p>
                </div>
                <span className={`text-sm font-extrabold shrink-0 ${a.points < 0 ? 'text-red-600' : 'text-gray-800'}`}>
                  {signed(a.points)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Guruh ma'lumoti */}
      {(student.teacherName || student.schedule) && (
        <Card title="👩‍🏫 Guruh">
          <dl className="text-sm space-y-1.5">
            {student.teacherName && <Row k="O'qituvchi" v={student.teacherName} />}
            {student.schedule && <Row k="Jadval" v={student.schedule} />}
            {student.time && <Row k="Vaqt" v={student.time} />}
          </dl>
        </Card>
      )}

      <p className="text-center text-[11px] text-gray-400 pt-2">Roboschool o'quv markazi 🤖📚</p>
    </div>
  );
}

// ==================== KICHIK KOMPONENTLAR ====================
function Avatar({ student }) {
  const [broken, setBroken] = useState(false);
  const src = avatarSrc(student.avatar);
  if (src && !broken) {
    return (
      <img src={src} alt={student.fullName} onError={() => setBroken(true)}
        className="w-16 h-16 rounded-2xl object-cover border-2 border-white/40 shrink-0" />
    );
  }
  return (
    <div className="w-16 h-16 rounded-2xl bg-white/20 border-2 border-white/30 flex items-center justify-center text-2xl font-extrabold shrink-0">
      {student.initials}
    </div>
  );
}

function Stat({ label, value, unit, hint }) {
  return (
    <div className="bg-white rounded-2xl p-4 border border-gray-200">
      <p className="text-xs text-gray-500 font-medium">{label}</p>
      <p className="text-2xl font-extrabold text-gray-900 mt-1 leading-none">
        {value}{unit && <span className="text-sm font-semibold text-gray-400 ml-1">{unit}</span>}
      </p>
      {hint && <p className="text-[11px] text-gray-400 mt-1.5">{hint}</p>}
    </div>
  );
}

function Card({ title, subtitle, children }) {
  return (
    <section className="bg-white rounded-2xl p-4 border border-gray-200">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="font-extrabold text-gray-900">{title}</h2>
        {subtitle && <span className="text-xs text-gray-400">{subtitle}</span>}
      </div>
      {children}
    </section>
  );
}

function Row({ k, v }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-gray-500">{k}</dt>
      <dd className="font-semibold text-gray-800 text-right">{v}</dd>
    </div>
  );
}

function RatingRow({ item }) {
  const r = RATING[item.rating] || RATING.AVERAGE;
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="text-gray-700 font-medium">
          <span aria-hidden className="mr-1.5">{item.icon}</span>{item.label}
        </span>
        <span className="font-bold text-gray-800 flex items-center gap-1">
          {r.label}
          {item.delta > 0 && <span className="text-green-600 text-xs" title="O'tgan oydan yaxshilangan">▲</span>}
          {item.delta < 0 && <span className="text-red-600 text-xs" title="O'tgan oydan pasaygan">▼</span>}
        </span>
      </div>
      <div className="grid grid-cols-4 gap-0.5" aria-label={`${item.label}: ${r.label}, 4 dan ${item.score}`}>
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="h-2 first:rounded-l-full last:rounded-r-full"
            style={{ background: n <= item.score ? r.color : '#e5e7eb' }} />
        ))}
      </div>
    </div>
  );
}

function PointsChart({ history }) {
  const data = history.map((h, i) => ({ ...h, isLast: i === history.length - 1 }));
  const hasAny = data.some((d) => d.points !== 0);
  if (!hasAny) return <p className="text-sm text-gray-400 py-4 text-center">Oxirgi 6 oyda ball yo'q</p>;
  const hasNegative = data.some((d) => d.points < 0);

  return (
    <div className="h-44 -ml-3">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 18, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%">
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#6b7280' }} />
          <YAxis width={32} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} allowDecimals={false} />
          {hasNegative && <ReferenceLine y={0} stroke="#d1d5db" />}
          <Tooltip
            cursor={{ fill: 'rgba(13,148,136,0.08)' }}
            formatter={(v) => [`${signed(v)} ball`, 'Ball']}
            labelFormatter={(_, p) => p?.[0]?.payload?.fullLabel || ''}
            contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }}
          />
          <Bar dataKey="points" radius={[4, 4, 0, 0]} maxBarSize={36}>
            {data.map((d) => (
              <Cell key={d.period} fill={d.isLast ? BRAND : '#99d5ce'} />
            ))}
            <LabelList
              dataKey="points"
              content={({ x, y, width, value, index }) =>
                index === data.length - 1 ? (
                  <text x={x + width / 2} y={y - 6} textAnchor="middle" fontSize={11} fontWeight={700} fill="#111827">
                    {signed(value)}
                  </text>
                ) : null}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function AttendanceBlock({ attendance }) {
  if (!attendance.total) return <p className="text-sm text-gray-400 py-4 text-center">Hali davomat yo'q</p>;
  return (
    <>
      <div className="flex flex-wrap gap-1.5" aria-label="Oxirgi darslar davomati">
        {attendance.recent.map((r, i) => {
          const s = ATTENDANCE[r.status] || ATTENDANCE.EXCUSED;
          return (
            <span key={i} title={`${fmtDate(r.date)} — ${s.label}`}
              className="w-5 h-5 rounded-md" style={{ background: s.color }} />
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-4 text-sm">
        {Object.entries(ATTENDANCE).map(([key, s]) => (
          <div key={key} className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: s.color }} aria-hidden />
            <span className="text-gray-600">{s.label}</span>
            <span className="ml-auto font-bold text-gray-800">{attendance.counts[key] || 0}</span>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-gray-400 mt-3">Eskidan yangiga — chapdan o'ngga</p>
    </>
  );
}

function AdminSearch({ initData, onPick }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    let alive = true;
    const t = setTimeout(() => {
      apiGet(`/search?q=${encodeURIComponent(q)}`, initData)
        .then((d) => { if (alive) setResults(d); })
        .catch(() => { if (alive) setResults([]); });
    }, 300);
    return () => { alive = false; clearTimeout(t); };
  }, [q, initData]);

  const shown = useMemo(() => (open ? results : []), [open, results]);

  return (
    <div className="bg-white rounded-2xl p-3 border border-amber-200">
      <p className="text-[11px] font-bold text-amber-700 mb-2">👑 ADMIN — istalgan o'quvchini ko'rish</p>
      <input
        value={q}
        onFocus={() => setOpen(true)}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        placeholder="O'quvchi ismi..."
        className="w-full px-3 py-2.5 rounded-xl border-2 border-gray-200 text-sm focus:border-teal-500 focus:outline-none"
      />
      {shown.length > 0 && (
        <ul className="mt-2 max-h-60 overflow-y-auto divide-y divide-gray-100">
          {shown.map((s) => (
            <li key={s.id}>
              <button
                onClick={() => { onPick(s.id); setOpen(false); }}
                className="w-full flex items-center justify-between gap-2 py-2 text-left"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-gray-800 truncate">{s.fullName}</span>
                  <span className="block text-[11px] text-gray-400 truncate">{s.courseIcon} {s.groupName || '—'}</span>
                </span>
                <span className="text-xs font-bold text-gray-600 shrink-0">{s.level.emoji} {s.totalPoints}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex justify-center">
      <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-teal-600" />
    </div>
  );
}

function FullScreen({ children }) {
  return <div className="min-h-screen bg-gray-100 flex items-center justify-center px-6">{children}</div>;
}

function Message({ icon, title, text, action }) {
  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-200 text-center max-w-sm w-full mx-auto">
      <div className="text-4xl mb-3" aria-hidden>{icon}</div>
      <h2 className="font-extrabold text-gray-900 text-lg">{title}</h2>
      {text && <p className="text-sm text-gray-500 mt-2">{text}</p>}
      {action && (action.href ? (
        <a href={action.href} className="inline-block mt-4 px-5 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-semibold">
          {action.label}
        </a>
      ) : (
        <button onClick={action.onClick} className="mt-4 px-5 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-semibold">
          {action.label}
        </button>
      ))}
    </div>
  );
}
