const NAV = [
  { id: "dashboard", label: "Dashboard" },
  { id: "patients", label: "Patients" },
  { id: "alerts", label: "Alerts" },
  { id: "rooms", label: "Rooms" },
  { id: "beds", label: "Beds" }
];

export default function AppShell({
  activePage,
  onNavigate,
  onLogout,
  alertCount,
  connected,
  pageTheme,
  children
}) {
  return (
    <div className={`min-h-screen pb-16 ${pageTheme}`}>
      <header className="fixed top-4 left-0 right-0 z-50 px-4 sm:px-6 max-w-7xl mx-auto flex items-center justify-between pointer-events-none">
        <div className="pointer-events-auto rounded-full bg-white/95 backdrop-blur-md px-4 sm:px-6 py-2.5 flex items-center gap-4 sm:gap-6 shadow-sm border border-black/5 overflow-x-auto">
          <button
            type="button"
            className="flex items-center gap-3 shrink-0"
            onClick={() => onNavigate("dashboard")}
          >
            <div className="w-9 h-9 rounded-full bg-slate-900 flex items-center justify-center text-white font-extrabold text-sm font-metric">
              LG
            </div>
            <div className="text-left">
              <div className="flex items-center gap-1.5 leading-none">
                <span className="font-bold text-base tracking-tight text-slate-900">
                  LifeGuard
                </span>
                <span className="bg-slate-900 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                  AI
                </span>
              </div>
              <p className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase mt-0.5 hidden sm:block">
                Patient Care Intelligence
              </p>
            </div>
          </button>
          <div className="h-4 w-px bg-slate-300 hidden md:block" />
          <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-[#f1f5f2] border border-emerald-300 text-emerald-800 text-xs font-semibold">
            <span className="relative flex h-2 w-2">
              <span className="status-pulse absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span>{connected ? "System Connected" : "Reconnecting"}</span>
          </div>
          <nav className="flex items-center text-sm font-medium gap-1 text-slate-600">
            {NAV.map((item) => {
              const active = activePage === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`px-3.5 py-1.5 rounded-full transition-all whitespace-nowrap ${
                    active
                      ? "bg-slate-100 text-slate-900 font-bold"
                      : "hover:text-slate-900"
                  }`}
                  onClick={() => onNavigate(item.id)}
                >
                  <span className="inline-flex items-center gap-1.5">
                    {item.label}
                    {item.id === "alerts" && alertCount > 0 && (
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    )}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>
        <div className="pointer-events-auto flex items-center gap-3 shrink-0 ml-3">
          <button
            type="button"
            className="bg-white hover:bg-slate-50 text-slate-700 px-5 py-2.5 rounded-full shadow-sm border border-slate-200 text-sm font-medium"
            onClick={onLogout}
          >
            Logout
          </button>
          <button
            type="button"
            className="bg-slate-900 hover:bg-black text-white px-5 py-2.5 rounded-full shadow-md text-sm font-medium flex items-center gap-2"
            onClick={() => onNavigate("dashboard")}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse hidden sm:inline-block" />
            Live Monitor
          </button>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-28 space-y-6">
        {children}
      </main>
    </div>
  );
}
