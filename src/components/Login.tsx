import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Lock, Mail, AlertCircle } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
    } catch (err: any) {
      setError(err.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side: Login Form */}
      <div className="w-full md:w-1/2 flex items-center justify-center bg-gradient-to-br from-white to-[#F0FAFA] px-6">
        <div className="p-10 w-full max-w-md bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-100 animate-slide-in">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#008080] to-[#00BFFF] mb-4 shadow-md">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-1">Welcome Back</h1>
            <p className="text-gray-600">Your Trusted Partner in Smart Savings</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#008080] focus:border-transparent outline-none transition"
                  placeholder="Enter your email"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#008080] focus:border-transparent outline-none transition"
                  placeholder="Enter your password"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-[#008080] to-[#00BFFF] text-white font-semibold rounded-xl shadow-md hover:scale-105 transition-transform duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-600">
            <p>Contact your administrator for login credentials</p>
          </div>
        </div>
      </div>

      {/* Right side: Graphics / Floating Text */}
      <div className="hidden md:flex w-1/2 bg-gradient-to-br from-[#00BFFF] via-[#008080] to-[#FF6F91] relative overflow-hidden">
        <div className="absolute top-16 left-12 text-white font-bold text-4xl tracking-wide animate-float">
          Empower Your <br /> Savings Journey
        </div>
        <div className="absolute bottom-20 right-10 text-white text-lg animate-float-slow">
          Safe. Smart. Sustainable Growth.
        </div>

        {/* Floating circles */}
        <div className="absolute -top-24 -left-24 w-80 h-80 bg-white opacity-10 rounded-full animate-spin-slow"></div>
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-white opacity-10 rounded-full animate-spin-slow-reverse"></div>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        @keyframes float-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-15px); }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes spin-slow-reverse {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
        @keyframes slide-in {
          from { opacity: 0; transform: translateX(-40px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .animate-float { animation: float 5s ease-in-out infinite; }
        .animate-float-slow { animation: float-slow 7s ease-in-out infinite; }
        .animate-spin-slow { animation: spin-slow 20s linear infinite; }
        .animate-spin-slow-reverse { animation: spin-slow-reverse 22s linear infinite; }
        .animate-slide-in { animation: slide-in 0.8s ease forwards; }
      `}</style>
    </div>
  );
}
