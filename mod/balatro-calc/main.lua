-- Balatro Calc Mod — Bidirectional communication mod for Balatro Calc web tool.
--
-- Steammodded entry point. Starts an HTTP server on localhost to expose game
-- state and receive highlighting commands from the web tool.
--
-- Install: Copy this entire `balatro-calc` directory to `%APPDATA%/Balatro/Mods/`
-- Requires: Steammodded, luasocket (bundled with most Steammodded installations)

local balatro_calc = {}
local MOD_NAME = 'Balatro Calc'
local DEFAULT_PORT = 18888
local MAX_PORT = 18893

-- ─── Bootstrap ─────────────────────────────────────────────────────

-- Set up package path so requires work relative to mod directory
-- In Steammodded, SMODS.current_mod.path gives us the mod's root
local mod_path = nil
if SMODS and SMODS.current_mod and SMODS.current_mod.path then
  mod_path = SMODS.current_mod.path
else
  -- Fallback: try to get path relative to this file
  local info = debug.getinfo(1, 'S')
  if info and info.source then
    mod_path = info.source:gsub('^@', ''):gsub('main%.lua$', '')
  end
end

if mod_path then
  package.path = mod_path .. '?.lua;' .. mod_path .. 'lib/?.lua;' .. mod_path .. 'src/?.lua;' .. package.path
end

-- ─── Check luasocket ───────────────────────────────────────────────

local has_socket, socket_ok = pcall(require, 'socket')
if not has_socket then
  -- Graceful degradation: mod loads but server doesn't start.
  -- Game runs normally; user can still use manual save file import.
  if SMODS and SMODS.log then
    SMODS.log('[' .. MOD_NAME .. '] luasocket not available — real-time sync disabled. ' ..
              'Please use manual save.jkr import instead.')
  end
end

-- ─── Load modules ──────────────────────────────────────────────────

if has_socket then
  socket = require('socket')
  balatro_calc.json = require('lib.json')
  balatro_calc.collector = require('src.collector')
  balatro_calc.highlighter = require('src.highlighter')
  balatro_calc.commands = require('src.commands')
  balatro_calc.server = require('src.server')

  -- Wire up dependencies
  balatro_calc.commands.set_highlighter(balatro_calc.highlighter)

  -- Inject json into modules that need it (avoids circular requires)
  balatro_calc.collector.json = balatro_calc.json
  balatro_calc.server.json = balatro_calc.json
end

-- ─── Start server ──────────────────────────────────────────────────

if has_socket then
  local started = false
  for port = DEFAULT_PORT, MAX_PORT do
    local ok, err = balatro_calc.server:start(port, balatro_calc.collector.collect, balatro_calc.commands.dispatch)
    if ok then
      started = true
      if SMODS and SMODS.log then
        SMODS.log('[' .. MOD_NAME .. '] HTTP server started on http://localhost:' .. tostring(port))
      end
      break
    end
    if port == MAX_PORT then
      if SMODS and SMODS.log then
        SMODS.log('[' .. MOD_NAME .. '] Failed to start HTTP server on any port (' ..
                  tostring(DEFAULT_PORT) .. '-' .. tostring(MAX_PORT) .. '): ' .. tostring(err))
      end
    end
  end
  balatro_calc._started = started
end

-- ─── Hooks ─────────────────────────────────────────────────────────

-- Hook into Game:update to tick the server every frame
if has_socket and balatro_calc._started then
  local _Game_update = Game.update
  function Game:update(dt)
    _Game_update(self, dt)  -- call vanilla first
    balatro_calc.server:tick()
  end
end

-- Hook into Game:draw to render card highlights
if has_socket and balatro_calc._started then
  local _Game_draw = Game.draw
  function Game:draw()
    _Game_draw(self)  -- draw vanilla UI first
    balatro_calc.highlighter:draw()
  end
end

return balatro_calc
