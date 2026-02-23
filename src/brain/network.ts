import { LIFNeuron } from './neurons';
import { STDPSynapse } from './synapses';

export type Pattern = 'A' | 'B';

export interface SimulationRecord {
  time: number[];
  v_in1: number[];
  v_in2: number[];
  v_out: number[];
  spikes_in1: number[];
  spikes_in2: number[];
  spikes_out: number[];
  w1: number[];
  w2: number[];
}

export interface TrainingEpochResult {
  epoch: number;
  pattern: Pattern;
  spiked: boolean;
  w1: number;
  w2: number;
}

/**
 * SimpleSTDPNetwork
 *
 * Architecture:
 *   input1 ──(synapse1)──┐
 *                        ▼
 *                      output
 *                        ▲
 *   input2 ──(synapse2)──┘
 *
 * Pattern A: input1 fires first (t=5ms), input2 fires 10ms later (t=15ms)
 * Pattern B: input2 fires first (t=5ms), input1 fires 10ms later (t=15ms)
 *
 * After training on Pattern A:
 *   synapse1.weight >> synapse2.weight
 *   → network spikes on A, stays silent on B
 */
export class SimpleSTDPNetwork {
  readonly input1: LIFNeuron;
  readonly input2: LIFNeuron;
  readonly output: LIFNeuron;
  readonly synapse1: STDPSynapse;
  readonly synapse2: STDPSynapse;

  readonly dt: number = 0.1; // ms

  constructor() {
    this.input1 = new LIFNeuron({ id: 'input1', tau_m: 20, v_rest: -65, v_thresh: -50, v_reset: -70, r_m: 10, t_ref: 2, tauTrace: 20 });
    this.input2 = new LIFNeuron({ id: 'input2', tau_m: 20, v_rest: -65, v_thresh: -50, v_reset: -70, r_m: 10, t_ref: 2, tauTrace: 20 });
    this.output = new LIFNeuron({ id: 'output', tau_m: 20, v_rest: -65, v_thresh: -50, v_reset: -70, r_m: 10, t_ref: 2, tauTrace: 20 });

    this.synapse1 = new STDPSynapse(this.input1, this.output, {
      weight: 0.5, wMin: 0, wMax: 1.0,
      aPlus: 0.015, aMinus: 0.012,
      tauPlus: 20, tauMinus: 20,
      pspAmplitude: 15,
    });
    this.synapse2 = new STDPSynapse(this.input2, this.output, {
      weight: 0.5, wMin: 0, wMax: 1.0,
      aPlus: 0.015, aMinus: 0.012,
      tauPlus: 20, tauMinus: 20,
      pspAmplitude: 15,
    });
  }

  /** Get current weights */
  get_weights(): { w1: number; w2: number } {
    return { w1: this.synapse1.weight, w2: this.synapse2.weight };
  }

  /**
   * Simulate one trial for a given pattern.
   * Returns a detailed simulation record.
   */
  private _simulate(
    pattern: Pattern,
    duration: number,
    learning: boolean
  ): SimulationRecord {
    this.input1.reset();
    this.input2.reset();
    this.output.reset();
    this.synapse1.reset();
    this.synapse2.reset();

    const steps = Math.round(duration / this.dt);
    const record: SimulationRecord = {
      time: [], v_in1: [], v_in2: [], v_out: [],
      spikes_in1: [], spikes_in2: [], spikes_out: [],
      w1: [], w2: [],
    };

    // Current injection timing:
    // A: input1 → t=5ms, input2 → t=15ms
    // B: input2 → t=5ms, input1 → t=15ms
    const delay = 10; // ms
    const baseTime = 5; // ms
    const pulseWidth = 2; // ms  (how long to inject)
    const injectionCurrent = 5; // nA

    for (let s = 0; s < steps; s++) {
      const t = s * this.dt;

      // Determine injected currents for inputs
      let i1 = 0;
      let i2 = 0;

      if (pattern === 'A') {
        if (t >= baseTime && t < baseTime + pulseWidth) i1 = injectionCurrent;
        if (t >= baseTime + delay && t < baseTime + delay + pulseWidth) i2 = injectionCurrent;
      } else {
        // Pattern B
        if (t >= baseTime && t < baseTime + pulseWidth) i2 = injectionCurrent;
        if (t >= baseTime + delay && t < baseTime + delay + pulseWidth) i1 = injectionCurrent;
      }

      // Step neurons
      const sp1 = this.input1.step(i1, this.dt, t);
      const sp2 = this.input2.step(i2, this.dt, t);
      const spO = this.output.step(0, this.dt, t); // output gets no external current

      // Step synapses (transmit PSP + STDP)
      this.synapse1.step(sp1, spO, learning);
      this.synapse2.step(sp2, spO, learning);

      // Record
      record.time.push(t);
      record.v_in1.push(this.input1.v);
      record.v_in2.push(this.input2.v);
      record.v_out.push(this.output.v);
      if (sp1) record.spikes_in1.push(t);
      if (sp2) record.spikes_in2.push(t);
      if (spO) record.spikes_out.push(t);
      record.w1.push(this.synapse1.weight);
      record.w2.push(this.synapse2.weight);
    }

    return record;
  }

  /**
   * Train the network on a given pattern for `epochs` trials.
   */
  train(
    pattern: Pattern,
    duration: number,
    epochs = 1,
    onEpoch?: (r: TrainingEpochResult) => void
  ): TrainingEpochResult[] {
    const results: TrainingEpochResult[] = [];
    for (let e = 0; e < epochs; e++) {
      const record = this._simulate(pattern, duration, true);
      const result: TrainingEpochResult = {
        epoch: e + 1,
        pattern,
        spiked: record.spikes_out.length > 0,
        w1: this.synapse1.weight,
        w2: this.synapse2.weight,
      };
      results.push(result);
      onEpoch?.(result);
    }
    return results;
  }

  /**
   * Test the network (no weight updates).
   */
  test(pattern: Pattern, duration: number): SimulationRecord {
    return this._simulate(pattern, duration, false);
  }

  /**
   * Full training session: train on pattern A then test on A and B.
   */
  runFullDemo(
    epochs: number,
    duration: number,
    onEpoch?: (r: TrainingEpochResult) => void
  ): {
    trainingHistory: TrainingEpochResult[];
    testA: SimulationRecord;
    testB: SimulationRecord;
    finalWeights: { w1: number; w2: number };
  } {
    // Reset weights before full training
    this.synapse1.resetFull(0.5);
    this.synapse2.resetFull(0.5);

    const trainingHistory = this.train('A', duration, epochs, onEpoch);
    const testA = this.test('A', duration);
    const testB = this.test('B', duration);
    const finalWeights = this.get_weights();

    return { trainingHistory, testA, testB, finalWeights };
  }
}
