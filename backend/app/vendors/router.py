from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.vendors import schemas, service
from app.auth.dependencies import get_current_admin

router = APIRouter(dependencies=[Depends(get_current_admin)])

@router.post("", response_model=schemas.VendorResponse)
async def create_vendor_endpoint(data: schemas.VendorCreate, db: AsyncSession = Depends(get_db)):
    return await service.create_vendor(db, data)

@router.get("", response_model=list[schemas.VendorResponse])
async def list_vendors(db: AsyncSession = Depends(get_db)):
    return await service.get_all_vendors(db)

@router.get("/{id}", response_model=schemas.VendorResponse)
async def get_vendor_endpoint(id: str, db: AsyncSession = Depends(get_db)):
    vendor = await service.get_vendor_by_id(db, id)
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return vendor

@router.patch("/{id}", response_model=schemas.VendorResponse)
async def update_vendor_endpoint(id: str, data: schemas.VendorUpdate, db: AsyncSession = Depends(get_db)):
    vendor = await service.update_vendor(db, id, data)
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return vendor

@router.patch("/{id}/toggle", response_model=schemas.VendorResponse)
async def toggle_vendor_active_endpoint(id: str, db: AsyncSession = Depends(get_db)):
    vendor = await service.toggle_vendor_active(db, id)
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return vendor