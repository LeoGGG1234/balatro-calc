-- Game state collector: reads Balatro Lua globals and produces an
-- InjectedSaveData-compatible table that can be JSON-serialized.
--
-- All output uses the tool's internal enum values (snake_case, short codes)
-- so zero transformation is needed on the TypeScript side.

local collector = {}
local json = nil  -- Injected after module load

-- ─── Mapping tables (must match save-parser.ts exactly) ────────────

local RANK_MAP = {
  ['2'] = '2', ['3'] = '3', ['4'] = '4', ['5'] = '5',
  ['6'] = '6', ['7'] = '7', ['8'] = '8', ['9'] = '9',
  ['10'] = '10', Jack = 'J', Queen = 'Q', King = 'K', Ace = 'A',
}

local SUIT_MAP = {
  Hearts = 'H', Diamonds = 'D', Clubs = 'C', Spades = 'S',
}

local ENHANCEMENT_MAP = {
  ['Base'] = 'none', Bonus = 'bonus', Mult = 'mult',
  ['Wild Card'] = 'wild', ['Glass Card'] = 'glass',
  ['Steel Card'] = 'steel', ['Stone Card'] = 'stone',
  ['Gold Card'] = 'gold', ['Lucky Card'] = 'lucky',
}

local EDITION_MAP = {
  ['Default'] = 'none', Foil = 'foil', Holographic = 'holo',
  Polychrome = 'poly', Negative = 'negative',
}

local SEAL_MAP = {
  Red = 'red', Blue = 'blue', Gold = 'gold', Purple = 'purple',
}

-- Balatro internal boss keys → our boss effect IDs
local BOSS_KEY_MAP = {
  bl_water = 'the_water', bl_needle = 'the_needle', bl_eye = 'the_eye',
  bl_mouth = 'the_mouth', bl_arm = 'the_arm', bl_wall = 'the_wall',
  bl_wheel = 'the_wheel', bl_fish = 'the_fish', bl_house = 'the_house',
  bl_mark = 'the_mark', bl_head = 'the_head', bl_tooth = 'the_tooth',
  bl_ox = 'the_ox', bl_serpent = 'the_serpent', bl_club = 'the_club',
  bl_window = 'the_window', bl_plant = 'the_plant', bl_hook = 'the_hook',
  bl_psychic = 'the_psychic', bl_goad = 'the_goad', bl_pillar = 'the_pillar',
  bl_flint = 'the_flint', bl_manacle = 'the_manacle',
  bl_vessel = 'violet_vessel', bl_leaf = 'verdant_leaf',
  bl_heart = 'crimson_heart', bl_bell = 'cerulean_bell',
  bl_acorn = 'amber_acorn',
}

-- Voucher center keys → our voucher IDs
local VOUCHER_KEY_MAP = {
  v_grabber = 'grabber', v_nacho_tong = 'nacho_tong',
  v_wasteful = 'wasteful', v_recyclomancy = 'recyclomancy',
  v_paint_brush = 'paint_brush', v_palette = 'palette',
}

-- Planet name → hand type (our internal key)
local PLANET_TO_HAND = {
  Pluto = 'HighCard', Mercury = 'Pair', Uranus = 'TwoPair',
  Saturn = 'Straight', Jupiter = 'Flush', Venus = 'ThreeOfAKind',
  Earth = 'FullHouse', Mars = 'FourOfAKind', Neptune = 'StraightFlush',
  ['Planet X'] = 'FiveOfAKind', Ceres = 'FlushHouse', Eris = 'FlushFive',
}

-- Balatro display hand names → our internal keys (fallback)
local HAND_NAME_MAP = {
  ['High Card'] = 'HighCard', Pair = 'Pair', ['Two Pair'] = 'TwoPair',
  ['Three of a Kind'] = 'ThreeOfAKind', Straight = 'Straight',
  Flush = 'Flush', ['Full House'] = 'FullHouse',
  ['Four of a Kind'] = 'FourOfAKind', ['Straight Flush'] = 'StraightFlush',
  ['Royal Flush'] = 'RoyalFlush', ['Five of a Kind'] = 'FiveOfAKind',
  ['Flush House'] = 'FlushHouse', ['Flush Five'] = 'FlushFive',
}

-- Voucher effects on round params (for back-calculating base values)
local VOUCHER_INFO = {
  grabber = { hands = 1 },
  nacho_tong = { hands = 1 },
  wasteful = { discards = 1 },
  recyclomancy = { discards = 1 },
  paint_brush = { handSize = 1 },
  palette = { handSize = 1 },
}

-- ─── Internal helpers ──────────────────────────────────────────────

-- Ensure empty tables serialize as JSON arrays, not objects
local function mark_as_array(t)
  if t and type(t) == 'table' and next(t) == nil then
    t.__json_array = true
  end
  return t
end

local function safe_get(tbl, key, default)
  if tbl and type(tbl) == 'table' then
    local v = rawget(tbl, key)
    if v ~= nil then return v end
  end
  return default
end

local function safe_number(val, default)
  local t = type(val)
  if t == 'number' then return val end
  if t == 'string' then return tonumber(val) or (default or 0) end
  return default or 0
end

local function safe_string(val, default)
  if type(val) == 'string' then return val end
  return default or ''
end

-- ─── Card parsing ──────────────────────────────────────────────────

local function parse_card_base(card)
  -- card.base.suit and card.base.value
  local base = card.base
  if not base then return nil, nil end
  local suit = SUIT_MAP[base.suit]
  local rank = RANK_MAP[base.value]
  if not suit or not rank then return nil, nil end
  return suit, rank
end

local function parse_card_modifiers(card)
  local ability = card.ability or {}
  local effect = ENHANCEMENT_MAP[ability.effect] or 'none'
  local edition = EDITION_MAP[ability['set']] or 'none'
  local seal = SEAL_MAP[card.seal] or SEAL_MAP[ability.seal] or 'none'
  local debuffed = card.debuff == true
  local facing = card.facing or 'front'
  return effect, edition, seal, debuffed, facing
end

-- ─── Hand cards ────────────────────────────────────────────────────

local function collect_hand_cards()
  local hand = G.hand
  if not hand or not hand.cards then return {} end

  local cards = {}
  for i, card in ipairs(hand.cards) do
    local suit, rank = parse_card_base(card)
    if suit and rank then
      local effect, edition, seal, debuffed, facing = parse_card_modifiers(card)
      local entry = {
        id = 'hand_' .. (i - 1),
        rank = rank,
        suit = suit,
        enhancement = effect,
        edition = edition,
        seal = seal,
        debuffed = debuffed,
      }
      if facing == 'back' then
        entry.fog = true
      end
      cards[#cards + 1] = entry
    end
  end
  return cards
end

-- ─── Jokers ────────────────────────────────────────────────────────

local function collect_jokers()
  local jokers_area = G.jokers
  if not jokers_area or not jokers_area.cards then return {}, {} end

  local jokers = {}
  local overrides = {}

  for i, card in ipairs(jokers_area.cards) do
    local ability = card.ability or {}
    local edition = EDITION_MAP[ability['set']] or 'none'

    -- Map joker ID: strip 'j_' prefix from ability.key
    local joker_id = 'joker'
    local raw_key = ability.key
    if raw_key and type(raw_key) == 'string' then
      if raw_key:sub(1, 2) == 'j_' then
        joker_id = raw_key:sub(3)
      else
        joker_id = raw_key
      end
    elseif ability.name then
      joker_id = ability.name:lower():gsub('[^a-z0-9]+', '_'):gsub('^_', ''):gsub('_$', '')
    end

    jokers[#jokers + 1] = { id = joker_id, edition = edition }

    -- Extract state override for state-driven jokers.
    -- Priority: extra_value > extra.mult/chips > counter > config.extra
    local override_val = nil
    if type(ability.extra_value) == 'number' then
      override_val = ability.extra_value
    elseif type(ability.extra) == 'table' then
      -- Hologram/Constellation/Campfire store xMult in extra.mult
      override_val = ability.extra.mult or ability.extra.chips
      if override_val ~= nil and type(override_val) ~= 'number' then
        override_val = nil
      end
    end
    if override_val == nil then
      if type(ability.counter) == 'number' then
        override_val = ability.counter
      elseif card.config and type(card.config.extra) == 'number' then
        override_val = card.config.extra
      end
    end
    if override_val ~= nil then
      overrides[#jokers - 1] = override_val  -- 0-based index
    end
  end

  return jokers, overrides
end

-- ─── Hand levels ───────────────────────────────────────────────────

local function collect_hand_levels()
  local levels = {
    HighCard = 1, Pair = 1, TwoPair = 1, ThreeOfAKind = 1,
    Straight = 1, Flush = 1, FullHouse = 1, FourOfAKind = 1,
    StraightFlush = 1, RoyalFlush = 1, FiveOfAKind = 1,
    FlushHouse = 1, FlushFive = 1,
  }

  -- Read from G.GAME.hands (authoritative source, persists after planets are used)
  local hands = G.GAME and G.GAME.hands
  if hands then
    for display_name, hand_data in pairs(hands) do
      local hand_key = HAND_NAME_MAP[display_name]
      if hand_key and type(hand_data) == 'table' then
        local lvl = safe_number(hand_data.level, 1)
        if lvl > 1 then levels[hand_key] = lvl end
      end
    end
  end

  return levels
end

-- ─── Deck composition ──────────────────────────────────────────────

local function collect_deck_composition()
  local deck_area = G.deck
  if not deck_area or not deck_area.cards then
    return {
      ['totalCards'] = 0,
      ['remainingByRank'] = {},
      ['remainingBySuit'] = {},
      ['cards'] = {},
    }
  end

  local cards = {}
  local by_rank = {}
  local by_suit = {}

  for _, card in ipairs(deck_area.cards) do
    local suit, rank = parse_card_base(card)
    if suit and rank then
      local effect, edition, seal = parse_card_modifiers(card)
      by_rank[rank] = (by_rank[rank] or 0) + 1
      by_suit[suit] = (by_suit[suit] or 0) + 1
      cards[#cards + 1] = { rank = rank, suit = suit, enhancement = effect, edition = edition, seal = seal }
    end
  end

  return {
    ['totalCards'] = #cards,
    ['remainingByRank'] = by_rank,
    ['remainingBySuit'] = by_suit,
    ['cards'] = cards,
  }
end

-- ─── Blind info ────────────────────────────────────────────────────

local function collect_blind_info()
  local round_resets = G.GAME and G.GAME.round_resets or {}
  local blind = round_resets.blind or {}
  local blind_states = round_resets.blind_states or {}

  -- Determine blind type from defeated states
  local small_state = blind_states.Small or 'Upcoming'
  local big_state = blind_states.Big or 'Upcoming'

  local blind_type = 'small'
  if small_state == 'Defeated' and big_state ~= 'Defeated' then
    blind_type = 'big'
  elseif small_state == 'Defeated' and big_state == 'Defeated' then
    blind_type = 'boss'
  elseif small_state ~= 'Defeated' then
    blind_type = 'small'
  end

  local blind_chips = safe_number(blind.chips, 0)
  local blind_name = safe_string(blind.name, 'Small Blind')
  local blind_key = safe_string(blind.key, '')

  -- Fallback: infer from blind name
  if blind_type == 'small' and blind_name == 'Big Blind' then
    blind_type = 'big'
  elseif blind_name == 'Boss Blind' then
    blind_type = 'boss'
  end

  -- Debuffed ranks/suits
  local debuff = blind.debuff or {}
  local debuffed_suits = {}
  local debuffed_ranks = {}

  if debuff.suit then
    for suit_name, _ in pairs(debuff.suit) do
      local s = SUIT_MAP[suit_name]
      if s then debuffed_suits[#debuffed_suits + 1] = s end
    end
  end

  if debuff.rank then
    for rank_name, _ in pairs(debuff.rank) do
      local r = RANK_MAP[rank_name]
      if r then debuffed_ranks[#debuffed_ranks + 1] = r end
    end
  end

  return blind_type, blind_chips, debuffed_ranks, debuffed_suits, blind_key
end

-- ─── Vouchers & Boss effect ────────────────────────────────────────

local function collect_active_vouchers()
  local current_round = G.GAME and G.GAME.current_round or {}
  local vouchers = current_round.vouchers or {}
  local ids = {}
  for key, _ in pairs(vouchers) do
    local mapped = VOUCHER_KEY_MAP[key]
    if mapped then ids[#ids + 1] = mapped end
  end
  return ids
end

local function collect_boss_effect(blind_type, blind_key)
  if blind_type ~= 'boss' then return nil end
  return BOSS_KEY_MAP[blind_key] or nil
end

-- ─── Round params (base values back-calculated) ────────────────────

local function compute_base_round_params(active_vouchers)
  local current_round = G.GAME and G.GAME.current_round or {}

  local hands_left = safe_number(current_round.hands_left, 0)
  local discards_left = safe_number(current_round.discards_left, 0)
  local hands_played = safe_number(current_round.hands_played, 0)
  local discards_used = safe_number(current_round.discards_used, 0)
  local hand_size = safe_number(current_round.hand_size, 8)

  local effective_hands = hands_left + hands_played
  local effective_discards = discards_left + discards_used

  -- Subtract voucher bonuses
  local voucher_hand_bonus = 0
  local voucher_discard_bonus = 0
  local voucher_hs_bonus = 0
  for _, v_id in ipairs(active_vouchers) do
    local info = VOUCHER_INFO[v_id]
    if info then
      if info.hands then voucher_hand_bonus = voucher_hand_bonus + info.hands end
      if info.discards then voucher_discard_bonus = voucher_discard_bonus + info.discards end
      if info.handSize then voucher_hs_bonus = voucher_hs_bonus + info.handSize end
    end
  end

  return {
    maxHandsBase = math.max(1, effective_hands - voucher_hand_bonus),
    maxDiscardsBase = math.max(0, effective_discards - voucher_discard_bonus),
    handSizeBase = math.max(5, hand_size - voucher_hs_bonus),
  }
end

-- ─── Held consumables (player's tarot/planet/spectral slots) ─────

local function collect_held_consumables()
  local area = G.consumeables
  if not area or not area.cards then return {} end

  local cards = {}
  for _, card in ipairs(area.cards) do
    local ability = card.ability or {}
    -- Determine type: tarot, planet, or spectral
    local card_type = 'unknown'
    local set = ability['set'] or ''
    if set == 'Tarot' or set == 'tarot' then
      card_type = 'tarot'
    elseif set == 'Planet' or set == 'planet' then
      card_type = 'planet'
    elseif set == 'Spectral' or set == 'spectral' then
      card_type = 'spectral'
    end

    -- Get card key/ID (strip prefix: c_ for tarot/spectral, p_ for planet)
    local card_id = ability.key or ability.name or 'unknown'
    if type(card_id) == 'string' then
      if card_id:sub(1, 2) == 'c_' or card_id:sub(1, 2) == 'p_' then
        card_id = card_id:sub(3)
      end
    end

    cards[#cards + 1] = {
      id = card_id,
      name = ability.name or card_id,
      type = card_type,
      highlighted = card.highlighted == true,
      sellCost = safe_number(card.sell_cost, 0),
    }
  end
  return cards
end

-- ─── Shop data ────────────────────────────────────────────────────

local function collect_shop()
  local shop = G.shop
  if not shop then return nil end

  local data = {}

  -- Jokers for sale
  if shop.cards and #shop.cards > 0 then
    local jokers = {}
    for _, card in ipairs(shop.cards) do
      local ability = card.ability or {}
      local joker_id = ability.key or 'unknown'
      if type(joker_id) == 'string' and joker_id:sub(1, 2) == 'j_' then
        joker_id = joker_id:sub(3)
      end
      jokers[#jokers + 1] = {
        id = joker_id,
        price = safe_number(card.sell_cost or card.cost, 0),
        edition = EDITION_MAP[ability['set']] or 'none',
      }
    end
    data.jokers = jokers
  end

  -- Voucher for sale
  if shop.voucher then
    local v_ability = shop.voucher.ability or {}
    local v_key = v_ability.key or ''
    local v_id = VOUCHER_KEY_MAP[v_key] or v_key
    data.voucher = {
      id = v_id,
      price = safe_number(shop.voucher.cost or shop.voucher.sell_cost, 0),
    }
  end

  -- Booster packs
  if shop.packs and #shop.packs > 0 then
    local packs = {}
    for _, pack in ipairs(shop.packs) do
      packs[#packs + 1] = {
        type = pack.kind or pack.type or 'unknown',
        price = safe_number(pack.sell_cost or pack.cost, 0),
        size = safe_number(pack.size or pack.config_size, 0),
      }
    end
    data.boosters = packs
  end

  -- Consumable slot (tarot/planet card)
  if shop.consumable then
    local cons = shop.consumable
    local cons_ability = cons.ability or {}
    data.consumable = {
      id = cons_ability.key or cons_ability.name or 'unknown',
      price = safe_number(cons.sell_cost or cons.cost, 0),
    }
  end

  -- Reroll cost
  data.rerollCost = safe_number(shop.reroll_cost or shop.re_roll_cost, 5)

  return data
end

-- ─── Main collect function ─────────────────────────────────────────

function collector.collect()
  if not G or not G.GAME then
    return nil, 'Game not initialized'
  end

  local current_round = G.GAME.current_round or {}
  local round_resets = G.GAME.round_resets or {}
  local pseudorandom = G.GAME.pseudorandom or {}

  local hand_cards = collect_hand_cards()
  local jokers, joker_overrides = collect_jokers()
  local hand_levels = collect_hand_levels()
  local deck = collect_deck_composition()
  local blind_type, blind_chips, debuff_ranks, debuff_suits, blind_key = collect_blind_info()
  local vouchers = collect_active_vouchers()
  local boss_effect = collect_boss_effect(blind_type, blind_key)
  local base_params = compute_base_round_params(vouchers)
  local held_consumables = collect_held_consumables()
  local shop_data = collect_shop()

  -- Try G.GAME.dollars first (global, more reliable), fall back to current_round.dollars
  local dollars = safe_number(G.GAME.dollars, nil)
  if dollars == nil or dollars == 0 then
    dollars = safe_number(current_round.dollars, 0)
  end
  local ante = safe_number(round_resets.ante, 1)
  local hands_played = safe_number(current_round.hands_played, 0)
  local discards_used = safe_number(current_round.discards_used, 0)
  local seed = current_round.seed

  return {
    handCards = mark_as_array(hand_cards),
    jokers = mark_as_array(jokers),
    handLevels = hand_levels,
    deckComposition = deck,
    dollars = dollars,
    antes = ante,
    handsPlayed = hands_played,
    discardsUsed = discards_used,
    blindType = blind_type,
    blindChips = blind_chips,
    blindDebuffedRanks = mark_as_array(debuff_ranks),
    blindDebuffedSuits = mark_as_array(debuff_suits),
    seed = type(seed) == 'string' and seed or nil,
    jokerStateOverrides = joker_overrides,
    activeVouchers = mark_as_array(vouchers),
    activeBossEffect = boss_effect,
    maxHandsBase = base_params.maxHandsBase,
    maxDiscardsBase = base_params.maxDiscardsBase,
    handSizeBase = base_params.handSizeBase,
    heldConsumables = held_consumables,
    shop = shop_data,
  }
end

return collector
