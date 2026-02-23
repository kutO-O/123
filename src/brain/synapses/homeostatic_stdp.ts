/**
 * Homeostatic STDP synapse:
 * - Pair-based STDP with LTP / LTD
 * - Homeostatic regulation: target firing rate maintained via scaling
 * - Synaptic scaling when neuron is too active or too quiet
 */

export interface HomeostaticSTDPParams {
  w?: number;
  wMin?: number;
  wMax?: number;
  // STDP params
  aPlus?: number;
  aMinus?: number;
  tauPlus?: number;
  tauMinus?: number;
  // Homeostatic params
  targetRate?: number;     // target firing rate (spikes per 1000ms window)
  tauHomeo?: number;       // homeostatic time constant
  homeoStrength?: number;  // scaling strength
  // Traces
  tauTracePre?: number;
  tauTracePost?: number;
}

export class HomeostaticSTDPSynapse {
  public w: number;
  public tracePre: number;
  public tracePost: number;
  public homeoFactor: number;  // multiplicative factor from homeostasis

  private p: Required<HomeostaticSTDPParams>;
  private postSpikeHistory: number[];

  constructor(params: HomeostaticSTDPParams = {}) {
    this.p = {
      w: params.w ?? 0.5,
      wMin: params.wMin ?? 0.01,
      wMax: params.wMax ?? 2.0,
      aPlus: params.aPlus ?? 0.01,
      aMinus: params.aMinus ?? 0.012,
      tauPlus: params.tauPlus ?? 20,
      tauMinus: params.tauMinus ?? 20,
      targetRate: params.targetRate ?? 5,
      tauHomeo: params.tauHomeo ?? 500,
      homeoStrength: params.homeoStrength ?? 0.001,
      tauTracePre: params.tauTracePre ?? 20,
      tauTracePost: params.tauTracePost ?? 20,
    };
    this.w = this.p.w;
    this.tracePre = 0;
    this.tracePost = 0;
    this.homeoFactor = 1.0;
    this.postSpikeHistory = [];
  }

  reset() {
    this.tracePre = 0;
    this.tracePost = 0;
    this.homeoFactor = 1.0;
    this.postSpikeHistory = [];
  }

  private clamp() {
    this.w = Math.max(this.p.wMin, Math.min(this.p.wMax, this.w));
  }

  /** Decay traces each timestep */
  decayTraces(dtMs: number) {
    this.tracePre *= Math.exp(-dtMs / this.p.tauTracePre);
    this.tracePost *= Math.exp(-dtMs / this.p.tauTracePost);
  }

  /** Update homeostatic factor based on recent post-synaptic activity */
  updateHomeostasis(tMs: number) {
    // Count spikes in last 1000ms window
    const windowMs = 1000;
    this.postSpikeHistory = this.postSpikeHistory.filter(t => tMs - t < windowMs);
    const currentRate = this.postSpikeHistory.length;
    const error = this.p.targetRate - currentRate;
    // Slowly adjust homeostatic factor
    this.homeoFactor += this.p.homeoStrength * error;
    this.homeoFactor = Math.max(0.1, Math.min(3.0, this.homeoFactor));
  }

  /** Call on presynaptic spike */
  onPreSpike(_tMs: number) {
    // LTD: pre after post → decrease (use tracePost)
    const dw = -this.p.aMinus * this.tracePost * this.homeoFactor;
    this.w += dw;
    this.clamp();
    this.tracePre += 1;
  }

  /** Call on postsynaptic spike */
  onPostSpike(tMs: number) {
    // LTP: post after pre → increase (use tracePre)
    const dw = this.p.aPlus * this.tracePre * this.homeoFactor;
    this.w += dw;
    this.clamp();
    this.tracePost += 1;
    this.postSpikeHistory.push(tMs);
  }

  /** Effective synaptic weight (with homeostatic scaling) */
  get effectiveWeight(): number {
    return this.w * this.homeoFactor;
  }
}
