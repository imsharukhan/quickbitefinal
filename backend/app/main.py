from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import create_tables

# Models import for SQLAlchemy metadata
from app.users.models import User
from app.vendors.models import Vendor
from app.outlets.models import Outlet
from app.menu.models import MenuItem
from app.orders.models import Order, OrderItem, Rating
from app.notifications.models import Notification

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
    await create_tables()
    from app.database import Base
    print("Recognized tables:", list(Base.metadata.tables.keys()))
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
