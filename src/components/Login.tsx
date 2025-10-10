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
    <div
      className="min-h-screen flex overflow-hidden"
      style={{
        background:
          'linear-gradient(110deg, #007B8A 0%, #00BFFF 45%, #D8468C 75%, #ffffff 95%)',
      }}
    >
      {/* Left side: Login Form */}
      <div className="w-full md:w-1/2 flex items-center justify-center px-6 relative z-10">
        <div className="p-10 w-full max-w-md rounded-2xl shadow-2xl bg-white/20 backdrop-blur-xl animate-slide-in border border-white/30">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#007B8A] to-[#D8468C] mb-4 shadow-md">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-1">
              SmartSave Management
            </h1>
            <p className="text-gray-100/90">
              Transforming Group Savings into Shared Success
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-100/30 border border-red-200/50 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-200 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-100">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-200" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 border border-white/40 rounded-xl bg-white/30 text-white placeholder-gray-200 focus:ring-2 focus:ring-[#00BFFF] focus:border-transparent outline-none transition"
                  placeholder="Enter your email"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-200" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 border border-white/40 rounded-xl bg-white/30 text-white placeholder-gray-200 focus:ring-2 focus:ring-[#00BFFF] focus:border-transparent outline-none transition"
                  placeholder="Enter your password"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-[#007B8A] to-[#D8468C] text-white font-semibold rounded-xl shadow-md hover:scale-105 transition-transform duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-200">
            <p>Contact your administrator for login credentials</p>
          </div>
        </div>
      </div>

      {/* Right side visuals */}
      <div className="hidden md:flex w-1/2 items-center justify-center relative overflow-hidden">
        {/* Gradient overlay for smooth transition */}
        <div className="absolute inset-0 bg-gradient-to-br from-transparent via-[#00BFFF]/40 to-white/40"></div>

        {/* Floating text */}
        <div className="absolute top-20 left-14 text-white font-bold text-4xl tracking-wide animate-fade-float drop-shadow-lg">
          Grow. Save. <br /> Prosper Together.
        </div>
        <div className="absolute bottom-24 right-10 text-white text-lg animate-fade-float-slow">
          Empowering Financial Growth Digitally.
        </div>

        {/* Floating circles */}
        <div className="absolute -top-24 -left-24 w-80 h-80 bg-white/15 opacity-25 rounded-full animate-spin-slow"></div>
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-white/15 opacity-25 rounded-full animate-spin-slow-reverse"></div>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); opacity: 1; }
          50% { transform: translateY(-10px); opacity: 0.85; }
        }
        @keyframes fade-float {
          0%, 100% { transform: translateY(0); opacity: 1; }
          50% { transform: translateY(-12px); opacity: 0.7; }
        }
        @keyframes fade-float-slow {
          0%, 100% { transform: translateY(0); opacity: 1; }
          50% { transform: translateY(-16px); opacity: 0.7; }
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
        .animate-fade-float { animation: fade-float 6s ease-in-out infinite; }
        .animate-fade-float-slow { animation: fade-float-slow 8s ease-in-out infinite; }
        .animate-spin-slow { animation: spin-slow 25s linear infinite; }
        .animate-spin-slow-reverse { animation: spin-slow-reverse 27s linear infinite; }
        .animate-slide-in { animation: slide-in 1s ease forwards; }
      `}</style>
    </div>
  );
}
