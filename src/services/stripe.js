import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe('your-publishable-key-here');

export const createPaymentIntent = async (amount) => {
    const response = await fetch('/api/create-payment-intent', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amount }),
    });

    if (!response.ok) {
        throw new Error('Failed to create payment intent');
    }

    return response.json();
};

export const getStripe = () => {
    return stripePromise;
};