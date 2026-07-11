import { createOperationsSnapshot } from "@/lib/enterprise/operations";
import { autonomousEventBus } from "@/lib/events/event-bus";
import { replayManager } from "@/lib/events/replay-manager";
import type { AutonomousEvent } from "@/lib/events/event-types";

function encodeSseEvent(eventName: string, data: unknown): string {
  return `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
}

function snapshotEvent(): AutonomousEvent {
  return {
    id: `operations:${Date.now().toString(36)}`,
    tenantId: "system",
    organizationId: "system",
    type: "operations-snapshot",
    source: "operations-stream",
    priority: "medium",
    timestamp: new Date().toISOString(),
    dedupeKey: `operations:${Math.floor(Date.now() / 3000)}`,
    payload: createOperationsSnapshot() as unknown as Record<string, unknown>,
  };
}

export async function GET(): Promise<Response> {
  let timer: ReturnType<typeof setInterval> | undefined;
  let unsubscribe: (() => void) | undefined;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      const replay = await replayManager.replayRecent("system", "system", 5);
      for (const event of replay.reverse()) {
        controller.enqueue(encoder.encode(encodeSseEvent("operations", event.payload)));
      }

      unsubscribe = autonomousEventBus.subscribe((event) => {
        if (event.type !== "operations-snapshot") return;
        controller.enqueue(encoder.encode(encodeSseEvent("operations", event.payload)));
      });

      const send = async () => {
        await autonomousEventBus.publish(snapshotEvent());
      };

      await send();
      timer = setInterval(() => {
        void send();
      }, 3000);

      controller.enqueue(encoder.encode(": connected\n\n"));
    },
    cancel() {
      unsubscribe?.();
      if (timer) clearInterval(timer);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
