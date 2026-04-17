from dotenv import load_dotenv
load_dotenv()
import asyncio, os
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

db_url = os.environ.get("DATABASE_URL")
if db_url and db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql+asyncpg://", 1)

engine = create_async_engine(db_url)
SeedSession = async_sessionmaker(bind=engine, class_=AsyncSession)

async def cleanup():
    async with SeedSession() as db:
        # Step 1: Delete menu items belonging to duplicate outlets
        await db.execute(text("""
            DELETE FROM menu_items 
            WHERE outlet_id IN (
                SELECT id FROM outlets WHERE name LIKE '%Outlet%'
            )
        """))
        # Step 2: Now delete the duplicate outlets
        await db.execute(text("DELETE FROM outlets WHERE name LIKE '%Outlet%'"))
        await db.commit()
        print("✅ Done! Duplicate outlets and their menu items removed.")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(cleanup())