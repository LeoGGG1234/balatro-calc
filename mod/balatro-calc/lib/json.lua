-- Pure-Lua JSON encoder.
-- Handles strings, numbers, booleans, nil/null, tables (arrays and objects).
-- Does NOT handle: NaN, Infinity, sparse arrays, cyclic references, metatables.

local json = {}

local function escape_string(s)
  return '"' .. s:gsub('\\', '\\\\'):gsub('"', '\\"'):gsub('\n', '\\n'):gsub('\r', '\\r'):gsub('\t', '\\t') .. '"'
end

local function is_array(t)
  if next(t) == nil then return false end -- empty table → object
  local max_idx = 0
  local count = 0
  for k, _ in pairs(t) do
    if type(k) ~= 'number' or k < 1 or k ~= math.floor(k) then
      return false
    end
    count = count + 1
    if k > max_idx then max_idx = k end
  end
  return max_idx == count
end

local function encode_value(v)
  local vt = type(v)
  if vt == 'nil' then
    return 'null'
  elseif vt == 'boolean' then
    return v and 'true' or 'false'
  elseif vt == 'number' then
    return tostring(v)
  elseif vt == 'string' then
    return escape_string(v)
  elseif vt == 'table' then
    local parts = {}
    if is_array(v) then
      for i = 1, #v do
        parts[i] = encode_value(v[i])
      end
      return '[' .. table.concat(parts, ',') .. ']'
    else
      for k, val in pairs(v) do
        if k ~= '__json_array' then
          parts[#parts + 1] = escape_string(tostring(k)) .. ':' .. encode_value(val)
        end
      end
      return '{' .. table.concat(parts, ',') .. '}'
    end
  else
    return 'null'
  end
end

function json.encode(v)
  return encode_value(v)
end

-- Minimal JSON decoder (only used for simple command objects)
local function skip_whitespace(s, pos)
  while pos <= #s do
    local c = s:sub(pos, pos)
    if c ~= ' ' and c ~= '\t' and c ~= '\n' and c ~= '\r' then break end
    pos = pos + 1
  end
  return pos
end

local function decode_value(s, pos)
  pos = skip_whitespace(s, pos)
  if pos > #s then return nil, pos end

  local c = s:sub(pos, pos)

  if c == '"' then
    local start = pos + 1
    local parts = {}
    pos = pos + 1
    while pos <= #s do
      local cc = s:sub(pos, pos)
      if cc == '\\' then
        parts[#parts + 1] = s:sub(start, pos - 1)
        pos = pos + 1
        local esc = s:sub(pos, pos)
        if esc == '"' then parts[#parts + 1] = '"'
        elseif esc == '\\' then parts[#parts + 1] = '\\'
        elseif esc == '/' then parts[#parts + 1] = '/'
        elseif esc == 'n' then parts[#parts + 1] = '\n'
        elseif esc == 'r' then parts[#parts + 1] = '\r'
        elseif esc == 't' then parts[#parts + 1] = '\t'
        else parts[#parts + 1] = esc end
        pos = pos + 1
        start = pos
      elseif cc == '"' then
        parts[#parts + 1] = s:sub(start, pos - 1)
        return table.concat(parts), pos + 1
      else
        pos = pos + 1
      end
    end
    return nil, pos

  elseif c == '{' then
    pos = pos + 1
    local obj = {}
    pos = skip_whitespace(s, pos)
    if s:sub(pos, pos) == '}' then
      return obj, pos + 1
    end
    while pos <= #s do
      pos = skip_whitespace(s, pos)
      if s:sub(pos, pos) == '}' then
        return obj, pos + 1
      end
      -- Parse key
      local key
      key, pos = decode_value(s, pos)
      if not key then return nil, pos end
      pos = skip_whitespace(s, pos)
      if s:sub(pos, pos) ~= ':' then return nil, pos end
      pos = pos + 1
      -- Parse value
      local val
      val, pos = decode_value(s, pos)
      if val == nil and s:sub(pos, pos) ~= 'n' then return nil, pos end
      obj[key] = val
      pos = skip_whitespace(s, pos)
      if s:sub(pos, pos) == ',' then
        pos = pos + 1
      elseif s:sub(pos, pos) == '}' then
        return obj, pos + 1
      end
    end
    return obj, pos

  elseif c == '[' then
    pos = pos + 1
    local arr = {}
    local idx = 1
    pos = skip_whitespace(s, pos)
    if s:sub(pos, pos) == ']' then
      return arr, pos + 1
    end
    while pos <= #s do
      local val
      val, pos = decode_value(s, pos)
      if val == nil and s:sub(pos, pos) ~= 'n' then return nil, pos end
      arr[idx] = val
      idx = idx + 1
      pos = skip_whitespace(s, pos)
      if s:sub(pos, pos) == ',' then
        pos = pos + 1
      elseif s:sub(pos, pos) == ']' then
        return arr, pos + 1
      end
    end
    return arr, pos

  elseif s:sub(pos, pos + 3) == 'true' then
    return true, pos + 4
  elseif s:sub(pos, pos + 4) == 'false' then
    return false, pos + 5
  elseif s:sub(pos, pos + 3) == 'null' then
    return nil, pos + 4
  else
    -- Number
    local start = pos
    if c == '-' then pos = pos + 1 end
    while pos <= #s do
      local cc = s:sub(pos, pos)
      if cc:match('[0-9.eE+-]') then
        pos = pos + 1
      else
        break
      end
    end
    local num = tonumber(s:sub(start, pos - 1))
    return num, pos
  end
end

function json.decode(s)
  local val, _ = decode_value(s, 1)
  return val
end

return json
