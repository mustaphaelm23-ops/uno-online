import Avatar from '../ui/Avatar';
import { useNotifications } from '../../contexts/NotificationsContext';

// Top bar across the lobby. Designed for both phone and desktop:
//   • Phone (< sm): hamburger + UNO logo + compact currency chips + 4 icon
//     buttons. User pill collapses into a single tap-target around the avatar.
//   • Tablet/desktop (sm+): full layout with the username/online row visible.
//
// Numeric values come from the user object. Currency chips abbreviate large
// numbers on phone (12,345 → 12.3K) so the chips stay short.

const fmt = (n) => Number(n || 0).toLocaleString();
const fmtCompact = (n) => {
  const num = Number(n || 0);
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (num >= 10_000)    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return fmt(num);
};

function CurrencyChip({ icon, color, value, onAdd }) {
  return (
    <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-full bg-bg-2/80 border border-line">
      <span className={`text-sm sm:text-base ${color}`}>{icon}</span>
      <span className="font-bold text-xs sm:text-sm tabular-nums">
        <span className="sm:hidden">{fmtCompact(value)}</span>
        <span className="hidden sm:inline">{fmt(value)}</span>
      </span>
      <button
        type="button"
        onClick={onAdd}
        aria-label="Add"
        className="ml-0.5 sm:ml-1 w-4 h-4 sm:w-5 sm:h-5 grid place-items-center rounded-full bg-emerald text-white text-[10px] sm:text-xs font-bold
                   hover:scale-110 transition"
      >+</button>
    </div>
  );
}

function IconBtn({ icon, label, dot, badge, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="relative w-8 h-8 sm:w-10 sm:h-10 grid place-items-center rounded-full bg-bg-2/80 border border-line
                 hover:border-violet/40 transition shrink-0"
    >
      <span className="text-sm sm:text-base">{icon}</span>
      {dot && !badge && <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-rose rounded-full" />}
      {badge > 0 && (
        <span className="absolute -top-1 -right-1 bg-rose text-white rounded-full
                         min-w-[16px] h-[16px] sm:min-w-[18px] sm:h-[18px] px-1 text-[9px] sm:text-[10px] font-bold grid place-items-center shadow-card">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );
}

export default function TopBar({ user, onShop, onSettings, onLogout, onChat, onFriends, onNotifications, onMenu }) {
  const { unread } = useNotifications();
  return (
    <header className="flex items-center gap-1.5 sm:gap-3 lg:gap-4">
      {/* Mobile/tablet hamburger — opens sidebar drawer. Hidden on lg+
          since the sidebar renders inline at that breakpoint. */}
      <button
        type="button"
        onClick={onMenu}
        aria-label="Menu"
        className="lg:hidden w-9 h-9 grid place-items-center rounded-lg bg-bg-2/80 border border-line hover:border-violet/40 transition shrink-0 text-lg"
      >☰</button>

      <div className="font-display text-2xl sm:text-3xl lg:text-4xl text-accent drop-shadow-[0_4px_24px_rgba(245,158,11,0.4)] tracking-wider select-none">
        UNO
      </div>

      <div className="flex-1" />

      {/* Currency chips — visible on every breakpoint, compacted on phone. */}
      <div className="flex items-center gap-1 sm:gap-2">
        <CurrencyChip icon="🪙" color="text-accent" value={user?.coins} onAdd={onShop} />
        <CurrencyChip icon="💎" color="text-sky" value={user?.diamonds} onAdd={onShop} />
      </div>

      <div className="flex items-center gap-1 sm:gap-2">
        <IconBtn icon="🔔" label="Notifications" badge={unread} onClick={onNotifications} />
        <IconBtn icon="👥" label="Friends" onClick={onFriends} />
        <IconBtn icon="💬" label="Messages" onClick={onChat} />
        <IconBtn icon="⚙️" label="Settings" onClick={onSettings} />
      </div>

      {/* Username + online pill — desktop only. Phone users see their
          identity inside the sidebar drawer + settings modal. */}
      <div className="hidden lg:flex items-center gap-2 pl-3 border-l border-line">
        <Avatar src={user?.avatar} name={user?.username} size="sm" online />
        <div className="leading-tight">
          <div className="text-sm font-bold">{user?.username}</div>
          <div className="text-[10px] text-emerald flex items-center gap-1">● Online</div>
        </div>
        <button
          type="button"
          onClick={onLogout}
          aria-label="Log out"
          className="ml-1 w-7 h-7 grid place-items-center rounded-md text-ink-faint hover:text-rose"
          title="Sign out"
        >⎋</button>
      </div>
    </header>
  );
}
