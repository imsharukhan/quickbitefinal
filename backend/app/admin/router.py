from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, update, cast, Date
from typing import Optional
from pydantic import BaseModel
import pytz
from datetime import datetime

from app.database import get_db
from app.auth.dependencies import get_current_admin
from app.users.models import User
from app.vendors.models import Vendor
from app.outlets.models import Outlet
from app.orders.models import Order
from app.auth.utils import hash_password

router = APIRouter(dependencies=[Depends(get_current_admin)])

IST = pytz.timezone('Asia/Kolkata')

class AdminVendorCreate(BaseModel):
    business_name: str
    email: Optional[str] = None
    phone: str
    initial_password: str

class OutletAssign(BaseModel):
    vendor_id: str

@router.post("/vendors")
async def create_vendor_admin(data: AdminVendorCreate, db: AsyncSession = Depends(get_db)):
    if len(data.initial_password) > 72:
        raise HTTPException(status_code=400, detail="Password too long (max 72 characters)")
        
    try:
        hashed_pw = hash_password(data.initial_password)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
        
    user = User(
        email=data.email,
        role="vendor",
        hashed_password=hashed_pw,
        is_active=True,
        is_verified=True,
        must_change_password=True,
    )
    db.add(user)
    await db.flush()

    new_vendor = Vendor(
        user_id=user.id,
        phone=data.phone,
        business_name=data.business_name,
        must_change_password=True,
        is_active=True,
    )
    db.add(new_vendor)
    await db.commit()
    await db.refresh(new_vendor)
    return new_vendor

@router.get("/vendors")
async def list_vendors(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Vendor, Outlet.name).outerjoin(Outlet, Vendor.id == Outlet.vendor_id)
    )
    rows = result.all()
    
    vendors_dict = {}
    for v, outlet_name in rows:
        vid = str(v.id)
        if vid not in vendors_dict:
            vendors_dict[vid] = {
                "id": vid,
                "business_name": v.business_name,
                "phone": v.phone,
                "is_active": v.is_active,
                "created_at": v.created_at,
                "outlets": []
            }
        if outlet_name:
            vendors_dict[vid]["outlets"].append(outlet_name)
            
    return list(vendors_dict.values())

@router.get("/outlets")
async def list_outlets(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Outlet, Vendor.business_name).join(Vendor, Outlet.vendor_id == Vendor.id)
    )
    rows = result.all()
    outlets = []
    for o, vendor_name in rows:
        outlets.append({
            "id": o.id,
            "name": o.name,
            "vendor_name": vendor_name,
            "rating": o.rating,
            "is_open": o.is_open,
            "cuisine": o.cuisine
        })
    return outlets

@router.get("/orders")
async def list_orders(
    status: Optional[str] = None,
    outlet_id: Optional[str] = None,
    date: Optional[str] = None,
    limit: int = Query(50),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db)
):
    from app.users.models import Student
    query = select(Order, Student.name, Outlet.name).join(User, Order.user_id == User.id).join(Student, Student.user_id == User.id).join(Outlet, Order.outlet_id == Outlet.id)
    
    if status:
        query = query.where(Order.status == status)
    if outlet_id:
        query = query.where(Order.outlet_id == outlet_id)
    if date:
        target_date = datetime.strptime(date, "%Y-%m-%d").date()
        start = IST.localize(datetime(target_date.year, target_date.month, target_date.day))
        from datetime import timedelta
        end = start + timedelta(days=1)
        start_utc = start.astimezone(pytz.UTC).replace(tzinfo=None)
        end_utc = end.astimezone(pytz.UTC).replace(tzinfo=None)
        query = query.where(Order.placed_at >= start_utc, Order.placed_at < end_utc)
        
    query = query.order_by(Order.placed_at.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    rows = result.all()
    
    orders = []
    for o, student_name, outlet_name in rows:
        orders.append({
            "id": o.id,
            "student_name": student_name,
            "outlet_name": outlet_name,
            "total_price": o.total_price,
            "status": o.status,
            "payment_status": o.payment_status,
            "placed_at": o.placed_at
        })
    return orders

@router.get("/stats")
async def get_stats(db: AsyncSession = Depends(get_db)):
    today_ist = datetime.now(IST).date()
    start_of_day = IST.localize(datetime(today_ist.year, today_ist.month, today_ist.day))
    start_utc = start_of_day.astimezone(pytz.UTC).replace(tzinfo=None)
    
    res_users = await db.execute(select(func.count(User.id)))
    total_users = res_users.scalar() or 0
    
    res_vendors = await db.execute(select(func.count(Vendor.id)))
    total_vendors = res_vendors.scalar() or 0
    
    res_outlets = await db.execute(select(func.count(Outlet.id)))
    total_outlets = res_outlets.scalar() or 0
    
    res_orders = await db.execute(select(func.count(Order.id)))
    total_orders = res_orders.scalar() or 0
    
    res_total_rev = await db.execute(select(func.sum(Order.total_price)).where(Order.status != 'Cancelled'))
    total_revenue = res_total_rev.scalar() or 0.0
    
    res_orders_today = await db.execute(select(func.count(Order.id)).where(Order.placed_at >= start_utc))
    orders_today = res_orders_today.scalar() or 0
    
    res_rev_today = await db.execute(select(func.sum(Order.total_price)).where(Order.status != 'Cancelled', Order.placed_at >= start_utc))
    revenue_today = res_rev_today.scalar() or 0.0
    
    res_active = await db.execute(select(func.count(Order.id)).where(Order.status.notin_(['Picked Up', 'Cancelled'])))
    active_orders = res_active.scalar() or 0
    
    res_pending = await db.execute(select(func.count(Order.id)).where(Order.payment_status == 'PENDING', Order.status == 'Placed'))
    pending_payment_orders = res_pending.scalar() or 0
    
    res_prep = await db.execute(select(func.count(Order.id)).where(Order.status == 'Preparing'))
    preparing_orders = res_prep.scalar() or 0
    
    res_done_today = await db.execute(select(func.count(Order.id)).where(Order.status == 'Picked Up', Order.placed_at >= start_utc))
    completed_today = res_done_today.scalar() or 0
    
    return {
        "total_users": total_users,
        "total_vendors": total_vendors,
        "total_outlets": total_outlets,
        "total_orders": total_orders,
        "total_revenue": total_revenue,
        "orders_today": orders_today,
        "revenue_today": revenue_today,
        "active_orders": active_orders,
        "pending_payment_orders": pending_payment_orders,
        "preparing_orders": preparing_orders,
        "completed_today": completed_today
    }

@router.patch("/vendors/{id}/toggle")
async def toggle_vendor(id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Vendor).where(Vendor.id == id))
    vendor = result.scalars().first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
        
    vendor.is_active = not vendor.is_active
    msg = f"Vendor activated"
    
    if not vendor.is_active:
        await db.execute(update(Outlet).where(Outlet.vendor_id == id).values(is_open=False))
        msg = f"Vendor deactivated and all related outlets closed"
        
    await db.commit()
    return {"id": vendor.id, "is_active": vendor.is_active, "message": msg}

@router.patch("/outlets/{id}/assign")
async def assign_outlet(id: str, data: OutletAssign, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Outlet).where(Outlet.id == id))
    outlet = result.scalars().first()
    if not outlet:
        raise HTTPException(status_code=404, detail="Outlet not found")
        
    result_vendor = await db.execute(select(Vendor).where(Vendor.id == data.vendor_id))
    vendor = result_vendor.scalars().first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
        
    outlet.vendor_id = vendor.id
    await db.commit()
    await db.refresh(outlet)
    
    return {"message": "Outlet assigned successfully", "id": outlet.id, "vendor_id": outlet.vendor_id}
