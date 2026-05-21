import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from datetime import datetime, timezone

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
MONGO_DATABASE = os.getenv("MONGO_DATABASE")

async def seed():
    print(f"Connecting to MongoDB at {MONGO_URI}...")
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[MONGO_DATABASE]
    now = datetime.now(timezone.utc)
    
    # Create two users
    user_a_id = "user_demo_a"
    user_b_id = "user_demo_b"
    
    await db.users.delete_one({"id": user_a_id})
    await db.users.delete_one({"id": user_b_id})
    
    await db.users.update_one(
        {"id": user_a_id},
        {"$set": {
            "id": user_a_id,
            "username": "demo_user_a",
            "email": "demo-a@example.com",
            "phone": "+8613800000001",
            "password_hash": "seed_fake_hash",
            "is_active": True,
            "email_verified_at": now,
            "phone_verified_at": now,
            "nickname": "Test User A",
            "created_at": now,
            "updated_at": now
        }},
        upsert=True
    )
    
    await db.users.update_one(
        {"id": user_b_id},
        {"$set": {
            "id": user_b_id,
            "username": "demo_user_b",
            "email": "demo-b@example.com",
            "phone": "+8613800000002",
            "password_hash": "seed_fake_hash",
            "is_active": True,
            "email_verified_at": now,
            "phone_verified_at": now,
            "nickname": "Test User B",
            "created_at": now,
            "updated_at": now
        }},
        upsert=True
    )
    
    # Create a space for them
    space_id = "space_demo_ab"
    
    await db.spaces.delete_one({"id": space_id})
    
    await db.spaces.update_one(
        {"id": space_id},
        {"$set": {
            "id": space_id,
            "member_ids": [user_a_id, user_b_id],
            "members": [
                {
                    "user_id": user_a_id,
                    "joined_at": now,
                    "role": "INITIATOR"
                },
                {
                    "user_id": user_b_id,
                    "joined_at": now,
                    "role": "INVITEE"
                }
            ],
            "agent_profile": {
                "name": "Ami",
                "tone": "empathetic_and_humorous"
            },
            "status": "ACTIVE",
            "created_at": now,
            "updated_at": now
        }},
        upsert=True
    )
    
    print(f"Seed completed successfully!")
    print(f"=============================")
    print(f"User A ID: {user_a_id}")
    print(f"User B ID: {user_b_id}")
    print(f"Space ID: {space_id}")
    print(f"=============================")
    print(f"Update your Amiapp/.env with these:")
    print(f"EXPO_PUBLIC_AMI_ACCESS_TOKEN=demo_token_a")
    print(f"EXPO_PUBLIC_AMI_SPACE_ID={space_id}")
    print(f"=============================")
    print(f"Please make sure to add this to Amiend/.env:")
    print(f"STATIC_ACCESS_TOKENS=demo_token_a:user_demo_a,demo_token_b:user_demo_b")

if __name__ == "__main__":
    asyncio.run(seed())
