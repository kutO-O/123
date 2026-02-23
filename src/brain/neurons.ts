/**
 * Leaky Integrate-and-Fire (LIF) Neuron
 *
 * Membrane potential dynamics:
 *   τ_m * dV/dt = -(V - V_rest) + R * I(t)
 *
 * Spike: if V >= V_thresh → fire, then reset to V_reset
 */
export class LIFNeuron {
  // Parameters
  readonly tau_m: number;   // membrane time constant (ms)
  readonly v_rest: number;  // resting potential (mV)
  readonly v_thresh: number;// spike threshold (mV)
  readonly v_reset: number; // reset potential (mV)
  readonly r_m: number;     // membrane resistance (MΩ)
  readonly t_ref: number;   // refractory period (ms)
  readonly id: string;

  // State
  v: number;                // membrane potential (mV)
  private refractoryTimer: number; // countdown to end of refractory (ms)

  // History
  spikeTimes: number[];     // list of spike timestamps (ms)

  // STDP traces
  tracePos: number;   // pre-synaptic trace x_pre (for LTP)
  traceNeg: number;   // post-synaptic trace x_post (for LTD)
  readonly tauTrace: number; // trace decay constant (ms)

  constructor(options: {
    id?: string;
    tau_m?: number;
    v_rest?: number;
    v_thresh?: number;
    v_reset?: number;
    r_m?: number;
    t_ref?: number;
    tauTrace?: number;
  } = {}) {
    this.id = options.id ?? 'neuron';
    this.tau_m = options.tau_m ?? 20;
    this.v_rest = options.v_rest ?? -65;
    this.v_thresh = options.v_thresh ?? -50;
    this.v_reset = options.v_reset ?? -70;
    this.r_m = options.r_m ?? 10;
    this.t_ref = options.t_ref ?? 2;
    this.tauTrace = options.tauTrace ?? 20;

    this.v = this.v_rest;
    this.refractoryTimer = 0;
    this.spikeTimes = [];
    this.tracePos = 0;
    this.traceNeg = 0;
  }

  /**
   * Step the neuron forward by dt milliseconds.
   * @param current  injected current (nA)
   * @param dt       time step (ms)
   * @param t        current time (ms)
   * @returns        true if a spike occurred this step
   */
  step(current: number, dt: number, t: number): boolean {
    // Decay STDP traces
    this.tracePos -= (this.tracePos / this.tauTrace) * dt;
    this.traceNeg -= (this.traceNeg / this.tauTrace) * dt;

    if (this.refractoryTimer > 0) {
      this.refractoryTimer -= dt;
      this.v = this.v_reset;
      return false;
    }

    // Euler integration of LIF equation
    const dv = (-(this.v - this.v_rest) + this.r_m * current) / this.tau_m;
    this.v += dv * dt;

    if (this.v >= this.v_thresh) {
      this.v = this.v_reset;
      this.refractoryTimer = this.t_ref;
      this.spikeTimes.push(t);
      // Bump STDP traces on spike
      this.tracePos += 1.0;
      this.traceNeg += 1.0;
      return true;
    }

    return false;
  }

  /**
   * Inject an instantaneous current pulse (e.g. from a synapse).
   * Modelled as a direct voltage bump = R_m * charge / tau_m (simplified).
   */
  injectCurrent(amount: number): void {
    if (this.refractoryTimer <= 0) {
      this.v += amount;
    }
  }

  reset(): void {
    this.v = this.v_rest;
    this.refractoryTimer = 0;
    this.spikeTimes = [];
    this.tracePos = 0;
    this.traceNeg = 0;
  }
}
