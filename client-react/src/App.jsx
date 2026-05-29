import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import AuthPage from './pages/AuthPage.jsx';
import LobbyPage from './pages/LobbyPage.jsx';
import RoomPage from './pages/RoomPage.jsx';

function Protected({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return <BootSplash />;
  if (!user)  return <Navigate to="/auth" replace />;
  return children;
}

function BootSplash() {
  return (
    <div className="h-full grid place-items-center">
      <div className="text-ink-soft text-sm tracking-widest uppercase animate-pulse">Loading…</div>
    </div>
  );
}

export default function App() {
  const { user, ready } = useAuth();
  return (
    <Routes>
      <Route path="/auth"        element={user ? <Navigate to="/" replace /> : <AuthPage />} />
      <Route path="/"            element={<Protected><LobbyPage /></Protected>} />
      <Route path="/room/:roomId" element={<Protected><RoomPage /></Protected>} />
      <Route path="*"            element={ready ? <Navigate to={user ? '/' : '/auth'} replace /> : <BootSplash />} />
    </Routes>
  );
}
