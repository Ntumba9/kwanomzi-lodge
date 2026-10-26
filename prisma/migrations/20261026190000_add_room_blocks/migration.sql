-- CreateTable
CREATE TABLE `room_block` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `startDate` DATE NOT NULL,
    `endDate` DATE NOT NULL,
    `reason` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `roomId` INTEGER NOT NULL,

    INDEX `room_block_roomId_idx`(`roomId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `room_block_night` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `stayDate` DATE NOT NULL,
    `roomBlockId` INTEGER NOT NULL,
    `roomId` INTEGER NOT NULL,

    INDEX `room_block_night_roomBlockId_idx`(`roomBlockId`),
    UNIQUE INDEX `room_block_night_roomId_stayDate_key`(`roomId`, `stayDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `room_block` ADD CONSTRAINT `room_block_roomId_fkey` FOREIGN KEY (`roomId`) REFERENCES `room`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `room_block_night` ADD CONSTRAINT `room_block_night_roomBlockId_fkey` FOREIGN KEY (`roomBlockId`) REFERENCES `room_block`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `room_block_night` ADD CONSTRAINT `room_block_night_roomId_fkey` FOREIGN KEY (`roomId`) REFERENCES `room`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
