/**
 * SpikingLayer: a population of AdaptiveLIF neurons with:
 * - Lateral inhibition (WTA dynamics) via InhibitorySynapses
 * - Population-level statistics tracking
 */

import { AdaptiveLIFNeuron, type AdaptiveLIFParams } from '../neurons/adaptive';
import { InhibitorySynapse, type InhibitorySynapseParams } from '../synapses/inhibitory';

export interface SpikingLayerParams {
  size: number;
  neuronParams?: AdaptiveLIFParams;
  inhibitionParams?: InhibitorySynapseParams;
  enableInhibition?: boolean;
}

export interface LayerState {
  spikes: boolean[];
  voltages: number[];
  inhibitions: number[];
  totalSpikes: number;
}

export class SpikingLayer {
  public neurons: AdaptiveLIFNeuron[];
  public inhibitorySynapses: InhibitorySynapse[][]; // [i][j] = inhibition from i to j
  public size: number;
  public enableInhibition: boolean;

  // Statistics
  public spikeHistory: boolean[][];
  public totalSpikesPerNeuron: number[];

  constructor(params: SpikingLayerParams) {
    this.size = params.size;
    this.enableInhibition = params.enableInhibition ?? true;
    this.neurons = [];
    this.inhibitorySynapses = [];
    this.spikeHistory = [];
    this.totalSpikesPerNeuron = new Array(params.size).fill(0);

    for (let i = 0; i < params.size; i++) {
      this.neurons.push(new AdaptiveLIFNeuron(params.neuronParams));
    }

    // Create lateral inhibitory connections (all-to-all except self)
    for (let i = 0; i < params.size; i++) {
      this.inhibitorySynapses[i] = [];
      for (let j = 0; j < params.size; j++) {
        if (i === j) {
          // Placeholder - no self-inhibition
          this.inhibitorySynapses[i][j] = new InhibitorySynapse({ w: 0 });
        } else {
          this.inhibitorySynapses[i][j] = new InhibitorySynapse(params.inhibitionParams);
        }
      }
    }
  }

  reset() {
    for (const n of this.neurons) n.reset();
    for (const row of this.inhibitorySynapses)
      for (const s of row) s.reset();
    this.spikeHistory = [];
    this.totalSpikesPerNeuron.fill(0);
  }

  /**
   * Step the entire layer.
   * @param inputCurrents array of currents for each neuron
   * @param dtMs timestep
   * @param tMs current time
   */
  step(inputCurrents: number[], dtMs: number, tMs: number): LayerState {
    const spikes: boolean[] = new Array(this.size).fill(false);
    const voltages: number[] = new Array(this.size);
    const inhibitions: number[] = new Array(this.size).fill(0);

    // Compute inhibitory currents from previous spikes
    if (this.enableInhibition) {
      for (let j = 0; j < this.size; j++) {
        let inhib = 0;
        for (let i = 0; i < this.size; i++) {
          if (i !== j) {
            this.inhibitorySynapses[i][j].decay(dtMs);
            inhib += this.inhibitorySynapses[i][j].getCurrent();
          }
        }
        inhibitions[j] = inhib;
      }
    }

    // Step neurons
    for (let i = 0; i < this.size; i++) {
      const totalCurrent = inputCurrents[i] + inhibitions[i];
      spikes[i] = this.neurons[i].step(totalCurrent, dtMs, tMs);
      voltages[i] = this.neurons[i].v;
    }

    // Apply lateral inhibition from spiking neurons
    if (this.enableInhibition) {
      for (let i = 0; i < this.size; i++) {
        if (spikes[i]) {
          for (let j = 0; j < this.size; j++) {
            if (i !== j) {
              this.inhibitorySynapses[i][j].onPreSpike();
            }
          }
        }
      }
    }

    // Record
    this.spikeHistory.push([...spikes]);
    for (let i = 0; i < this.size; i++) {
      if (spikes[i]) this.totalSpikesPerNeuron[i]++;
    }

    const totalSpikes = spikes.filter(Boolean).length;
    return { spikes, voltages, inhibitions, totalSpikes };
  }

  /** Get firing rates (spikes per 1000ms) for each neuron over history */
  getFiringRates(windowSteps: number, dtMs: number): number[] {
    const rates: number[] = new Array(this.size).fill(0);
    const start = Math.max(0, this.spikeHistory.length - windowSteps);
    const len = this.spikeHistory.length - start;
    if (len === 0) return rates;

    for (let t = start; t < this.spikeHistory.length; t++) {
      for (let i = 0; i < this.size; i++) {
        if (this.spikeHistory[t][i]) rates[i]++;
      }
    }

    const windowMs = len * dtMs;
    for (let i = 0; i < this.size; i++) {
      rates[i] = (rates[i] / windowMs) * 1000;
    }
    return rates;
  }
}
