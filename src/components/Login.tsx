import React, { useState, useCallback } from 'react';
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

  const particlesInit = useCallback(async (engine: Engine) => {
    await loadFull(engine);
  }, []);

  const particlesLoaded = useCallback(async (container: Container | undefined) => {
    return;
  }, []);

  return (
    <div className="min-h-screen relative flex items-center justify-center">
      {/* Background Image */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage:
            "url('https://i.pinimg.com/1200x/26/a5/2e/26a52e8b95ed4915aeb8cc8dd4bbd36f.jpg')",
        }}
      ></div>

      {/* Particles */}
      <Particles
        id="tsparticles-background"
        init={particlesInit}
        loaded={particlesLoaded}
        style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}
        options={{
          fullScreen: { enable: false },
          fpsLimit: 60,
          particles: {
            number: { value: 40, density: { enable: true, area: 800 } },
            color: { value: ['#00BFFF', '#007B8A', '#D8468C'] },
            shape: { type: 'circle' },
            opacity: { value: 0.7, random: { enable: true, minimumValue: 0.4 } },
            size: { value: { min: 2, max: 8 }, random: true },
            move: {
              enable: true,
              speed: 0.8,
              direction: 'none',
              random: true,
              straight: false,
              outModes: { default: 'out' }
            },
            links: { enable: true, distance: 140, color: '#00BFFF', opacity: 0.08, width: 1 }
          },
          interactivity: {
            events: { onHover: { enable: true, mode: 'repulse' }, onClick: { enable: true, mode: 'push' } },
            modes: { repulse: { distance: 100 }, push: { quantity: 4 } }
          },
          detectRetina: true
        }}
      />

      {/* Login Form */}
      <div className="relative z-10 p-10 w-full max-w-md rounded-3xl shadow-2xl bg-[#0D1B3D]/90 backdrop-blur-xl animate-slide-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#007B8A] to-[#D8468C] mb-4 shadow-md">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-1">
            SmartSave Management
          </h1>
          <p className="text-gray-200/90">
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
                className="w-full pl-11 pr-4 py-3 border border-white/40 rounded-xl bg-white/20 text-white placeholder-gray-200 focus:ring-2 focus:ring-[#00BFFF] focus:border-transparent outline-none transition"
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
                className="w-full pl-11 pr-4 py-3 border border-white/40 rounded-xl bg-white/20 text-white placeholder-gray-200 focus:ring-2 focus:ring-[#00BFFF] focus:border-transparent outline-none transition"
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

      {/* Animations */}
      <style>{`
        @keyframes slide-in { from{opacity:0;transform:translateY(-20px)} to{opacity:1;transform:translateY(0)} }
        .animate-slide-in { animation: slide-in 0.8s ease forwards; }
      `}</style>
    </div>
  );
}
