# Floor Plans Fix

## Problem
Floor plans uploaded through the agent wizard appeared on the review page but were not visible when:
- Viewing the published listing
- Editing the listing later

## Root Cause
The system was saving floor plans in two places:
1. ✅ As JSON in the `unit_listings.floorPlans` field
2. ❌ As Media entries with type='DOCUMENT' and role='FLOORPLAN' (MISSING)

When displaying listings, the TraditionalViewer reads from the Media table, not the JSON field.

## Solution

### 1. Fixed API Endpoints
Updated both POST and PUT endpoints to create Media entries for floor plans:
- **POST** `/api/listings/route.ts`: Lines 220-233
- **PUT** `/api/listings/[id]/route.ts`: Lines 197-215

Now when creating or updating a listing, floor plans are stored as Media entries just like images and videos.

### 2. Migration Script
Created a migration script to fix existing listings that have floor plans stored only as JSON.

**Run the migration:**
```bash
node scripts/migrate_floorplans_to_media.mjs
```

This script will:
- Find all listings with floor plans in JSON format
- Check if Media entries already exist for each floor plan
- Create missing Media entries
- Skip duplicates to avoid data corruption

## Testing

### For New Listings
1. Upload a listing with floor plans
2. Publish the listing
3. View the listing → floor plans should appear
4. Edit the listing → floor plans should be loaded

### For Existing Listings
1. Run the migration script first
2. View any existing listing with floor plans
3. Floor plans should now appear

## Files Changed
- `src/app/listings/[id]/page.tsx` - Fixed prop name mismatch
- `src/app/listings/[id]/TraditionalViewer.tsx` - Added safety filters
- `src/app/api/listings/route.ts` - Added floor plan Media creation (POST)
- `src/app/api/listings/[id]/route.ts` - Added floor plan Media creation (PUT)
- `scripts/migrate_floorplans_to_media.ts` - Migration script (NEW)

## Status
✅ New listings will work correctly
✅ Editing listings will work correctly  
✅ Migration completed - 1 listing with floor plans migrated successfully

