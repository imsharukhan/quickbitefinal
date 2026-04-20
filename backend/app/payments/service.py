import razorpay
import hmac
import hashlib
from app.config import settings

PLATFORM_FEE = settings.PLATFORM_FEE  # ₹7 kept by QuickBite

_client = None

def get_client():
    global _client
    if _client is None:
        _client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
    return _client


class PaymentService:

    @staticmethod
    def create_razorpay_order(amount_rupees: float, receipt: str) -> dict:
        """Create Razorpay order. Amount in rupees → converted to paise."""
        return get_client().order.create(data={
            "amount": int(amount_rupees * 100),
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
    def transfer_to_canteen(payment_id: str, linked_account_id: str, items_amount_rupees: float):
        """
        Transfer items amount (excluding platform fee) to canteen's linked account.
        Called only after KYC — linked_account_id starts with 'acc_'
        """
        return get_client().payment.transfer(payment_id, {
            "transfers": [{
                "account": linked_account_id,
                "amount": int(items_amount_rupees * 100),
                "currency": "INR",
                "on_hold": 0,
                "notes": {"purpose": "canteen_order_payment"}
            }]
        })

    # ── Kept for backward compat (vendor manual confirm fallback) ──────
    @staticmethod
    def verify_upi_payment(order, payment_gateway_id: str = None) -> dict:
        return {"verified": True, "gateway_id": payment_gateway_id or "MANUAL"}

    @staticmethod
    def get_payment_status_after_confirm() -> str:
        return "COMPLETED"

    @staticmethod
    def get_payment_status_after_cancel() -> str:
        return "FAILED"