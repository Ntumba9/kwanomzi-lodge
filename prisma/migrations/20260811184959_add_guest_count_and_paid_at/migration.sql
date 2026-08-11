-- AlterTable
ALTER TABLE `booking` ADD COLUMN `guestCount` INTEGER NULL;

-- AlterTable
ALTER TABLE `payment` ADD COLUMN `paidAt` DATETIME(3) NULL;
