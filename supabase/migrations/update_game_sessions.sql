-- Add new columns to game_sessions for the DailySessionScreen state machine

ALTER TABLE game_sessions
ADD COLUMN mood_reported TEXT,
ADD COLUMN did_breathing_exercise BOOLEAN DEFAULT FALSE,
ADD COLUMN loops_completed INTEGER DEFAULT 1;
