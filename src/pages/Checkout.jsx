import React from 'react';
import { useStripe, useElements, CardElement } from '@stripe/react-stripe-js';
import { useAuth } from '../hooks/useAuth';
import { createPaymentIntent } from '../services/stripe';

const Checkout = () => {
    const stripe = useStripe();
    const elements = useElements();
    const { user } = useAuth();

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (!stripe || !elements) {
            return;
        }

        const cardElement = elements.getElement(CardElement);

        const { error, paymentIntent } = await createPaymentIntent({
            amount: 1000, // Example amount in cents
            currency: 'usd',
            payment_method: {
                card: cardElement,
                billing_details: {
                    name: user?.displayName || 'Guest',
                },
            },
        });

        if (error) {
            console.error(error);
        } else {
            console.log('Payment successful:', paymentIntent);
        }
    };

    return (
        <div className="max-w-md mx-auto mt-10">
            <h1 className="text-2xl font-bold mb-4">Checkout</h1>
            <form onSubmit={handleSubmit}>
                <CardElement className="border p-2 mb-4" />
                <button
                    type="submit"
                    disabled={!stripe}
                    className="bg-blue-500 text-white py-2 px-4 rounded"
                >
                    Pay
                </button>
            </form>
        </div>
    );
};

export default Checkout;