import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import AdminDashboard from './components/AdminDashboard';
import MemberDashboard from './components/MemberDashboard';
import HelperDashboard from './components/HelperDashboard';

function AppContent() {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-white font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return <Login />;
  }

  if (profile.role === 'admin') {
    return <AdminDashboard />;
  }

  if (profile.role === 'employee') {
    return <HelperDashboard />;
  }

  if (profile.role === 'member') {
    return <MemberDashboard />;
  }

  // Unknown role — show a simple state instead of re-rendering Login
  return (
    <div className="min-h-screen gradient-bg flex items-center justify-center p-6">
      <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 text-center max-w-md">
        <p className="text-white font-semibold">Access blocked</p>
        <p className="text-white/80 text-sm mt-2">
          Your account role isn’t recognized. Please contact an administrator.
        </p>
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
