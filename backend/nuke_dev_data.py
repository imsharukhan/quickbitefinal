import asyncio
from app.database import engine
from sqlalchemy import text

async def main():
    async with engine.begin() as conn:
        print("Clearing all data...")
        await conn.execute(text("DELETE FROM ratings;"))
        await conn.execute(text("DELETE FROM notifications;"))
        await conn.execute(text("DELETE FROM order_items;"))
        await conn.execute(text("DELETE FROM orders;"))
        await conn.execute(text("DELETE FROM menu_items;"))
        await conn.execute(text("DELETE FROM outlets;"))
        await conn.execute(text("DELETE FROM vendors;"))
        await conn.execute(text("DELETE FROM students;"))
        await conn.execute(text("DELETE FROM users;"))
        print("Data successfully obliterated. Clean slate ready!")

if __name__ == "__main__":
    asyncio.run(main())