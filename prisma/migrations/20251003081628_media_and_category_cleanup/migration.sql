/*
  Warnings:

  - You are about to alter the column `lineItems` on the `buyer_selections` table. The data in that column could be lost. The data in that column will be cast from `String` to `Json`.

*/
-- AlterTable
ALTER TABLE "file_uploads" ADD COLUMN "usdFilePath" TEXT;

-- CreateTable
CREATE TABLE "export_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "unitId" TEXT NOT NULL,
    "userId" TEXT,
    "artifactCount" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "export_logs_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "property_units" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "export_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Media" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "type" TEXT NOT NULL,
    "role" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "url" TEXT NOT NULL,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "altText" TEXT,
    "caption" TEXT,
    "propertyId" TEXT,
    "unitId" TEXT,
    "uploadedById" TEXT,
    CONSTRAINT "Media_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Media_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "property_units" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Media_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_buyer_selections" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "unitId" TEXT NOT NULL,
    "userId" TEXT,
    "selections" JSONB NOT NULL,
    "priceTotal" REAL NOT NULL DEFAULT 0,
    "basePrice" REAL NOT NULL DEFAULT 0,
    "addonTotal" REAL NOT NULL DEFAULT 0,
    "lineItems" JSONB,
    "clientPrice" REAL,
    "priceDifference" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "buyer_selections_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "property_units" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_buyer_selections" ("addonTotal", "basePrice", "clientPrice", "createdAt", "id", "lineItems", "priceDifference", "priceTotal", "selections", "unitId", "updatedAt", "userId") SELECT "addonTotal", "basePrice", "clientPrice", "createdAt", "id", "lineItems", "priceDifference", "priceTotal", "selections", "unitId", "updatedAt", "userId" FROM "buyer_selections";
DROP TABLE "buyer_selections";
ALTER TABLE "new_buyer_selections" RENAME TO "buyer_selections";
CREATE TABLE "new_properties" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "address" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "bedrooms" INTEGER NOT NULL,
    "bathrooms" INTEGER NOT NULL,
    "squareFeet" INTEGER,
    "images" TEXT NOT NULL,
    "modelPath" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'RESIDENTIAL',
    CONSTRAINT "properties_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_properties" ("address", "bathrooms", "bedrooms", "createdAt", "description", "id", "images", "isActive", "modelPath", "price", "squareFeet", "title", "updatedAt", "userId") SELECT "address", "bathrooms", "bedrooms", "createdAt", "description", "id", "images", "isActive", "modelPath", "price", "squareFeet", "title", "updatedAt", "userId" FROM "properties";
DROP TABLE "properties";
ALTER TABLE "new_properties" RENAME TO "properties";
CREATE TABLE "new_unit_listings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "unitId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "address" TEXT,
    "city" TEXT,
    "bedrooms" INTEGER DEFAULT 0,
    "bathrooms" INTEGER DEFAULT 0,
    "areaSqm" REAL DEFAULT 0,
    "basePrice" REAL NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'ETB',
    "coverImage" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "unit_listings_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "property_units" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_unit_listings" ("address", "areaSqm", "basePrice", "bathrooms", "bedrooms", "city", "coverImage", "createdAt", "currency", "description", "id", "isPublished", "title", "unitId", "updatedAt") SELECT "address", "areaSqm", "basePrice", "bathrooms", "bedrooms", "city", "coverImage", "createdAt", coalesce("currency", 'ETB') AS "currency", "description", "id", "isPublished", "title", "unitId", "updatedAt" FROM "unit_listings";
DROP TABLE "unit_listings";
ALTER TABLE "new_unit_listings" RENAME TO "unit_listings";
CREATE UNIQUE INDEX "unit_listings_unitId_key" ON "unit_listings"("unitId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Media_propertyId_type_role_sortOrder_idx" ON "Media"("propertyId", "type", "role", "sortOrder");

-- CreateIndex
CREATE INDEX "Media_unitId_type_role_sortOrder_idx" ON "Media"("unitId", "type", "role", "sortOrder");
