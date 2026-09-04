export default function HeroAtmosphere() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="hero-grid" />
      <div className="hero-orb -left-24 -top-24 h-72 w-72 bg-blue-600/30" />
      <div className="hero-orb -right-20 top-10 h-80 w-80 bg-orange-500/20 [animation-delay:-3s]" />
      <div className="hero-orb bottom-[-9rem] left-1/2 h-72 w-72 bg-lime-400/10 [animation-delay:-6s]" />
      <div className="hero-scanline" />
    </div>
  );
}

export function ActivityTicker() {
  const items = ['Run', 'Ride', 'Swim', 'Hike', 'Compete', 'Repeat'];
  const content = [...items, ...items];

  return (
    <div aria-hidden="true" className="overflow-hidden border-y border-white/10 bg-black/20 py-3">
      <div className="hero-ticker-track">
        {content.map((item, index) => (
          <span key={`${item}-${index}`} className="athletic-display flex items-center gap-5 px-5 text-sm tracking-[0.24em] text-slate-500 sm:text-base">
            {item}<span className="text-lime-300">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}
