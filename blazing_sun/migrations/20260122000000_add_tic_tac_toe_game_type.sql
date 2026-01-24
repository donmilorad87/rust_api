-- Add tic_tac_toe to valid game types
-- Drop the existing constraint and recreate with both game types

ALTER TABLE game_rooms DROP CONSTRAINT IF EXISTS valid_game_type;

ALTER TABLE game_rooms ADD CONSTRAINT valid_game_type
    CHECK (game_type IN ('bigger_dice', 'tic_tac_toe'));
