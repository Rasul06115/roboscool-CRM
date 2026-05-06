import { Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { LayoutDashboard, Users, BookOpen, DollarSign, Phone, BarChart3, Menu, X, Bot, LogOut, User, ClipboardCheck, MessageSquare } from 'lucide-react';
import { useAuth } from './context/AuthContext';

import Login from './components/Auth/Login';
import Dashboard from './components/Dashboard/Dashboard';
import Students from './components/Students/Students';
import Courses from './components/Courses/Courses';
import Finance from './components/Finance/Finance';
import Leads from './components/Leads/Leads';
import Reports from './components/Reports/Reports';
import Attendance from './components/Attendance/Attendance';
import SmsCenter from './components/SmsCenter/SmsCenter';

const navItems = [
  { path: '/', label: 'Boshqaruv', icon: LayoutDashboard },
  { path: '/students', label: "O'quvchilar", icon: Users },
  { path: '/attendance', label: 'Davomat', icon: ClipboardCheck },
  { path: '/courses', label: 'Kurslar', icon: BookOpen },
  { path: '/finance', label: 'Moliya', icon: DollarSign },
  { path: '/sms', label: 'SMS Markaz', icon: MessageSquare },
  { path: '/leads', label: 'Leadlar', icon: Phone },
  { path: '/reports', label: 'Hisobotlar', icon: BarChart3 },
];

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const { user, loading, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  if (loading) return <div className="flex items-center justify-center h-screen bg-gray-100"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600" /></div>;

  if (!user) return <Routes><Route path="/login" element={<Login />} /><Route path="*" element={<Navigate to="/login" />} /></Routes>;

  const currentPage = navItems.find(item => item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path));

  return (
    <div className="flex h-screen bg-gray-100">
      {sidebarOpen && <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-gray-900 text-white flex flex-col transform transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center"><Bot size={24} /></div>
            <div><h1 className="text-lg font-extrabold tracking-tight">RoboSchool</h1><p className="text-xs text-gray-500 font-medium">CRM Pro v2.2</p></div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(item => (
            <NavLink key={item.path} to={item.path} end={item.path === '/'} onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-all ${isActive ? 'bg-gradient-to-r from-teal-600 to-teal-700 text-white shadow-lg shadow-teal-900/30' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
              <item.icon size={20} />{item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-teal-600 flex items-center justify-center text-sm font-bold">{user.fullName?.charAt(0)}</div>
            <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-white truncate">{user.fullName}</p><p className="text-xs text-gray-400">{user.role}</p></div>
          </div>
          <button onClick={logout} className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-red-400 hover:bg-white/5"><LogOut size={16} /> Chiqish</button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden p-2 rounded-lg hover:bg-gray-100">{sidebarOpen ? <X size={22} /> : <Menu size={22} />}</button>
            <h2 className="text-xl font-extrabold text-gray-900">{currentPage?.label || 'Boshqaruv paneli'}</h2>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500 font-medium hidden sm:block">📅 {new Date().toLocaleDateString('uz-UZ', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-teal-50 rounded-lg"><User size={14} className="text-teal-600" /><span className="text-sm font-semibold text-teal-700">{user.role}</span></div>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-6">
          <Routes>
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/students" element={<ProtectedRoute><Students /></ProtectedRoute>} />
            <Route path="/attendance" element={<ProtectedRoute><Attendance /></ProtectedRoute>} />
            <Route path="/courses" element={<ProtectedRoute><Courses /></ProtectedRoute>} />
            <Route path="/finance" element={<ProtectedRoute><Finance /></ProtectedRoute>} />
            <Route path="/sms" element={<ProtectedRoute><SmsCenter /></ProtectedRoute>} />
            <Route path="/leads" element={<ProtectedRoute><Leads /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
