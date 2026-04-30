from fastapi import WebSocket
from fastapi.encoders import jsonable_encoder
from typing import Dict, List

class OrderConnectionManager:
    def __init__(self):
        self.student_connections: Dict[str, WebSocket] = {}
        self.vendor_connections: Dict[str, List[WebSocket]] = {}

    async def connect_student(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.student_connections[user_id] = websocket

    async def connect_vendor(self, websocket: WebSocket, vendor_id: str):
        await websocket.accept()
        if vendor_id not in self.vendor_connections:
            self.vendor_connections[vendor_id] = []
        self.vendor_connections[vendor_id].append(websocket)

    def disconnect_student(self, user_id: str):
        if user_id in self.student_connections:
            del self.student_connections[user_id]

    def disconnect_vendor(self, websocket: WebSocket, vendor_id: str):
        if vendor_id in self.vendor_connections:
            if websocket in self.vendor_connections[vendor_id]:
                self.vendor_connections[vendor_id].remove(websocket)
            if not self.vendor_connections[vendor_id]:
                del self.vendor_connections[vendor_id]

    async def notify_student(self, user_id: str, data: dict):
        if user_id in self.student_connections:
            try:
                await self.student_connections[user_id].send_json(jsonable_encoder(data))
            except Exception:
                pass

    async def notify_vendor(self, vendor_id: str, data: dict):
        if vendor_id in self.vendor_connections:
            for connection in self.vendor_connections[vendor_id]:
                try:
                    await connection.send_json(jsonable_encoder(data))
                except Exception:
                    pass

manager = OrderConnectionManager()
