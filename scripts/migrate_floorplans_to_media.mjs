/**
 * Migration script to convert floor plans from JSON storage to Media entries
 * This ensures floor plans appear correctly when viewing and editing listings
 * 
 * Usage: node scripts/migrate_floorplans_to_media.mjs
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function migrateFloorPlans() {
  console.log('Starting floor plans migration...')
  
  try {
    // Find all listings with floor plans in JSON format
    const listings = await prisma.unitListing.findMany({
      where: {
        floorPlans: {
          not: null
        }
      },
      include: {
        unit: {
          include: {
            media: true
          }
        }
      }
    })
    
    console.log(`Found ${listings.length} listings with floor plans`)
    
    let migrated = 0
    let skipped = 0
    
    for (const listing of listings) {
      try {
        // Parse floor plans from JSON
        const floorPlansJson = listing.floorPlans
        let floorPlans = []
        
        if (typeof floorPlansJson === 'string') {
          try {
            floorPlans = JSON.parse(floorPlansJson)
          } catch (e) {
            console.warn(`Failed to parse floor plans for listing ${listing.id}`)
            continue
          }
        } else if (Array.isArray(floorPlansJson)) {
          floorPlans = floorPlansJson
        }
        
        if (!Array.isArray(floorPlans) || floorPlans.length === 0) {
          skipped++
          continue
        }
        
        // Check if media entries already exist
        const existingFloorPlanMedia = listing.unit?.media?.filter(
          (m) => m.type === 'DOCUMENT' && m.role === 'FLOORPLAN'
        ) || []
        
        const existingUrls = new Set(existingFloorPlanMedia.map((m) => m.url))
        
        // Filter out floor plans that already have media entries
        const newFloorPlans = floorPlans.filter(url => 
          typeof url === 'string' && url && !existingUrls.has(url)
        )
        
        if (newFloorPlans.length === 0) {
          skipped++
          console.log(`  Listing ${listing.id}: All floor plans already migrated`)
          continue
        }
        
        // Create media entries for floor plans
        const mediaEntries = newFloorPlans.map((url, index) => ({
          type: 'DOCUMENT',
          role: 'FLOORPLAN',
          url: url,
          sortOrder: existingFloorPlanMedia.length + index,
          unitId: listing.unitId,
          uploadedById: null, // Will be null for migrated entries
        }))
        
        await prisma.media.createMany({
          data: mediaEntries
        })
        
        migrated++
        console.log(`  ✓ Listing ${listing.id}: Migrated ${newFloorPlans.length} floor plan(s)`)
      } catch (error) {
        console.error(`  ✗ Error processing listing ${listing.id}:`, error)
      }
    }
    
    console.log('\nMigration complete!')
    console.log(`  Migrated: ${migrated} listings`)
    console.log(`  Skipped: ${skipped} listings`)
  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Run migration
migrateFloorPlans()
  .then(() => {
    console.log('\n✓ Migration successful!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n✗ Migration failed:', error)
    process.exit(1)
  })

