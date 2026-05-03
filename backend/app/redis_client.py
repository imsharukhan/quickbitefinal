from upstash_redis.asyncio import Redis
from app.config import settings

redis_client = Redis(url=settings.REDIS_URL, token=settings.REDIS_TOKEN)