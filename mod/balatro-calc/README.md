# Balatro Calc Mod

Real-time bidirectional bridge between Balatro and the [Balatro Calc](https://github.com/balatro-calc) web tool.

## How It Works

The mod starts a lightweight HTTP server inside Balatro that exposes your live game state. The web tool (running in your browser) connects to this server and auto-fills all inputs — no more manual card entry. In the reverse direction, the tool can send highlighting commands back to the game: green overlays for cards to play, red for cards to discard.

## Requirements

- [Steamodded](https://github.com/Steamodded/smods) (includes luasocket)
- Balatro (official/vanilla, any platform that runs Steammodded)

## Installation

1. Copy the entire `balatro-calc` folder into your Balatro Mods directory:
   - **Windows**: `%APPDATA%\Balatro\Mods\balatro-calc\`
   - **Linux/Steam Deck**: `~/.local/share/Steam/steamapps/compatdata/2379780/pfx/drive_c/users/steamuser/AppData/Roaming/Balatro/Mods/balatro-calc/`
2. Launch Balatro with Steammodded
3. The mod starts automatically — no configuration needed
4. Open the [Balatro Calc web tool](http://localhost:5173) in your browser
5. The connection indicator should turn green within a few seconds

## API Endpoints

The mod runs an HTTP server on `localhost:18888` (falls back to 18889–18893 if the port is taken):

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Connection check — returns `{"status":"ok"}` |
| GET | `/api/state` | Full game state as JSON (matching InjectedSaveData schema) |
| POST | `/api/command` | Receive highlighting commands from the tool |

## Troubleshooting

- **Mod doesn't load**: Make sure the folder is named `balatro-calc` and contains `main.lua` at the root
- **Web tool shows "Disconnected"**: Check that Balatro is running and a run is active. Try `curl http://localhost:18888/api/health` in a terminal
- **luasocket not available**: Some minimal Steammodded installations may not include luasocket. The mod will log a warning and the game will run normally — you can still use manual save file import

## Development

The mod source is in `mod/balatro-calc/`. File structure:

```
main.lua              — Steammodded entry point, hooks Game.update/draw
lib/json.lua          — Pure-Lua JSON encoder/decoder
src/server.lua        — Non-blocking HTTP server (luasocket TCP)
src/collector.lua     — Reads G.GAME / G.hand / G.deck / G.jokers
src/highlighter.lua   — Draws green (play) / red (discard) card overlays
src/commands.lua      — Dispatches incoming POST /api/command payloads
```
