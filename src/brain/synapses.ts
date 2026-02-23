import { LIFNeuron } from './neurons';

/**
 * Spike-Timing Dependent Plasticity (STDP) Synapse
 *
 * Weight update rules:
 *   Pre before Post (LTP): ΔW = A_plus  * x_pre  * exp(-Δt / tau_plus)
 *   Post before Pre (LTD): ΔW = -A_minus * x_post * exp(-Δt / tau_minus)
 *
 * Online approximation (trace-based):
 *   When pre fires:  ΔW += -A_minus * x_post  (LTD)
 *   When post fires: ΔW += +A_plus  * x_pre   (LTP)
 */
export class STDPSynapse {
  readonly pre: LIFNeuron;
  readonly post: LIFNeuron;

  // Synaptic weight
  weight: number;
  readonly wMin: number;
  readonly wMax: number;

  // STDP parameters
  readonly aPlusInit: number;   // LTP amplitude
  readonly aMinusInit: number;  // LTD amplitude
  readonly tauPlus: number;     // LTP time constant (ms)
  readonly tauMinus: number;    // LTD time constant (ms)

  // Conductance / PSP amplitude
  readonly pspAmplitude: number; // mV bump per spike

  // History
  weightHistory: number[];

  constructor(
    pre: LIFNeuron,
    post: LIFNeuron,
    options: {
      weight?: number;
      wMin?: number;
      wMax?: number;
      aPlus?: number;
      aMinus?: number;
      tauPlus?: number;
      tauMinus?: number;
      pspAmplitude?: number;
    } = {}
  ) {
    this.pre = pre;
    this.post = post;

    this.weight = options.weight ?? 0.5;
    this.wMin = options.wMin ?? 0.0;
    this.wMax = options.wMax ?? 1.0;

    this.aPlusInit = options.aPlus ?? 0.01;
    this.aMinusInit = options.aMinus ?? 0.0105; // Slightly asymmetric → competitive
    this.tauPlus = options.tauPlus ?? 20;
    this.tauMinus = options.tauMinus ?? 20;
    this.pspAmplitude = options.pspAmplitude ?? 15; // mV

    this.weightHistory = [this.weight];
  }

  /**
   * Called once per simulation step.
   * @param preSpike  did the pre-synaptic neuron spike this step?
   * @param postSpike did the post-synaptic neuron spike this step?
   * @param learning  whether to apply STDP updates
   */
  step(preSpike: boolean, postSpike: boolean, learning: boolean): void {
    // Transmit PSP to post-synaptic neuron on pre-spike
    if (preSpike) {
      this.post.injectCurrent(this.weight * this.pspAmplitude);

      // LTD: pre fires AFTER post → depress
      if (learning) {
        const dw = -this.aMinusInit * this.post.traceNeg;
        this.weight = Math.max(this.wMin, Math.min(this.wMax, this.weight + dw));
      }
    }

    // LTP: post fires AFTER pre → potentiate
    if (postSpike && learning) {
      const dw = this.aPlusInit * this.pre.tracePos;
      this.weight = Math.max(this.wMin, Math.min(this.wMax, this.weight + dw));
    }

    this.weightHistory.push(this.weight);
  }

  reset(): void {
    this.weightHistory = [this.weight];
  }

  resetFull(initialWeight = 0.5): void {
    this.weight = initialWeight;
    this.weightHistory = [this.weight];
  }
}
