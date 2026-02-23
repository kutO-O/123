export type STDPParams = {
  w?: number;
  wMin?: number;
  wMax?: number;
  aPlus?: number;
  aMinus?: number;
  tauPlusMs?: number;
  tauMinusMs?: number;
};

export class STDPSynapse {
  public w: number;
  private params: Required<STDPParams>;
  private tPreLast: number;
  private tPostLast: number;

  constructor(params: STDPParams = {}) {
    this.params = {
      w: params.w ?? 0.5,
      wMin: params.wMin ?? 0,
      wMax: params.wMax ?? 2,
      aPlus: params.aPlus ?? 0.02,
      aMinus: params.aMinus ?? 0.025,
      tauPlusMs: params.tauPlusMs ?? 20,
      tauMinusMs: params.tauMinusMs ?? 20,
    };
    this.w = this.params.w;
    this.tPreLast = -Infinity;
    this.tPostLast = -Infinity;
  }

  reset() {
    this.tPreLast = -Infinity;
    this.tPostLast = -Infinity;
  }

  private clamp() {
    this.w = Math.max(this.params.wMin, Math.min(this.params.wMax, this.w));
  }

  /** Call when a presynaptic spike occurs */
  onPreSpike(tMs: number) {
    // If post fired recently BEFORE this pre => LTD (pre after post)
    const dt = tMs - this.tPostLast;
    if (Number.isFinite(dt) && dt >= 0 && dt < 10_000) {
      const dw = -this.params.aMinus * Math.exp(-dt / this.params.tauMinusMs);
      this.w += dw;
      this.clamp();
    }
    this.tPreLast = tMs;
  }

  /** Call when a postsynaptic spike occurs */
  onPostSpike(tMs: number) {
    // If pre fired recently BEFORE this post => LTP
    const dt = tMs - this.tPreLast;
    if (Number.isFinite(dt) && dt >= 0 && dt < 10_000) {
      const dw = this.params.aPlus * Math.exp(-dt / this.params.tauPlusMs);
      this.w += dw;
      this.clamp();
    }
    this.tPostLast = tMs;
  }
}
