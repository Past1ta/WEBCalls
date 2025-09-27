from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
from pathlib import Path
import uvicorn
import json
import subprocess
import threading
import sys

app = FastAPI()

# serve web client (use path relative to this file so running from project root works)
STATIC_DIR = Path(__file__).parent.joinpath('static')
if not STATIC_DIR.exists():
    raise RuntimeError(f"Static directory not found: {STATIC_DIR!s}. Make sure server/static exists")
app.mount('/static', StaticFiles(directory=str(STATIC_DIR)), name='static')

# In-memory rooms: room_id -> { sockets:set, meta: { ws_id -> nick } }
rooms = {}

def make_room():
    return {'sockets': set(), 'meta': {}}


@app.get("/")
async def index():
    return HTMLResponse("Signaling server running. Connect via WebSocket at /ws/{room}")


@app.websocket('/ws/{room_id}')
async def websocket_endpoint(websocket: WebSocket, room_id: str):
    await websocket.accept()
    if room_id not in rooms:
        rooms[room_id] = make_room()
    room = rooms[room_id]
    room['sockets'].add(websocket)
    sock_id = id(websocket)
    try:
        while True:
            text = await websocket.receive_text()
            try:
                msg = json.loads(text)
            except Exception:
                # ignore non-json
                continue

            mtype = msg.get('type')

            # JOIN: store nick and broadcast peers list
            if mtype == 'join':
                nick = msg.get('nick', f'guest-{sock_id}')
                room['meta'][sock_id] = nick
                # notify all peers about current peers list
                peers = list(room['meta'].values())
                out = json.dumps({ 'type': 'peers', 'list': peers })
                for peer in list(room['sockets']):
                    try:
                        await peer.send_text(out)
                    except Exception:
                        pass
                # also notify others that someone joined (so they can create offer)
                join_notify = json.dumps({ 'type': 'join', 'nick': nick })
                for peer in list(room['sockets']):
                    if peer is websocket: continue
                    try:
                        await peer.send_text(join_notify)
                    except Exception:
                        pass
                continue

            # LEAVE
            if mtype == 'leave':
                # remove and broadcast peers
                room['meta'].pop(sock_id, None)
                peers = list(room['meta'].values())
                out = json.dumps({ 'type': 'peers', 'list': peers })
                for peer in list(room['sockets']):
                    try:
                        await peer.send_text(out)
                    except Exception:
                        pass
                continue

            # OFFER / ANSWER / CANDIDATE: forward to others
            if mtype in ('offer','answer','candidate'):
                # forward message as-is to other peers
                out = json.dumps(msg)
                for peer in list(room['sockets']):
                    if peer is websocket: continue
                    try:
                        await peer.send_text(out)
                    except Exception:
                        pass
                continue

            # unknown types ignored
    except WebSocketDisconnect:
        pass
    finally:
        room['sockets'].discard(websocket)
        room['meta'].pop(sock_id, None)
        # broadcast updated peers
        peers = list(room['meta'].values())
        out = json.dumps({ 'type': 'peers', 'list': peers })
        for peer in list(room['sockets']):
            try:
                await peer.send_text(out)
            except Exception:
                pass


if __name__ == '__main__':
    # try to start cloudflared tunnel for easy external testing
    def start_cloudflared():
        try:
            cmd = ['cloudflared', 'tunnel', '--url', 'http://localhost:8000']
            creationflags = 0
            if sys.platform.startswith('win'):
                creationflags = 0x00000008 | 0x00000200
            proc = subprocess.Popen(cmd, cwd=str(STATIC_DIR.parent), stdout=subprocess.PIPE, stderr=subprocess.STDOUT, creationflags=creationflags, text=True)

            def reader(p):
                for line in p.stdout:
                    line = line.strip()
                    print('[cloudflared]', line)
                    if 'https://' in line or 'trycloudflare.com' in line:
                        print('Public URL from cloudflared:', line)

            t = threading.Thread(target=reader, args=(proc,), daemon=True)
            t.start()
            return proc
        except FileNotFoundError:
            print('cloudflared not found on PATH; skip starting tunnel. Install cloudflared to expose server publicly.')
            return None

    # start cloudflared in background (best-effort)
    start_cloudflared()
    uvicorn.run('main:app', host='0.0.0.0', port=8000, reload=True)
