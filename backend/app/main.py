from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timezone
from app.payments.router import router as payments_router
from app.config import settings
from app.database import create_tables
from app.users.models import User, Student
from app.vendors.models import Vendor
from app.outlets.models import Outlet
from app.menu.models import MenuItem
from app.orders.models import Order, OrderItem, Rating
from app.notifications.models import Notification
from app.auth.utils import hash_password
from sqlalchemy.future import select


async def seed_data():
    from app.database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        try:
            # ── Vendor 1 - Dimora ──────────────────────────────────────
            stmt = select(User).where(User.email == "dimora@test.com")
            result = await db.execute(stmt)
            dimora_user = result.scalars().first()
            if not dimora_user:
                dimora_user = User(
                    email="dimora@test.com",
                    role="vendor",
                    hashed_password=hash_password("dimora123"),
                    is_active=True, is_verified=True, must_change_password=True,
                )
                db.add(dimora_user)
                await db.commit()
                await db.refresh(dimora_user)
                print("✅ Vendor Dimora user seeded.")

            stmt = select(Vendor).where(Vendor.phone == "9999999999")
            result = await db.execute(stmt)
            dimora_vendor = result.scalars().first()
            if not dimora_vendor:
                dimora_vendor = Vendor(user_id=dimora_user.id, phone="9999999999", business_name="Dimora Central")
                db.add(dimora_vendor)
                await db.commit()
                await db.refresh(dimora_vendor)

            # ── Outlet for Dimora ──────────────────────────────────────
            stmt = select(Outlet).where(Outlet.vendor_id == dimora_vendor.id)
            result = await db.execute(stmt)
            if not result.scalars().first():
                db.add(Outlet(
                    vendor_id=dimora_vendor.id,
                    name="Dimora Central", description="Main Academic Block",
                    is_open=True, rating=0.0, opening_time="08:00", closing_time="20:00", slot_duration_minutes=15
                ))
                await db.commit()
                print("✅ Outlet Dimora seeded.")

            # ── Vendor 2 - Reenu ───────────────────────────────────────
            stmt = select(User).where(User.email == "reenu@test.com")
            result = await db.execute(stmt)
            reenu_user = result.scalars().first()
            if not reenu_user:
                reenu_user = User(
                    email="reenu@test.com",
                    role="vendor",
                    hashed_password=hash_password("reenu123"),
                    is_active=True, is_verified=True, must_change_password=True,
                )
                db.add(reenu_user)
                await db.commit()
                await db.refresh(reenu_user)

            stmt = select(Vendor).where(Vendor.phone == "8888888888")
            result = await db.execute(stmt)
            reenu_vendor = result.scalars().first()
            if not reenu_vendor:
                reenu_vendor = Vendor(user_id=reenu_user.id, phone="8888888888", business_name="Reenu")
                db.add(reenu_vendor)
                await db.commit()
                await db.refresh(reenu_vendor)

            # ── Outlet for Reenu ───────────────────────────────────────
            stmt = select(Outlet).where(Outlet.vendor_id == reenu_vendor.id)
            result = await db.execute(stmt)
            if not result.scalars().first():
                db.add(Outlet(
                    vendor_id=reenu_vendor.id,
                    name="Reenu Food Court", description="Near Library",
                    is_open=True, rating=0.0, opening_time="08:00", closing_time="20:00", slot_duration_minutes=15
                ))
                await db.commit()
                print("✅ Outlet Reenu seeded.")

            # ── Vendor 3 - Bhojan ──────────────────────────────────────
            stmt = select(User).where(User.email == "bhojan@test.com")
            result = await db.execute(stmt)
            bhojan_user = result.scalars().first()
            if not bhojan_user:
                bhojan_user = User(
                    email="bhojan@test.com",
                    role="vendor",
                    hashed_password=hash_password("bhojan123"),
                    is_active=True, is_verified=True, must_change_password=True,
                )
                db.add(bhojan_user)
                await db.commit()
                await db.refresh(bhojan_user)

            stmt = select(Vendor).where(Vendor.phone == "7777777777")
            result = await db.execute(stmt)
            bhojan_vendor = result.scalars().first()
            if not bhojan_vendor:
                bhojan_vendor = Vendor(user_id=bhojan_user.id, phone="7777777777", business_name="Bhojan")
                db.add(bhojan_vendor)
                await db.commit()
                await db.refresh(bhojan_vendor)

            # ── Outlet for Bhojan ──────────────────────────────────────
            stmt = select(Outlet).where(Outlet.vendor_id == bhojan_vendor.id)
            result = await db.execute(stmt)
            if not result.scalars().first():
                db.add(Outlet(
                    vendor_id=bhojan_vendor.id,
                    name="Bhojan Express", description="Hospital Block",
                    is_open=True, rating=0.0, opening_time="08:00", closing_time="20:00", slot_duration_minutes=15
                ))
                await db.commit()
                print("✅ Outlet Bhojan seeded.")

            print("✅ All vendor seeds complete. Students self-register.")

        except Exception as e:
            await db.rollback()
            print(f"❌ Error seeding data: {e}")

# Routers
from app.auth.router import router as auth_router
from app.users.router import router as users_router
from app.vendors.router import router as vendors_router
from app.outlets.router import router as outlets_router
from app.menu.router import router as menu_router
from app.orders.router import router as orders_router
from app.notifications.router import router as notifications_router
from app.admin.router import router as admin_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.database import engine, Base
    from sqlalchemy import text

    # ── Transaction 1: ALTER TABLE alone (commits immediately) ────────
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            print("✅ Tables created/verified.")
    except Exception as e:
        print(f"❌ Migration Error: {e}")

    # ── Safe column migrations — run every startup, IF NOT EXISTS is safe ──
    migrations = [
        "ALTER TABLE orders ADD COLUMN IF NOT EXISTS razorpay_order_id VARCHAR(100)",
        "ALTER TABLE outlets ADD COLUMN IF NOT EXISTS razorpay_account_id VARCHAR(100)",
    ]
    try:
        from sqlalchemy import text
        async with engine.begin() as conn:
            for sql in migrations:
                await conn.execute(text(sql))
        print("✅ Column migrations applied.")
    except Exception as e:
        print(f"❌ Column migration error: {e}")

    
    # Seed vendor accounts
    try:
        from app.database import AsyncSessionLocal
        async with AsyncSessionLocal() as _check_db:
            from sqlalchemy.future import select as _sel
            from app.vendors.models import Vendor as _V
            _r = await _check_db.execute(_sel(_V).limit(1))
            if not _r.scalars().first():
                await seed_data()
            else:
                print("✅ Vendors already seeded — skipping.")
    except Exception as _e:
        print(f"⚠️ Seed check failed: {_e}")
    yield


app = FastAPI(title="QuickBite API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://quickbitefinal.vercel.app",
        "http://localhost:3000",
        "http://localhost:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def health_check():
    return {"status": "ok", "app": "QuickBite API"}

app.include_router(auth_router,          prefix="/api/auth",          tags=["auth"])
app.include_router(users_router,         prefix="/api/users",         tags=["users"])
app.include_router(vendors_router,       prefix="/api/vendors",       tags=["vendors"])
app.include_router(outlets_router,       prefix="/api/outlets",       tags=["outlets"])
app.include_router(menu_router,          prefix="/api/menu",          tags=["menu"])
app.include_router(orders_router,        prefix="/api/orders",        tags=["orders"])
app.include_router(notifications_router, prefix="/api/notifications", tags=["notifications"])
app.include_router(admin_router,         prefix="/api/admin",         tags=["admin"])
app.include_router(payments_router, prefix="/api/payments", tags=["payments"])