import hashlib
import hmac
import math

import razorpay

from app.config import settings

PLATFORM_FEE_RATE = settings.PLATFORM_FEE_RATE

_client = None


def get_client():
    global _client
    if _client is None:
        _client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
    return _client


class PaymentService:
    @staticmethod
    def calculate_platform_fee(food_amount_rupees: float) -> float:
        if food_amount_rupees <= 0:
            return 0.0
        total = math.ceil(food_amount_rupees / (1 - PLATFORM_FEE_RATE))
        return round(total - food_amount_rupees, 2)

    @staticmethod
    def calculate_payable_total(food_amount_rupees: float) -> float:
        return round(food_amount_rupees + PaymentService.calculate_platform_fee(food_amount_rupees), 2)

    @staticmethod
    def create_razorpay_order(amount_rupees: float, receipt: str) -> dict:
        return get_client().order.create(data={
            "amount": int(round(amount_rupees * 100)),
            "currency": "INR",
            "receipt": receipt,
        })

    @staticmethod
    def verify_payment_signature(
        razorpay_order_id: str,
        razorpay_payment_id: str,
        razorpay_signature: str
    ) -> bool:
        try:
            get_client().utility.verify_payment_signature({
                "razorpay_order_id": razorpay_order_id,
                "razorpay_payment_id": razorpay_payment_id,
                "razorpay_signature": razorpay_signature,
            })
            return True
        except Exception:
            return False

    @staticmethod
    def verify_webhook_signature(body: bytes, signature: str) -> bool:
        expected = hmac.new(
            settings.RAZORPAY_WEBHOOK_SECRET.encode(),
            body,
            hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(expected, signature)

    @staticmethod
    def transfer_to_canteen(payment_id: str, linked_account_id: str, vendor_amount_rupees: float):
        return get_client().payment.transfer(payment_id, {
            "transfers": [{
                "account": linked_account_id,
                "amount": int(round(vendor_amount_rupees * 100)),
                "currency": "INR",
                "on_hold": 0,
                "notes": {"purpose": "canteen_order_payment"}
            }]
        })

    @staticmethod
    def verify_upi_payment(order, payment_gateway_id: str = None) -> dict:
        return {"verified": True, "gateway_id": payment_gateway_id or "MANUAL"}

    @staticmethod
    def get_payment_status_after_confirm() -> str:
        return "COMPLETED"

    @staticmethod
    def get_payment_status_after_cancel() -> str:
        return "FAILED"
