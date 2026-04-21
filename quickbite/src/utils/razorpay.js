export const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') { resolve(false); return; }
    if (window.Razorpay) { resolve(true); return; }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
};

export const openRazorpayCheckout = ({
  rzpData, orderId, userName, userEmail, onSuccess, onDismiss,
}) => {
  if (typeof window === 'undefined' || !window.Razorpay) {
    if (onDismiss) onDismiss();
    return;
  }

  const options = {
    key: rzpData.key_id,
    amount: rzpData.amount,
    currency: rzpData.currency || 'INR',
    name: 'QuickBite',
    description: `Order #${orderId}`,
    order_id: rzpData.razorpay_order_id,
    prefill: { name: userName || '', email: userEmail || '' },
    theme: { color: '#FC8019' },
    config: {
      display: {
        blocks: {
          upi: { name: 'Pay via UPI', instruments: [{ method: 'upi' }] },
        },
        sequence: ['block.upi'],
        preferences: { show_default_blocks: false },
      },
    },
    handler: onSuccess,
    modal: {
      ondismiss: onDismiss,
      escape: false,
      backdropclose: false,
    },
  };

  try {
    const rzp = new window.Razorpay(options);
    rzp.on('payment.failed', function(response) {
      if (onDismiss) onDismiss();
    });
    rzp.open();
  } catch (e) {
    console.error('Razorpay open failed:', e);
    if (onDismiss) onDismiss();
  }
};