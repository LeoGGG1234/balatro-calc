-- Card highlighter: draws colored overlays on hand cards in-game.
-- Green overlay = recommended to play. Red overlay = recommended to discard.
-- Hooks into the game's draw cycle via Game.draw override in main.lua.

local highlighter = {}
local play_set = {}      -- {[0-based-index] = true}
local discard_set = {}   -- {[0-based-index] = true}
local overlay_opacity = 0.30
local border_opacity = 0.70
local line_width = 3

function highlighter:set_play_highlights(indices)
  play_set = {}
  for _, idx in ipairs(indices) do
    play_set[idx] = true
  end
  -- Clear discard highlights when play highlights are set
  discard_set = {}
end

function highlighter:set_discard_highlights(indices)
  discard_set = {}
  for _, idx in ipairs(indices) do
    discard_set[idx] = true
  end
  -- Clear play highlights when discard highlights are set
  play_set = {}
end

function highlighter:clear()
  play_set = {}
  discard_set = {}
end

function highlighter:has_highlights()
  return next(play_set) ~= nil or next(discard_set) ~= nil
end

function highlighter:draw()
  if not G or not G.hand or not G.hand.cards then
    return
  end

  local has_play = next(play_set) ~= nil
  local has_discard = next(discard_set) ~= nil
  if not has_play and not has_discard then
    return
  end

  for i, card in ipairs(G.hand.cards) do
    if card and card.T then
      local idx = i - 1  -- Convert to 0-based for protocol consistency
      local r, g, b

      if has_play and play_set[idx] then
        r, g, b = 0.2, 0.9, 0.3  -- Green for play
      elseif has_discard and discard_set[idx] then
        r, g, b = 0.9, 0.2, 0.2  -- Red for discard
      else
        goto continue
      end

      local x = card.T.x - card.T.w / 2
      local y = card.T.y - card.T.h / 2
      local w = card.T.w
      local h = card.T.h
      local radius = 4

      -- Store current color
      local cr, cg, cb, ca = love.graphics.getColor()

      -- Draw semi-transparent overlay fill
      love.graphics.setColor(r, g, b, overlay_opacity)
      love.graphics.rectangle('fill', x, y, w, h, radius, radius)

      -- Draw colored border
      love.graphics.setColor(r, g, b, border_opacity)
      love.graphics.setLineWidth(line_width)
      love.graphics.rectangle('line', x, y, w, h, radius, radius)
      love.graphics.setLineWidth(1)

      -- Restore original color
      love.graphics.setColor(cr, cg, cb, ca)

      ::continue::
    end
  end
end

return highlighter
