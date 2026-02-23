import { useState, useCallback, useRef } from 'react';
import { SimpleSTDPNetwork, SimulationRecord, TrainingEpochResult } from './brain/network';
import { SpikeRasterChart } from './components/SpikeRasterChart';
import { VoltageChart } from './components/VoltageChart';
import { WeightChart } from './components/WeightChart';
import { NetworkDiagram } from './components/NetworkDiagram';

const DURATION = 50; // ms per trial
const EPOCHS   = 80; // training epochs

type AppState = 'idle' | 'training' | 'done';

interface Results {
  trainingHistory: TrainingEpochResult[];
  testA: SimulationRecord;
  testB: SimulationRecord;
  finalW1: number;
  finalW2: number;
}

export function App() {
  const [state, setState] = useState<AppState>('idle');
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<Results | null>(null);
  const [liveWeights, setLiveWeights] = useState({ w1: 0.5, w2: 0.5 });
  const networkRef = useRef<SimpleSTDPNetwork | null>(null);

  const runSimulation = useCallback(() => {
    setState('training');
    setProgress(0);
    setResults(null);

    // Run async to avoid blocking UI
    setTimeout(() => {
      const net = new SimpleSTDPNetwork();
      networkRef.current = net;

      const history: TrainingEpochResult[] = [];

      // Train with progress updates
      net.synapse1.resetFull(0.5);
      net.synapse2.resetFull(0.5);

      for (let e = 0; e < EPOCHS; e++) {
        const epochResults = net.train('A', DURATION, 1);
        history.push(...epochResults);
        setProgress(Math.round(((e + 1) / EPOCHS) * 100));
        setLiveWeights({ w1: net.synapse1.weight, w2: net.synapse2.weight });
      }

      const testA = net.test('A', DURATION);
      const testB = net.test('B', DURATION);
      const { w1, w2 } = net.get_weights();

      setResults({
        trainingHistory: history,
        testA,
        testB,
        finalW1: w1,
        finalW2: w2,
      });
      setLiveWeights({ w1, w2 });
      setState('done');
    }, 50);
  }, []);

  const reset = useCallback(() => {
    setState('idle');
    setProgress(0);
    setResults(null);
    setLiveWeights({ w1: 0.5, w2: 0.5 });
    networkRef.current = null;
  }, []);

  const firedA = results ? results.testA.spikes_out.length > 0 : false;
  const firedB = results ? results.testB.spikes_out.length > 0 : false;
  const success = firedA && !firedB;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-mono">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-sm font-bold">
              🧠
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-100 leading-tight">STDP Neural Network</h1>
              <p className="text-xs text-slate-500">Spike-Timing Dependent Plasticity · LIF Neurons</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {state !== 'idle' && (
              <button onClick={reset}
                className="px-3 py-1.5 text-xs border border-slate-700 rounded-lg text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-colors">
                Reset
              </button>
            )}
            <button
              onClick={runSimulation}
              disabled={state === 'training'}
              className={`px-4 py-1.5 text-xs rounded-lg font-semibold transition-all ${
                state === 'training'
                  ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
              }`}>
              {state === 'training' ? `Training… ${progress}%` :
               state === 'done'     ? '▶ Re-run'   : '▶ Run Simulation'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">

        {/* Description cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="text-xs text-indigo-400 font-semibold mb-2 uppercase tracking-wider">Architecture</div>
            <div className="space-y-1.5 text-xs text-slate-400">
              <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-indigo-400 inline-block"/>2 × LIF Input Neurons</div>
              <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-400 inline-block"/>1 × LIF Output Neuron</div>
              <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-purple-400 inline-block"/>2 × STDP Synapses</div>
            </div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="text-xs text-amber-400 font-semibold mb-2 uppercase tracking-wider">Patterns</div>
            <div className="space-y-1.5 text-xs text-slate-400">
              <div><span className="text-indigo-300 font-bold">Pattern A:</span> Input1 → Input2 <span className="text-slate-600">(+10ms)</span></div>
              <div><span className="text-amber-300 font-bold">Pattern B:</span> Input2 → Input1 <span className="text-slate-600">(+10ms)</span></div>
              <div className="text-slate-600 pt-1">τ_m=20ms, V_thresh=−50mV</div>
            </div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="text-xs text-green-400 font-semibold mb-2 uppercase tracking-wider">STDP Rules</div>
            <div className="space-y-1.5 text-xs text-slate-400">
              <div><span className="text-green-300">LTP:</span> Pre→Post: ΔW=A₊·x_pre</div>
              <div><span className="text-red-300">LTD:</span> Post→Pre: ΔW=−A₋·x_post</div>
              <div className="text-slate-600 pt-1">A₊=0.015, A₋=0.012, τ=20ms</div>
            </div>
          </div>
        </div>

        {/* Training config */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap gap-6 text-xs">
          {[
            ['Training Pattern', 'Pattern A (Input1 first)'],
            ['Epochs', `${EPOCHS}`],
            ['Trial Duration', `${DURATION} ms`],
            ['Time Step (dt)', '0.1 ms'],
            ['Initial Weights', 'w1 = w2 = 0.5'],
          ].map(([k, v]) => (
            <div key={k}>
              <div className="text-slate-500 mb-0.5">{k}</div>
              <div className="text-slate-200 font-semibold">{v}</div>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        {state === 'training' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span>Training in progress…</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-600 to-purple-500 transition-all duration-200 rounded-full"
                style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-2 flex gap-4 text-xs text-slate-500">
              <span>w1 = <span className="text-indigo-400 font-semibold">{liveWeights.w1.toFixed(4)}</span></span>
              <span>w2 = <span className="text-amber-400 font-semibold">{liveWeights.w2.toFixed(4)}</span></span>
            </div>
          </div>
        )}

        {/* Network diagram + weight chart */}
        {(state === 'training' || state === 'done') && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <NetworkDiagram w1={liveWeights.w1} w2={liveWeights.w2} />
            {results && (
              <WeightChart history={results.trainingHistory.map((h, i) => ({
                epoch: i + 1, w1: h.w1, w2: h.w2
              }))} />
            )}
          </div>
        )}

        {/* Results */}
        {results && (
          <>
            {/* Result banner */}
            <div className={`rounded-xl p-5 border ${success
              ? 'border-green-500/30 bg-green-500/5'
              : 'border-red-500/30 bg-red-500/5'}`}>
              <div className="flex items-start gap-4">
                <div className={`text-3xl ${success ? 'text-green-400' : 'text-red-400'}`}>
                  {success ? '✅' : '⚠️'}
                </div>
                <div>
                  <div className={`font-bold text-base mb-1 ${success ? 'text-green-400' : 'text-red-400'}`}>
                    {success ? 'Learning Successful!' : 'Learning Incomplete'}
                  </div>
                  <div className="text-sm text-slate-400 space-y-1">
                    <div>
                      <span className="text-indigo-300 font-semibold">Pattern A: </span>
                      {firedA
                        ? <span className="text-green-400">Output spiked ✓ ({results.testA.spikes_out.length} spike{results.testA.spikes_out.length !== 1 ? 's' : ''} at {results.testA.spikes_out.map(t => t.toFixed(1)).join(', ')}ms)</span>
                        : <span className="text-red-400">Output silent ✗ (expected to fire)</span>}
                    </div>
                    <div>
                      <span className="text-amber-300 font-semibold">Pattern B: </span>
                      {!firedB
                        ? <span className="text-green-400">Output silent ✓ (correctly suppressed)</span>
                        : <span className="text-red-400">Output spiked ✗ ({results.testB.spikes_out.length} spike{results.testB.spikes_out.length !== 1 ? 's' : ''}) — should be silent</span>}
                    </div>
                  </div>
                </div>
                <div className="ml-auto text-right text-xs text-slate-500 shrink-0 space-y-1">
                  <div>Final w1 = <span className="text-indigo-400 font-bold">{results.finalW1.toFixed(4)}</span></div>
                  <div>Final w2 = <span className="text-amber-400 font-bold">{results.finalW2.toFixed(4)}</span></div>
                  <div className={`font-semibold mt-1 ${results.finalW1 > results.finalW2 ? 'text-indigo-400' : 'text-amber-400'}`}>
                    {results.finalW1 > results.finalW2 ? 'w1 > w2 ✓' : 'w2 > w1'}
                  </div>
                </div>
              </div>
            </div>

            {/* Test A results */}
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-indigo-500" />
                Test Results — Pattern A (Input1 fires first)
              </div>
              <div className="space-y-3">
                <SpikeRasterChart
                  title="Pattern A — Spike Raster"
                  duration={DURATION}
                  spikesIn1={results.testA.spikes_in1}
                  spikesIn2={results.testA.spikes_in2}
                  spikesOut={results.testA.spikes_out}
                  fired={results.testA.spikes_out.length > 0}
                />
                <VoltageChart
                  title="Pattern A — Membrane Potentials"
                  time={results.testA.time}
                  v_in1={results.testA.v_in1}
                  v_in2={results.testA.v_in2}
                  v_out={results.testA.v_out}
                />
              </div>
            </div>

            {/* Test B results */}
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                Test Results — Pattern B (Input2 fires first)
              </div>
              <div className="space-y-3">
                <SpikeRasterChart
                  title="Pattern B — Spike Raster"
                  duration={DURATION}
                  spikesIn1={results.testB.spikes_in1}
                  spikesIn2={results.testB.spikes_in2}
                  spikesOut={results.testB.spikes_out}
                  fired={results.testB.spikes_out.length > 0}
                />
                <VoltageChart
                  title="Pattern B — Membrane Potentials"
                  time={results.testB.time}
                  v_in1={results.testB.v_in1}
                  v_in2={results.testB.v_in2}
                  v_out={results.testB.v_out}
                />
              </div>
            </div>

            {/* Code snippet */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <div className="text-xs text-slate-500 uppercase tracking-widest mb-3">Usage Example</div>
              <pre className="text-xs text-slate-300 overflow-x-auto leading-relaxed">
{`from brain.neurons import LIFNeuron
from brain.synapses import STDPSynapse
from brain.network import SimpleSTDPNetwork

# Create network
net = SimpleSTDPNetwork()

# Train on Pattern A (input1 fires first)
net.train(pattern='A', duration=50, epochs=${EPOCHS})

# Test both patterns
test_a = net.test(pattern='A', duration=50)
test_b = net.test(pattern='B', duration=50)

# Get learned weights
weights = net.get_weights()
print(f"w1 = {weights['w1']:.4f}")   # → ${results.finalW1.toFixed(4)} (strong, input1-linked)
print(f"w2 = {weights['w2']:.4f}")   # → ${results.finalW2.toFixed(4)} (weak, input2-linked)

# Results
print(f"Pattern A fired: {firedA}")   # → ${String(firedA)}
print(f"Pattern B fired: {firedB}")   # → ${String(firedB)}`}
              </pre>
            </div>

            {/* STDP explanation */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <div className="text-xs text-slate-500 uppercase tracking-widest mb-4">How STDP Learning Works</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-slate-400">
                <div>
                  <div className="text-green-400 font-semibold mb-2">① Pattern A Training (Input1 first)</div>
                  <ol className="space-y-1.5 list-decimal list-inside">
                    <li>Input1 spikes at t=5ms → PSP reaches output</li>
                    <li>Input2 spikes at t=15ms → PSP reaches output</li>
                    <li>Combined PSPs push output above threshold → output fires</li>
                    <li><span className="text-green-300">LTP on Synapse1:</span> Input1 fired BEFORE output → w1 ↑</li>
                    <li><span className="text-red-300">LTD on Synapse2:</span> Input2 fired AFTER output → w2 stays low</li>
                  </ol>
                </div>
                <div>
                  <div className="text-indigo-400 font-semibold mb-2">② After Convergence (w1≫w2)</div>
                  <ol className="space-y-1.5 list-decimal list-inside">
                    <li><span className="text-indigo-300">Pattern A:</span> Input1 PSP alone (w1×15mV={`${(results.finalW1*15).toFixed(1)}`}mV) crosses threshold → fires ✅</li>
                    <li><span className="text-amber-300">Pattern B:</span> Input2 PSP (w2×15mV={`${(results.finalW2*15).toFixed(1)}`}mV) too weak → silent ✅</li>
                    <li>Network has learned to distinguish temporal order of inputs</li>
                  </ol>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Idle state */}
        {state === 'idle' && (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">🧠</div>
            <div className="text-slate-400 text-sm mb-2">
              Ready to simulate a <span className="text-indigo-400 font-semibold">Spiking Neural Network</span> with STDP learning
            </div>
            <div className="text-slate-600 text-xs">
              Click "Run Simulation" to train and visualize the network
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-slate-900 mt-8 py-4 text-center text-xs text-slate-700">
        SimpleSTDPNetwork · LIF Neurons · Online Trace-Based STDP · {EPOCHS} epochs × {DURATION}ms
      </div>
    </div>
  );
}
