"""
Password Reset Script for Forge AI
Run this to reset your password directly in the database.
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from dotenv import load_dotenv
import os

load_dotenv()

# Password hashing (same as your auth.py)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Config
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "forge_db")

async def reset_password():
    # ==========================================
    #  EDIT THESE VALUES
    # ==========================================
    YOUR_EMAIL = "mpitaval07@gmail.com"
    NEW_PASSWORD = "caca"  # <-- Put your new password here
    # ==========================================
    
    if YOUR_EMAIL == "YOUR_EMAIL_HERE":
        print("❌ Please edit this script first!")
        print("   Set YOUR_EMAIL and NEW_PASSWORD variables.")
        return
    
    print(f"🔌 Connecting to database...")
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Find the user
    user = await db.users.find_one({"email": YOUR_EMAIL})
    
    if not user:
        print(f"❌ No user found with email: {YOUR_EMAIL}")
        client.close()
        return
    
    print(f"✅ Found user: {user['email']}")
    
    # Hash the new password
    new_hash = pwd_context.hash(NEW_PASSWORD)
    
    # Update the password
    await db.users.update_one(
        {"email": YOUR_EMAIL},
        {"$set": {"password_hash": new_hash}}
    )
    
    print(f"🎉 Password reset successfully!")
    print(f"   You can now log in with your new password.")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(reset_password())
