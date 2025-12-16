from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "forge_db")

# Module-level client - cached for connection reuse in serverless environments
_client: AsyncIOMotorClient = None

def _get_client():
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(MONGO_URL)
    return _client

# The 'db' object used throughout the app - this is the actual database
# Lazy-initialized on first access
class _DatabaseProxy:
    """Proxy class that lazily initializes the MongoDB connection."""
    
    def __getattr__(self, name):
        client = _get_client()
        return getattr(client[DB_NAME], name)

db = _DatabaseProxy()

async def get_db():
    """Get the database instance."""
    return _get_client()[DB_NAME]

async def close_mongo_connection():
    """Close the MongoDB connection."""
    global _client
    if _client:
        _client.close()
        _client = None
