-- Widen `user`.`role` to the full staff role set, safely migrating any
-- existing 'ADMIN' rows to 'OWNER' rather than dropping the old value out
-- from under them in one step (which would leave those rows referencing an
-- enum value that no longer exists).
ALTER TABLE `user`
  MODIFY COLUMN `role` ENUM('ADMIN', 'OWNER', 'MANAGER', 'RECEPTION', 'HOUSEKEEPING', 'READ_ONLY') NOT NULL DEFAULT 'READ_ONLY';

UPDATE `user` SET `role` = 'OWNER' WHERE `role` = 'ADMIN';

ALTER TABLE `user`
  MODIFY COLUMN `role` ENUM('OWNER', 'MANAGER', 'RECEPTION', 'HOUSEKEEPING', 'READ_ONLY') NOT NULL DEFAULT 'READ_ONLY';

-- Last-login tracking, shown on the staff list.
ALTER TABLE `user` ADD COLUMN `lastLoginAt` DATETIME(3) NULL;

-- Housekeeping/front-desk operational status per room, independent of
-- booking-derived occupancy — see schema.prisma's RoomOperationalStatus doc.
ALTER TABLE `room` ADD COLUMN `operationalStatus` ENUM('AVAILABLE', 'OCCUPIED', 'CLEANING', 'MAINTENANCE') NOT NULL DEFAULT 'AVAILABLE';
