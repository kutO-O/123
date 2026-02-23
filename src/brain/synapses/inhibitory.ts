/**
 * Inhibitory synapse for lateral inhibition / WTA dynamics.
 * When pre-neuron fires, it sends inhibitory (negative) current to post-neuron.
 */

export interface InhibitorySynapseParams {
  w?: number;              // inhibitory weight (positive value, applied as negative current)
  wMin?: number;
  wMax?: number;
  tauDecay?: number;       // inhibitory current decay time constant
  delayMs?: number;
}

export class InhibitorySynapse {
  public w: number;
  public inhibitoryCurrent: number;
  private p: Required<InhibitorySynapseParams>;

  constructor(params: InhibitorySynapseParams = {}) {
    this.p = {
      w: params.w ?? 0.8,
      wMin: params.wMin ?? 0,
      wMax: params.wMax ?? 5.0,
      tauDecay: params.tauDecay ?? 5,
      delayMs: params.delayMs ?? 0.5,
    };
    this.w = this.p.w;
    this.inhibitoryCurrent = 0;
  }

  reset() {
    this.inhibitoryCurrent = 0;
  }

  /** Decay inhibitory current */
  decay(dtMs: number) {
    this.inhibitoryCurrent *= Math.exp(-dtMs / this.p.tauDecay);
  }

  /** On pre-synaptic spike: add inhibition */
  onPreSpike() {
    this.inhibitoryCurrent += this.w;
  }

  /** Get current inhibitory contribution (negative) */
  getCurrent(): number {
    return -this.inhibitoryCurrent;
  }
}
