-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "properties" (
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
    CONSTRAINT "properties_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PROCESSING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    "propertyId" TEXT,
    CONSTRAINT "projects_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "projects_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "file_uploads" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UPLOADED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "processedFilePath" TEXT,
    "ifcFilePath" TEXT,
    "glbFilePath" TEXT,
    "errorMessage" TEXT,
    CONSTRAINT "file_uploads_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "file_uploads_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "material_libraries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "ownerId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "material_libraries_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "material_options" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "description" TEXT,
    "baseColorHex" TEXT,
    "roughness" REAL DEFAULT 0.8,
    "albedoUrl" TEXT,
    "normalUrl" TEXT,
    "roughnessMapUrl" TEXT,
    "metallicMapUrl" TEXT,
    "aoMapUrl" TEXT,
    "tilingScale" REAL DEFAULT 1.0,
    "metallic" REAL DEFAULT 0,
    "libraryId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "material_options_libraryId_fkey" FOREIGN KEY ("libraryId") REFERENCES "material_libraries" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "property_units" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "fileUploadId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "editorState" JSONB,
    "editorStatePath" TEXT,
    CONSTRAINT "property_units_fileUploadId_fkey" FOREIGN KEY ("fileUploadId") REFERENCES "file_uploads" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "buyer_selections" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "unitId" TEXT NOT NULL,
    "userId" TEXT,
    "selections" JSONB NOT NULL,
    "priceTotal" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "buyer_selections_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "property_units" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "unit_listings" (
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
    "coverImage" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "unit_listings_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "property_units" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "unit_material_whitelist" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "unitId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "overridePrice" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "unit_material_whitelist_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "property_units" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "unit_material_whitelist_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "material_options" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "asset_categories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "parentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "asset_categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "asset_categories" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" TEXT NOT NULL,
    "previewUrl" TEXT,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "assets_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "asset_categories" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "asset_variants" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "lodLevel" TEXT,
    "modelPath" TEXT,
    "thumbnailUrl" TEXT,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "asset_variants_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "material_profiles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "materialType" TEXT,
    "albedoPath" TEXT,
    "normalPath" TEXT,
    "roughnessPath" TEXT,
    "metallicPath" TEXT,
    "aoPath" TEXT,
    "displacementPath" TEXT,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "asset_variant_materials" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assetVariantId" TEXT NOT NULL,
    "materialProfileId" TEXT NOT NULL,
    "usage" TEXT,
    "uvScale" REAL,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "asset_variant_materials_assetVariantId_fkey" FOREIGN KEY ("assetVariantId") REFERENCES "asset_variants" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "asset_variant_materials_materialProfileId_fkey" FOREIGN KEY ("materialProfileId") REFERENCES "material_profiles" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "room_style_presets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "roomType" TEXT,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "room_style_preset_materials" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "presetId" TEXT NOT NULL,
    "materialProfileId" TEXT NOT NULL,
    "targetCategory" TEXT NOT NULL,
    "priority" INTEGER DEFAULT 0,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "room_style_preset_materials_presetId_fkey" FOREIGN KEY ("presetId") REFERENCES "room_style_presets" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "room_style_preset_materials_materialProfileId_fkey" FOREIGN KEY ("materialProfileId") REFERENCES "material_profiles" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "room_style_preset_assets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "presetId" TEXT NOT NULL,
    "assetVariantId" TEXT NOT NULL,
    "placement" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "room_style_preset_assets_presetId_fkey" FOREIGN KEY ("presetId") REFERENCES "room_style_presets" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "room_style_preset_assets_assetVariantId_fkey" FOREIGN KEY ("assetVariantId") REFERENCES "asset_variants" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "unit_listings_unitId_key" ON "unit_listings"("unitId");

-- CreateIndex
CREATE UNIQUE INDEX "unit_material_whitelist_unitId_optionId_key" ON "unit_material_whitelist"("unitId", "optionId");

-- CreateIndex
CREATE UNIQUE INDEX "asset_categories_slug_key" ON "asset_categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "assets_slug_key" ON "assets"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "material_profiles_slug_key" ON "material_profiles"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "asset_variant_materials_assetVariantId_materialProfileId_usage_key" ON "asset_variant_materials"("assetVariantId", "materialProfileId", "usage");

-- CreateIndex
CREATE UNIQUE INDEX "room_style_presets_slug_key" ON "room_style_presets"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "room_style_preset_materials_presetId_targetCategory_key" ON "room_style_preset_materials"("presetId", "targetCategory");
