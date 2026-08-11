import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { api } from '../api/client';
import { getSocket } from '../api/socket';
// Above-the-fold lobby pieces — render on every visit, stay in the main
// chunk. The TopBar's NotificationsContext subscription would also need
// to be top-level, so it stays here.
import LazyWhenOpened from '../components/ui/LazyWhenOpened';
import Sidebar from '../components/lobby/Sidebar';
import SidebarDrawer from '../components/lobby/SidebarDrawer';
import LobbyBackground from '../components/lobby/LobbyBackground';
import TopBar from '../components/lobby/TopBar';
import WelcomeCard from '../components/lobby/WelcomeCard';
import PublicRooms from '../components/lobby/PublicRooms';
import FriendsRail from '../components/lobby/FriendsRail';
import WorldChat from '../components/lobby/WorldChat';
import BattlePassCard from '../components/lobby/BattlePassCard';
import SpecialOfferCard from '../components/lobby/SpecialOfferCard';
import BottomNav from '../components/lobby/BottomNav';
import ActionTiles from '../components/lobby/ActionTiles';

// Modals + slide-outs — code-split per surface. Each fetches on first
// open and cache-hits thereafter. Rendered inside <Suspense fallback=null>
// so the brief network round-trip is invisible (the modal would be
// invisible during open animation anyway).
const CreateRoomModal   = lazy(() => import('../components/lobby/CreateRoomModal'));
const ShopModal         = lazy(() => import('../components/lobby/ShopModal'));
const BattlePassModal   = lazy(() => import('../components/lobby/BattlePassModal'));
const FriendsPanel      = lazy(() => import('../components/lobby/FriendsPanel'));
const SettingsModal     = lazy(() => import('../components/lobby/SettingsModal'));
const DailyRewardModal  = lazy(() => import('../components/lobby/DailyRewardModal'));
const JoinByCodeModal   = lazy(() => import('../components/lobby/JoinByCodeModal'));
const LeaderboardModal  = lazy(() => import('../components/lobby/LeaderboardModal'));
const RankedHubModal    = lazy(() => import('../components/lobby/RankedHubModal'));
const EventModal        = lazy(() => import('../components/lobby/EventModal'));
const AchievementsModal = lazy(() => import('../components/lobby/AchievementsModal'));
const NotificationsPanel= lazy(() => import('../components/lobby/NotificationsPanel'));
const LiveGamesModal    = lazy(() => import('../components/lobby/LiveGamesModal'));
const CollectionModal   = lazy(() => import('../components/lobby/CollectionModal'));
const EmotesModal       = lazy(() => import('../components/lobby/EmotesModal'));

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

// Single-line motion wrapper used to stagger lobby sections on mount.
// Parent `motion.div` drives the staggerChildren timing via variants;
// each Reveal just declares the per-child hidden/show transform.
function Reveal({ children, className = '' }) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 10 },
        show:   { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
      }}
    >
      {children}
    </motion.div>
  );
}

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
  const [rankedOpen, setRankedOpen]     = useState(false);
  const [eventOpen, setEventOpen]       = useState(false);
  const [achOpen, setAchOpen]           = useState(false);
  const [notifOpen, setNotifOpen]       = useState(false);
  const [liveOpen, setLiveOpen]         = useState(false);
  const [collOpen, setCollOpen]         = useState(false);
  const [emotesOpen, setEmotesOpen]     = useState(false);
  const [drawerOpen, setDrawerOpen]     = useState(false);

  // Shared sidebar action handler — used by both the inline desktop
  // Sidebar and the mobile SidebarDrawer so the two stay in sync.
  const onSidebar = (id) => {
    if (id === 'play')    return;
    if (id === 'join')    return setJoinOpen(true);
    if (id === 'quick')   return quickMatch();
    if (id === 'shop')    return openShop('packages');
    if (id === 'daily')   return setDailyOpen(true);
    if (id === 'ranked')  return setRankedOpen(true);
    return toast.info(`${id} ships in a follow-up commit`);
  };

  const openShop = (tab = 'packages') => { setShopTab(tab); setShopOpen(true); };

  const [refreshing, setRefreshing] = useState(false);
  const fetchFeatured = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const data = await api.get('/api/rooms/featured');
      setFeatured(data);
    } catch (err) {
      toast.error(err.message || 'Failed to load rooms');
    } finally {
      // Hold the spinner for ~400 ms even on instant responses so the
      // user actually sees the refresh tick — no perceived ghost-click.
      if (manual) setTimeout(() => setRefreshing(false), 400);
    }
  }, [toast]);
  const refreshRooms = () => fetchFeatured(true);

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
    <div className="relative min-h-full max-w-[1480px] mx-auto px-2 sm:px-6 py-3 sm:py-5 flex flex-col gap-3 sm:gap-4">
      <LobbyBackground />
      <TopBar
        user={user}
        onShop={() => openShop('packages')}
        onSettings={() => setSettingsOpen(true)}
        onLogout={logout}
        onChat={() => openSocial('dms')}
        onFriends={() => openSocial('friends')}
        onNotifications={() => setNotifOpen(true)}
        onMenu={() => setDrawerOpen(true)}
      />

      <motion.div
        initial="hidden"
        animate="show"
        variants={{
          hidden: {},
          show:   { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
        }}
        className="flex gap-3 sm:gap-4 lg:gap-5 items-start"
      >
        <Sidebar onAction={onSidebar} />

        {/* Center column — each section fades + lifts in sequence so the
            lobby reveals itself rather than popping fully formed. */}
        <main className="flex-1 min-w-0 flex flex-col gap-4">
          <Reveal><WelcomeCard user={user} /></Reveal>
          <Reveal>
            <PublicRooms
              rooms={featured.rooms}
              hotType={featured.hotType}
              onJoin={joinFeatured}
              onWatchLive={() => setLiveOpen(true)}
              onRefresh={refreshRooms}
              refreshing={refreshing}
            />
          </Reveal>
          <Reveal><ActionTiles onCreate={() => setCreateOpen(true)} onQuickMatch={quickMatch} /></Reveal>

          {/* Mobile-only surface for right-rail cards. On lg+ the right rail
              renders the same components and these duplicates are hidden. */}
          <Reveal className="lg:hidden grid grid-cols-1 sm:grid-cols-2 gap-4">
            <BattlePassCard user={user} onView={() => setBpOpen(true)} />
            <SpecialOfferCard onClaim={() => openShop('offer')} />
          </Reveal>

          <Reveal>
            <BottomNav onAction={(id) => {
              if (id === 'leaderboard')  return openLb('ranked');
              if (id === 'missions')     return setEventOpen(true);
              if (id === 'achievements') return setAchOpen(true);
              if (id === 'collection')   return setCollOpen(true);
              if (id === 'emotes')       return setEmotesOpen(true);
              toast.info(`${id} — follow-up commit`);
            }} />
          </Reveal>
        </main>

        {/* Right rail */}
        <div className="hidden lg:flex flex-col gap-4 w-72 shrink-0">
          <Reveal><BattlePassCard user={user} onView={() => setBpOpen(true)} /></Reveal>
          <Reveal><FriendsRail activeRoomId={activeRoomId} /></Reveal>
          <Reveal><WorldChat /></Reveal>
          <Reveal><SpecialOfferCard onClaim={() => openShop('offer')} /></Reveal>
        </div>
      </motion.div>

      {/* Mobile sidebar drawer — eager (small, mobile-essential). */}
      <SidebarDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        user={user}
        onAction={onSidebar}
        onLogout={logout}
      />

      {/* Code-split modal layer. Each surface only loads its chunk on
          first open; after that it stays mounted so exit animations play
          and reopen is instant. Suspense fallback is null because the
          modal would be invisible during the ~50–200 ms chunk fetch
          window anyway. */}
      <Suspense fallback={null}>
        <LazyWhenOpened open={createOpen}>
          <CreateRoomModal
            open={createOpen}
            onClose={() => setCreateOpen(false)}
            onCreated={onCreated}
          />
        </LazyWhenOpened>
        <LazyWhenOpened open={shopOpen}>
          <ShopModal
            open={shopOpen}
            onClose={() => setShopOpen(false)}
            initialTab={shopTab}
          />
        </LazyWhenOpened>
        <LazyWhenOpened open={bpOpen}>
          <BattlePassModal
            open={bpOpen}
            onClose={() => setBpOpen(false)}
          />
        </LazyWhenOpened>
        <LazyWhenOpened open={socialOpen}>
          <FriendsPanel
            open={socialOpen}
            onClose={() => setSocialOpen(false)}
            initialTab={socialTab}
            activeRoomId={activeRoomId}
          />
        </LazyWhenOpened>
        <LazyWhenOpened open={settingsOpen}>
          <SettingsModal
            open={settingsOpen}
            onClose={() => setSettingsOpen(false)}
          />
        </LazyWhenOpened>
        <LazyWhenOpened open={dailyOpen}>
          <DailyRewardModal
            open={dailyOpen}
            onClose={() => setDailyOpen(false)}
          />
        </LazyWhenOpened>
        <LazyWhenOpened open={joinOpen}>
          <JoinByCodeModal
            open={joinOpen}
            onClose={() => setJoinOpen(false)}
          />
        </LazyWhenOpened>
        <LazyWhenOpened open={lbOpen}>
          <LeaderboardModal
            open={lbOpen}
            onClose={() => setLbOpen(false)}
            initialTab={lbTab}
          />
        </LazyWhenOpened>
        <LazyWhenOpened open={rankedOpen}>
          <RankedHubModal
            open={rankedOpen}
            onClose={() => setRankedOpen(false)}
            onPlay={() => joinFeatured('RANKED')}
          />
        </LazyWhenOpened>
        <LazyWhenOpened open={eventOpen}>
          <EventModal
            open={eventOpen}
            onClose={() => setEventOpen(false)}
          />
        </LazyWhenOpened>
        <LazyWhenOpened open={achOpen}>
          <AchievementsModal
            open={achOpen}
            onClose={() => setAchOpen(false)}
          />
        </LazyWhenOpened>
        <LazyWhenOpened open={notifOpen}>
          <NotificationsPanel
            open={notifOpen}
            onClose={() => setNotifOpen(false)}
          />
        </LazyWhenOpened>
        <LazyWhenOpened open={liveOpen}>
          <LiveGamesModal
            open={liveOpen}
            onClose={() => setLiveOpen(false)}
          />
        </LazyWhenOpened>
        <LazyWhenOpened open={collOpen}>
          <CollectionModal
            open={collOpen}
            onClose={() => setCollOpen(false)}
          />
        </LazyWhenOpened>
        <LazyWhenOpened open={emotesOpen}>
          <EmotesModal
            open={emotesOpen}
            onClose={() => setEmotesOpen(false)}
          />
        </LazyWhenOpened>
      </Suspense>
    </div>
  );
}
