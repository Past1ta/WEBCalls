# KivyMessenger Call Prototype

This prototype provides:

- A lightweight signaling server (FastAPI + WebSocket) at `server/main.py`.
- A WebRTC web client at `server/static/index.html` + `server/static/client.js`.
- Simple launchers for Kivy (`clients/launcher_kivy.py`) and Tkinter (`clients/launcher_tk.py`) that open the web client in the default browser.

Quick start (Windows PowerShell):

# create a virtual env and install server deps
python -m venv .venv; .\.venv\Scripts\Activate.ps1; pip install -r server/requirements.txt

# run the signaling server
python server/main.py

# open the web client in a browser:
# open http://127.0.0.1:8000/static/index.html

# Launchers
- Tkinter launcher: `python clients/launcher_tk.py` (opens web client in default browser)
- Kivy launcher: `python clients/launcher_kivy.py` (opens web client; requires Kivy installed)

Local testing and exposing your server for free (quick options):

- Using ngrok (free tier)
	1. Install ngrok and run: `ngrok http 8000`
	2. ngrok will print a public URL like `https://abcd1234.ngrok.io` — open `https://abcd1234.ngrok.io/static/index.html` on any device to join.

- Using cloudflared (Cloudflare Tunnel, free)
	1. Download cloudflared, then run: `cloudflared tunnel --url http://localhost:8000`
	2. It returns a public URL you can use like above.

Launcher notes:
- Both `clients/launcher_tk.py` and `clients/launcher_kivy.py` now try to auto-start the local server if it is not reachable, wait briefly for it to boot, and then open an embedded window using `pywebview`.
- To test the embedded windows, install dependencies (see server/requirements.txt) and run one of the launcher scripts.

Design & UX notes:
- The web UI was updated with a clean dark design, nickname, auto-generated room codes, mute/unmute, camera toggle, and a leave button.
- For production polish: add icons, animations, accessibility labels, and responsive adjustments for small screens.

Hosting options (free tiers and quick-start)

1) Static frontend only (if you separate server signaling):
	- GitHub Pages / Cloudflare Pages / Vercel can host `server/static` (HTML/JS/CSS). These are free for static sites.
	- For GitHub Pages: push `server/static` to a repository's `gh-pages` branch or use an action.

2) Full app (server + web client): free options
	- Fly.io (free tier): you can deploy the Dockerfile provided. Steps:
	  - Install flyctl, login: `flyctl auth login`
	  - Create app and deploy: `flyctl launch --name my-meet` (follow prompts) then `flyctl deploy`
	- Railway / Render / Fly.io have free tiers that support running a small uvicorn container. Use the provided `Dockerfile`.

3) Quick tunneling for testing (no deploy)
	- ngrok (free tier): `ngrok http 8000` and use the generated https URL.
	- cloudflared (Cloudflare Tunnel): `cloudflared tunnel --url http://localhost:8000` and use the provided public URL.

Notes:
- For reliable p2p (non-local) use TURN (coturn) to traverse NATs.
- If you host the static files separately (Cloudflare Pages), set the signaling server URL in `client.js` to your server's public URL.

Notes:
- This is a minimal prototype. The signaling server is in-memory and not production-ready.
- For Android/Kivy packaging, use Buildozer/KivyMD and embed a WebView or open an external browser.
- The web client uses simple naive offer/answer flow; it works for two peers in the same room.
