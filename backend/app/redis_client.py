from upstash_redis import Redis
from app.config import settings

# Connect to Upstash synchronously
redis_client = Redis(url=settings.REDIS_URL, token=settings.REDIS_TOKEN)
