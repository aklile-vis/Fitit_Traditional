-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    "has3D" BOOLEAN NOT NULL DEFAULT false,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "unit_listings_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "property_units" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_unit_listings" ("address", "areaSqm", "basePrice", "bathrooms", "bedrooms", "city", "coverImage", "createdAt", "currency", "description", "id", "isPublished", "title", "unitId", "updatedAt") SELECT "address", "areaSqm", "basePrice", "bathrooms", "bedrooms", "city", "coverImage", "createdAt", "currency", "description", "id", "isPublished", "title", "unitId", "updatedAt" FROM "unit_listings";
DROP TABLE "unit_listings";
ALTER TABLE "new_unit_listings" RENAME TO "unit_listings";
CREATE UNIQUE INDEX "unit_listings_unitId_key" ON "unit_listings"("unitId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
