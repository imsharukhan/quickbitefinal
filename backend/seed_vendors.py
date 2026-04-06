import asyncio
import os
import sys
from dotenv import dotenv_values
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.future import select

# --- SENIOR DEV HACK FOR BCRYPT BUG ---
# This fixes the AttributeError: module 'bcrypt' has no attribute '__about__'
try:
    import bcrypt
    if not hasattr(bcrypt, "__about__"):
        class About: __version__ = getattr(bcrypt, "__version__", "4.0.1")
        bcrypt.__about__ = About
except ImportError:
    pass
# --------------------------------------

current_dir = os.path.dirname(os.path.abspath(__file__))
env_file = os.path.join(current_dir, ".env")
env_config = dotenv_values(env_file)
db_url = env_config.get("DATABASE_URL")

if not db_url:
    # On Railway, the DATABASE_URL is an environment variable, not always in .env
    db_url = os.environ.get("DATABASE_URL")

if not db_url:
    print("❌ ERROR: DATABASE_URL not found in .env or Environment Variables.")
    sys.exit(1)

# Fix for asyncpg
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql+asyncpg://", 1)
elif "asyncpg" not in db_url:
    db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)

engine = create_async_engine(db_url, echo=False)
SeedSession = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

from app.users.models import User
from app.vendors.models import Vendor
from app.auth.utils import hash_password

VENDORS_TO_SEED = [
    {"phone": "9000000001", "name": "Dimora Central", "password": "password123"},
    {"phone": "9000000002", "name": "Reenu Food Court", "password": "password123"},
    {"phone": "9000000003", "name": "Bhojan Express", "password": "password123"},
]

async def seed():
    print(f"🔌 Connecting to: {db_url.split('@')[-1]}")
    print("🚀 Starting Vendor Seed Process...")
    
    async with SeedSession() as db:
        for v_data in VENDORS_TO_SEED:
            stmt = select(Vendor).where(Vendor.phone == v_data["phone"])
            result = await db.execute(stmt)
            if result.scalars().first():
                print(f"⏭️  {v_data['name']} exists. Skipping.")
                continue

            print(f"⏳ Hashing password and creating {v_data['name']}...")
            new_user = User(
                role="vendor",
                hashed_password=hash_password(v_data["password"]),
                is_verified=True, is_active=True, must_change_password=True 
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
            print(f"✅ Success: {v_data['name']}")
            
    print("🎉 SEEDING COMPLETE!")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(seed())