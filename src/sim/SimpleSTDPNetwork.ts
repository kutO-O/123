import { LIFNeuron } from "../brain/neurons";
import { STDPSynapse } from "../brain/synapses";

export type PatternName = "A" | "B";
export type SpikePattern = {
  name: PatternName;
  pre1SpikeMs: number;
  pre2SpikeMs: number;
};

export type RunResult = {
  t: number[];
  pre1: boolean[];
  pre2: boolean[];
  post: boolean[];
  vPost: number[];
  w1: number[];
  w2: number[];
};

export class SimpleSTDPNetwork {
  public in1: LIFNeuron;
  public in2: LIFNeuron;
  public out: LIFNeuron;
  public syn1: STDPSynapse;
  public syn2: STDPSynapse;

  private dtMs: number;
  private inputPulseCurrent: number;

  constructor(opts?: {
    dtMs?: number;
    inputPulseCurrent?: number;
    outThreshold?: number;
    initialW1?: number;
    initialW2?: number;
  }) {
    this.dtMs = opts?.dtMs ?? 1;
    this.inputPulseCurrent = opts?.inputPulseCurrent ?? 1.2;

    // Inputs: LIF but we drive them with a single pulse current at spike time
    this.in1 = new LIFNeuron({ tauMs: 10, vThreshold: 1, refractoryMs: 1 });
    this.in2 = new LIFNeuron({ tauMs: 10, vThreshold: 1, refractoryMs: 1 });

    // Output: slightly slower, require coincident excitation
    this.out = new LIFNeuron({
      tauMs: 20,
      vThreshold: opts?.outThreshold ?? 1.0,
      refractoryMs: 2,
    });

    this.syn1 = new STDPSynapse({ w: opts?.initialW1 ?? 0.6, wMin: 0, wMax: 2 });
    this.syn2 = new STDPSynapse({ w: opts?.initialW2 ?? 0.6, wMin: 0, wMax: 2 });
  }



  private run(pattern: SpikePattern, durationMs: number, training: boolean): RunResult {
    // Keep neuron states, but reset synapse traces only per episode? In classic STDP,
    // traces are internal; here we use last spike times, so reset them per episode.
    // Also reset neurons per episode.
    this.in1.reset();
    this.in2.reset();
    this.out.reset();
    this.syn1.reset();
    this.syn2.reset();

    const steps = Math.ceil(durationMs / this.dtMs) + 1;
    const t: number[] = new Array(steps);
    const pre1: boolean[] = new Array(steps).fill(false);
    const pre2: boolean[] = new Array(steps).fill(false);
    const post: boolean[] = new Array(steps).fill(false);
    const vPost: number[] = new Array(steps);
    const w1: number[] = new Array(steps);
    const w2: number[] = new Array(steps);

    for (let i = 0; i < steps; i++) {
      const time = i * this.dtMs;
      t[i] = time;

      // Generate single-timestep current pulses to evoke input spikes at desired times
      const i1 = Math.abs(time - pattern.pre1SpikeMs) < this.dtMs / 2 ? this.inputPulseCurrent : 0;
      const i2 = Math.abs(time - pattern.pre2SpikeMs) < this.dtMs / 2 ? this.inputPulseCurrent : 0;

      const s1 = this.in1.step(i1, this.dtMs, time);
      const s2 = this.in2.step(i2, this.dtMs, time);
      pre1[i] = s1;
      pre2[i] = s2;

      if (s1) this.syn1.onPreSpike(time);
      if (s2) this.syn2.onPreSpike(time);

      // Synaptic current: instantaneous on presynaptic spike (delta PSC)
      const iPost = (s1 ? this.syn1.w : 0) + (s2 ? this.syn2.w : 0);
      const sOut = this.out.step(iPost, this.dtMs, time);
      post[i] = sOut;
      vPost[i] = this.out.v;

      if (training && sOut) {
        this.syn1.onPostSpike(time);
        this.syn2.onPostSpike(time);
      } else if (!training && sOut) {
        // During test we do NOT modify weights
      }

      w1[i] = this.syn1.w;
      w2[i] = this.syn2.w;
    }

    return { t, pre1, pre2, post, vPost, w1, w2 };
  }

  /** Train for one episode on a pattern */
  train(pattern: SpikePattern, durationMs: number): RunResult {
    return this.run(pattern, durationMs, true);
  }

  /** Test for one episode on a pattern (no learning) */
  test(pattern: SpikePattern, durationMs: number): RunResult {
    return this.run(pattern, durationMs, false);
  }

  get_weights() {
    return { w1: this.syn1.w, w2: this.syn2.w };
  }
}

export const PATTERN_A: SpikePattern = { name: "A", pre1SpikeMs: 20, pre2SpikeMs: 30 };
export const PATTERN_B: SpikePattern = { name: "B", pre1SpikeMs: 30, pre2SpikeMs: 20 };
