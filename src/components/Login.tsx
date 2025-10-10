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
    <div className="min-h-screen flex bg-gradient-to-br from-[#E0F7FA] to-[#B3E5FC] overflow-hidden relative">
      {/* Left side: Login Form */}
      <div className="w-full md:w-1/2 flex items-center justify-center px-4">
        <div className="p-10 w-full max-w-lg bg-white rounded-3xl shadow-2xl transform transition duration-1000 animate-slide-fade">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#008080] to-[#ADD8E6] mb-4">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Welcome Back</h1>
            <p className="text-gray-600">Sign in to your account</p>
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
              className="w-full py-3 btn-primary text-white font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition transform hover:scale-105"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-600">
            <p>Contact your administrator for login credentials</p>
          </div>
        </div>
      </div>

      {/* Right side: Floating Graphics and Text */}
      <div className="hidden md:flex w-1/2 relative overflow-hidden">
        <div className="absolute top-12 left-12 text-white font-bold text-4xl tracking-wide animate-float">
          Welcome to <br /> Our System
        </div>
        <div className="absolute bottom-24 right-12 text-white text-lg animate-float-slow">
          Secure, Professional & Modern
        </div>

        {/* Floating circles */}
        <div className="absolute -top-24 -left-24 w-80 h-80 bg-pink-200 opacity-20 rounded-full animate-spin-slow"></div>
        <div className="absolute -bottom-28 -right-28 w-96 h-96 bg-white opacity-10 rounded-full animate-spin-slow-reverse"></div>
        <div className="absolute top-40 right-32 text-pink-300 text-xl animate-float-slow">
          Easy & Fast
        </div>
        <div className="absolute bottom-40 left-28 text-white text-lg animate-float">
          Reliable & Modern
        </div>
      </div>

      {/* Tailwind animation classes */}
      <style>
        {`
          @keyframes slideFade {
            0% { opacity: 0; transform: translateX(-50px); }
            100% { opacity: 1; transform: translateX(0); }
          }
          .animate-slide-fade {
            animation: slideFade 1s ease-out forwards;
          }

          @keyframes float {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
          }
          .animate-float { animation: float 4s ease-in-out infinite; }

          @keyframes floatSlow {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-6px); }
          }
          .animate-float-slow { animation: floatSlow 6s ease-in-out infinite; }

          @keyframes spinSlow {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          .animate-spin-slow { animation: spinSlow 30s linear infinite; }
          .animate-spin-slow-reverse { animation: spinSlow 40s linear reverse infinite; }
        `}
      </style>
    </div>
  );
}
