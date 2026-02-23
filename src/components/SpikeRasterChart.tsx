import React from 'react';

interface Props {
  duration: number;
  spikesIn1: number[];
  spikesIn2: number[];
  spikesOut: number[];
  title: string;
  fired: boolean;
}

export const SpikeRasterChart: React.FC<Props> = ({
  duration, spikesIn1, spikesIn2, spikesOut, title, fired
}) => {
  const W = 560;
  const H = 120;
  const PAD = { left: 72, right: 16, top: 14, bottom: 28 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const rows = [
    { label: 'Input 1', spikes: spikesIn1, color: '#6366f1', yFrac: 0.15 },
    { label: 'Input 2', spikes: spikesIn2, color: '#f59e0b', yFrac: 0.5 },
    { label: 'Output',  spikes: spikesOut, color: fired ? '#22c55e' : '#ef4444', yFrac: 0.85 },
  ];

  const tx = (t: number) => PAD.left + (t / duration) * plotW;
  const ty = (frac: number) => PAD.top + frac * plotH;

  const tickCount = 5;
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => (duration / tickCount) * i);

  return (
    <div className="bg-slate-900 rounded-xl p-3">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-slate-200 text-sm font-semibold">{title}</span>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${fired
          ? 'bg-green-500/20 text-green-400 border border-green-500/40'
          : 'bg-red-500/20 text-red-400 border border-red-500/40'}`}>
          {fired ? '⚡ SPIKED' : '— SILENT'}
        </span>
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="font-mono">
        {/* Background */}
        <rect x={PAD.left} y={PAD.top} width={plotW} height={plotH}
          fill="#0f172a" rx="4" />

        {/* Horizontal row separators */}
        {rows.map((_row, i) => (
          i < rows.length - 1 ? (
            <line key={i}
              x1={PAD.left} x2={PAD.left + plotW}
              y1={ty((rows[i].yFrac + rows[i + 1].yFrac) / 2)}
              y2={ty((rows[i].yFrac + rows[i + 1].yFrac) / 2)}
              stroke="#1e293b" strokeWidth="1" />
          ) : null
        ))}

        {/* Spike marks */}
        {rows.map(row =>
          row.spikes.map((t, si) => (
            <line key={`${row.label}-${si}`}
              x1={tx(t)} x2={tx(t)}
              y1={ty(row.yFrac) - 8} y2={ty(row.yFrac) + 8}
              stroke={row.color} strokeWidth="2.5"
              strokeLinecap="round" />
          ))
        )}

        {/* Row labels */}
        {rows.map(row => (
          <text key={row.label}
            x={PAD.left - 6} y={ty(row.yFrac) + 4}
            textAnchor="end" fontSize="9" fill={row.color} fontWeight="600">
            {row.label}
          </text>
        ))}

        {/* Time axis */}
        {ticks.map(t => (
          <g key={t}>
            <line x1={tx(t)} x2={tx(t)}
              y1={PAD.top + plotH} y2={PAD.top + plotH + 4}
              stroke="#475569" strokeWidth="1" />
            <text x={tx(t)} y={H - 4}
              textAnchor="middle" fontSize="8" fill="#64748b">
              {t.toFixed(0)}ms
            </text>
          </g>
        ))}

        {/* Axes */}
        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + plotH}
          stroke="#334155" strokeWidth="1" />
        <line x1={PAD.left} y1={PAD.top + plotH} x2={PAD.left + plotW} y2={PAD.top + plotH}
          stroke="#334155" strokeWidth="1" />
      </svg>
    </div>
  );
};
