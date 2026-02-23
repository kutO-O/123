import React from 'react';

interface Props {
  history: { epoch: number; w1: number; w2: number }[];
}

export const WeightChart: React.FC<Props> = ({ history }) => {
  const W = 560;
  const H = 160;
  const PAD = { left: 44, right: 16, top: 14, bottom: 32 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const n = history.length;
  if (n === 0) return null;

  const tx = (i: number) => PAD.left + (i / Math.max(n - 1, 1)) * plotW;
  const ty = (w: number) => PAD.top + (1 - w) * plotH;

  const w1Path = history
    .map((h, i) => `${i === 0 ? 'M' : 'L'}${tx(i).toFixed(1)},${ty(h.w1).toFixed(1)}`)
    .join(' ');
  const w2Path = history
    .map((h, i) => `${i === 0 ? 'M' : 'L'}${tx(i).toFixed(1)},${ty(h.w2).toFixed(1)}`)
    .join(' ');

  // Final values
  const finalW1 = history[n - 1].w1;
  const finalW2 = history[n - 1].w2;

  const yTicks = [0, 0.25, 0.5, 0.75, 1.0];
  const xTickCount = Math.min(n - 1, 5);
  const xTicks = Array.from({ length: xTickCount + 1 }, (_, i) =>
    Math.round((i / xTickCount) * (n - 1))
  );

  return (
    <div className="bg-slate-900 rounded-xl p-3">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-slate-200 text-sm font-semibold">Weight Evolution During Training</span>
        <div className="flex gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-0.5 bg-indigo-400" />
            <span className="text-xs text-slate-400">Synapse 1 (w1={finalW1.toFixed(3)})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-0.5 bg-amber-400" />
            <span className="text-xs text-slate-400">Synapse 2 (w2={finalW2.toFixed(3)})</span>
          </div>
        </div>
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`}>
        <rect x={PAD.left} y={PAD.top} width={plotW} height={plotH}
          fill="#0f172a" rx="4" />

        {/* Grid */}
        {yTicks.map(w => (
          <line key={w}
            x1={PAD.left} x2={PAD.left + plotW}
            y1={ty(w)} y2={ty(w)}
            stroke="#1e293b" strokeWidth="1" />
        ))}

        {/* Convergence area */}
        <rect x={PAD.left} y={ty(finalW2 > finalW1 ? finalW2 : finalW1)}
          width={plotW}
          height={Math.abs(ty(finalW1) - ty(finalW2))}
          fill={finalW1 > finalW2 ? '#6366f120' : '#f59e0b20'} />

        {/* Weight traces */}
        <path d={w1Path} fill="none" stroke="#6366f1" strokeWidth="2" />
        <path d={w2Path} fill="none" stroke="#f59e0b" strokeWidth="2" strokeDasharray="5,2" />

        {/* Final weight markers */}
        <circle cx={tx(n - 1)} cy={ty(finalW1)} r="4" fill="#6366f1" />
        <circle cx={tx(n - 1)} cy={ty(finalW2)} r="4" fill="#f59e0b" />

        {/* Y-axis ticks */}
        {yTicks.map(w => (
          <g key={w}>
            <line x1={PAD.left - 3} x2={PAD.left} y1={ty(w)} y2={ty(w)}
              stroke="#475569" strokeWidth="1" />
            <text x={PAD.left - 5} y={ty(w) + 3}
              textAnchor="end" fontSize="7" fill="#64748b">{w.toFixed(2)}</text>
          </g>
        ))}

        {/* X-axis ticks */}
        {xTicks.map(i => (
          <g key={i}>
            <line x1={tx(i)} x2={tx(i)}
              y1={PAD.top + plotH} y2={PAD.top + plotH + 3}
              stroke="#475569" strokeWidth="1" />
            <text x={tx(i)} y={H - 10}
              textAnchor="middle" fontSize="7" fill="#64748b">ep.{i + 1}</text>
          </g>
        ))}

        {/* Axes */}
        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + plotH}
          stroke="#334155" strokeWidth="1" />
        <line x1={PAD.left} y1={PAD.top + plotH} x2={PAD.left + plotW} y2={PAD.top + plotH}
          stroke="#334155" strokeWidth="1" />

        {/* Axis labels */}
        <text x={10} y={PAD.top + plotH / 2}
          textAnchor="middle" fontSize="8" fill="#64748b"
          transform={`rotate(-90, 10, ${PAD.top + plotH / 2})`}>Weight</text>
        <text x={PAD.left + plotW / 2} y={H - 2}
          textAnchor="middle" fontSize="8" fill="#64748b">Epoch</text>
      </svg>
    </div>
  );
};
