import type { ScheduledSignal, Signal, SimulationScenario } from "@openforge/schema";

export interface SimulationClock {
  readonly tick: number;
  advance(): number;
  reset(): void;
}

export class FixedStepSimulationClock implements SimulationClock {
  private currentTick = 0;

  public get tick(): number {
    return this.currentTick;
  }

  public advance(): number {
    this.currentTick += 1;
    return this.currentTick;
  }

  public reset(): void {
    this.currentTick = 0;
  }
}

export class ScenarioSignalScheduler {
  private readonly scheduledSignals: ScheduledSignal[];

  public constructor(scenario: SimulationScenario) {
    this.scheduledSignals = scenario.scheduledSignals ?? [];
  }

  public signalsForTick(tick: number): Signal[] {
    return this.scheduledSignals.filter((entry) => entry.tick === tick).map((entry) => entry.signal);
  }
}
