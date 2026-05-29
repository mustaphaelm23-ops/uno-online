import Avatar from '../ui/Avatar';

// Top bar across the lobby: coins + diamonds chips, gift / notifications /
// chat icons, settings, and a user pill on the right. Closer to mockup #2
// (the wider layout). Numeric values come from the user object.

const fmt = (n) => Number(n || 0).toLocaleString();

function CurrencyChip({ icon, color, value, onAdd }) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-bg-2/80 border border-line">
      <span className={`text-base ${color}`}>{icon}</span>
      <span className="font-bold text-sm">{fmt(value)}</span>
      <button
        type="button"
        onClick={onAdd}
        aria-label="Add"
        className="ml-1 w-5 h-5 grid place-items-center rounded-full bg-emerald text-white text-xs font-bold
                   hover:scale-110 transition"
      >+</button>
    </div>
  );
}

function IconBtn({ icon, label, dot, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="relative w-10 h-10 grid place-items-center rounded-full bg-bg-2/80 border border-line
                 hover:border-violet/40 transition"
    >
      <span className="text-base">{icon}</span>
      {dot && <span className="absolute top-1 right-1 w-2 h-2 bg-rose rounded-full" />}
    </button>
  );
}

export default function TopBar({ user, onShop, onSettings, onLogout, onChat }) {
  return (
    <header className="flex items-center gap-3 sm:gap-4">
      <div className="font-display text-4xl text-accent drop-shadow-[0_4px_24px_rgba(245,158,11,0.4)] tracking-wider select-none">
        UNO
      </div>

      <div className="flex-1" />

      <div className="hidden sm:flex items-center gap-2">
        <CurrencyChip icon="🪙" color="text-accent" value={user?.coins} onAdd={onShop} />
        <CurrencyChip icon="💎" color="text-sky" value={user?.diamonds} onAdd={onShop} />
      </div>

      <div className="flex items-center gap-2">
        <IconBtn icon="🔔" label="Notifications" dot onClick={() => {}} />
        <IconBtn icon="💬" label="Chat" onClick={onChat} />
        <IconBtn icon="⚙️" label="Settings" onClick={onSettings} />
      </div>

      <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-line">
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
