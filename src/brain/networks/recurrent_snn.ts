/**
 * RecurrentSNN: Multi-layer recurrent spiking neural network
 *
 * Architecture:
 *   Input layer (N_in neurons) →  Hidden layer (N_hid neurons, with WTA) →  Output layer (N_out neurons, with WTA)
 *   + Recurrent connections within hidden layer
 *   + Homeostatic STDP on feedforward synapses
 *
 * Capable of learning to classify multiple spike patterns.
 */

import { AdaptiveLIFNeuron } from '../neurons/adaptive';
import { HomeostaticSTDPSynapse } from '../synapses/homeostatic_stdp';
import { RecurrentSynapse } from '../synapses/recurrent';
import { SpikingLayer } from '../layers/spiking_layer';

export interface SpikePattern {
  name: string;
  /** Spike times for each input neuron (ms) */
  spikeTimes: number[];
}

export interface RecurrentSNNParams {
  nInput: number;
  nHidden: number;
  nOutput: number;
  dtMs?: number;
  // Neuron params
  hiddenThreshold?: number;
  outputThreshold?: number;
  // Synapse params
  initialW?: number;
  wMax?: number;
  // STDP
  aPlus?: number;
  aMinus?: number;
  // Homeostasis
  targetRate?: number;
  homeoStrength?: number;
  // Inhibition
  inhibitionW?: number;
  // Recurrent
  recurrentW?: number;
  enableRecurrent?: boolean;
}

export interface TrainResult {
  t: number[];
  inputSpikes: boolean[][];   // [time][neuron]
  hiddenSpikes: boolean[][];
  outputSpikes: boolean[][];
  hiddenV: number[][];
  outputV: number[][];
  weightsIH: number[][];      // [time][synapse_idx] for input→hidden
  weightsHO: number[][];      // [time][synapse_idx] for hidden→output
  homeoFactors: number[][];
  firingRates: number[][];
}

export interface TestResult {
  patternName: string;
  outputSpikes: boolean[][];
  winnerNeuron: number;
  outputSpikeCounts: number[];
  confidence: number;
}

export class RecurrentSNN {
  public inputNeurons: AdaptiveLIFNeuron[];
  public hiddenLayer: SpikingLayer;
  public outputLayer: SpikingLayer;

  public synapsesIH: HomeostaticSTDPSynapse[][]; // [input][hidden]
  public synapsesHO: HomeostaticSTDPSynapse[][]; // [hidden][output]
  public recurrentSynapses: RecurrentSynapse[][]; // [hidden][hidden]

  public nInput: number;
  public nHidden: number;
  public nOutput: number;
  public dtMs: number;
  public enableRecurrent: boolean;

  private inputPulseCurrent = 1.5;

  constructor(params: RecurrentSNNParams) {
    this.nInput = params.nInput;
    this.nHidden = params.nHidden;
    this.nOutput = params.nOutput;
    this.dtMs = params.dtMs ?? 1;
    this.enableRecurrent = params.enableRecurrent ?? true;

    // Input neurons
    this.inputNeurons = [];
    for (let i = 0; i < this.nInput; i++) {
      this.inputNeurons.push(new AdaptiveLIFNeuron({ tauMs: 10, vThreshold: 1, refractoryMs: 1, bAdapt: 0 }));
    }

    // Hidden layer with WTA
    this.hiddenLayer = new SpikingLayer({
      size: this.nHidden,
      neuronParams: {
        tauMs: 20,
        vThreshold: params.hiddenThreshold ?? 0.8,
        refractoryMs: 3,
        tauAdapt: 100,
        bAdapt: 0.03,
      },
      inhibitionParams: { w: params.inhibitionW ?? 0.6, tauDecay: 5 },
      enableInhibition: true,
    });

    // Output layer with WTA
    this.outputLayer = new SpikingLayer({
      size: this.nOutput,
      neuronParams: {
        tauMs: 20,
        vThreshold: params.outputThreshold ?? 0.7,
        refractoryMs: 3,
        tauAdapt: 100,
        bAdapt: 0.02,
      },
      inhibitionParams: { w: params.inhibitionW ?? 0.8, tauDecay: 5 },
      enableInhibition: true,
    });

    // Input → Hidden synapses (with homeostatic STDP)
    const wIH = params.initialW ?? 0.4;
    this.synapsesIH = [];
    for (let i = 0; i < this.nInput; i++) {
      this.synapsesIH[i] = [];
      for (let h = 0; h < this.nHidden; h++) {
        // Slight random variation
        const w0 = wIH * (0.8 + Math.random() * 0.4);
        this.synapsesIH[i][h] = new HomeostaticSTDPSynapse({
          w: w0,
          wMax: params.wMax ?? 2.0,
          aPlus: params.aPlus ?? 0.008,
          aMinus: params.aMinus ?? 0.009,
          targetRate: params.targetRate ?? 8,
          homeoStrength: params.homeoStrength ?? 0.0005,
        });
      }
    }

    // Hidden → Output synapses (with homeostatic STDP)
    const wHO = params.initialW ?? 0.4;
    this.synapsesHO = [];
    for (let h = 0; h < this.nHidden; h++) {
      this.synapsesHO[h] = [];
      for (let o = 0; o < this.nOutput; o++) {
        const w0 = wHO * (0.8 + Math.random() * 0.4);
        this.synapsesHO[h][o] = new HomeostaticSTDPSynapse({
          w: w0,
          wMax: params.wMax ?? 2.0,
          aPlus: params.aPlus ?? 0.008,
          aMinus: params.aMinus ?? 0.009,
          targetRate: params.targetRate ?? 5,
          homeoStrength: params.homeoStrength ?? 0.0005,
        });
      }
    }

    // Recurrent connections in hidden layer
    this.recurrentSynapses = [];
    for (let i = 0; i < this.nHidden; i++) {
      this.recurrentSynapses[i] = [];
      for (let j = 0; j < this.nHidden; j++) {
        if (i === j) {
          this.recurrentSynapses[i][j] = new RecurrentSynapse({ w: 0 });
        } else {
          this.recurrentSynapses[i][j] = new RecurrentSynapse({
            w: params.recurrentW ?? 0.1,
            delayMs: 2,
          });
        }
      }
    }
  }

  resetState() {
    for (const n of this.inputNeurons) n.reset();
    this.hiddenLayer.reset();
    this.outputLayer.reset();
    for (const row of this.synapsesIH) for (const s of row) s.reset();
    for (const row of this.synapsesHO) for (const s of row) s.reset();
    for (const row of this.recurrentSynapses) for (const s of row) s.reset();
  }

  /** Run one episode (training or testing) */
  run(pattern: SpikePattern, durationMs: number, training: boolean): TrainResult {
    // Reset neuron states (but keep weights)
    for (const n of this.inputNeurons) n.reset();
    this.hiddenLayer.reset();
    this.outputLayer.reset();
    for (const row of this.synapsesIH) for (const s of row) s.reset();
    for (const row of this.synapsesHO) for (const s of row) s.reset();
    for (const row of this.recurrentSynapses) for (const s of row) s.reset();

    const steps = Math.ceil(durationMs / this.dtMs) + 1;
    const t: number[] = [];
    const inputSpikes: boolean[][] = [];
    const hiddenSpikes: boolean[][] = [];
    const outputSpikes: boolean[][] = [];
    const hiddenV: number[][] = [];
    const outputV: number[][] = [];
    const weightsIH: number[][] = [];
    const weightsHO: number[][] = [];
    const homeoFactors: number[][] = [];
    const firingRates: number[][] = [];

    for (let step = 0; step < steps; step++) {
      const time = step * this.dtMs;
      t.push(time);

      // 1. Input spikes
      const inSpikes: boolean[] = new Array(this.nInput).fill(false);
      for (let i = 0; i < this.nInput; i++) {
        const current = Math.abs(time - pattern.spikeTimes[i]) < this.dtMs / 2
          ? this.inputPulseCurrent : 0;
        inSpikes[i] = this.inputNeurons[i].step(current, this.dtMs, time);
      }
      inputSpikes.push([...inSpikes]);

      // 2. Decay traces on all synapses
      for (const row of this.synapsesIH) for (const s of row) s.decayTraces(this.dtMs);
      for (const row of this.synapsesHO) for (const s of row) s.decayTraces(this.dtMs);

      // 3. Pre-spikes on IH synapses
      for (let i = 0; i < this.nInput; i++) {
        if (inSpikes[i]) {
          for (let h = 0; h < this.nHidden; h++) {
            this.synapsesIH[i][h].onPreSpike(time);
          }
        }
      }

      // 4. Compute hidden layer input currents
      const hiddenCurrents: number[] = new Array(this.nHidden).fill(0);
      for (let h = 0; h < this.nHidden; h++) {
        for (let i = 0; i < this.nInput; i++) {
          if (inSpikes[i]) {
            hiddenCurrents[h] += this.synapsesIH[i][h].w;
          }
        }
        // Recurrent input
        if (this.enableRecurrent) {
          for (let j = 0; j < this.nHidden; j++) {
            if (j !== h) {
              this.recurrentSynapses[j][h].decayVariables(this.dtMs);
              hiddenCurrents[h] += this.recurrentSynapses[j][h].getCurrent(time);
            }
          }
        }
      }

      // 5. Step hidden layer
      const hiddenState = this.hiddenLayer.step(hiddenCurrents, this.dtMs, time);
      hiddenSpikes.push([...hiddenState.spikes]);
      hiddenV.push([...hiddenState.voltages]);

      // 6. Recurrent pre-spikes
      if (this.enableRecurrent) {
        for (let i = 0; i < this.nHidden; i++) {
          if (hiddenState.spikes[i]) {
            for (let j = 0; j < this.nHidden; j++) {
              if (i !== j) {
                this.recurrentSynapses[i][j].onPreSpike(time);
              }
            }
          }
        }
      }

      // 7. STDP: hidden post-spikes update IH synapses
      if (training) {
        for (let h = 0; h < this.nHidden; h++) {
          if (hiddenState.spikes[h]) {
            for (let i = 0; i < this.nInput; i++) {
              this.synapsesIH[i][h].onPostSpike(time);
            }
          }
        }
      }

      // 8. Pre-spikes on HO synapses
      for (let h = 0; h < this.nHidden; h++) {
        if (hiddenState.spikes[h]) {
          for (let o = 0; o < this.nOutput; o++) {
            this.synapsesHO[h][o].onPreSpike(time);
          }
        }
      }

      // 9. Compute output layer input currents
      const outputCurrents: number[] = new Array(this.nOutput).fill(0);
      for (let o = 0; o < this.nOutput; o++) {
        for (let h = 0; h < this.nHidden; h++) {
          if (hiddenState.spikes[h]) {
            outputCurrents[o] += this.synapsesHO[h][o].w;
          }
        }
      }

      // 10. Step output layer
      const outputState = this.outputLayer.step(outputCurrents, this.dtMs, time);
      outputSpikes.push([...outputState.spikes]);
      outputV.push([...outputState.voltages]);

      // 11. STDP: output post-spikes update HO synapses
      if (training) {
        for (let o = 0; o < this.nOutput; o++) {
          if (outputState.spikes[o]) {
            for (let h = 0; h < this.nHidden; h++) {
              this.synapsesHO[h][o].onPostSpike(time);
            }
          }
        }
      }

      // 12. Homeostasis update (every 50ms)
      if (training && step % 50 === 0) {
        for (const row of this.synapsesIH) for (const s of row) s.updateHomeostasis(time);
        for (const row of this.synapsesHO) for (const s of row) s.updateHomeostasis(time);
      }

      // Record weights (sample: first synapse from each group)
      const ihWeights: number[] = [];
      for (let i = 0; i < this.nInput; i++) {
        for (let h = 0; h < this.nHidden; h++) {
          ihWeights.push(this.synapsesIH[i][h].w);
        }
      }
      weightsIH.push(ihWeights);

      const hoWeights: number[] = [];
      for (let h = 0; h < this.nHidden; h++) {
        for (let o = 0; o < this.nOutput; o++) {
          hoWeights.push(this.synapsesHO[h][o].w);
        }
      }
      weightsHO.push(hoWeights);

      const hFactors: number[] = [];
      for (let i = 0; i < this.nInput; i++) {
        for (let h = 0; h < this.nHidden; h++) {
          hFactors.push(this.synapsesIH[i][h].homeoFactor);
        }
      }
      homeoFactors.push(hFactors);

      // Firing rates of hidden layer
      firingRates.push(this.hiddenLayer.getFiringRates(100, this.dtMs));
    }

    return { t, inputSpikes, hiddenSpikes, outputSpikes, hiddenV, outputV, weightsIH, weightsHO, homeoFactors, firingRates };
  }

  train(pattern: SpikePattern, durationMs: number): TrainResult {
    return this.run(pattern, durationMs, true);
  }

  test(pattern: SpikePattern, durationMs: number): TestResult {
    const result = this.run(pattern, durationMs, false);
    // Count output spikes per neuron
    const counts = new Array(this.nOutput).fill(0);
    for (const spikes of result.outputSpikes) {
      for (let o = 0; o < this.nOutput; o++) {
        if (spikes[o]) counts[o]++;
      }
    }

    const maxCount = Math.max(...counts);
    const winner = counts.indexOf(maxCount);
    const total = counts.reduce((a: number, b: number) => a + b, 0);
    const confidence = total > 0 ? maxCount / total : 0;

    return {
      patternName: pattern.name,
      outputSpikes: result.outputSpikes,
      winnerNeuron: winner,
      outputSpikeCounts: counts,
      confidence,
    };
  }

  /** Get all weight matrices */
  getWeights(): { ih: number[][]; ho: number[][] } {
    const ih: number[][] = [];
    for (let i = 0; i < this.nInput; i++) {
      ih[i] = [];
      for (let h = 0; h < this.nHidden; h++) {
        ih[i][h] = this.synapsesIH[i][h].w;
      }
    }
    const ho: number[][] = [];
    for (let h = 0; h < this.nHidden; h++) {
      ho[h] = [];
      for (let o = 0; o < this.nOutput; o++) {
        ho[h][o] = this.synapsesHO[h][o].w;
      }
    }
    return { ih, ho };
  }

  /** Get homeostatic factors */
  getHomeoFactors(): { ih: number[][]; ho: number[][] } {
    const ih: number[][] = [];
    for (let i = 0; i < this.nInput; i++) {
      ih[i] = [];
      for (let h = 0; h < this.nHidden; h++) {
        ih[i][h] = this.synapsesIH[i][h].homeoFactor;
      }
    }
    const ho: number[][] = [];
    for (let h = 0; h < this.nHidden; h++) {
      ho[h] = [];
      for (let o = 0; o < this.nOutput; o++) {
        ho[h][o] = this.synapsesHO[h][o].homeoFactor;
      }
    }
    return { ih, ho };
  }
}

// ─── Predefined Spike Patterns ──────────────────────────────────────────────

export function generatePatterns(nInput: number): SpikePattern[] {
  const baseTime = 15;
  const spacing = 5;

  return [
    {
      name: 'Alpha',
      spikeTimes: Array.from({ length: nInput }, (_, i) => baseTime + i * spacing),
    },
    {
      name: 'Beta',
      spikeTimes: Array.from({ length: nInput }, (_, i) => baseTime + (nInput - 1 - i) * spacing),
    },
    {
      name: 'Gamma',
      spikeTimes: Array.from({ length: nInput }, (_, i) =>
        baseTime + (i % 2 === 0 ? 0 : 15)),
    },
    {
      name: 'Delta',
      spikeTimes: Array.from({ length: nInput }, (_, i) =>
        baseTime + Math.floor(i / 2) * spacing * 2),
    },
    {
      name: 'Epsilon',
      spikeTimes: Array.from({ length: nInput }, (_, i) =>
        baseTime + ((i * 3) % nInput) * spacing),
    },
  ];
}
