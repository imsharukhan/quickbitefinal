from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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
            stmt = select(User).where(User.email == "student@test.com")
            result = await db.execute(stmt)
            if not result.scalars().first():
                user = User(email="student@test.com", role="student", hashed_password=hash_password("Sharukhan@123"), is_active=True, is_verified=True)
                db.add(user)
                await db.flush()  # So user.id is available for student
                student = Student(user_id=user.id, register_no="11523040468", name="Sharukhan")
                db.add(student)
                await db.commit()
                
            # Vendor 1 - Dimora
            stmt = select(User).where(User.email == "dimora@test.com")
            result = await db.execute(stmt)
            dimora_user = result.scalars().first()
            if not dimora_user:
                dimora_user = User(email="dimora@test.com", role="vendor", hashed_password=hash_password("Dimoras@123"), is_active=True, is_verified=True)
                db.add(dimora_user)
                await db.commit()
                await db.refresh(dimora_user)

            stmt = select(Vendor).where(Vendor.phone == "9999999999")
            result = await db.execute(stmt)
            dimora_vendor = result.scalars().first()
            if not dimora_vendor:
                dimora_vendor = Vendor(user_id=dimora_user.id, phone="9999999999", business_name="Dimora Central")
                db.add(dimora_vendor)
                await db.commit()
                await db.refresh(dimora_vendor)

            # Vendor 2 - Reenu
            stmt = select(User).where(User.email == "reenu@test.com")
            result = await db.execute(stmt)
            reenu_user = result.scalars().first()
            if not reenu_user:
                reenu_user = User(email="reenu@test.com", role="vendor", hashed_password=hash_password("Reenus@123"), is_active=True, is_verified=True)
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
                
            # Vendor 3 - Bhojan
            stmt = select(User).where(User.email == "bhojan@test.com")
            result = await db.execute(stmt)
            bhojan_user = result.scalars().first()
            if not bhojan_user:
                bhojan_user = User(email="bhojan@test.com", role="vendor", hashed_password=hash_password("Bhojans@123"), is_active=True, is_verified=True)
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
                
            # Outlets
            stmt = select(Outlet).where(Outlet.name == "Dimora")
            result = await db.execute(stmt)
            dimora_outlet = result.scalars().first()
            if not dimora_outlet:
                dimora_outlet = Outlet(vendor_id=dimora_vendor.id, name="Dimora", description="Near Academic Block", opening_time="08:00", closing_time="20:00", is_open=True)
                db.add(dimora_outlet)
                
            stmt = select(Outlet).where(Outlet.name == "Reenu")
            result = await db.execute(stmt)
            reenu_outlet = result.scalars().first()
            if not reenu_outlet:
                reenu_outlet = Outlet(vendor_id=reenu_vendor.id, name="Reenu", description="Food Court", opening_time="08:00", closing_time="20:00", is_open=True)
                db.add(reenu_outlet)
                
            stmt = select(Outlet).where(Outlet.name == "Bhojan")
            result = await db.execute(stmt)
            bhojan_outlet = result.scalars().first()
            if not bhojan_outlet:
                bhojan_outlet = Outlet(vendor_id=bhojan_vendor.id, name="Bhojan", description="Inside Hospital", opening_time="08:00", closing_time="20:00", is_open=True)
                db.add(bhojan_outlet)

            await db.commit()
        except Exception as e:
            await db.rollback()
            print(f"Error seeding data: {e}")

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
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
            await conn.run_sync(Base.metadata.create_all)
        print("Database Reset Complete")
    except Exception as e:
        print(f"Database Reset Failed: {e}")

    await seed_data()
    yield

app = FastAPI(title="QuickBite API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def health_check():
    return {"status": "ok", "app": "QuickBite API"}

app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(users_router, prefix="/api/users", tags=["users"])
app.include_router(vendors_router, prefix="/api/vendors", tags=["vendors"])
app.include_router(outlets_router, prefix="/api/outlets", tags=["outlets"])
app.include_router(menu_router, prefix="/api/menu", tags=["menu"])
app.include_router(orders_router, prefix="/api/orders", tags=["orders"])
app.include_router(notifications_router, prefix="/api/notifications", tags=["notifications"])
app.include_router(admin_router, prefix="/api/admin", tags=["admin"])
