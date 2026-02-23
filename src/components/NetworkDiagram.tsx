import React from 'react';

interface Props {
  w1: number;
  w2: number;
}

export const NetworkDiagram: React.FC<Props> = ({ w1, w2 }) => {
  const W = 340;
  const H = 180;

  const neurons = {
    in1:  { x: 70,  y: 55,  label: 'Input 1', color: '#6366f1' },
    in2:  { x: 70,  y: 130, label: 'Input 2', color: '#f59e0b' },
    out:  { x: 270, y: 90,  label: 'Output',  color: '#22c55e' },
  };
  const r = 28;

  const weightToColor = (w: number) => {
    const g = Math.round(w * 255);
    return `rgb(${255 - g}, ${g}, 60)`;
  };
  const weightToWidth = (w: number) => 1.5 + w * 5;

  return (
    <div className="bg-slate-900 rounded-xl p-3">
      <div className="text-slate-200 text-sm font-semibold mb-2 px-1">Network Architecture</div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`}>
        {/* Synapse 1 */}
        <line
          x1={neurons.in1.x + r} y1={neurons.in1.y}
          x2={neurons.out.x - r} y2={neurons.out.y}
          stroke={weightToColor(w1)} strokeWidth={weightToWidth(w1)}
          opacity="0.85" strokeLinecap="round"
        />
        {/* Synapse 2 */}
        <line
          x1={neurons.in2.x + r} y1={neurons.in2.y}
          x2={neurons.out.x - r} y2={neurons.out.y}
          stroke={weightToColor(w2)} strokeWidth={weightToWidth(w2)}
          opacity="0.85" strokeLinecap="round"
        />

        {/* Synapse weight labels */}
        <text
          x={(neurons.in1.x + r + neurons.out.x - r) / 2 - 10}
          y={(neurons.in1.y + neurons.out.y) / 2 - 8}
          fontSize="9" fill="#94a3b8" textAnchor="middle" fontWeight="600">
          w1={w1.toFixed(3)}
        </text>
        <text
          x={(neurons.in2.x + r + neurons.out.x - r) / 2 - 10}
          y={(neurons.in2.y + neurons.out.y) / 2 + 14}
          fontSize="9" fill="#94a3b8" textAnchor="middle" fontWeight="600">
          w2={w2.toFixed(3)}
        </text>

        {/* Neurons */}
        {Object.entries(neurons).map(([key, n]) => (
          <g key={key}>
            <circle cx={n.x} cy={n.y} r={r}
              fill="#0f172a" stroke={n.color} strokeWidth="2.5" />
            <text x={n.x} y={n.y - 2} textAnchor="middle" fontSize="8" fill={n.color} fontWeight="700">
              {key === 'out' ? 'OUT' : key.toUpperCase()}
            </text>
            <text x={n.x} y={n.y + 9} textAnchor="middle" fontSize="7" fill="#64748b">
              LIF
            </text>
          </g>
        ))}

        {/* Labels below */}
        {Object.entries(neurons).map(([key, n]) => (
          <text key={`lbl-${key}`} x={n.x} y={n.y + r + 14}
            textAnchor="middle" fontSize="8" fill="#94a3b8">
            {n.label}
          </text>
        ))}

        {/* STDP label */}
        <text x={W / 2} y={H - 5}
          textAnchor="middle" fontSize="8" fill="#475569">
          STDP Synapses — weight: 0.0 (red) → 1.0 (green)
        </text>
      </svg>
    </div>
  );
};
