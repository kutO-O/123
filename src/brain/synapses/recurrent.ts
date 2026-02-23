/**
 * Recurrent synapse with short-term plasticity (STP).
 * Models facilitation and depression for recurrent connections.
 */

export interface RecurrentSynapseParams {
  w?: number;
  wMin?: number;
  wMax?: number;
  // Short-term plasticity
  tauFacilitation?: number;   // facilitation recovery time constant
  tauDepression?: number;     // depression recovery time constant
  uFacilitation?: number;     // facilitation increment
  // Delay
  delayMs?: number;
}

export class RecurrentSynapse {
  public w: number;
  public facilitation: number;  // u variable (use probability)
  public depression: number;    // x variable (available resources)
  public delayBuffer: { time: number; strength: number }[];

  private p: Required<RecurrentSynapseParams>;

  constructor(params: RecurrentSynapseParams = {}) {
    this.p = {
      w: params.w ?? 0.3,
      wMin: params.wMin ?? 0,
      wMax: params.wMax ?? 1.5,
      tauFacilitation: params.tauFacilitation ?? 200,
      tauDepression: params.tauDepression ?? 500,
      uFacilitation: params.uFacilitation ?? 0.2,
      delayMs: params.delayMs ?? 1,
    };
    this.w = this.p.w;
    this.facilitation = this.p.uFacilitation;
    this.depression = 1.0;
    this.delayBuffer = [];
  }

  reset() {
    this.facilitation = this.p.uFacilitation;
    this.depression = 1.0;
    this.delayBuffer = [];
  }

  /** Decay STP variables */
  decayVariables(dtMs: number) {
    // u recovers towards baseline
    this.facilitation += (this.p.uFacilitation - this.facilitation) / this.p.tauFacilitation * dtMs;
    // x recovers towards 1
    this.depression += (1 - this.depression) / this.p.tauDepression * dtMs;
  }

  /** On presynaptic spike: compute effective transmission */
  onPreSpike(tMs: number) {
    // Update facilitation
    this.facilitation += this.p.uFacilitation * (1 - this.facilitation);
    // Effective current
    const effectiveW = this.w * this.facilitation * this.depression;
    // Depression
    this.depression *= (1 - this.facilitation);
    // Add to delay buffer
    this.delayBuffer.push({ time: tMs + this.p.delayMs, strength: effectiveW });
  }

  /** Get current arriving at this timestep */
  getCurrent(tMs: number): number {
    let current = 0;
    const remaining: typeof this.delayBuffer = [];
    for (const item of this.delayBuffer) {
      if (tMs >= item.time) {
        current += item.strength;
      } else {
        remaining.push(item);
      }
    }
    this.delayBuffer = remaining;
    return current;
  }
}
