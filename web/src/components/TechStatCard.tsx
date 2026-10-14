import { initials } from '../lib/format';

export interface StatItem {
  label: string;
  value: string;
  tone?: 'gold' | 'green' | 'cyan' | 'purple' | 'default';
}

const TONE: Record<NonNullable<StatItem['tone']>, string> = {
  gold: 'text-amber-400',
  green: 'text-emerald-400',
  cyan: 'text-cyan-400',
  purple: 'text-purple-400',
  default: 'text-white',
};

export function TechStatCard({
  name,
  role,
  color,
  inactive,
  top,
  stats,
}: {
  name: string;
  role: string;
  color: string;
  inactive?: boolean;
  top?: boolean;
  stats: StatItem[];
}) {
  return (
    <div className={`glass-panel p-4 rounded-xl ${top ? 'border-amber-500/40' : ''}`}>
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-black text-black shrink-0"
          style={{ backgroundColor: color }}
        >
          {initials(name)}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-white truncate">{name}</span>
            {top && <span className="trophy-badge px-1.5 rounded text-[10px] font-black">🏆</span>}
            {inactive && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-300">disattivato</span>
            )}
          </div>
          <p className="text-xs text-gray-400 truncate">{role}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 mt-3">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-gray-900/50 rounded-lg px-2 py-1.5">
            <p className="text-[10px] uppercase text-gray-500">{stat.label}</p>
            <p className={`text-sm font-bold font-mono-num ${TONE[stat.tone ?? 'default']}`}>{stat.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
