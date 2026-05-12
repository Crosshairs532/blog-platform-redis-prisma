export const LOGIN_LUA = `
local user_sessions_key = KEYS[1]
local user_id = ARGV[1]
local session_id = ARGV[2]
local device_info = ARGV[3]
local ip_address = ARGV[4]
local email = ARGV[5]
local max_sessions = tonumber(ARGV[6])

-- Get all existing session IDs
local session_ids = redis.call('SMEMBERS', user_sessions_key)
local existing_session_id = nil

-- Check for same device+IP and remove old session
for i, sid in ipairs(session_ids) do
    local session_key = 'session:' .. sid
    local device = redis.call('HGET', session_key, 'deviceInfo')
    local ip = redis.call('HGET', session_key, 'ipAddress')
    if device == device_info and ip == ip_address then
        existing_session_id = sid
        redis.call('DEL', session_key)
        redis.call('SREM', user_sessions_key, sid)
        session_ids[i] = nil
        break
    end
end

-- Clean nil entries from session_ids table
local new_session_ids = {}
for _, sid in ipairs(session_ids) do
    if sid then
        table.insert(new_session_ids, sid)
    end
end
session_ids = new_session_ids

-- Check max session limit
if #session_ids >= max_sessions then
    return {err = "MAX_SESSIONS"}
end

-- Get current time in milliseconds
local time_parts = redis.call('TIME')
local now_ms = time_parts[1] * 1000 + math.floor(time_parts[2] / 1000)

-- Create new session hash
local session_hash_key = 'session:' .. session_id
redis.call('HSET', session_hash_key,
    'sessionId', session_id,
    'userId', user_id,
    'email', email,
    'accessToken', access_token,
    'refreshToken', refresh_token,
    'deviceInfo', device_info,
    'ipAddress', ip_address,
    'createdAt', now_ms,
    'lastActivity', now_ms,
    'isActive', 'true'
)
redis.call('EXPIRE', session_hash_key, 3600) -- 7 days

-- Add new session ID to user's session set
redis.call('SADD', user_sessions_key, session_id)

return {ok = "SUCCESS"}

`;
