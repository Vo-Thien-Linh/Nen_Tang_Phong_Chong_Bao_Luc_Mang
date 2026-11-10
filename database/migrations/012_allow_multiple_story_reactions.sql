-- Migration 012: Cho phép người dùng thả nhiều loại cảm xúc / nhiều lần cho một tin (tương tự Facebook Stories)
ALTER TABLE story_reactions DROP CONSTRAINT IF EXISTS unique_story_reaction;
ALTER TABLE story_reactions DROP CONSTRAINT IF EXISTS story_reactions_story_id_user_id_key;
DROP INDEX IF EXISTS unique_story_reaction;
DROP INDEX IF EXISTS story_reactions_story_id_user_id_key;
