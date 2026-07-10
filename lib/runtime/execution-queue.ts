import { randomUUID } from "node:crypto";
import type { ExecutionId, ExecutionRequest } from "@/lib/runtime/types";

type QueueItem = {
  request: ExecutionRequest;
  priority: number;
  sequence: number;
};

export class ExecutionQueue {
  private readonly items: QueueItem[] = [];
  private sequence = 0;

  enqueue(req: ExecutionRequest): ExecutionId {
    const id = req.id ?? randomUUID();
    this.items.push({
      request: { ...req, id },
      priority: req.priority ?? 0,
      sequence: this.sequence++,
    });
    return id;
  }

  dequeue(): ExecutionRequest | undefined {
    const index = this.nextIndex();
    if (index === -1) {
      return undefined;
    }
    const [item] = this.items.splice(index, 1);
    return item.request;
  }

  peek(): ExecutionRequest | undefined {
    const index = this.nextIndex();
    return index === -1 ? undefined : this.items[index]?.request;
  }

  cancel(id: ExecutionId): boolean {
    const index = this.items.findIndex((item) => item.request.id === id);
    if (index === -1) {
      return false;
    }
    this.items.splice(index, 1);
    return true;
  }

  size(): number {
    return this.items.length;
  }

  drain(): ExecutionRequest[] {
    const drained: ExecutionRequest[] = [];
    while (this.items.length > 0) {
      const item = this.dequeue();
      if (item) {
        drained.push(item);
      }
    }
    return drained;
  }

  private nextIndex(): number {
    if (this.items.length === 0) {
      return -1;
    }

    let bestIndex = 0;
    for (let index = 1; index < this.items.length; index++) {
      const candidate = this.items[index];
      const best = this.items[bestIndex];
      if (
        candidate.priority > best.priority ||
        (candidate.priority === best.priority && candidate.sequence < best.sequence)
      ) {
        bestIndex = index;
      }
    }

    return bestIndex;
  }
}
