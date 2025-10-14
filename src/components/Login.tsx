import React, { useCallback, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Lock, Mail, AlertCircle } from 'lucide-react';
import Particles from 'react-tsparticles';
import type { Engine, Container } from 'tsparticles-engine';
import { loadFull } from 'tsparticles';

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

  // tsparticles init
  const particlesInit = useCallback(async (engine: Engine) => {
    // load full bundle
    await loadFull(engine);
  }, []);

  const particlesLoaded = useCallback(async (container: Container | undefined) => {
    // you could store container if needed
    return;
  }, []);

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

      {/* Right side visuals with particles */}
      <div className="hidden md:flex w-1/2 items-center justify-center relative overflow-hidden">
        {/* Particles canvas (fills this right half only) */}
        <Particles
          id="tsparticles-right"
          init={particlesInit}
          loaded={particlesLoaded}
          style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}
          options={{
            fullScreen: { enable: false }, // do NOT take full screen; confined to this container
            fpsLimit: 60,
            background: { color: { value: 'transparent' } },
            particles: {
              number: { value: 40, density: { enable: true, area: 800 } },
              color: { value: ['#00BFFF', '#007B8A', '#D8468C'] },
              shape: { type: 'circle' },
              opacity: {
                value: 0.7,
                random: { enable: true, minimumValue: 0.4 },
                anim: { enable: true, speed: 0.5, opacity_min: 0.3, sync: false }
              },
              size: {
                value: { min: 2, max: 8 },
                random: true,
                anim: { enable: true, speed: 4, size_min: 1, sync: false }
              },
              move: {
                enable: true,
                speed: 0.8,
                direction: 'none',
                random: true,
                straight: false,
                outModes: { default: 'out' },
                attract: { enable: false }
              },
              links: {
                enable: true,
                distance: 140,
                color: '#00BFFF',
                opacity: 0.08,
                width: 1
              }
            },
            interactivity: {
              events: {
                onHover: { enable: true, mode: 'repulse' },
                onClick: { enable: true, mode: 'push' },
                resize: true
              },
              modes: {
                grab: { distance: 200, links: { opacity: 0.2 } },
                bubble: { distance: 200, size: 6, duration: 2, opacity: 0.8 },
                repulse: { distance: 100 },
                push: { quantity: 4 },
                remove: { quantity: 2 }
              }
            },
            detectRetina: true
          }}
        />

        {/* Gradient overlay for smooth transition */}
        <div className="absolute inset-0 bg-gradient-to-br from-transparent via-[#00BFFF]/30 to-white/30 z-10 pointer-events-none"></div>

        {/* Floating text (above particles) */}
        <div className="absolute top-20 left-14 text-white font-bold text-4xl tracking-wide z-20 drop-shadow-lg">
          Grow. Save. <br /> Prosper Together.
        </div>
        <div className="absolute bottom-24 right-10 text-white text-lg z-20">
          Empowering Financial Growth Digitally.
        </div>

        {/* Soft decorative circles */}
        <div className="absolute -top-24 -left-24 w-80 h-80 bg-white/10 opacity-25 rounded-full animate-spin-slow z-5"></div>
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-white/10 opacity-25 rounded-full animate-spin-slow-reverse z-5"></div>
      </div>

      {/* Animations */}
      <style>{`
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
