-- Command dispatcher: routes incoming POST /api/command payloads.
-- Provides a clean interface that server.lua calls into.

local commands = {}
local highlighter = nil  -- Lazily resolved (loaded after this module)

function commands.set_highlighter(h)
  highlighter = h
end

function commands.dispatch(cmd_type, payload)
  if not highlighter then
    return false, 'highlighter not initialized'
  end

  if cmd_type == 'highlight_play' then
    if not payload or not payload.indices then
      return false, 'missing indices for highlight_play'
    end
    highlighter:set_play_highlights(payload.indices)
    return true

  elseif cmd_type == 'highlight_discard' then
    if not payload or not payload.indices then
      return false, 'missing indices for highlight_discard'
    end
    highlighter:set_discard_highlights(payload.indices)
    return true

  elseif cmd_type == 'clear_highlights' then
    highlighter:clear()
    return true

  else
    return false, 'unknown command type: ' .. tostring(cmd_type)
  end
end

return commands
