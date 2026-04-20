from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./test.db"
    REDIS_URL: str
    REDIS_TOKEN: str
    SECRET_KEY: str
    ALGORITHM: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int
    REFRESH_TOKEN_EXPIRE_DAYS: int
    RESEND_API_KEY: str          # NEW: replace GMAIL_ADDRESS + GMAIL_APP_PASSWORD
    RESEND_FROM_EMAIL: str       # e.g. "QuickBite <noreply@yourdomain.com>"
    COLLEGE_EMAIL_DOMAIN: str
    ADMIN_SECRET_KEY: str
    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""
    RAZORPAY_WEBHOOK_SECRET: str = ""
    PLATFORM_FEE: int = 7

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

settings = Settings()