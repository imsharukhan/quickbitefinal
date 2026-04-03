from pydantic import BaseModel, EmailStr, field_validator
from typing import Literal, Optional
import re

class StudentRegister(BaseModel):
    name: str
    register_number: str
    email: EmailStr
    password: str
    role: Literal["student", "staff"] = "student"

    @field_validator("register_number")
    @classmethod
    def validate_reg_no(cls, v: str) -> str:
        if not re.match(r"^[0-9]{8,16}$", v):
            raise ValueError("Register number must be 8 to 16 digits")
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v

class UserLogin(BaseModel):
    register_number: str
    password: str

class VendorLogin(BaseModel):
    phone: str
    password: str

class VerifyOTP(BaseModel):
    register_number: str
    otp: str

class ResendOTP(BaseModel):
    register_number: str

class ForgotPassword(BaseModel):
    email: EmailStr

class VendorForgotPassword(BaseModel):
    phone: str

class VendorResetPassword(BaseModel):
    phone: str
    otp: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_password_val(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v

class ResetPassword(BaseModel):
    register_number: str
    otp: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_password_val(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v

class VendorChangePassword(BaseModel):
    old_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_password_length(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v

class RefreshRequest(BaseModel):
    refresh_token: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    role: str
    user_id: str
    name: str
    must_change_password: bool = False
