import { createOperationsSnapshot } from "@/lib/enterprise/operations";

function encodeSseEvent(data: unknown): string {
  return `event: operations\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(): Promise<Response> {
  let timer: ReturnType<typeof setInterval> | undefined;
  const stream = new ReadableStream({
    start(controller) {
      const send = () => {
        const payload = encodeSseEvent(createOperationsSnapshot());
        controller.enqueue(new TextEncoder().encode(payload));
      };

      send();
      timer = setInterval(send, 3000);

      controller.enqueue(new TextEncoder().encode(": connected\n\n"));
    },
    cancel() {
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
