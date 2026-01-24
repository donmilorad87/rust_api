-- Add auto_players column to game_rooms table
-- This stores the list of player IDs that are auto-controlled (disconnected + kicked)
ALTER TABLE game_rooms
ADD COLUMN IF NOT EXISTS auto_players BIGINT[] NOT NULL DEFAULT '{}';

-- Add comment for documentation
COMMENT ON COLUMN game_rooms.auto_players IS 'List of player IDs that are auto-controlled (disconnected/kicked players)';
