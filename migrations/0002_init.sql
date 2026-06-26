-- Speeds up the access-control subquery: WHERE user_id = $N in resource_shares
CREATE INDEX IF NOT EXISTS idx_resource_shares_user_id ON resource_shares(user_id);