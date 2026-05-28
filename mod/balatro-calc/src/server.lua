-- Non-blocking HTTP server on localhost.
-- Uses luasocket's TCP server with settimeout(0) for non-blocking accept.
-- Called every frame via Game.update hook.
-- Handles one connection per tick (adequate for 300ms polling).

local json = nil  -- Injected after module load

local server = {}
local tcp_server = nil
local collector_fn = nil
local command_dispatch = nil

-- ─── HTTP response builder ─────────────────────────────────────────

local function build_response(status_code, body, content_type)
  local status_text = 'OK'
  if status_code == 400 then status_text = 'Bad Request'
  elseif status_code == 404 then status_text = 'Not Found'
  elseif status_code == 405 then status_text = 'Method Not Allowed'
  elseif status_code == 500 then status_text = 'Internal Server Error'
  end

  content_type = content_type or 'application/json'

  local headers = {
    'HTTP/1.1 ' .. tostring(status_code) .. ' ' .. status_text,
    'Content-Type: ' .. content_type .. '; charset=utf-8',
    'Content-Length: ' .. tostring(#body),
    'Access-Control-Allow-Origin: *',
    'Access-Control-Allow-Methods: GET, POST, OPTIONS',
    'Access-Control-Allow-Headers: Content-Type',
    'Connection: close',
    '',
    '',
  }

  return table.concat(headers, '\r\n') .. body
end

local function json_response(status_code, data)
  local body = json.encode(data)
  return build_response(status_code, body, 'application/json')
end

local function error_response(status_code, message)
  return json_response(status_code, { status = 'error', message = message })
end

-- ─── HTTP request parser ───────────────────────────────────────────

local function parse_request(client)
  client:settimeout(0.01)  -- Short timeout for reading

  -- Read request line: "GET /api/health HTTP/1.1"
  local line, err = client:receive('*l')
  if not line then return nil, nil, nil, nil end

  local method, path = line:match('^(%a+) (/%S*) HTTP/')
  if not method then
    method, path = line:match('^(%a+) (/%S*)')
  end
  if not method then return nil, nil, nil, nil end

  -- Read headers
  local headers = {}
  local content_length = 0
  while true do
    local header_line, _ = client:receive('*l')
    if not header_line or header_line == '' or header_line == '\r' then break end
    local key, val = header_line:match('^([%w%-]+):%s*(.*)')
    if key then
      headers[key:lower()] = val
      if key:lower() == 'content-length' then
        content_length = tonumber(val) or 0
      end
    end
  end

  -- Read body if Content-Length > 0
  local body = ''
  if content_length > 0 then
    body, err = client:receive(content_length)
  end

  return method, path, body, headers
end

-- ─── Route handlers ────────────────────────────────────────────────

local function handle_health()
  return json_response(200, { status = 'ok' })
end

local function handle_state()
  if not collector_fn then
    return error_response(500, 'Collector not initialized')
  end

  local ok, result = pcall(collector_fn)
  if not ok then
    return error_response(500, 'Failed to collect game state: ' .. tostring(result))
  end

  return build_response(200, json.encode(result), 'application/json')
end

local function handle_command(body)
  if not body or body == '' then
    return error_response(400, 'Empty request body')
  end

  local cmd = json.decode(body)
  if not cmd or not cmd.type then
    return error_response(400, 'Invalid command: missing type field')
  end

  local ok, msg = command_dispatch(cmd.type, cmd.payload)
  if ok then
    return json_response(200, { status = 'ok' })
  else
    return error_response(400, msg or 'Unknown error')
  end
end

local function handle_preflight()
  return build_response(
    200,
    '',
    'text/plain'
  ):gsub('Access%-Control%-Allow%-Origin: %*',
        'Access-Control-Allow-Origin: *\r\n' ..
        'Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n' ..
        'Access-Control-Allow-Headers: Content-Type\r\n')
end

local function route_and_handle(method, path, body)
  -- CORS preflight
  if method == 'OPTIONS' then
    return handle_preflight()
  end

  -- GET /api/health
  if method == 'GET' and path == '/api/health' then
    return handle_health()
  end

  -- GET /api/state
  if method == 'GET' and path == '/api/state' then
    return handle_state()
  end

  -- POST /api/command
  if method == 'POST' and path == '/api/command' then
    return handle_command(body)
  end

  return error_response(404, 'Not found: ' .. (method or '?') .. ' ' .. (path or '/'))
end

-- ─── Socket raw response helper ────────────────────────────────────

-- luasocket receive can return nil,"timeout" on timeout
local function safe_send(client, data)
  local ok, err = pcall(function()
    local sent = 0
    local total = #data
    while sent < total do
      local n, send_err = client:send(string.sub(data, sent + 1))
      if n then
        sent = sent + n
      elseif send_err == 'timeout' then
        -- retry
      else
        error(send_err or 'send failed')
      end
    end
  end)
  return ok, err
end

-- ─── Public API ────────────────────────────────────────────────────

function server:start(port, collector, commands)
  if not socket then
    return false, 'luasocket not available'
  end

  collector_fn = collector
  command_dispatch = commands

  local ok, err = pcall(function()
    tcp_server = socket.tcp()
    tcp_server:setoption('reuseaddr', true)
    tcp_server:bind('127.0.0.1', port)
    tcp_server:listen(8)
    tcp_server:settimeout(0)  -- Non-blocking
  end)

  if not ok then
    tcp_server = nil
    return false, err
  end

  return true
end

function server:tick()
  if not tcp_server then return end

  local client, err = tcp_server:accept()
  if not client then return end  -- No connection pending

  -- Process one connection
  local ok = pcall(function()
    local method, path, body = parse_request(client)
    if method then
      local response = route_and_handle(method, path, body)
      safe_send(client, response)
    end
  end)

  local close_ok = pcall(function() client:close() end)
  if not (ok and close_ok) then
    -- Silently ignore errors from individual connections
  end
end

function server:stop()
  if tcp_server then
    pcall(function() tcp_server:close() end)
    tcp_server = nil
  end
end

return server
