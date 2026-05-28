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

    -- Extract state override (for Castle, Green Joker, Yorick, etc.)
    local override_val = nil
    local extra = ability.extra_value
    if type(extra) == 'number' then
      override_val = extra
    else
      local counter = ability.counter
      if type(counter) == 'number' then
        override_val = counter
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

  -- First try: check consumable area for planet cards (most reliable)
  local consumables = G.consumeables
  if consumables and consumables.cards then
    for _, card in ipairs(consumables.cards) do
      if card and card.ability and card.ability.name then
        local hand_key = PLANET_TO_HAND[card.ability.name]
        if hand_key then
          local lvl = safe_number(card.ability.level, 1)
          if lvl > 1 then levels[hand_key] = lvl end
        end
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

  local dollars = safe_number(current_round.dollars, 0)
  local ante = safe_number(round_resets.ante, 1)
  local hands_played = safe_number(current_round.hands_played, 0)
  local discards_used = safe_number(current_round.discards_used, 0)
  local seed = current_round.seed

  return {
    handCards = hand_cards,
    jokers = jokers,
    handLevels = hand_levels,
    deckComposition = deck,
    dollars = dollars,
    antes = ante,
    handsPlayed = hands_played,
    discardsUsed = discards_used,
    blindType = blind_type,
    blindChips = blind_chips,
    blindDebuffedRanks = debuff_ranks,
    blindDebuffedSuits = debuff_suits,
    seed = type(seed) == 'string' and seed or nil,
    jokerStateOverrides = joker_overrides,
    activeVouchers = vouchers,
    activeBossEffect = boss_effect,
    maxHandsBase = base_params.maxHandsBase,
    maxDiscardsBase = base_params.maxDiscardsBase,
    handSizeBase = base_params.handSizeBase,
  }
end

return collector
