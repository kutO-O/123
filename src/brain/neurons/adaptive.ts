/**
 * Three types of adaptive spiking neurons:
 * 1. AdaptiveLIFNeuron - LIF with spike-frequency adaptation
 * 2. IzhikevichNeuron  - Izhikevich model (rich dynamics)
 * 3. BurstingNeuron    - LIF with burst mode
 */

// ─── 1. Adaptive LIF Neuron ────────────────────────────────────────────────────

export interface AdaptiveLIFParams {
  tauMs?: number;
  vRest?: number;
  vReset?: number;
  vThreshold?: number;
  refractoryMs?: number;
  // Adaptation
  tauAdapt?: number;   // adaptation time constant
  bAdapt?: number;     // adaptation increment per spike
}

export class AdaptiveLIFNeuron {
  public v: number;
  public adaptation: number;
  public tLastSpike: number;
  public spikeCount: number;
  private p: Required<AdaptiveLIFParams>;

  constructor(params: AdaptiveLIFParams = {}) {
    this.p = {
      tauMs: params.tauMs ?? 20,
      vRest: params.vRest ?? 0,
      vReset: params.vReset ?? 0,
      vThreshold: params.vThreshold ?? 1,
      refractoryMs: params.refractoryMs ?? 2,
      tauAdapt: params.tauAdapt ?? 100,
      bAdapt: params.bAdapt ?? 0.05,
    };
    this.v = this.p.vRest;
    this.adaptation = 0;
    this.tLastSpike = -Infinity;
    this.spikeCount = 0;
  }

  reset() {
    this.v = this.p.vRest;
    this.adaptation = 0;
    this.tLastSpike = -Infinity;
    this.spikeCount = 0;
  }

  step(inputCurrent: number, dtMs: number, tMs: number): boolean {
    const { tauMs, vRest, vReset, vThreshold, refractoryMs, tauAdapt, bAdapt } = this.p;

    if (tMs - this.tLastSpike < refractoryMs) {
      this.v = vReset;
      return false;
    }

    // Decay adaptation
    this.adaptation += (-this.adaptation / tauAdapt) * dtMs;

    // Leaky integration with adaptation subtracted
    const dv = (-(this.v - vRest) / tauMs + inputCurrent - this.adaptation) * dtMs;
    this.v += dv;

    if (this.v >= vThreshold) {
      this.v = vReset;
      this.tLastSpike = tMs;
      this.adaptation += bAdapt;
      this.spikeCount++;
      return true;
    }
    return false;
  }

  get threshold() { return this.p.vThreshold; }
  set threshold(v: number) { this.p.vThreshold = v; }
}

// ─── 2. Izhikevich Neuron ──────────────────────────────────────────────────────

export interface IzhikevichParams {
  a?: number; b?: number; c?: number; d?: number;
  vPeak?: number;
}

export class IzhikevichNeuron {
  public v: number;
  public u: number;
  public tLastSpike: number;
  public spikeCount: number;
  private p: Required<IzhikevichParams>;

  constructor(params: IzhikevichParams = {}) {
    this.p = {
      a: params.a ?? 0.02,
      b: params.b ?? 0.2,
      c: params.c ?? -65,
      d: params.d ?? 8,
      vPeak: params.vPeak ?? 30,
    };
    this.v = this.p.c;
    this.u = this.p.b * this.v;
    this.tLastSpike = -Infinity;
    this.spikeCount = 0;
  }

  reset() {
    this.v = this.p.c;
    this.u = this.p.b * this.v;
    this.tLastSpike = -Infinity;
    this.spikeCount = 0;
  }

  step(inputCurrent: number, dtMs: number, tMs: number): boolean {
    const { a, b, c, d, vPeak } = this.p;
    const dt = dtMs;

    // Euler integration (0.5ms substeps for stability)
    const substeps = Math.max(1, Math.round(dt / 0.5));
    const h = dt / substeps;
    for (let s = 0; s < substeps; s++) {
      const dv = 0.04 * this.v * this.v + 5 * this.v + 140 - this.u + inputCurrent;
      const du = a * (b * this.v - this.u);
      this.v += dv * h;
      this.u += du * h;
      if (this.v >= vPeak) {
        this.v = c;
        this.u += d;
        this.tLastSpike = tMs;
        this.spikeCount++;
        return true;
      }
    }
    return false;
  }
}

// ─── 3. Bursting Neuron ────────────────────────────────────────────────────────

export interface BurstingParams {
  tauMs?: number;
  vRest?: number;
  vReset?: number;
  vThreshold?: number;
  refractoryMs?: number;
  burstSize?: number;       // spikes per burst
  intraBurstInterval?: number; // ms between spikes within burst
  tauBurst?: number;        // slow variable tau
  bBurst?: number;          // slow variable increment
}

export class BurstingNeuron {
  public v: number;
  public burstVar: number;
  public tLastSpike: number;
  public spikeCount: number;
  private burstRemaining: number;
  private burstTimer: number;
  private p: Required<BurstingParams>;

  constructor(params: BurstingParams = {}) {
    this.p = {
      tauMs: params.tauMs ?? 20,
      vRest: params.vRest ?? 0,
      vReset: params.vReset ?? 0,
      vThreshold: params.vThreshold ?? 1,
      refractoryMs: params.refractoryMs ?? 1,
      burstSize: params.burstSize ?? 3,
      intraBurstInterval: params.intraBurstInterval ?? 3,
      tauBurst: params.tauBurst ?? 200,
      bBurst: params.bBurst ?? 0.15,
    };
    this.v = this.p.vRest;
    this.burstVar = 0;
    this.tLastSpike = -Infinity;
    this.spikeCount = 0;
    this.burstRemaining = 0;
    this.burstTimer = 0;
  }

  reset() {
    this.v = this.p.vRest;
    this.burstVar = 0;
    this.tLastSpike = -Infinity;
    this.spikeCount = 0;
    this.burstRemaining = 0;
    this.burstTimer = 0;
  }

  step(inputCurrent: number, dtMs: number, tMs: number): boolean {
    const { tauMs, vRest, vReset, vThreshold, tauBurst, bBurst, intraBurstInterval } = this.p;

    // Slow variable decay
    this.burstVar += (-this.burstVar / tauBurst) * dtMs;

    // If in burst mode
    if (this.burstRemaining > 0) {
      this.burstTimer -= dtMs;
      if (this.burstTimer <= 0) {
        this.burstRemaining--;
        this.burstTimer = intraBurstInterval;
        this.tLastSpike = tMs;
        this.spikeCount++;
        this.v = vReset;
        return true;
      }
      return false;
    }

    // Normal LIF dynamics with burst variable suppression
    const dv = (-(this.v - vRest) / tauMs + inputCurrent - this.burstVar) * dtMs;
    this.v += dv;

    if (this.v >= vThreshold) {
      this.v = vReset;
      this.tLastSpike = tMs;
      this.spikeCount++;
      this.burstVar += bBurst;
      // Initiate burst
      this.burstRemaining = this.p.burstSize - 1; // already spiked once
      this.burstTimer = intraBurstInterval;
      return true;
    }
    return false;
  }
}

// Union type for any neuron
export type AnyNeuron = AdaptiveLIFNeuron | IzhikevichNeuron | BurstingNeuron;
