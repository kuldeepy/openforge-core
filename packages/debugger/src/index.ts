import type { RuntimeEvent } from "@openforge/schema";

export interface TraceSession {
  workflowId: string;
  startedAt: string;
  events: RuntimeEvent[];
}

export class RuntimeTrace {
  private readonly events: RuntimeEvent[] = [];

  public append(event: RuntimeEvent): void {
    this.events.push(event);
  }

  public appendMany(events: RuntimeEvent[]): void {
    this.events.push(...events);
  }

  public byTick(tick: number): RuntimeEvent[] {
    return this.events.filter((event) => event.tick === tick);
  }

  public byNode(nodeId: string): RuntimeEvent[] {
    return this.events.filter((event) => event.nodeId === nodeId);
  }

  public toSession(workflowId: string, startedAt: string): TraceSession {
    return {
      workflowId,
      startedAt,
      events: [...this.events]
    };
  }
}
