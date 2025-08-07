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

// Configura a chave da API do SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Armazenamento em memória para idempotência (substituir por DB em produção)
const processedPaymentIntents = new Set();

// Middlewares
app.use('/api/webhook', express.raw({ type: 'application/json' }));
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Servir arquivos estáticos
app.use('/css', express.static(path.join(__dirname, 'public/css')));
app.use('/js', express.static(path.join(__dirname, 'public/js')));
app.use('/images', express.static(path.join(__dirname, 'public/images')));

// Função de validação de dados
function validatePaymentData(data) {
    const { amount, currency, plan, passengers, date, customer } = data;
    if (!amount || amount <= 0) throw new Error('Invalid amount');
    if (!currency || !['USD', 'BRL', 'EUR'].includes(currency.toUpperCase())) throw new Error('Invalid currency');
    if (!plan || !plan.name || !plan.days) throw new Error('Invalid plan data');
    if (!passengers || passengers <= 0) throw new Error('Invalid passenger count');
    if (!date) throw new Error('Invalid date');
    if (!customer || !customer.fullName || !customer.email) throw new Error('Customer information is required');
    return true;
}

// Função de envio de e-mail usando o Template Dinâmico do SendGrid
async function sendConfirmationEmail(paymentIntent) {
    try {
        const sendgridApiKey = process.env.SENDGRID_API_KEY;
        const templateId = process.env.SENDGRID_TEMPLATE_ID;

        if (!sendgridApiKey || !templateId) {
            console.warn('SendGrid API Key ou Template ID não configurados. Pulando envio de e-mail.');
            return;
        }

        const { metadata } = paymentIntent;
        
        // Objeto com os dados que serão inseridos nas variáveis {{exemplo}} do seu template
        const dynamicTemplateData = {
            customer_name: metadata.customerName,
            payment_intent_id: paymentIntent.id.replace('pi_', ''),
            plan_name: metadata.plan,
            plan_days: metadata.days,
            passengers: metadata.passengers,
            activation_date: new Date(metadata.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' }),
            total_amount: `${(paymentIntent.amount / 100).toFixed(2)} ${paymentIntent.currency.toUpperCase()}`
        };

        const msg = {
            // SendGrid enviará um e-mail individual para cada destinatário neste array.
            // O cliente não verá os e-mails da equipe, funcionando como uma Cópia Oculta (CCo).
            to: [
                { email: metadata.customerEmail, name: metadata.customerName },
                { email: 'financeiro@vpoexperience.com', name: 'Financeiro VPO' },
                { email: 'matriz@airland.com.br', name: 'Matriz Airland' }
            ],
            from: {
                email: 'noreply@vpoexperience.com', // IMPORTANTE: Deve ser um e-mail/domínio verificado no SendGrid
                name: 'VPO Experience'
            },
            templateId: templateId, // ID do seu template no SendGrid
            dynamic_template_data: dynamicTemplateData, // Dados para preencher o template
        };
        
        await sgMail.send(msg);
        console.log(`E-mail de template dinâmico enviado com sucesso para o PaymentIntent: ${paymentIntent.id}`);
        
    } catch (error) {
        console.error('Erro ao enviar e-mail de template dinâmico:', error.response?.body || error.message);
    }
}


// --- ROTAS DA API ---

app.get('/api/stripe-key', (req, res) => {
    if (!process.env.STRIPE_PUBLISHABLE_KEY) {
        return res.status(500).json({ error: 'Stripe publishable key not configured' });
    }
    res.json({ publishableKey: process.env.STRIPE_PUBLISHABLE_KEY });
});

app.post('/api/create-payment-intent', async (req, res) => {
    try {
        validatePaymentData(req.body);
        const { amount, currency, plan, passengers, date, customer } = req.body;

        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount * 100),
            currency: 'usd',
            automatic_payment_methods: { enabled: true },
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
                customerCountry: customer.country,
                requestedCurrency: currency
            }
        });

        res.json({ clientSecret: paymentIntent.client_secret, paymentIntentId: paymentIntent.id });
    } catch (error) {
        console.error('Erro ao criar payment intent:', error);
        res.status(400).json({ error: error.message || 'Falha ao criar payment intent' });
    }
});

// --- WEBHOOK DO STRIPE ---

app.post('/api/webhook', async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error('Falha na verificação da assinatura do webhook:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    switch (event.type) {
        case 'payment_intent.succeeded':
            const paymentIntent = event.data.object;
            await handleSuccessfulPayment(paymentIntent);
            break;
        case 'payment_intent.payment_failed':
            const failedPayment = event.data.object;
            await handleFailedPayment(failedPayment);
            break;
        default:
            console.log(`Evento não tratado: ${event.type}`);
    }
    res.json({ received: true });
});

// --- LÓGICA DE NEGÓCIO (HANDLERS) ---

async function handleSuccessfulPayment(paymentIntent) {
    if (processedPaymentIntents.has(paymentIntent.id)) {
        console.log(`Verificação de Idempotência: PaymentIntent ${paymentIntent.id} já processado. Pulando.`);
        return;
    }
    try {
        console.log('Processando lógica de pagamento bem-sucedido para:', paymentIntent.id);
        await sendConfirmationEmail(paymentIntent);
        processedPaymentIntents.add(paymentIntent.id);
        console.log(`PaymentIntent ${paymentIntent.id} marcado como processado.`);
    } catch (error) {
        console.error('Erro ao lidar com pagamento bem-sucedido:', error);
    }
}

async function handleFailedPayment(paymentIntent) {
    try {
        console.log('Processando pagamento falho:', {
            id: paymentIntent.id,
            lastPaymentError: paymentIntent.last_payment_error?.message,
            customer: paymentIntent.metadata.customerEmail
        });
    } catch (error) {
        console.error('Erro ao lidar com pagamento falho:', error);
    }
}

// --- ROTAS GERAIS E ERRO ---

app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        stripe: !!process.env.STRIPE_SECRET_KEY,
        sendgrid: !!process.env.SENDGRID_API_KEY
    });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((error, req, res, next) => {
    console.error('Erro não tratado:', error);
    res.status(500).json({
        error: 'Erro interno do servidor',
        ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
});

// --- INICIALIZAÇÃO DO SERVIDOR ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    console.log(`Stripe configurado: ${!!process.env.STRIPE_SECRET_KEY}`);
    console.log(`SendGrid configurado: ${!!process.env.SENDGRID_API_KEY}`);
});
