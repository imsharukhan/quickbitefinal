import asyncio
import os
from dotenv import dotenv_values
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.future import select

# ---------------------------------------------------------
# 1. BULLETPROOF ENV LOADER (Bypasses app.config entirely)
# ---------------------------------------------------------
# Look exactly in the current folder for the .env
current_dir = os.path.dirname(os.path.abspath(__file__))
env_file = os.path.join(current_dir, ".env")

# Parse the file manually
env_config = dotenv_values(env_file)
db_url = env_config.get("DATABASE_URL")

if not db_url:
    print("❌ ERROR: Could not find DATABASE_URL in your .env file.")
    exit(1)

# Apply the same God-Level interceptor for Railway/Neon asyncpg format
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql+asyncpg://", 1)
elif db_url.startswith("postgresql://") and "asyncpg" not in db_url:
    db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)

# Safely print the host we are connecting to (hiding the password)
safe_url_print = db_url.split("@")[-1] if "@" in db_url else "Local DB"
print(f"🔌 Attempting connection to host: {safe_url_print}")

# ---------------------------------------------------------
# 2. STANDALONE DATABASE ENGINE
# ---------------------------------------------------------
engine = create_async_engine(db_url, echo=False)
SeedSession = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

# ---------------------------------------------------------
# 3. IMPORTS (Loaded AFTER environment is secured)
# ---------------------------------------------------------
from app.users.models import User
from app.vendors.models import Vendor
from app.auth.utils import hash_password

# The 3 Official Campus Canteens
VENDORS_TO_SEED = [
    {"phone": "9000000001", "name": "Dimora Central", "password": "password123"},
    {"phone": "9000000002", "name": "Reenu Food Court", "password": "password123"},
    {"phone": "9000000003", "name": "Bhojan Express", "password": "password123"},
]

async def seed():
    print("🚀 Starting Vendor Seed Process...")
    
    async with SeedSession() as db:
        for v_data in VENDORS_TO_SEED:
            
            # Check if vendor already exists
            stmt = select(Vendor).where(Vendor.phone == v_data["phone"])
            result = await db.execute(stmt)
            existing_vendor = result.scalars().first()

            if existing_vendor:
                print(f"⏭️  Vendor {v_data['name']} already exists. Skipping.")
                continue

            print(f"⏳ Creating User profile for {v_data['name']}...")
            new_user = User(
                role="vendor",
                hashed_password=hash_password(v_data["password"]),
                is_verified=True,  
                is_active=True,
                must_change_password=True 
            )
            db.add(new_user)
            await db.flush() 

            new_vendor = Vendor(
                user_id=new_user.id,
                phone=v_data["phone"],
                business_name=v_data["name"],
                must_change_password=True
            )
            db.add(new_vendor)
            
            await db.commit() 
            print(f"✅ Successfully seeded: {v_data['name']} ({v_data['phone']})")
            
    print("🎉 Seed Process Complete!")
    await engine.dispose() # Clean up connection

if __name__ == "__main__":
    asyncio.run(seed())