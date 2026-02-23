import React from 'react';

interface Props {
  time: number[];
  v_in1: number[];
  v_in2: number[];
  v_out: number[];
  title: string;
}

export const VoltageChart: React.FC<Props> = ({ time, v_in1, v_in2, v_out, title }) => {
  const W = 560;
  const H = 160;
  const PAD = { left: 40, right: 16, top: 14, bottom: 28 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const allV = [...v_in1, ...v_in2, ...v_out];
  const vMin = Math.min(...allV) - 2;
  const vMax = Math.max(...allV) + 5;
  const vRange = vMax - vMin;
  const duration = time[time.length - 1] ?? 1;

  const tx = (t: number) => PAD.left + (t / duration) * plotW;
  const ty = (v: number) => PAD.top + ((vMax - v) / vRange) * plotH;

  const lines = [
    { values: v_in1, color: '#6366f1', label: 'Input 1', dash: '' },
    { values: v_in2, color: '#f59e0b', label: 'Input 2', dash: '4,2' },
    { values: v_out, color: '#22c55e', label: 'Output',  dash: '2,2' },
  ];

  const yTicks = [-70, -65, -60, -55, -50];
  const tickCount = 5;
  const xTicks = Array.from({ length: tickCount + 1 }, (_, i) => (duration / tickCount) * i);

  // Downsample for performance
  const step = Math.max(1, Math.floor(time.length / 300));
  const toPathDs = (vs: number[]) =>
    vs.filter((_, i) => i % step === 0)
      .map((v, i) => {
        const ti = i * step;
        return `${i === 0 ? 'M' : 'L'}${tx(time[ti]).toFixed(1)},${ty(v).toFixed(1)}`;
      }).join(' ');

  return (
    <div className="bg-slate-900 rounded-xl p-3">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-slate-200 text-sm font-semibold">{title}</span>
        <div className="flex gap-3">
          {lines.map(l => (
            <div key={l.label} className="flex items-center gap-1">
              <div className="w-4 h-0.5" style={{ backgroundColor: l.color }} />
              <span className="text-xs text-slate-400">{l.label}</span>
            </div>
          ))}
        </div>
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`}>
        <rect x={PAD.left} y={PAD.top} width={plotW} height={plotH}
          fill="#0f172a" rx="4" />

        {/* Grid */}
        {yTicks.map(v => (
          <line key={v}
            x1={PAD.left} x2={PAD.left + plotW}
            y1={ty(v)} y2={ty(v)}
            stroke="#1e293b" strokeWidth="1" />
        ))}
        {xTicks.map(t => (
          <line key={t}
            x1={tx(t)} x2={tx(t)}
            y1={PAD.top} y2={PAD.top + plotH}
            stroke="#1e293b" strokeWidth="1" />
        ))}

        {/* Threshold line */}
        <line x1={PAD.left} x2={PAD.left + plotW}
          y1={ty(-50)} y2={ty(-50)}
          stroke="#ef4444" strokeWidth="1" strokeDasharray="6,3" opacity="0.5" />
        <text x={PAD.left + plotW - 2} y={ty(-50) - 3}
          fontSize="7" fill="#ef4444" textAnchor="end" opacity="0.7">thresh</text>

        {/* Voltage traces */}
        {lines.map(l => (
          <path key={l.label}
            d={toPathDs(l.values)}
            fill="none" stroke={l.color}
            strokeWidth="1.5"
            strokeDasharray={l.dash}
            opacity="0.85" />
        ))}

        {/* Y-axis ticks */}
        {yTicks.map(v => (
          <g key={v}>
            <line x1={PAD.left - 3} x2={PAD.left} y1={ty(v)} y2={ty(v)}
              stroke="#475569" strokeWidth="1" />
            <text x={PAD.left - 5} y={ty(v) + 3}
              textAnchor="end" fontSize="7" fill="#64748b">{v}</text>
          </g>
        ))}

        {/* X-axis ticks */}
        {xTicks.map(t => (
          <g key={t}>
            <line x1={tx(t)} x2={tx(t)}
              y1={PAD.top + plotH} y2={PAD.top + plotH + 3}
              stroke="#475569" strokeWidth="1" />
            <text x={tx(t)} y={H - 4}
              textAnchor="middle" fontSize="7" fill="#64748b">{t.toFixed(0)}ms</text>
          </g>
        ))}

        {/* Axes */}
        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + plotH}
          stroke="#334155" strokeWidth="1" />
        <line x1={PAD.left} y1={PAD.top + plotH} x2={PAD.left + plotW} y2={PAD.top + plotH}
          stroke="#334155" strokeWidth="1" />

        {/* Y label */}
        <text x={10} y={PAD.top + plotH / 2}
          textAnchor="middle" fontSize="8" fill="#64748b"
          transform={`rotate(-90, 10, ${PAD.top + plotH / 2})`}>mV</text>
      </svg>
    </div>
  );
};
