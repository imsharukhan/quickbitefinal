from dotenv import load_dotenv
load_dotenv()

import asyncio
import os
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

# --- BCRYPT HACK ---
try:
    import bcrypt
    if not hasattr(bcrypt, "__about__"):
        class About: __version__ = getattr(bcrypt, "__version__", "4.0.1")
        bcrypt.__about__ = About
except: pass

db_url = os.environ.get("DATABASE_URL")
if db_url and db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql+asyncpg://", 1)

engine = create_async_engine(db_url)
SeedSession = async_sessionmaker(bind=engine, class_=AsyncSession)

from app.users.models import User
from app.vendors.models import Vendor
from app.outlets.models import Outlet
from app.auth.utils import hash_password

async def seed():
    async with SeedSession() as db:
        print("🛠️  STEP 1: Fixing Database Schema...")
        await db.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT TRUE"))
        await db.execute(text("ALTER TABLE vendors ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT TRUE"))
        await db.execute(text("ALTER TABLE users ALTER COLUMN email DROP NOT NULL"))
        await db.commit()
        print("✅ Schema fixed!")

        print("🚀 STEP 2: Seeding Vendors...")
        from sqlalchemy.future import select

        VENDORS = [
            {"phone": "9999999999", "name": "Dimora Central", "password": "dimora123", "outlet": "Dimora Central Outlet"},
            {"phone": "9000000002", "name": "Reenu Food Court", "password": "password123", "outlet": "Reenu Food Court Outlet"},
            {"phone": "9000000003", "name": "Bhojan Express", "password": "password123", "outlet": "Bhojan Express Outlet"},
        ]

        for v in VENDORS:
            res = await db.execute(select(Vendor).where(Vendor.phone == v["phone"]))
            existing_vendor = res.scalars().first()

            if existing_vendor:
                print(f"⏭️  {v['name']} already exists. Checking outlet...")
                outlet_res = await db.execute(select(Outlet).where(Outlet.vendor_id == existing_vendor.id))
                if outlet_res.scalars().first():
                    print(f"⏭️  Outlet already exists for {v['name']}.")
                    continue
                new_outlet = Outlet(vendor_id=existing_vendor.id, name=v["outlet"])
                db.add(new_outlet)
                await db.commit()
                print(f"✅ Outlet linked for existing vendor: {v['name']}")
                continue

            new_user = User(
                role="vendor",
                hashed_password=hash_password(v["password"]),
                is_verified=True, is_active=True
            )
            db.add(new_user)
            await db.flush()

            new_vendor = Vendor(user_id=new_user.id, phone=v["phone"], business_name=v["name"])
            db.add(new_vendor)
            await db.flush()

            new_outlet = Outlet(vendor_id=new_vendor.id, name=v["outlet"])
            db.add(new_outlet)
            await db.commit()
            print(f"✅ Successfully seeded: {v['name']} with outlet")

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(seed())