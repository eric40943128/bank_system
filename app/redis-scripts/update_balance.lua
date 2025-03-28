local userKey = KEYS[1]
local amount  = tonumber(ARGV[1]) -- 直接使用已轉換的分數值
local balance = tonumber(redis.call('HGET', userKey, 'balance_cents')) or 0
-- 檢查餘額
if balance + amount  < 0 then
    return { -1 }
end
-- 更新餘額 (直接操作整數分)
balance = redis.call('HINCRBY', userKey, 'balance_cents', amount)
-- 更新opId（遞增）
local opId = tonumber(redis.call('HINCRBY', userKey, 'opId', 1))

return { balance, opId }
