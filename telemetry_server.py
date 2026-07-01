import asyncio
import json
import random
import websockets

async def stream_telemetry(websocket):
    print(f"[+] UI Client Connected: {websocket.remote_address}")
    try:
        while True:
            # Simulate real production state logic
            # High TPS sometimes triggers Z3 solver backpressure cliffs
            tps = random.randint(1100, 1900)
            is_heavy_load = tps > 1600
            
            triton_latency = random.randint(12, 18) if is_heavy_load else random.randint(4, 8)
            triton_q_depth = random.randint(8, 15) if is_heavy_load else random.randint(0, 2)
            
            z3_latency = random.randint(90, 160) if is_heavy_load else random.randint(25, 45)
            z3_q_depth = random.randint(5, 12) if is_heavy_load else random.randint(0, 1)
            is_solving = random.choice([True, False]) if not is_heavy_load else True
            
            commit_latency = random.randint(18, 28) if is_heavy_load else random.randint(8, 14)

            payload = {
                "triton": {
                    "latency": triton_latency,
                    "queueDepth": triton_q_depth,
                    "tps": tps
                },
                "z3": {
                    "latency": z3_latency,
                    "queueDepth": z3_q_depth,
                    "isSolving": is_solving
                },
                "commit": {
                    "latency": commit_latency,
                    "queueDepth": 0
                }
            }

            # Emit state to frontend canvas over the socket
            await websocket.send(json.dumps(payload))
            
            # Match your pipeline's stream tick resolution (e.g., every 500ms)
            await asyncio.sleep(0.5)
            
    except websockets.exceptions.ConnectionClosed:
        print(f"[-] UI Client Disconnected: {websocket.remote_address}")

async def main():
    # Bind to local loopback interface on port 8765
    server = await websockets.serve(stream_telemetry, "127.0.0.1", 8765)
    print("[*] AesirGrid Core Telemetry Server started on ws://127.0.0.1:8765")
    await server.wait_closed()

if __name__ == "__main__":
    asyncio.run(main())
