-- Distinguish genuine lodge photographs from temporary licensed stock
-- photos standing in for ones not supplied yet, so they're never confused
-- and STOCK rows can be found and swapped out later without guessing.
ALTER TABLE `room_image`
  ADD COLUMN `source` ENUM('LODGE', 'STOCK') NOT NULL DEFAULT 'LODGE',
  ADD COLUMN `attribution` TEXT NULL;
