import asyncio
from app.database import engine, Base
from app.main import seed_data

async def main():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    await seed_data()
    print("Seeding complete")

if __name__ == "__main__":
    asyncio.run(main())
