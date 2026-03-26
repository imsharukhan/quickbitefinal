from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.menu import schemas, service
from app.auth.dependencies import get_current_vendor

router = APIRouter()

@router.get("/{outlet_id}", response_model=list[schemas.MenuItemResponse])
async def get_menu(
    outlet_id: str,
    request: Request,
    include_unavailable: bool = Query(False),
    db: AsyncSession = Depends(get_db)
):
    final_include = False
    if include_unavailable:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            try:
                from app.auth.utils import decode_token
                payload = decode_token(token)
                vendor_id = payload.get("sub")
                role = payload.get("role")
                if role == "vendor" and vendor_id:
                    owns = await service.validate_vendor_owns_outlet(db, vendor_id, outlet_id)
                    if owns:
                        final_include = True
            except Exception:
                pass
    return await service.get_menu_by_outlet(db, outlet_id, final_include)

@router.post("/{outlet_id}", response_model=schemas.MenuItemResponse)
async def create_menu_item(
    outlet_id: str,
    data: schemas.MenuItemCreate,
    current_vendor = Depends(get_current_vendor),
    db: AsyncSession = Depends(get_db)
):
    owns = await service.validate_vendor_owns_outlet(db, str(current_vendor.id), outlet_id)
    if not owns:
        raise HTTPException(status_code=403, detail="Not authorized for this outlet")
    return await service.create_menu_item(db, outlet_id, data)

@router.patch("/item/{id}", response_model=schemas.MenuItemResponse)
async def update_menu_item(
    id: str,
    data: schemas.MenuItemUpdate,
    current_vendor = Depends(get_current_vendor),
    db: AsyncSession = Depends(get_db)
):
    item = await service.get_menu_item(db, id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
        
    owns = await service.validate_vendor_owns_outlet(db, str(current_vendor.id), str(item.outlet_id))
    if not owns:
        raise HTTPException(status_code=403, detail="Not authorized for this outlet")
        
    updated = await service.update_menu_item(db, id, data)
    return updated

@router.patch("/item/{id}/toggle", response_model=schemas.MenuItemResponse)
async def toggle_menu_item(
    id: str,
    current_vendor = Depends(get_current_vendor),
    db: AsyncSession = Depends(get_db)
):
    item = await service.get_menu_item(db, id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
        
    owns = await service.validate_vendor_owns_outlet(db, str(current_vendor.id), str(item.outlet_id))
    if not owns:
        raise HTTPException(status_code=403, detail="Not authorized for this outlet")
        
    updated = await service.toggle_availability(db, id)
    return updated

@router.delete("/item/{id}")
async def delete_menu_item(
    id: str,
    current_vendor = Depends(get_current_vendor),
    db: AsyncSession = Depends(get_db)
):
    item = await service.get_menu_item(db, id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
        
    owns = await service.validate_vendor_owns_outlet(db, str(current_vendor.id), str(item.outlet_id))
    if not owns:
        raise HTTPException(status_code=403, detail="Not authorized for this outlet")
        
    await service.delete_menu_item(db, id)
    return {"message": "Menu item soft deleted successfully"}