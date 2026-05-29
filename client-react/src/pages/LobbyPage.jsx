import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { api } from '../api/client';
import { getSocket } from '../api/socket';
import Sidebar from '../components/lobby/Sidebar';
import TopBar from '../components/lobby/TopBar';
import WelcomeCard from '../components/lobby/WelcomeCard';
import PublicRooms from '../components/lobby/PublicRooms';
import FriendsRail from '../components/lobby/FriendsRail';
import WorldChat from '../components/lobby/WorldChat';
import BattlePassCard from '../components/lobby/BattlePassCard';
import SpecialOfferCard from '../components/lobby/SpecialOfferCard';
import BottomNav from '../components/lobby/BottomNav';
import ActionTiles from '../components/lobby/ActionTiles';
import CreateRoomModal from '../components/lobby/CreateRoomModal';
import ShopModal from '../components/lobby/ShopModal';
import BattlePassModal from '../components/lobby/BattlePassModal';
import FriendsPanel from '../components/lobby/FriendsPanel';
import SettingsModal from '../components/lobby/SettingsModal';
import DailyRewardModal from '../components/lobby/DailyRewardModal';
import JoinByCodeModal from '../components/lobby/JoinByCodeModal';
import LeaderboardModal from '../components/lobby/LeaderboardModal';

// LobbyPage assembles the visible mockup: sidebar nav on the left, top bar,
// welcome card + featured rooms + action tiles + bottom nav in the center
// column, friends rail + battle pass + world chat on the right.
//
// Room state: `activeRoomId` tracks whether the logged-in user is currently
// the host/member of a room (set after Create Room success, cleared on
// leave). The FriendsRail uses it to switch INVITE between enabled / muted.
//
// Server interactions:
//   - GET /api/rooms/featured     → the four themed room cards
//   - POST /api/rooms             → create-room modal submit
//   - POST /api/rooms/quick-join  → quick match + featured-card click
//   - friend:invite               → fired by the friends rail
//
// Listens for socket 'friend:invite' so an incoming invite produces a toast
// with a Join CTA. (Wired via plain socket .on inside the page so the
// notification flow doesn't need a dedicated context yet.)

export default function LobbyPage() {
  const { user, logout, refreshUser } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [featured, setFeatured] = useState({ rooms: [], hotType: null, onlineCount: 0 });
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [shopOpen, setShopOpen]     = useState(false);
  const [shopTab, setShopTab]       = useState('packages');
  const [bpOpen, setBpOpen]         = useState(false);
  const [socialOpen, setSocialOpen] = useState(false);
  const [socialTab, setSocialTab]   = useState('friends');
  const openSocial = (t = 'friends') => { setSocialTab(t); setSocialOpen(true); };
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dailyOpen, setDailyOpen]       = useState(false);
  const [joinOpen, setJoinOpen]         = useState(false);
  const [lbOpen, setLbOpen]             = useState(false);
  const [lbTab, setLbTab]               = useState('ranked');
  const openLb = (t = 'ranked') => { setLbTab(t); setLbOpen(true); };

  const openShop = (tab = 'packages') => { setShopTab(tab); setShopOpen(true); };

  const fetchFeatured = useCallback(async () => {
    try {
      const data = await api.get('/api/rooms/featured');
      setFeatured(data);
    } catch (err) {
      toast.error(err.message || 'Failed to load rooms');
    }
  }, [toast]);

  useEffect(() => {
    fetchFeatured();
    const t = setInterval(fetchFeatured, 6000);   // backstop refresh; sockets push real-time updates too
    return () => clearInterval(t);
  }, [fetchFeatured]);

  // React to room mutations from the server side.
  useEffect(() => {
    const sk = getSocket();
    if (!sk) return;
    const onRoomChanged = () => fetchFeatured();
    sk.on('room:list_changed', onRoomChanged);
    sk.on('room:created',      onRoomChanged);
    sk.on('room:player_change',onRoomChanged);

    // Incoming friend invite — surface with a Join CTA via toast.info.
    const onFriendInvite = ({ from, roomId, code }) => {
      toast.info(`${from?.username || 'A friend'} invited you to room ${code || ''}`);
      // For now we just toast; clicking the toast is a follow-up. Persist
      // the latest invite so a "Join last invite" button can pick it up.
      window.__lastInvite = { from, roomId, code };
    };
    sk.on('friend:invite', onFriendInvite);

    return () => {
      sk.off('room:list_changed', onRoomChanged);
      sk.off('room:created',      onRoomChanged);
      sk.off('room:player_change',onRoomChanged);
      sk.off('friend:invite',     onFriendInvite);
    };
  }, [fetchFeatured, toast]);

  // Click a featured room card → quick-join the type. Server creates a new
  // instance if all are full / none exist.
  const joinFeatured = async (type) => {
    try {
      const data = await api.post('/api/rooms/quick-join', { type });
      setActiveRoomId(data.roomId);
      navigate(`/room/${data.roomId}`);
    } catch (err) {
      toast.error(err.message || 'Failed to join');
    }
  };

  const quickMatch = () => joinFeatured('QUICK_MATCH');

  const onCreated = (roomId, code) => {
    setActiveRoomId(roomId);
    refreshUser();
    navigate(`/room/${roomId}`);
  };

  return (
    <div className="min-h-full max-w-[1480px] mx-auto px-3 sm:px-6 py-4 sm:py-5 flex flex-col gap-4">
      <TopBar
        user={user}
        onShop={() => openShop('packages')}
        onSettings={() => setSettingsOpen(true)}
        onLogout={logout}
        onChat={() => openSocial('dms')}
        onFriends={() => openSocial('friends')}
      />

      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
        className="flex gap-4 lg:gap-5 items-start"
      >
        <Sidebar onAction={(id) => {
          if (id === 'play')    return;
          if (id === 'join')    return setJoinOpen(true);
          if (id === 'quick')   return quickMatch();
          if (id === 'shop')    return openShop('packages');
          if (id === 'daily')   return setDailyOpen(true);
          if (id === 'ranked')  return openLb('ranked');
          return toast.info(`${id} ships in a follow-up commit`);
        }} />

        {/* Center column */}
        <main className="flex-1 min-w-0 flex flex-col gap-4">
          <WelcomeCard user={user} />
          <PublicRooms rooms={featured.rooms} hotType={featured.hotType} onJoin={joinFeatured} />
          <ActionTiles onCreate={() => setCreateOpen(true)} onQuickMatch={quickMatch} />
          <BottomNav onAction={(id) => {
            if (id === 'leaderboard') return openLb('ranked');
            toast.info(`${id} — follow-up commit`);
          }} />
        </main>

        {/* Right rail */}
        <div className="hidden lg:flex flex-col gap-4 w-72 shrink-0">
          <BattlePassCard user={user} onView={() => setBpOpen(true)} />
          <FriendsRail activeRoomId={activeRoomId} />
          <WorldChat />
          <SpecialOfferCard onClaim={() => openShop('offer')} />
        </div>
      </motion.div>

      <CreateRoomModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={onCreated}
      />
      <ShopModal
        open={shopOpen}
        onClose={() => setShopOpen(false)}
        initialTab={shopTab}
      />
      <BattlePassModal
        open={bpOpen}
        onClose={() => setBpOpen(false)}
      />
      <FriendsPanel
        open={socialOpen}
        onClose={() => setSocialOpen(false)}
        initialTab={socialTab}
        activeRoomId={activeRoomId}
      />
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
      <DailyRewardModal
        open={dailyOpen}
        onClose={() => setDailyOpen(false)}
      />
      <JoinByCodeModal
        open={joinOpen}
        onClose={() => setJoinOpen(false)}
      />
      <LeaderboardModal
        open={lbOpen}
        onClose={() => setLbOpen(false)}
        initialTab={lbTab}
      />
    </div>
  );
}
