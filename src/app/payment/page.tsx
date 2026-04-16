'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Razorpay: any;
  }
}

const PLAN_AMOUNT = 2499;
const PLAN_CURRENCY = 'INR';

export default function PaymentPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [userId, setUserId] = useState('');
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    async function checkStatus() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      setUserId(user.id);

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email, phone, is_paid')
        .eq('id', user.id)
        .single();

      if (profile) {
        setUserName(profile.full_name || '');
        setUserEmail(profile.email || user.email || '');
        setUserPhone(profile.phone || '');
        setIsPaid(profile.is_paid || false);
      }
      setPageLoading(false);
    }
    checkStatus();
  }, [supabase, router]);

  useEffect(() => {
    // Load Razorpay script
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const handlePayment = async () => {
    setLoading(true);

    try {
      // Create order via API
      const res = await fetch('/api/payment/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: PLAN_AMOUNT,
          currency: PLAN_CURRENCY,
        }),
      });

      const order = await res.json();

      if (!res.ok) {
        alert(order.error || 'Failed to create payment order');
        setLoading(false);
        return;
      }

      // Open Razorpay checkout
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency,
        name: 'Iluzia My Class',
        description: 'Premium XR Learning — 1 Year Access',
        order_id: order.order_id,
        handler: async function (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) {
          // Verify payment
          const verifyRes = await fetch(`/api/payment/verify?user_id=${userId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
            }),
          });

          if (verifyRes.ok) {
            setIsPaid(true);
            router.push('/student');
            router.refresh();
          } else {
            alert('Payment verification failed. Please contact support.');
          }
        },
        prefill: {
          name: userName,
          email: userEmail,
          contact: userPhone,
        },
        theme: {
          color: '#7c3aed',
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (error) {
      console.error('Payment error:', error);
      alert('Payment failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (pageLoading) {
    return (
      <div className="loading-page">
        <div className="spinner spinner-lg" />
      </div>
    );
  }

  if (isPaid) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--surface-bg)',
        padding: '24px',
      }}>
        <div className="payment-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '4rem', marginBottom: '16px' }}>🎉</div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '8px' }}>You&apos;re Premium!</h1>
          <p className="text-muted" style={{ marginBottom: '24px' }}>
            You already have full access to all XR learning content.
          </p>
          <Link href="/student/explore" className="btn btn-primary btn-lg">
            🔍 Explore Content
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--surface-bg)',
      padding: '24px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background decorations */}
      <div style={{
        position: 'absolute',
        width: '500px',
        height: '500px',
        background: 'rgba(124, 58, 237, 0.12)',
        borderRadius: '50%',
        filter: 'blur(100px)',
        top: '-150px',
        right: '-150px',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        width: '400px',
        height: '400px',
        background: 'rgba(6, 182, 212, 0.08)',
        borderRadius: '50%',
        filter: 'blur(80px)',
        bottom: '-100px',
        left: '-100px',
        pointerEvents: 'none',
      }} />

      <div className="payment-card" style={{ position: 'relative', zIndex: 1 }}>
        {/* Header */}
        <div style={{ marginBottom: '8px' }}>
          <span className="badge badge-primary" style={{ marginBottom: '16px', display: 'inline-flex' }}>
            ✦ Premium Plan
          </span>
        </div>

        <h1 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>
          Unlock All XR Content
        </h1>
        <p className="text-muted" style={{ fontSize: '0.9rem', marginBottom: '24px' }}>
          Get unlimited access to all 3D experiential learning content
        </p>

        {/* Price */}
        <div className="price-tag">₹{PLAN_AMOUNT.toLocaleString()}</div>
        <div className="price-period">per year</div>

        {/* Features */}
        <ul className="feature-list">
          <li>Unlimited access to all topics</li>
          <li>3D interactive models & experiments</li>
          <li>All subjects & chapters unlocked</li>
          <li>Virtual lab experiences</li>
          <li>Access from any device</li>
          <li>Valid for 1 full year</li>
        </ul>

        {/* CTA */}
        <button
          className="btn btn-primary btn-lg"
          onClick={handlePayment}
          disabled={loading}
          style={{ width: '100%', marginBottom: '16px' }}
        >
          {loading ? (
            <>
              <span className="spinner" style={{ width: '18px', height: '18px' }} />
              Processing...
            </>
          ) : (
            `💎 Pay ₹${PLAN_AMOUNT.toLocaleString()} & Start Learning`
          )}
        </button>

        <p style={{ fontSize: '0.75rem', color: 'var(--neutral-600)' }}>
          Secure payment via Razorpay. 100% safe & encrypted.
        </p>

        <div style={{ marginTop: '16px' }}>
          <Link href="/student" className="text-muted" style={{ fontSize: '0.85rem' }}>
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
