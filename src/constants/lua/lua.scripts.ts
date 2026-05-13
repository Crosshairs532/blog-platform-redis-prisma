// src/constants/lua/lua.scripts.ts
export const LOGIN_LUA = `
local user_sessions_key = KEYS[1]
local session_key = KEYS[2]
local user_id = ARGV[1]
local session_id = ARGV[2]
local device_info = ARGV[3]
local ip_address = ARGV[4]
local email = ARGV[5]
local max_sessions = tonumber(ARGV[6])
local access_token = ARGV[7]
local refresh_token = ARGV[8]
local session_prefix = ARGV[9]

local session_ids = redis.call('SMEMBERS', user_sessions_key)

-- Check for same device and remove old session
for i, sid in ipairs(session_ids) do
    local s_key = session_prefix .. sid
    if redis.call('HGET', s_key, 'deviceInfo') == device_info and 
       redis.call('HGET', s_key, 'ipAddress') == ip_address then
        redis.call('DEL', s_key)
        redis.call('SREM', user_sessions_key, sid)
    end
end

-- Refresh session list after potential deletion
session_ids = redis.call('SMEMBERS', user_sessions_key)

if #session_ids >= max_sessions then
    return {err = "MAX_SESSIONS"}
end

local time = redis.call('TIME')
local now = (time[1] * 1000) + math.floor(time[2] / 1000)

redis.call('HSET', session_key,
    'sessionId', session_id,
    'userId', user_id,
    'email', email,
    'accessToken', access_token,
    'refreshToken', refresh_token,
    'deviceInfo', device_info,
    'ipAddress', ip_address,
    'createdAt', now,
    'lastActivity', now,
    'isActive', 'true'
)
redis.call('EXPIRE', session_key, 604800) -- 7 Days
redis.call('SADD', user_sessions_key, session_id)

return {ok = "SUCCESS"}
`;
