import express from 'express';
import Stripe from 'stripe';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Middleware for webhook (raw body needed)
app.use('/api/webhook', express.raw({ type: 'application/json' }));

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Serve static files
app.use('/css', express.static(path.join(__dirname, 'public/css')));
app.use('/js', express.static(path.join(__dirname, 'public/js')));
app.use('/images', express.static(path.join(__dirname, 'public/images')));

// Validation functions
function validatePaymentData(data) {
  const { amount, currency, plan, passengers, date } = data;
  
  if (!amount || amount <= 0) {
    throw new Error('Invalid amount');
  }
  
  if (!currency || !['USD', 'BRL', 'EUR'].includes(currency.toUpperCase())) {
    throw new Error('Invalid currency');
  }
  
  if (!plan || !plan.name || !plan.days) {
    throw new Error('Invalid plan data');
  }
  
  if (!passengers || passengers <= 0) {
    throw new Error('Invalid passenger count');
  }
  
  if (!date) {
    throw new Error('Invalid date');
  }
  
  return true;
}

// API Routes
app.get('/api/stripe-key', (req, res) => {
  if (!process.env.STRIPE_PUBLISHABLE_KEY) {
    return res.status(500).json({ error: 'Stripe publishable key not configured' });
  }
  res.json({ publishableKey: process.env.STRIPE_PUBLISHABLE_KEY });
});

app.post('/api/create-payment-intent', async (req, res) => {
  try {
    const { amount, currency, plan, passengers, date } = req.body;

    // Validate input data
    validatePaymentData(req.body);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: currency.toLowerCase(),
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        plan: plan.name,
        days: plan.days.toString(),
        passengers: passengers.toString(),
        date: date,
        service: 'vpo-guidance'
      }
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
  } catch (error) {
    console.error('Error creating payment intent:', error);
    res.status(400).json({ 
      error: error.message || 'Failed to create payment intent' 
    });
  }
});

// Stripe Webhook Handler
app.post('/api/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body, 
      sig, 
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      console.log('Payment succeeded:', paymentIntent.id);
      
      // Here you would:
      // 1. Update your database
      // 2. Send confirmation email
      // 3. Create customer record
      // 4. Any other business logic
      
      await handleSuccessfulPayment(paymentIntent);
      break;
      
    case 'payment_intent.payment_failed':
      const failedPayment = event.data.object;
      console.log('Payment failed:', failedPayment.id);
      
      await handleFailedPayment(failedPayment);
      break;
      
    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  res.json({ received: true });
});

// Business logic functions
async function handleSuccessfulPayment(paymentIntent) {
  try {
    // Extract metadata
    const { plan, days, passengers, date, service } = paymentIntent.metadata;
    
    // Here you would typically:
    // 1. Save to database
    // 2. Send confirmation email
    // 3. Create customer account/booking
    // 4. Send WhatsApp message
    
    console.log('Processing successful payment:', {
      id: paymentIntent.id,
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency,
      plan,
      days,
      passengers,
      date
    });
    
    // TODO: Implement your business logic here
    // Example: await saveBookingToDatabase(paymentIntent);
    // Example: await sendConfirmationEmail(paymentIntent);
    
  } catch (error) {
    console.error('Error handling successful payment:', error);
  }
}

async function handleFailedPayment(paymentIntent) {
  try {
    console.log('Processing failed payment:', {
      id: paymentIntent.id,
      lastPaymentError: paymentIntent.last_payment_error
    });
    
    // TODO: Implement failed payment logic
    // Example: await notifyAdminOfFailedPayment(paymentIntent);
    
  } catch (error) {
    console.error('Error handling failed payment:', error);
  }
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    stripe: !!process.env.STRIPE_SECRET_KEY 
  });
});

// Main route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { details: error.message })
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Stripe configured: ${!!process.env.STRIPE_SECRET_KEY}`);
});
