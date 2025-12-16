from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "forge_db")

class Database:
    client: AsyncIOMotorClient = None

db = Database()

async def get_db_client():
    if db.client is None:
        db.client = AsyncIOMotorClient(MONGO_URL)
    return db.client

async def get_db():
    if db.client is None:
        db.client = AsyncIOMotorClient(MONGO_URL)
    return db.client[DB_NAME]

async def close_mongo_connection():
    if db.client:
        db.client.close()
        db.client = None

