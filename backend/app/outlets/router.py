from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from app.database import get_db
from app.outlets import schemas, service
from app.auth.dependencies import get_current_admin, get_current_vendor

router = APIRouter()

@router.get("", response_model=list[schemas.OutletResponse])
async def list_outlets(db: AsyncSession = Depends(get_db)):
    return await service.get_all_outlets(db)

# ✅ /me MUST come before /{id}
@router.get("/me", response_model=list[schemas.OutletResponse])
async def get_my_outlets(current_vendor = Depends(get_current_vendor), db: AsyncSession = Depends(get_db)):
    return await service.get_outlets_by_vendor(db, str(current_vendor.id))

# ✅ /{id} comes AFTER all fixed-path routes
@router.get("/{id}/slots", response_model=list[schemas.TimeSlotResponse])
async def get_time_slots(id: str, date: Optional[str] = Query(None), db: AsyncSession = Depends(get_db)):
    return await service.get_available_time_slots(db, id, date)

@router.get("/{id}", response_model=schemas.OutletResponse)
async def get_outlet(id: str, db: AsyncSession = Depends(get_db)):
    outlet = await service.get_outlet_by_id(db, id)
    if not outlet:
        raise HTTPException(status_code=404, detail="Outlet not found")
    return outlet

@router.post("", response_model=schemas.OutletResponse, dependencies=[Depends(get_current_admin)])
async def create_outlet_admin(data: schemas.OutletCreate, db: AsyncSession = Depends(get_db)):
    return await service.create_outlet(db, data)

@router.patch("/{id}", response_model=schemas.OutletResponse)
async def update_outlet(id: str, data: schemas.OutletUpdate, current_vendor = Depends(get_current_vendor), db: AsyncSession = Depends(get_db)):
    owns = await service.validate_vendor_owns_outlet(db, str(current_vendor.id), id)
    if not owns:
        raise HTTPException(status_code=403, detail="Not authorized to update this outlet")
    outlet = await service.update_outlet(db, id, data)
    return outlet

@router.patch("/{id}/toggle", response_model=schemas.OutletResponse)
async def toggle_outlet_open(id: str, current_vendor = Depends(get_current_vendor), db: AsyncSession = Depends(get_db)):
    owns = await service.validate_vendor_owns_outlet(db, str(current_vendor.id), id)
    if not owns:
        raise HTTPException(status_code=403, detail="Not authorized to toggle this outlet")
    outlet = await service.toggle_outlet_open(db, id)
    return outlet

@router.delete("/{id}", dependencies=[Depends(get_current_admin)])
async def delete_outlet(id: str, db: AsyncSession = Depends(get_db)):
    outlet = await service.get_outlet_by_id(db, id)
    if not outlet:
        raise HTTPException(status_code=404, detail="Outlet not found")
    await db.delete(outlet)
    await db.commit()
    return {"message": "Outlet deleted successfully"}