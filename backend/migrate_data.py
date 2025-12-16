import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

# Configuration
SOURCE_URI = os.getenv("MONGO_URL_SOURCE", "mongodb://localhost:27017")
DEST_URI = os.getenv("MONGO_URL_DEST") # Must be provided
DB_NAME = os.getenv("DB_NAME", "forge_db")

async def migrate():
    print(f"🚀 Starting migration...")
    print(f"ℹ️ using DB_NAME: {DB_NAME}")
    
    if not DEST_URI:
        print("❌ Error: MONGO_URL_DEST environment variable is missing.")
        return

    # Connect to Source
    print(f"Connecting to source: {SOURCE_URI}...")
    source_client = AsyncIOMotorClient(SOURCE_URI)
    source_db = source_client[DB_NAME]
    
    # Connect to Destination
    print(f"Connecting to destination...")
    dest_client = AsyncIOMotorClient(DEST_URI)
    dest_db = dest_client[DB_NAME]
    
    # Get all collection names
    collections = await source_db.list_collection_names()
    print(f"Found collections: {collections}")
    
    for col_name in collections:
        print(f"📦 Migrating collection: {col_name}")
        source_col = source_db[col_name]
        dest_col = dest_db[col_name]
        
        # Count documents
        count = await source_col.count_documents({})
        if count == 0:
            print(f"   Skipping empty collection: {col_name}")
            continue
            
        print(f"   Copying {count} documents...")
        
        # Read all documents
        cursor = source_col.find({})
        batch = []
        batch_size = 100
        
        async for doc in cursor:
            batch.append(doc)
            if len(batch) >= batch_size:
                # Upsert to prevent duplicates if running multiple times
                for d in batch:
                    await dest_col.replace_one({"_id": d["_id"]}, d, upsert=True)
                print(f"   - Migrated {len(batch)} documents...")
                batch = []
                
        # Remaining
        if batch:
            for d in batch:
                await dest_col.replace_one({"_id": d["_id"]}, d, upsert=True)
            print(f"   - Migrated remaining {len(batch)} documents.")
            
        print(f"✅ Collection {col_name} migrated.")

    print("🎉 Migration completed successfully!")
    source_client.close()
    dest_client.close()

if __name__ == "__main__":
    asyncio.run(migrate())
