import express from 'express';
import Stripe from 'stripe';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import sgMail from '@sendgrid/mail';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Configure SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

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
  const { amount, currency, plan, passengers, date, customer } = data;
  
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

  if (!customer || !customer.fullName || !customer.email) {
    throw new Error('Customer information is required');
  }
  
  return true;
}

// Email templates
function getConfirmationEmailTemplate(paymentData, customer) {
  const { plan, passengers, date, amount, currency } = paymentData;
  
  return {
    to: [
      { email: customer.email, name: customer.fullName },
      { email: 'financeiro@vpoexperience.com', name: 'Financeiro VPO' },
      { email: 'matriz@airland.com.br', name: 'Matriz Airland' }
    ],
    from: {
      email: 'noreply@vpoexperience.com',
      name: 'VPO Experience'
    },
    subject: `Booking Confirmation - ${plan.name}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Booking Confirmation</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #9E135C; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .booking-details { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; }
          .footer { background: #333; color: white; padding: 20px; text-align: center; }
          .highlight { color: #9E135C; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Booking Confirmed!</h1>
            <p>Thank you for choosing VPO Experience</p>
          </div>
          
          <div class="content">
            <h2>Hello ${customer.fullName}!</h2>
            <p>We're excited to confirm your booking for our Remote Guidance service. Here are your booking details:</p>
            
            <div class="booking-details">
              <h3>📋 Booking Summary</h3>
              <p><strong>Service:</strong> ${plan.name}</p>
              <p><strong>Duration:</strong> ${plan.days} day${plan.days > 1 ? 's' : ''}</p>
              <p><strong>Passengers:</strong> ${passengers}</p>
              <p><strong>Activation Date:</strong> ${new Date(date).toLocaleDateString()}</p>
              <p><strong>Total Amount:</strong> <span class="highlight">${currency} ${(amount / 100).toFixed(2)}</span></p>
              
              <h3>👤 Customer Information</h3>
              <p><strong>Name:</strong> ${customer.fullName}</p>
              <p><strong>Email:</strong> ${customer.email}</p>
              <p><strong>Phone:</strong> ${customer.phone}</p>
              <p><strong>Address:</strong> ${customer.address}, ${customer.city}, ${customer.country}</p>
            </div>
            
            <div class="booking-details">
              <h3>📱 What's Next?</h3>
              <p>1. <strong>Save this confirmation email</strong> - You'll need it for reference</p>
              <p>2. <strong>WhatsApp Contact</strong> - Our team will contact you via WhatsApp 48 hours before your activation date</p>
              <p>3. <strong>Pre-Trip Planning</strong> - We'll create a personalized itinerary for your visit</p>
              <p>4. <strong>Real-Time Support</strong> - During your park visit, you'll have direct access to our specialist guides</p>
            </div>
            
            <div class="booking-details">
              <h3>ℹ️ Important Information</h3>
              <p>• Make sure you have internet access in the parks (WiFi is available)</p>
              <p>• Keep your WhatsApp active and available during your visit</p>
              <p>• Our guides speak Portuguese, English, and Spanish</p>
              <p>• Service hours: 8:00 AM - 10:00 PM (park local time)</p>
            </div>
            
            <p>If you have any questions, please don't hesitate to contact us:</p>
            <p>📧 Email: contact@vpoexperience.com</p>
            <p>📱 WhatsApp: +1 (555) 123-4567</p>
          </div>
          
          <div class="footer">
            <p>&copy; 2024 VPO Experience - Your Personal Concierge for the Magic of Parks</p>
            <p>This is an automated email. Please do not reply directly to this message.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      Booking Confirmation - VPO Experience
      
      Hello ${customer.fullName}!
      
      We're excited to confirm your booking for our Remote Guidance service.
      
      Booking Details:
      - Service: ${plan.name}
      - Duration: ${plan.days} day${plan.days > 1 ? 's' : ''}
      - Passengers: ${passengers}
      - Activation Date: ${new Date(date).toLocaleDateString()}
      - Total Amount: ${currency} ${(amount / 100).toFixed(2)}
      
      Customer Information:
      - Name: ${customer.fullName}
      - Email: ${customer.email}
      - Phone: ${customer.phone}
      - Address: ${customer.address}, ${customer.city}, ${customer.country}
      
      What's Next:
      1. Save this confirmation email
      2. Our team will contact you via WhatsApp 48 hours before your activation date
      3. We'll create a personalized itinerary for your visit
      4. During your park visit, you'll have direct access to our specialist guides
      
      Contact us:
      Email: contact@vpoexperience.com
      WhatsApp: +1 (555) 123-4567
      
      © 2024 VPO Experience
    `
  };
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
    const { amount, currency, plan, passengers, date, customer } = req.body;

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
        service: 'vpo-guidance',
        productId: plan.productId || '',
        customerName: customer.fullName,
        customerEmail: customer.email,
        customerPhone: customer.phone,
        customerAddress: customer.address,
        customerCity: customer.city,
        customerCountry: customer.country
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

// Send confirmation email
async function sendConfirmationEmail(paymentIntent) {
  try {
    if (!process.env.SENDGRID_API_KEY) {
      console.warn('SendGrid API key not configured - skipping email');
      return;
    }

    const { metadata } = paymentIntent;
    
    const customer = {
      fullName: metadata.customerName,
      email: metadata.customerEmail,
      phone: metadata.customerPhone,
      address: metadata.customerAddress,
      city: metadata.customerCity,
      country: metadata.customerCountry
    };

    const paymentData = {
      plan: {
        name: metadata.plan,
        days: parseInt(metadata.days)
      },
      passengers: parseInt(metadata.passengers),
      date: metadata.date,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency.toUpperCase()
    };

    const emailData = getConfirmationEmailTemplate(paymentData, customer);
    
    await sgMail.send(emailData);
    console.log('Confirmation email sent successfully');
    
  } catch (error) {
    console.error('Error sending confirmation email:', error);
    // Don't throw error - email failure shouldn't stop the payment flow
  }
}

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
    const { plan, days, passengers, date, service, customerName, customerEmail } = paymentIntent.metadata;
    
    console.log('Processing successful payment:', {
      id: paymentIntent.id,
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency,
      plan,
      days,
      passengers,
      date,
      customer: customerName,
      email: customerEmail
    });
    
    // Send confirmation email
    await sendConfirmationEmail(paymentIntent);
    
    // Here you would typically also:
    // 1. Save to database
    // 2. Create customer account/booking
    // 3. Send WhatsApp message notification to team
    // 4. Set up automated reminders
    
  } catch (error) {
    console.error('Error handling successful payment:', error);
  }
}

async function handleFailedPayment(paymentIntent) {
  try {
    console.log('Processing failed payment:', {
      id: paymentIntent.id,
      lastPaymentError: paymentIntent.last_payment_error,
      customer: paymentIntent.metadata.customerEmail
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
    stripe: !!process.env.STRIPE_SECRET_KEY,
    sendgrid: !!process.env.SENDGRID_API_KEY
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
  console.log(`SendGrid configured: ${!!process.env.SENDGRID_API_KEY}`);
});
