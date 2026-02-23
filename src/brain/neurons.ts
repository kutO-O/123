export type LIFParams = {
  tauMs?: number; // membrane time constant
  vRest?: number;
  vReset?: number;
  vThreshold?: number;
  refractoryMs?: number;
};

export class LIFNeuron {
  public v: number;
  private tLastSpike: number;
  private params: Required<LIFParams>;

  constructor(params: LIFParams = {}) {
    this.params = {
      tauMs: params.tauMs ?? 20,
      vRest: params.vRest ?? 0,
      vReset: params.vReset ?? 0,
      vThreshold: params.vThreshold ?? 1,
      refractoryMs: params.refractoryMs ?? 2,
    };
    this.v = this.params.vRest;
    this.tLastSpike = -Infinity;
  }

  reset() {
    this.v = this.params.vRest;
    this.tLastSpike = -Infinity;
  }

  /**
   * Step neuron dynamics by dt.
   * @param inputCurrent current injected at this timestep
   * @param dtMs timestep
   * @param tMs current simulation time
   * @returns true if spikes
   */
  step(inputCurrent: number, dtMs: number, tMs: number): boolean {
    const { tauMs, vRest, vReset, vThreshold, refractoryMs } = this.params;

    // Refractory: hold at reset
    if (tMs - this.tLastSpike < refractoryMs) {
      this.v = vReset;
      return false;
    }

    // Simple leaky integration towards rest with additive input
    // dv/dt = -(v - vRest)/tau + I
    const dv = (-(this.v - vRest) / tauMs + inputCurrent) * dtMs;
    this.v += dv;

    if (this.v >= vThreshold) {
      this.v = vReset;
      this.tLastSpike = tMs;
      return true;
    }

    return false;
  }
}
