import { useState, useMemo, useCallback, type ReactElement } from 'react';
import { RecurrentSNN, generatePatterns, type TrainResult, type TestResult } from './brain/networks/recurrent_snn';

// ─── Chart Components ───────────────────────────────────────────────────────

const COLORS = ['#6366f1', '#f43f5e', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

function SVGLine({ values, w, h, pad, color, min, max, strokeWidth }: {
  values: number[]; w: number; h: number; pad: number;
  color: string; min: number; max: number; strokeWidth?: number;
}) {
  if (values.length < 2) return null;
  const denom = max - min || 1;
  const d = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (w - 2 * pad);
    const y = pad + (1 - (v - min) / denom) * (h - 2 * pad);
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return <path d={d} fill="none" stroke={color} strokeWidth={strokeWidth ?? 1.5} opacity={0.85} />;
}

function MultiLineChart({ series, labels, w, h, title, yMin, yMax }: {
  series: number[][]; labels: string[];
  w: number; h: number; title: string;
  yMin?: number; yMax?: number;
}) {
  const pad = 24;
  const allVals = series.flat();
  const mn = yMin ?? Math.min(...allVals);
  const mx = yMax ?? Math.max(...allVals);

  return (
    <div>
      <div className="text-xs font-medium text-slate-600 mb-1">{title}</div>
      <svg width={w} height={h} className="rounded-lg bg-white shadow-sm ring-1 ring-slate-200">
        {/* Y axis labels */}
        <text x={2} y={pad} fontSize={9} fill="#94a3b8">{mx.toFixed(2)}</text>
        <text x={2} y={h - pad + 10} fontSize={9} fill="#94a3b8">{mn.toFixed(2)}</text>
        {series.map((s, idx) => (
          <SVGLine key={idx} values={s} w={w} h={h} pad={pad} color={COLORS[idx % COLORS.length]} min={mn} max={mx} />
        ))}
      </svg>
      <div className="flex flex-wrap gap-2 mt-1">
        {labels.map((l, i) => (
          <div key={i} className="flex items-center gap-1 text-[10px] text-slate-600">
            <div className="w-3 h-0.5 rounded" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
            {l}
          </div>
        ))}
      </div>
    </div>
  );
}

function RasterPlot({ spikesMatrix, labels, w, h, title, dtMs, colors }: {
  spikesMatrix: boolean[][]; labels: string[];
  w: number; h: number; title: string; dtMs: number;
  colors?: string[];
}) {
  const pad = 28;
  const nNeurons = labels.length;
  const nSteps = spikesMatrix.length;
  if (nSteps === 0 || nNeurons === 0) return null;

  const rowH = (h - 2 * pad) / nNeurons;
  const lines: ReactElement[] = [];

  for (let t = 0; t < nSteps; t++) {
    const x = pad + (t / nSteps) * (w - 2 * pad);
    for (let n = 0; n < nNeurons; n++) {
      if (spikesMatrix[t][n]) {
        const y = pad + n * rowH + rowH / 2;
        const c = colors ? colors[n % colors.length] : COLORS[n % COLORS.length];
        lines.push(<line key={`${t}-${n}`} x1={x} y1={y - rowH * 0.35} x2={x} y2={y + rowH * 0.35} stroke={c} strokeWidth={1.5} />);
      }
    }
  }

  return (
    <div>
      <div className="text-xs font-medium text-slate-600 mb-1">{title}</div>
      <svg width={w} height={h} className="rounded-lg bg-white shadow-sm ring-1 ring-slate-200">
        {labels.map((l, i) => (
          <text key={i} x={3} y={pad + i * rowH + rowH / 2 + 3} fontSize={9} fill="#64748b">{l}</text>
        ))}
        {/* time axis */}
        <text x={pad} y={h - 4} fontSize={8} fill="#94a3b8">0ms</text>
        <text x={w - pad - 20} y={h - 4} fontSize={8} fill="#94a3b8">{(nSteps * dtMs).toFixed(0)}ms</text>
        {lines}
      </svg>
    </div>
  );
}

function HeatMap({ matrix, xLabels, yLabels, w, h, title, colorScale }: {
  matrix: number[][]; xLabels: string[]; yLabels: string[];
  w: number; h: number; title: string;
  colorScale?: (v: number, min: number, max: number) => string;
}) {
  const padL = 30;
  const padT = 10;
  const padR = 10;
  const padB = 20;

  const rows = matrix.length;
  const cols = rows > 0 ? matrix[0].length : 0;
  if (rows === 0 || cols === 0) return null;

  const allVals = matrix.flat();
  const mn = Math.min(...allVals);
  const mx = Math.max(...allVals);

  const cellW = (w - padL - padR) / cols;
  const cellH = (h - padT - padB) / rows;

  const defaultColor = (v: number, min: number, max: number) => {
    const t = max > min ? (v - min) / (max - min) : 0.5;
    const r = Math.round(99 + t * 100);
    const g = Math.round(102 + (1 - t) * 100);
    const b = Math.round(241);
    return `rgb(${r},${g},${b})`;
  };

  const getColor = colorScale ?? defaultColor;

  return (
    <div>
      <div className="text-xs font-medium text-slate-600 mb-1">{title}</div>
      <svg width={w} height={h} className="rounded-lg bg-white shadow-sm ring-1 ring-slate-200">
        {matrix.map((row, r) =>
          row.map((val, c) => (
            <rect key={`${r}-${c}`}
              x={padL + c * cellW} y={padT + r * cellH}
              width={cellW - 1} height={cellH - 1}
              fill={getColor(val, mn, mx)} rx={2} />
          ))
        )}
        {yLabels.map((l, i) => (
          <text key={`y${i}`} x={padL - 3} y={padT + i * cellH + cellH / 2 + 3}
            fontSize={8} fill="#64748b" textAnchor="end">{l}</text>
        ))}
        {xLabels.map((l, i) => (
          <text key={`x${i}`} x={padL + i * cellW + cellW / 2} y={h - 4}
            fontSize={8} fill="#64748b" textAnchor="middle">{l}</text>
        ))}
      </svg>
    </div>
  );
}

function BarChart({ values, labels, w, h, title, colors }: {
  values: number[]; labels: string[];
  w: number; h: number; title: string;
  colors?: string[];
}) {
  const pad = 24;
  const mx = Math.max(...values, 0.01);
  const barW = (w - 2 * pad) / values.length - 4;

  return (
    <div>
      <div className="text-xs font-medium text-slate-600 mb-1">{title}</div>
      <svg width={w} height={h} className="rounded-lg bg-white shadow-sm ring-1 ring-slate-200">
        {values.map((v, i) => {
          const barH = (v / mx) * (h - 2 * pad - 10);
          const x = pad + i * (barW + 4);
          const y = h - pad - barH;
          const c = colors ? colors[i % colors.length] : COLORS[i % COLORS.length];
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={barH} fill={c} rx={3} opacity={0.85} />
              <text x={x + barW / 2} y={h - pad + 12} fontSize={8} fill="#64748b" textAnchor="middle">{labels[i]}</text>
              <text x={x + barW / 2} y={y - 3} fontSize={8} fill="#64748b" textAnchor="middle">{v}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── Experiment runner ──────────────────────────────────────────────────────

interface ExperimentResult {
  trainHistory: {
    epoch: number;
    patternName: string;
    avgWeightIH: number;
    avgWeightHO: number;
    avgHomeoFactor: number;
    hiddenSpikes: number;
    outputSpikes: number;
  }[];
  testResults: TestResult[];
  finalWeightsIH: number[][];
  finalWeightsHO: number[][];
  finalHomeo: number[][];
  // Detailed data from last training epoch per pattern
  lastTrainDetail: Map<string, TrainResult>;
  // WTA / inhibition data
  wtaDynamics: {
    patternName: string;
    hiddenSpikeCounts: number[];
    outputSpikeCounts: number[];
  }[];
  // Homeostasis over time
  homeoOverEpochs: number[][];  // [epoch][sample_synapse_idx]
  // Firing rate stability
  firingRateOverEpochs: number[][];  // [epoch][hidden_neuron]
}

function runExperiment(params: {
  nInput: number; nHidden: number; nOutput: number;
  epochs: number; durationMs: number;
  inhibitionW: number; recurrentW: number;
  enableRecurrent: boolean;
  seed: number;
}): ExperimentResult {
  // Seed-like determinism via resetting random
  const origRandom = Math.random;
  let seedVal = params.seed;
  const seededRandom = () => {
    seedVal = (seedVal * 16807 + 0) % 2147483647;
    return seedVal / 2147483647;
  };
  Math.random = seededRandom;

  const net = new RecurrentSNN({
    nInput: params.nInput,
    nHidden: params.nHidden,
    nOutput: params.nOutput,
    inhibitionW: params.inhibitionW,
    recurrentW: params.recurrentW,
    enableRecurrent: params.enableRecurrent,
    hiddenThreshold: 0.7,
    outputThreshold: 0.6,
    initialW: 0.35,
    wMax: 2.0,
    aPlus: 0.012,
    aMinus: 0.013,
    targetRate: 6,
    homeoStrength: 0.0008,
  });

  Math.random = origRandom;

  const patterns = generatePatterns(params.nInput);
  const trainHistory: ExperimentResult['trainHistory'] = [];
  const lastTrainDetail = new Map<string, TrainResult>();
  const homeoOverEpochs: number[][] = [];
  const firingRateOverEpochs: number[][] = [];

  // Training
  for (let epoch = 0; epoch < params.epochs; epoch++) {
    for (const pattern of patterns) {
      const result = net.train(pattern, params.durationMs);
      lastTrainDetail.set(pattern.name, result);

      // Compute stats
      let hiddenSpikeCount = 0;
      for (const row of result.hiddenSpikes) for (const s of row) if (s) hiddenSpikeCount++;
      let outputSpikeCount = 0;
      for (const row of result.outputSpikes) for (const s of row) if (s) outputSpikeCount++;

      const ihWeights = result.weightsIH[result.weightsIH.length - 1] || [];
      const hoWeights = result.weightsHO[result.weightsHO.length - 1] || [];
      const homeos = result.homeoFactors[result.homeoFactors.length - 1] || [];

      const avgWIH = ihWeights.length > 0 ? ihWeights.reduce((a, b) => a + b, 0) / ihWeights.length : 0;
      const avgWHO = hoWeights.length > 0 ? hoWeights.reduce((a, b) => a + b, 0) / hoWeights.length : 0;
      const avgHomeo = homeos.length > 0 ? homeos.reduce((a, b) => a + b, 0) / homeos.length : 0;

      trainHistory.push({
        epoch,
        patternName: pattern.name,
        avgWeightIH: avgWIH,
        avgWeightHO: avgWHO,
        avgHomeoFactor: avgHomeo,
        hiddenSpikes: hiddenSpikeCount,
        outputSpikes: outputSpikeCount,
      });
    }

    // Record homeostatic factors (sample first few synapses)
    const hfRow: number[] = [];
    for (let i = 0; i < Math.min(3, params.nInput); i++) {
      for (let h = 0; h < Math.min(3, params.nHidden); h++) {
        hfRow.push(net.synapsesIH[i][h].homeoFactor);
      }
    }
    homeoOverEpochs.push(hfRow);

    // Record firing rates from hidden layer after last pattern
    const lastResult = lastTrainDetail.get(patterns[patterns.length - 1].name)!;
    const lastRates = lastResult.firingRates[lastResult.firingRates.length - 1] || [];
    firingRateOverEpochs.push([...lastRates]);
  }

  // Testing
  const testResults: TestResult[] = [];
  const wtaDynamics: ExperimentResult['wtaDynamics'] = [];

  for (const pattern of patterns) {
    const testResult = net.test(pattern, params.durationMs);
    testResults.push(testResult);

    // Count spikes per hidden neuron
    const hiddenCounts = new Array(params.nHidden).fill(0);
    const trResult = net.run(pattern, params.durationMs, false);
    for (const row of trResult.hiddenSpikes) {
      for (let n = 0; n < params.nHidden; n++) {
        if (row[n]) hiddenCounts[n]++;
      }
    }

    wtaDynamics.push({
      patternName: pattern.name,
      hiddenSpikeCounts: hiddenCounts,
      outputSpikeCounts: testResult.outputSpikeCounts,
    });
  }

  // Final weights
  const weights = net.getWeights();
  const homeoFactors = net.getHomeoFactors();

  return {
    trainHistory,
    testResults,
    finalWeightsIH: weights.ih,
    finalWeightsHO: weights.ho,
    finalHomeo: homeoFactors.ih,
    lastTrainDetail,
    wtaDynamics,
    homeoOverEpochs,
    firingRateOverEpochs,
  };
}

// ─── Main App ───────────────────────────────────────────────────────────────

type TabId = 'overview' | 'patterns' | 'homeostasis' | 'wta' | 'weights' | 'tests';

export function App() {
  const [epochs, setEpochs] = useState(40);
  const [durationMs, setDurationMs] = useState(80);
  const [inhibitionW, setInhibitionW] = useState(0.7);
  const [recurrentW, setRecurrentW] = useState(0.12);
  const [enableRecurrent, setEnableRecurrent] = useState(true);
  const [seed, setSeed] = useState(42);
  const [tab, setTab] = useState<TabId>('overview');

  const nInput = 6;
  const nHidden = 8;
  const nOutput = 5;
  const chartW = 480;
  const chartH = 160;

  const result = useMemo(() =>
    runExperiment({ nInput, nHidden, nOutput, epochs, durationMs, inhibitionW, recurrentW, enableRecurrent, seed }),
    [epochs, durationMs, inhibitionW, recurrentW, enableRecurrent, seed]
  );

  const rerun = useCallback(() => setSeed(s => s + 1), []);

  const patterns = generatePatterns(nInput);


  // Accuracy: check if winner neuron is unique per pattern
  const uniqueWinners = new Set(result.testResults.map(r => r.winnerNeuron));
  const accuracy = uniqueWinners.size === nOutput ? 100 :
    Math.round((uniqueWinners.size / nOutput) * 100);

  // Prepare series for training history
  const epochNums = Array.from({ length: epochs }, (_, i) => i);

  // Avg weight IH per epoch (averaged across patterns)
  const avgWIHPerEpoch = epochNums.map(e => {
    const entries = result.trainHistory.filter(h => h.epoch === e);
    return entries.reduce((s, h) => s + h.avgWeightIH, 0) / entries.length;
  });
  const avgWHOPerEpoch = epochNums.map(e => {
    const entries = result.trainHistory.filter(h => h.epoch === e);
    return entries.reduce((s, h) => s + h.avgWeightHO, 0) / entries.length;
  });
  const avgHomeoPerEpoch = epochNums.map(e => {
    const entries = result.trainHistory.filter(h => h.epoch === e);
    return entries.reduce((s, h) => s + h.avgHomeoFactor, 0) / entries.length;
  });

  // Tabs
  const tabs: { id: TabId; label: string }[] = [
    { id: 'overview', label: '📊 Overview' },
    { id: 'patterns', label: '🧬 Patterns' },
    { id: 'homeostasis', label: '⚖️ Homeostasis' },
    { id: 'wta', label: '🏆 WTA / Inhibition' },
    { id: 'weights', label: '🔗 Weights' },
    { id: 'tests', label: '🧪 Test Results' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-zinc-50 text-slate-900">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-7xl px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold tracking-tight">🧠 Recurrent SNN with Homeostatic STDP</h1>
            <p className="text-xs text-slate-500">
              {nInput} inputs → {nHidden} hidden (WTA) → {nOutput} outputs | {patterns.length} patterns | Lateral Inhibition + Recurrence
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
              accuracy >= 80 ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' :
              accuracy >= 50 ? 'bg-amber-50 text-amber-700 ring-amber-200' :
              'bg-red-50 text-red-700 ring-red-200'
            }`}>
              Separation: {uniqueWinners.size}/{nOutput} patterns
            </span>
            <button onClick={rerun}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-indigo-700 transition">
              🔄 Re-run
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-4">
        {/* Controls */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 mb-4">
          <label className="block">
            <span className="text-[10px] text-slate-500 font-medium">Epochs</span>
            <input type="number" className="mt-0.5 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
              value={epochs} min={5} max={200} onChange={e => setEpochs(+e.target.value)} />
          </label>
          <label className="block">
            <span className="text-[10px] text-slate-500 font-medium">Duration (ms)</span>
            <input type="number" className="mt-0.5 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
              value={durationMs} min={40} max={200} onChange={e => setDurationMs(+e.target.value)} />
          </label>
          <label className="block">
            <span className="text-[10px] text-slate-500 font-medium">Inhibition W</span>
            <input type="number" step={0.1} className="mt-0.5 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
              value={inhibitionW} min={0} max={3} onChange={e => setInhibitionW(+e.target.value)} />
          </label>
          <label className="block">
            <span className="text-[10px] text-slate-500 font-medium">Recurrent W</span>
            <input type="number" step={0.02} className="mt-0.5 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
              value={recurrentW} min={0} max={1} onChange={e => setRecurrentW(+e.target.value)} />
          </label>
          <label className="flex items-center gap-2 pt-4">
            <input type="checkbox" checked={enableRecurrent}
              onChange={e => setEnableRecurrent(e.target.checked)}
              className="rounded border-slate-300" />
            <span className="text-xs text-slate-600">Recurrent</span>
          </label>
          <label className="block">
            <span className="text-[10px] text-slate-500 font-medium">Seed</span>
            <input type="number" className="mt-0.5 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
              value={seed} onChange={e => setSeed(+e.target.value)} />
          </label>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition whitespace-nowrap ${
                tab === t.id ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="space-y-4">

          {/* ─── OVERVIEW ─── */}
          {tab === 'overview' && (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <MultiLineChart
                  series={[avgWIHPerEpoch, avgWHOPerEpoch]}
                  labels={['Avg W (Input→Hidden)', 'Avg W (Hidden→Output)']}
                  w={chartW} h={chartH}
                  title="Weight Evolution Over Training"
                  yMin={0} yMax={1.5}
                />
              </div>
              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <MultiLineChart
                  series={[avgHomeoPerEpoch]}
                  labels={['Avg Homeostatic Factor']}
                  w={chartW} h={chartH}
                  title="Homeostatic Factor Over Training"
                  yMin={0} yMax={3}
                />
              </div>

              {/* Test summary */}
              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 lg:col-span-2">
                <div className="text-sm font-semibold mb-3">Test Results Summary</div>
                <div className="grid grid-cols-5 gap-3">
                  {result.testResults.map((tr, i) => (
                    <div key={i} className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                      <div className="text-xs font-semibold" style={{ color: COLORS[i] }}>
                        {tr.patternName}
                      </div>
                      <div className="mt-1 text-lg font-bold">→ N{tr.winnerNeuron}</div>
                      <div className="text-[10px] text-slate-500">
                        conf: {(tr.confidence * 100).toFixed(0)}%
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">
                        spikes: [{tr.outputSpikeCounts.join(', ')}]
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Architecture */}
              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 lg:col-span-2">
                <div className="text-sm font-semibold mb-2">Network Architecture</div>
                <div className="flex items-center justify-center gap-6 py-4">
                  <div className="text-center">
                    <div className="grid grid-cols-3 gap-1">
                      {Array.from({ length: nInput }).map((_, i) => (
                        <div key={i} className="w-6 h-6 rounded-full bg-sky-100 ring-1 ring-sky-300 flex items-center justify-center text-[8px] text-sky-700 font-bold">{i}</div>
                      ))}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">Input ({nInput})</div>
                  </div>
                  <div className="text-slate-300 text-xl">→</div>
                  <div className="text-center">
                    <div className="grid grid-cols-4 gap-1">
                      {Array.from({ length: nHidden }).map((_, i) => (
                        <div key={i} className="w-6 h-6 rounded-full bg-violet-100 ring-1 ring-violet-300 flex items-center justify-center text-[8px] text-violet-700 font-bold">{i}</div>
                      ))}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">Hidden ({nHidden}) + WTA</div>
                    {enableRecurrent && <div className="text-[9px] text-violet-500">↻ recurrent</div>}
                  </div>
                  <div className="text-slate-300 text-xl">→</div>
                  <div className="text-center">
                    <div className="flex gap-1">
                      {Array.from({ length: nOutput }).map((_, i) => (
                        <div key={i} className="w-6 h-6 rounded-full bg-rose-100 ring-1 ring-rose-300 flex items-center justify-center text-[8px] text-rose-700 font-bold">{i}</div>
                      ))}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">Output ({nOutput}) + WTA</div>
                  </div>
                </div>
                <div className="text-[10px] text-slate-400 text-center">
                  {nInput * nHidden} I→H synapses (Homeo-STDP) + {nHidden * nOutput} H→O synapses (Homeo-STDP)
                  + {nHidden * (nHidden - 1)} recurrent + lateral inhibition
                </div>
              </div>
            </div>
          )}

          {/* ─── PATTERNS ─── */}
          {tab === 'patterns' && (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 lg:col-span-2">
                <div className="text-sm font-semibold mb-2">5 Spike Patterns (Input Layer)</div>
                <div className="text-xs text-slate-500 mb-3">
                  Each pattern defines when each of the {nInput} input neurons fires.
                  Temporal order creates distinct spatiotemporal signatures.
                </div>
                <div className="grid grid-cols-5 gap-3">
                  {patterns.map((p, pi) => (
                    <div key={pi} className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                      <div className="text-xs font-bold" style={{ color: COLORS[pi] }}>{p.name}</div>
                      <div className="mt-1 space-y-0.5">
                        {p.spikeTimes.map((t, ni) => (
                          <div key={ni} className="flex items-center gap-1">
                            <span className="text-[9px] text-slate-400 w-5">n{ni}</span>
                            <div className="flex-1 h-2 bg-slate-200 rounded-full relative">
                              <div className="absolute h-2 w-1 rounded-full"
                                style={{
                                  left: `${(t / 60) * 100}%`,
                                  backgroundColor: COLORS[pi],
                                }} />
                            </div>
                            <span className="text-[9px] text-slate-400 w-8">{t}ms</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Raster plots for each pattern (from last training) */}
              {patterns.map((p, pi) => {
                const detail = result.lastTrainDetail.get(p.name);
                if (!detail) return null;
                return (
                  <div key={pi} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                    <RasterPlot
                      spikesMatrix={detail.inputSpikes}
                      labels={Array.from({ length: nInput }, (_, i) => `in${i}`)}
                      w={chartW} h={100}
                      title={`Input Raster: ${p.name}`}
                      dtMs={1}
                      colors={[COLORS[pi]]}
                    />
                    <div className="mt-2" />
                    <RasterPlot
                      spikesMatrix={detail.hiddenSpikes}
                      labels={Array.from({ length: nHidden }, (_, i) => `h${i}`)}
                      w={chartW} h={120}
                      title={`Hidden Raster: ${p.name}`}
                      dtMs={1}
                    />
                  </div>
                );
              })}
            </div>
          )}

          {/* ─── HOMEOSTASIS ─── */}
          {tab === 'homeostasis' && (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <MultiLineChart
                  series={
                    result.homeoOverEpochs[0]
                      ? result.homeoOverEpochs[0].map((_, si) =>
                          result.homeoOverEpochs.map(row => row[si]))
                      : []
                  }
                  labels={
                    result.homeoOverEpochs[0]
                      ? result.homeoOverEpochs[0].map((_, si) => `syn${si}`)
                      : []
                  }
                  w={chartW} h={chartH}
                  title="Homeostatic Factors (Sample I→H Synapses) Over Epochs"
                  yMin={0} yMax={3}
                />
                <div className="text-[10px] text-slate-400 mt-2">
                  Homeostasis adjusts synaptic scaling to maintain target firing rates.
                  Factors &gt; 1 = boosting quiet synapses, &lt; 1 = suppressing active ones.
                </div>
              </div>

              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <MultiLineChart
                  series={
                    result.firingRateOverEpochs[0]
                      ? result.firingRateOverEpochs[0].map((_, ni) =>
                          result.firingRateOverEpochs.map(row => row[ni] || 0))
                      : []
                  }
                  labels={Array.from({ length: nHidden }, (_, i) => `h${i}`)}
                  w={chartW} h={chartH}
                  title="Hidden Layer Firing Rates Over Epochs (Hz)"
                  yMin={0}
                />
                <div className="text-[10px] text-slate-400 mt-2">
                  Homeostasis stabilizes firing rates around the target rate.
                  Without it, some neurons would dominate while others go silent.
                </div>
              </div>

              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 lg:col-span-2">
                <div className="text-sm font-semibold mb-2">How Homeostasis Works</div>
                <div className="grid grid-cols-3 gap-4 text-xs text-slate-600">
                  <div className="bg-emerald-50 rounded-xl p-3 ring-1 ring-emerald-200">
                    <div className="font-semibold text-emerald-700 mb-1">📈 Activity Too Low</div>
                    <p>Neuron fires below target rate → homeostatic factor increases → effective weights scaled up → more excitation → firing rate rises</p>
                  </div>
                  <div className="bg-amber-50 rounded-xl p-3 ring-1 ring-amber-200">
                    <div className="font-semibold text-amber-700 mb-1">⚖️ At Target</div>
                    <p>Neuron fires at target rate → homeostatic factor ≈ 1.0 → weights unchanged → stable dynamics</p>
                  </div>
                  <div className="bg-rose-50 rounded-xl p-3 ring-1 ring-rose-200">
                    <div className="font-semibold text-rose-700 mb-1">📉 Activity Too High</div>
                    <p>Neuron fires above target rate → homeostatic factor decreases → effective weights scaled down → less excitation → firing rate drops</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─── WTA / INHIBITION ─── */}
          {tab === 'wta' && (
            <div className="grid gap-4 lg:grid-cols-2">
              {result.wtaDynamics.map((wta, i) => (
                <div key={i} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                  <BarChart
                    values={wta.hiddenSpikeCounts}
                    labels={Array.from({ length: nHidden }, (_, j) => `H${j}`)}
                    w={chartW} h={chartH}
                    title={`Hidden WTA: ${wta.patternName}`}
                  />
                  <div className="mt-3" />
                  <BarChart
                    values={wta.outputSpikeCounts}
                    labels={Array.from({ length: nOutput }, (_, j) => `O${j}`)}
                    w={chartW} h={120}
                    title={`Output WTA: ${wta.patternName}`}
                    colors={COLORS.slice(3)}
                  />
                </div>
              ))}

              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 lg:col-span-2">
                <div className="text-sm font-semibold mb-2">Lateral Inhibition & WTA Dynamics</div>
                <div className="grid grid-cols-2 gap-4 text-xs text-slate-600">
                  <div className="bg-violet-50 rounded-xl p-3 ring-1 ring-violet-200">
                    <div className="font-semibold text-violet-700 mb-1">🏆 Winner-Take-All</div>
                    <p>Each neuron that fires sends inhibitory current to all other neurons in the same layer.
                    The strongest responder suppresses competitors, creating sparse selective representations.</p>
                    <p className="mt-1 font-medium">Inhibition weight: {inhibitionW}</p>
                  </div>
                  <div className="bg-cyan-50 rounded-xl p-3 ring-1 ring-cyan-200">
                    <div className="font-semibold text-cyan-700 mb-1">🔀 Pattern Selectivity</div>
                    <p>Different patterns activate different winner neurons, enabling the network to
                    discriminate between {patterns.length} distinct temporal spike patterns through
                    competitive learning.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─── WEIGHTS ─── */}
          {tab === 'weights' && (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <HeatMap
                  matrix={result.finalWeightsIH}
                  xLabels={Array.from({ length: nHidden }, (_, i) => `H${i}`)}
                  yLabels={Array.from({ length: nInput }, (_, i) => `In${i}`)}
                  w={chartW} h={200}
                  title="Input → Hidden Weights"
                />
              </div>
              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <HeatMap
                  matrix={result.finalWeightsHO}
                  xLabels={Array.from({ length: nOutput }, (_, i) => `O${i}`)}
                  yLabels={Array.from({ length: nHidden }, (_, i) => `H${i}`)}
                  w={chartW} h={220}
                  title="Hidden → Output Weights"
                />
              </div>
              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <HeatMap
                  matrix={result.finalHomeo}
                  xLabels={Array.from({ length: nHidden }, (_, i) => `H${i}`)}
                  yLabels={Array.from({ length: nInput }, (_, i) => `In${i}`)}
                  w={chartW} h={200}
                  title="Homeostatic Factors (I→H)"
                  colorScale={(v, mn, mx) => {
                    const t = mx > mn ? (v - mn) / (mx - mn) : 0.5;
                    if (t < 0.5) {
                      const r = Math.round(239);
                      const g = Math.round(68 + t * 2 * 187);
                      const b = Math.round(68);
                      return `rgb(${r},${g},${b})`;
                    } else {
                      const r = Math.round(239 - (t - 0.5) * 2 * 205);
                      const g = Math.round(255);
                      const b = Math.round(68 - (t - 0.5) * 2 * 34);
                      return `rgb(${r},${g},${b})`;
                    }
                  }}
                />
              </div>
              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <MultiLineChart
                  series={[avgWIHPerEpoch, avgWHOPerEpoch]}
                  labels={['Avg I→H', 'Avg H→O']}
                  w={chartW} h={chartH}
                  title="Average Weight Trajectories"
                  yMin={0} yMax={1.5}
                />
              </div>
            </div>
          )}

          {/* ─── TEST RESULTS ─── */}
          {tab === 'tests' && (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 lg:col-span-2">
                <div className="text-sm font-semibold mb-3">Classification Matrix</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-2 px-3 text-slate-500">Pattern</th>
                        {Array.from({ length: nOutput }, (_, i) => (
                          <th key={i} className="text-center py-2 px-3 text-slate-500">Output {i}</th>
                        ))}
                        <th className="text-center py-2 px-3 text-slate-500">Winner</th>
                        <th className="text-center py-2 px-3 text-slate-500">Confidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.testResults.map((tr, i) => (
                        <tr key={i} className="border-b border-slate-100">
                          <td className="py-2 px-3 font-semibold" style={{ color: COLORS[i] }}>{tr.patternName}</td>
                          {tr.outputSpikeCounts.map((c, j) => (
                            <td key={j} className={`text-center py-2 px-3 ${j === tr.winnerNeuron ? 'font-bold text-indigo-700 bg-indigo-50' : 'text-slate-500'}`}>
                              {c}
                            </td>
                          ))}
                          <td className="text-center py-2 px-3 font-bold text-indigo-700">N{tr.winnerNeuron}</td>
                          <td className="text-center py-2 px-3">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${
                              tr.confidence >= 0.5 ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' :
                              tr.confidence >= 0.3 ? 'bg-amber-50 text-amber-700 ring-amber-200' :
                              'bg-red-50 text-red-700 ring-red-200'
                            }`}>
                              {(tr.confidence * 100).toFixed(0)}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {result.testResults.map((tr, i) => (
                <div key={i} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                  <BarChart
                    values={tr.outputSpikeCounts}
                    labels={Array.from({ length: nOutput }, (_, j) => `O${j}`)}
                    w={chartW} h={chartH}
                    title={`${tr.patternName}: Output Spike Counts`}
                    colors={tr.outputSpikeCounts.map((_, j) => j === tr.winnerNeuron ? COLORS[i] : '#cbd5e1')}
                  />
                </div>
              ))}

              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 lg:col-span-2">
                <div className="text-sm font-semibold mb-2">✅ Success Criteria</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div className={`rounded-xl p-3 ring-1 ${uniqueWinners.size >= 4 ? 'bg-emerald-50 ring-emerald-200' : 'bg-red-50 ring-red-200'}`}>
                    <div className="font-semibold">Pattern Discrimination</div>
                    <div className="mt-1">{uniqueWinners.size}/{nOutput} unique winners</div>
                  </div>
                  <div className={`rounded-xl p-3 ring-1 ${avgHomeoPerEpoch[avgHomeoPerEpoch.length - 1] > 0.3 && avgHomeoPerEpoch[avgHomeoPerEpoch.length - 1] < 2.5 ? 'bg-emerald-50 ring-emerald-200' : 'bg-amber-50 ring-amber-200'}`}>
                    <div className="font-semibold">Homeostasis Stable</div>
                    <div className="mt-1">Factor: {avgHomeoPerEpoch[avgHomeoPerEpoch.length - 1]?.toFixed(2)}</div>
                  </div>
                  <div className={`rounded-xl p-3 ring-1 bg-emerald-50 ring-emerald-200`}>
                    <div className="font-semibold">WTA Active</div>
                    <div className="mt-1">Inhibition W: {inhibitionW}</div>
                  </div>
                  <div className={`rounded-xl p-3 ring-1 ${enableRecurrent ? 'bg-emerald-50 ring-emerald-200' : 'bg-slate-50 ring-slate-200'}`}>
                    <div className="font-semibold">Recurrence</div>
                    <div className="mt-1">{enableRecurrent ? 'Enabled' : 'Disabled'}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Footer */}
      <footer className="mt-8 border-t border-slate-200 py-4 text-center text-[10px] text-slate-400">
        Recurrent SNN with Homeostatic STDP, Lateral Inhibition, WTA Dynamics
        — AdaptiveLIF + IzhikevichNeuron + BurstingNeuron | HomeostaticSTDP + RecurrentSynapse + InhibitorySynapse
      </footer>
    </div>
  );
}
