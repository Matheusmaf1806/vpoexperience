// Global variables
let selectedPlan = null;
let adults = 1;
let children = 0;
let currentDestination = null;
let currentCurrency = 'USD';
let stripe = null;
let currentPaymentIntentId = null;

// Fixed pricing (in USD)
const FIXED_PRICES = {
    1: 199,
    2: 397,
    3: 589,
    4: 749
};

// --- ALTERAÇÃO ---
// As taxas de câmbio agora são usadas APENAS PARA EXIBIÇÃO no frontend.
// A cobrança real será sempre processada em USD no backend.
const EXCHANGE_RATES = {
    USD: 1,
    BRL: 5.5, // Taxa de exemplo para exibição
    EUR: 0.85  // Taxa de exemplo para exibição
};

// Currency symbols
const CURRENCY_SYMBOLS = {
    USD: '$',
    BRL: 'R$',
    EUR: '€'
};

// Stripe Product IDs mapping
const STRIPE_PRODUCTS = {
    orlando: {
        1: 'prod_SoBce813cZyr8J',
        2: 'prod_SoDEy82gkNoFb7',
        3: 'prod_SoDEIy1ZmYtTCf',
        4: 'prod_SoDE5A0xGZhcd7'
    },
    california: {
        1: 'prod_SoDSgwQhfSnvBa',
        2: 'prod_SoDStcR0TDUt3w',
        3: 'prod_SoDSozYy2aaqCv',
        4: 'prod_SoDSYxpr3jgqF1'
    },
    paris: {
        1: 'prod_SoDVduJiat8nq9',
        2: 'prod_SoDVXdKjBGwEqT',
        3: 'prod_SoDV0iH1oHQ1ZU',
        4: 'prod_SoDVfd14jLT7P2'
    }
};

// Initialize Stripe
async function initializeStripe() {
    try {
        const response = await fetch('/api/stripe-key');
        if (!response.ok) {
            throw new Error('Failed to get Stripe key');
        }
        const { publishableKey } = await response.json();
        stripe = Stripe(publishableKey);
        console.log('Stripe initialized successfully');
    } catch (error) {
        console.error('Error initializing Stripe:', error);
        showError('Failed to initialize payment system. Please refresh the page.');
    }
}

// Get current language for translations
function getCurrentLanguage() {
    return localStorage.getItem('vpo-language') || 'en';
}

// Get translated text
function getTranslation(key) {
    const lang = getCurrentLanguage();
    const keys = key.split('.');
    let translation = translations[lang];
    
    for (const k of keys) {
        if (translation && translation[k]) {
            translation = translation[k];
        } else {
            // Fallback to English
            translation = translations.en;
            for (const k2 of keys) {
                if (translation && translation[k2]) {
                    translation = translation[k2];
                } else {
                    return key; // Return key if translation not found
                }
            }
            break;
        }
    }
    
    return typeof translation === 'string' ? translation : key;
}

// Show error with beautiful styling
function showError(message) {
    // Remove any existing error notifications
    const existingError = document.querySelector('.error-notification');
    if (existingError) {
        existingError.remove();
    }

    // Create error notification
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-notification';
    errorDiv.innerHTML = `
        <div class="error-content">
            <i class="fas fa-exclamation-circle"></i>
            <span>${message}</span>
            <button class="error-close" onclick="this.parentElement.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;

    // Add styles if not already present
    if (!document.getElementById('error-notification-styles')) {
        const styles = document.createElement('style');
        styles.id = 'error-notification-styles';
        styles.textContent = `
            .error-notification {
                position: fixed;
                top: 20px;
                right: 20px;
                background: linear-gradient(135deg, #ff6b6b, #ee5a52);
                color: white;
                padding: 0;
                border-radius: 12px;
                box-shadow: 0 8px 32px rgba(255, 107, 107, 0.3);
                z-index: 10000;
                min-width: 300px;
                max-width: 500px;
                animation: slideInRight 0.3s ease-out;
                backdrop-filter: blur(10px);
            }
            
            .error-content {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 16px 20px;
            }
            
            .error-content i:first-child {
                font-size: 20px;
                flex-shrink: 0;
            }
            
            .error-content span {
                flex: 1;
                font-weight: 500;
                line-height: 1.4;
            }
            
            .error-close {
                background: rgba(255, 255, 255, 0.2);
                border: none;
                border-radius: 6px;
                color: white;
                cursor: pointer;
                padding: 6px;
                transition: background-color 0.2s;
                flex-shrink: 0;
            }
            
            .error-close:hover {
                background: rgba(255, 255, 255, 0.3);
            }
            
            @keyframes slideInRight {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            
            @media (max-width: 768px) {
                .error-notification {
                    top: 10px;
                    right: 10px;
                    left: 10px;
                    min-width: auto;
                    max-width: none;
                }
            }
        `;
        document.head.appendChild(styles);
    }

    // Add to page
    document.body.appendChild(errorDiv);

    // Auto remove after 7 seconds
    setTimeout(() => {
        if (errorDiv.parentNode) {
            errorDiv.remove();
        }
    }, 7000);
}

// Success handling function
function showSuccess(message) {
    alert(message);
}

// Format price based on currency
function formatPrice(priceUSD, currency = currentCurrency) {
    const convertedPrice = priceUSD * EXCHANGE_RATES[currency];
    const symbol = CURRENCY_SYMBOLS[currency];
    
    return `${symbol}${convertedPrice.toLocaleString('en-US', { 
        minimumFractionDigits: 2,
        maximumFractionDigits: 2 
    })}`;
}

// Show plans for destination
function showPlans(destination) {
    currentDestination = destination;
    selectedPlan = null;
    
    const container = document.getElementById('plans-display-container');
    const destinationName = document.getElementById('destination-name');
    
    // Map destination to display name
    const destinationNames = {
        orlando: 'Orlando',
        california: 'California', 
        paris: 'Paris'
    };
    
    destinationName.textContent = destinationNames[destination];
    container.style.display = 'block';
    container.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    renderPlans();
    updateTotalPrice();
}

// Render plans
function renderPlans() {
    const grid = document.getElementById('plans-grid');
    
    const plans = [
        { days: 1, popular: false },
        { days: 2, popular: false },
        { days: 3, popular: true },
        { days: 4, popular: false }
    ];
    
    grid.innerHTML = plans.map((plan, index) => {
        const priceUSD = FIXED_PRICES[plan.days];
        const priceConverted = formatPrice(priceUSD);
        const pricePerDay = formatPrice(priceUSD / plan.days);
        
        return `
            <div class="plan-card ${plan.popular ? 'popular' : ''}" data-plan-index="${index}" onclick="selectPlan(${index})">
                ${plan.popular ? `<div class="popular-badge">${getTranslation('plans.most_popular')}</div>` : ''}
                <div class="plan-checkmark"><i class="fas fa-check-circle"></i></div>
                <div class="plan-header">
                    <h3 class="plan-title">${plan.days} ${plan.days === 1 ? 'Day' : 'Days'}</h3>
                    <div class="plan-price">${priceConverted}</div>
                    <div class="plan-price-usd">${pricePerDay} ${getTranslation('plans.per_day')}</div>
                    <div class="plan-period">${getTranslation('plans.complete_guidance')}</div>
                </div>
                <div class="plan-features">
                    <ul>
                        <li><i class="fas fa-check"></i> ${getTranslation('plans.features.park_planning')}</li>
                        <li><i class="fas fa-check"></i> ${getTranslation('plans.features.queue_tips')}</li>
                        <li><i class="fas fa-check"></i> ${getTranslation('plans.features.skip_line')}</li>
                        <li><i class="fas fa-check"></i> ${getTranslation('plans.features.detailed_planning')}</li>
                        <li><i class="fas fa-check"></i> ${getTranslation('plans.features.restaurant_reservations')}</li>
                        <li><i class="fas fa-check"></i> ${getTranslation('plans.features.whatsapp_support')}</li>
                    </ul>
                </div>
            </div>
        `;
    }).join('');
    
    // Auto-select most popular plan
    const popularIndex = plans.findIndex(p => p.popular);
    selectPlan(popularIndex >= 0 ? popularIndex : 0);
}

// Select plan
function selectPlan(index) {
    document.querySelectorAll('.plan-card').forEach(card => card.classList.remove('selected'));
    const selectedCard = document.querySelector(`[data-plan-index="${index}"]`);
    
    if (selectedCard) {
        selectedCard.classList.add('selected');
        const plans = [
            { days: 1, popular: false },
            { days: 2, popular: false }, 
            { days: 3, popular: true },
            { days: 4, popular: false }
        ];
        selectedPlan = plans[index];
        updateTotalPrice();
    }
}

// Update total price
function updateTotalPrice() {
    const totalElement = document.getElementById('total-price-value');
    
    if (selectedPlan) {
        const totalPax = adults + children;
        if (totalPax === 0) {
            totalElement.textContent = formatPrice(0);
            return;
        }
        
        const groupCount = Math.ceil(totalPax / 10) || 1;
        const basePriceUSD = FIXED_PRICES[selectedPlan.days];
        const totalPriceUSD = basePriceUSD * groupCount;
        
        totalElement.textContent = formatPrice(totalPriceUSD);
    } else {
        totalElement.textContent = formatPrice(0);
    }
}

// Update passenger UI
function updatePassengerUI() {
    document.getElementById('adults-count').textContent = adults;
    document.getElementById('children-count').textContent = children;
    
    document.querySelector('.passenger-btn[data-type="adults"][data-action="decrease"]').disabled = adults === 1 && children === 0;
    document.querySelector('.passenger-btn[data-type="children"][data-action="decrease"]').disabled = children === 0;
    
    const totalPax = adults + children;
    const groupCount = Math.ceil(totalPax / 10) || 1;
    
    document.getElementById('total-pax-count').textContent = totalPax;
    document.getElementById('group-size').textContent = `${groupCount} ${groupCount > 1 ? 'groups' : 'group'}`;
    
    let displayText = `${adults} adult${adults !== 1 ? 's' : ''}`;
    if (children > 0) {
        displayText += `, ${children} child${children !== 1 ? 'ren' : ''}`;
    }
    document.querySelector('.passenger-text').textContent = displayText;
    
    updateTotalPrice();
}

// Accordion functionality
function toggleAccordion(item) {
    const content = item.querySelector('.accordion-content');
    const icon = item.querySelector('.accordion-icon');
    
    if (item.classList.contains('active')) {
        item.classList.remove('active');
        content.style.height = '0';
        if (icon) icon.style.transform = 'rotate(0deg)';
    } else {
        // Close all others first
        document.querySelectorAll('.accordion-item.active').forEach(activeItem => {
            activeItem.classList.remove('active');
            activeItem.querySelector('.accordion-content').style.height = '0';
            const activeIcon = activeItem.querySelector('.accordion-icon');
            if (activeIcon) activeIcon.style.transform = 'rotate(0deg)';
        });
        
        item.classList.add('active');
        content.style.height = content.scrollHeight + 'px';
        if (icon) icon.style.transform = 'rotate(180deg)';
    }
}

// Validation functions
function validateCheckoutData() {
    if (!selectedPlan) {
        throw new Error(getTranslation('validation.select_plan'));
    }
    
    const travelDate = document.getElementById('travel-date-input').value;
    if (!travelDate) {
        throw new Error(getTranslation('validation.select_date'));
    }
    
    const totalPax = adults + children;
    if (totalPax === 0) {
        throw new Error(getTranslation('validation.select_passengers'));
    }
    
    const selectedDate = new Date(travelDate);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (selectedDate < tomorrow) {
        throw new Error(getTranslation('validation.future_date'));
    }
    
    return { travelDate, totalPax };
}

// Validate customer form
function validateCustomerForm() {
    const errors = {};
    
    // Get form values
    const fullName = document.getElementById('customer-name').value.trim();
    const email = document.getElementById('customer-email').value.trim();
    const phone = document.getElementById('customer-phone').value.trim();
    const address = document.getElementById('customer-address').value.trim();
    const city = document.getElementById('customer-city').value.trim();
    const country = document.getElementById('customer-country').value;
    const currency = document.getElementById('checkout-currency').value;
    
    // Validate required fields
    if (!fullName) errors.name = 'Full name is required';
    if (!email) errors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Please enter a valid email';
    if (!phone) errors.phone = 'Phone number is required';
    if (!address) errors.address = 'Address is required';
    if (!city) errors.city = 'City is required';
    if (!country) errors.country = 'Country is required';
    
    // Display errors
    Object.keys(errors).forEach(field => {
        const fieldElement = document.getElementById(`customer-${field === 'name' ? 'name' : field}`);
        const errorElement = fieldElement.parentNode.querySelector('.error-message');
        
        if (errorElement) {
            errorElement.textContent = errors[field];
        } else {
            const newError = document.createElement('div');
            newError.className = 'error-message';
            newError.textContent = errors[field];
            fieldElement.parentNode.appendChild(newError);
        }
        fieldElement.classList.add('error');
    });
    
    // Clear previous errors for valid fields
    const allFields = ['customer-name', 'customer-email', 'customer-phone', 'customer-address', 'customer-city', 'customer-country'];
    allFields.forEach(fieldId => {
        if (!Object.keys(errors).some(key => fieldId.includes(key))) {
            const fieldElement = document.getElementById(fieldId);
            const errorElement = fieldElement.parentNode.querySelector('.error-message');
            if (errorElement) errorElement.remove();
            fieldElement.classList.remove('error');
        }
    });
    
    if (Object.keys(errors).length > 0) {
        throw new Error(getTranslation('validation.fill_required'));
    }
    
    return {
        fullName,
        email,
        phone,
        address,
        city,
        country,
        currency
    };
}

// Show checkout modal
function showCheckoutModal() {
    try {
        const { travelDate, totalPax } = validateCheckoutData();
        
        const modal = document.getElementById('checkout-modal');
        const checkoutDetails = document.getElementById('checkout-details');
        
        const groupCount = Math.ceil(totalPax / 10) || 1;
        const basePriceUSD = FIXED_PRICES[selectedPlan.days];
        const totalPriceUSD = basePriceUSD * groupCount;
        
        // Create properly translated summary
        const adultsText = adults > 0 ? `${adults} ${getTranslation('checkout.adults')}${adults > 1 ? 's' : ''}` : '';
        const childrenText = children > 0 ? `${children} ${getTranslation('checkout.children')}` : '';
        let passengersText = adultsText;
        if (adultsText && childrenText) {
            passengersText += `, ${childrenText}`;
        } else if (childrenText) {
            passengersText = childrenText;
        }
        
        // Update checkout details with translations
        checkoutDetails.innerHTML = `
            <div style="border-bottom: 1px solid var(--gray-200); padding-bottom: 1rem; margin-bottom: 1rem;">
                <h4>${currentDestination.charAt(0).toUpperCase() + currentDestination.slice(1)} - ${selectedPlan.days} Day${selectedPlan.days > 1 ? 's' : ''}</h4>
                <p>${passengersText}</p>
                <p>${getTranslation('checkout.date')}: ${new Date(travelDate).toLocaleDateString()}</p>
                <p>${getTranslation('checkout.groups')}: ${groupCount}</p>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 1.25rem; font-weight: bold;">
                <span>${getTranslation('checkout.total')}:</span>
                <span id="modal-total-price">${formatPrice(totalPriceUSD)}</span>
            </div>
        `;
        
        // Set default currency in form
        document.getElementById('checkout-currency').value = currentCurrency;
        
        modal.style.display = 'block';
        
        // Clear any previous errors
        const errorDiv = document.getElementById('card-errors');
        if (errorDiv) errorDiv.textContent = '';
        
        // Initialize Stripe Elements
        initializePayment(totalPriceUSD, travelDate);
        
    } catch (error) {
        showError(error.message);
    }
}

// Initialize payment
async function initializePayment(totalPriceUSD, travelDate) {
    try {
        if (!stripe) {
            await initializeStripe();
        }
        
        if (!stripe) {
            throw new Error('Payment system not available');
        }
        
        const elements = stripe.elements({
            appearance: {
                theme: 'stripe',
            },
        });
        
        const cardElement = elements.create('card', {
            style: {
                base: {
                    fontSize: '16px',
                    color: '#424770',
                    '::placeholder': {
                        color: '#aab7c4',
                    },
                },
                invalid: {
                    color: '#9e2146',
                },
            },
        });
        
        const cardElementContainer = document.getElementById('card-element');
        cardElementContainer.innerHTML = '';
        cardElement.mount('#card-element');
        
        // Handle real-time validation errors from the card Element
        cardElement.on('change', (event) => {
            const displayError = document.getElementById('card-errors');
            if (event.error) {
                displayError.textContent = event.error.message;
            } else {
                displayError.textContent = '';
            }
        });
        
        // Handle currency change
        document.getElementById('checkout-currency').addEventListener('change', (e) => {
            const newCurrency = e.target.value;
            const newTotal = formatPrice(totalPriceUSD, newCurrency);
            document.getElementById('modal-total-price').textContent = newTotal;
        });
        
        // Handle form submission
        const form = document.getElementById('payment-form');
        form.onsubmit = async (event) => {
            event.preventDefault();
            await processPayment(cardElement, totalPriceUSD, travelDate);
        };
        
    } catch (error) {
        console.error('Error initializing payment:', error);
        showError('Failed to initialize payment form. Please try again.');
    }
}

// Process payment
async function processPayment(cardElement, totalPriceUSD, travelDate) {
    const submitButton = document.getElementById('submit-payment');
    const originalButtonText = submitButton.innerHTML;
    
    try {
        // Validate customer form first
        const customerData = validateCustomerForm();
        
        // Disable submit button and show loading
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
        
        // Clear any previous errors
        const errorDiv = document.getElementById('card-errors');
        errorDiv.textContent = '';
        
        // Get selected currency from form for metadata purposes
        const selectedCurrency = document.getElementById('checkout-currency').value;
        
        // Get Stripe product ID
        const productId = STRIPE_PRODUCTS[currentDestination][selectedPlan.days];
        
        // Create payment intent
        // --- ALTERAÇÃO INÍCIO ---
        // Enviamos o valor em USD (totalPriceUSD) para o backend.
        // O backend irá ignorar a moeda selecionada e forçar a cobrança em USD.
        const response = await fetch('/api/create-payment-intent', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                amount: totalPriceUSD, // Sempre envie o valor base em USD
                currency: selectedCurrency, // Envie a moeda selecionada para metadados/exibição
                plan: {
                    name: `Remote Guide ${currentDestination.charAt(0).toUpperCase() + currentDestination.slice(1)} - ${selectedPlan.days} Day${selectedPlan.days > 1 ? 's' : ''}`,
                    days: selectedPlan.days,
                    productId: productId
                },
                passengers: adults + children,
                date: travelDate,
                customer: customerData
            }),
        });
        // --- ALTERAÇÃO FIM ---
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Payment setup failed');
        }
        
        const { clientSecret, paymentIntentId } = await response.json();
        currentPaymentIntentId = paymentIntentId;
        
        // Confirm payment
        const result = await stripe.confirmCardPayment(clientSecret, {
            payment_method: {
                card: cardElement,
                billing_details: {
                    name: customerData.fullName,
                    email: customerData.email,
                    phone: customerData.phone,
                    address: {
                        line1: customerData.address,
                        city: customerData.city,
                        country: customerData.country,
                    },
                },
            }
        });
        
        if (result.error) {
            throw new Error(result.error.message);
        } else {
            // Payment succeeded
            handlePaymentSuccess(result.paymentIntent);
        }
        
    } catch (error) {
        console.error('Payment error:', error);
        showError(error.message || 'Payment failed. Please try again.');
    } finally {
        // Re-enable submit button
        submitButton.disabled = false;
        submitButton.innerHTML = originalButtonText;
    }
}

// Handle successful payment
function handlePaymentSuccess(paymentIntent) {
    console.log('Payment succeeded on client:', paymentIntent);
    
    // A confirmação final (e-mail, etc.) é feita pelo webhook do servidor.
    // Aqui, apenas notificamos o usuário.
    showSuccess('Payment successful! Thank you for your purchase. You will receive a confirmation email shortly.');
    
    // Close modal
    document.getElementById('checkout-modal').style.display = 'none';
    
    // You could redirect to a success page
    // window.location.href = '/success?payment_intent=' + paymentIntent.id;
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Initialize Lucide icons
        if (window.lucide) lucide.createIcons();
        
        // Set minimum date to tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const minDate = tomorrow.toISOString().split('T')[0];
        const dateInput = document.getElementById('travel-date-input');
        if (dateInput) {
            dateInput.min = minDate;
        }
        
        // Currency selector
        const currencySelect = document.getElementById('currency-select');
        if (currencySelect) {
            currencySelect.addEventListener('change', (e) => {
                currentCurrency = e.target.value;
                if (selectedPlan) {
                    renderPlans();
                }
                updateTotalPrice();
            });
        }
        
        // Passenger selector logic
        const passengerSelector = document.querySelector('.passenger-selector');
        const passengerDisplay = document.querySelector('.passenger-display');
        const passengerDropdown = document.querySelector('.passenger-dropdown');
        
        if (passengerDisplay && passengerDropdown) {
            passengerDisplay.addEventListener('click', (event) => {
                event.stopPropagation();
                passengerDropdown.classList.toggle('show');
            });
            
            document.addEventListener('click', (event) => {
                if (passengerSelector && !passengerSelector.contains(event.target)) {
                    passengerDropdown.classList.remove('show');
                }
            });
            
            passengerDropdown.addEventListener('click', (event) => {
                const button = event.target.closest('.passenger-btn');
                if (!button) return;
                
                const type = button.dataset.type;
                const action = button.dataset.action;
                
                if (action === 'increase') {
                    if (type === 'adults') adults++;
                    else if (type === 'children') children++;
                } else if (action === 'decrease') {
                    if (type === 'adults' && (adults > 1 || (adults === 1 && children > 0))) {
                        adults--;
                    } else if (type === 'children' && children > 0) {
                        children--;
                    }
                }
                
                if (adults + children === 0) adults = 1;
                updatePassengerUI();
            });
        }
        
        // Accordion functionality
        document.querySelectorAll('.accordion-trigger').forEach(trigger => {
            trigger.addEventListener('click', () => {
                toggleAccordion(trigger.parentElement);
            });
        });
        
        // Checkout button
        const checkoutBtn = document.getElementById('checkout-btn');
        if (checkoutBtn) {
            checkoutBtn.addEventListener('click', showCheckoutModal);
        }
        
        // Modal close functionality
        const closeModal = document.getElementById('close-modal');
        if (closeModal) {
            closeModal.addEventListener('click', () => {
                document.getElementById('checkout-modal').style.display = 'none';
            });
        }
        
        window.addEventListener('click', (event) => {
            const modal = document.getElementById('checkout-modal');
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });
        
        // Initial UI setup
        updatePassengerUI();
        
        // Initialize Stripe
        await initializeStripe();
        
    } catch (error) {
        console.error('Error initializing app:', error);
    }
});

// Global functions for onclick handlers
window.showPlans = showPlans;
window.selectPlan = selectPlan;
