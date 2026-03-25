import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Bot, Eye, EyeOff, LogIn } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) { toast.error("Email va parolni kiriting!"); return; }
    setLoading(true);
    try {
      await login(email, password);
      toast.success('Tizimga xush kelibsiz!');
    } catch (err) {
      toast.error(err.response?.data?.error || "Login xatosi");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-teal-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-teal-500/30">
            <Bot size={40} className="text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">RoboSchool</h1>
          <p className="text-gray-400 mt-1">CRM Tizimi v2.0</p>
        </div>

        {/* Login Form */}
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 p-8 shadow-2xl">
          <h2 className="text-xl font-bold text-white mb-6">Tizimga kirish</h2>

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20 transition-all"
                placeholder="admin@roboschool.uz"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Parol</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20 transition-all pr-12"
                  placeholder="••••••"
                  onKeyDown={e => e.key === 'Enter' && handleSubmit(e)}
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                  {showPass ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <button onClick={handleSubmit} disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2 hover:from-teal-600 hover:to-teal-700 transition-all disabled:opacity-50 shadow-lg shadow-teal-500/25">
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
              ) : (
                <><LogIn size={18} /> Kirish</>
              )}
            </button>
          </div>

          <div className="mt-6 p-4 bg-white/5 rounded-xl border border-white/10">
            <p className="text-xs text-gray-400 mb-1">Demo login:</p>
            <p className="text-sm text-gray-300 font-mono">admin@roboschool.uz / admin123</p>
          </div>
        </div>
      </div>
    </div>
  );
}
