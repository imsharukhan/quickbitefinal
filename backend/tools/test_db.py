import asyncio
from app.database import engine, Base
from app.users.models import User, Student
from app.vendors.models import Vendor
from app.outlets.models import Outlet
from app.menu.models import MenuItem
from app.orders.models import Order, OrderItem, Rating
from app.notifications.models import Notification

async def test():
    async with engine.begin() as conn:
        print("Dropping all...")
        await conn.run_sync(Base.metadata.drop_all)
        print("Creating all...")
        await conn.run_sync(Base.metadata.create_all)
    print("Done")

asyncio.run(test())
