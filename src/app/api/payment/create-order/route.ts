import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { amount, currency } = await request.json();

    const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return NextResponse.json(
        { error: 'Payment gateway not configured. Please contact admin.' },
        { status: 500 }
      );
    }

    const orderData = {
      amount: amount * 100, // Razorpay expects amount in paise
      currency: currency || 'INR',
      receipt: `order_${Date.now()}`,
      notes: {
        plan: 'premium_annual',
        platform: 'iluzia_myclass',
      },
    };

    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
      },
      body: JSON.stringify(orderData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Razorpay order error:', errorData);
      return NextResponse.json(
        { error: 'Failed to create payment order' },
        { status: 500 }
      );
    }

    const order = await response.json();

    return NextResponse.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (error) {
    console.error('Create order error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
