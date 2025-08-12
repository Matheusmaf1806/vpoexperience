// Global variables
let selectedPlan = null;
let adults = 1;
let children = 0;
let currentDestination = null;
let currentCurrency = 'USD';
let stripe = null;
let currentPaymentIntentId = null;
let currentLanguage = 'en'; // Keep track of current language

// Fixed pricing (in USD)
const FIXED_PRICES = {
    1: 199,
    2: 397,
    3: 589,
    4: 749
};

const EXCHANGE_RATES = {
    USD: 1,
    BRL: 5.5,
    EUR: 0.85
};

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

// --- HELPER FUNCTIONS ---

// NEW: Toast Notification Function
function showToast(message, type = 'error', duration = 4000) {
    const toast = document.getElementById('toast-notification');
    if (!toast) {
        console.error("Toast notification element not found!");
        alert(message); // Fallback to alert
        return;
    }

    toast.textContent = message;
    toast.className = 'toast show'; // Reset classes
    if (type === 'success') {
        toast.classList.add('success');
    } else {
        toast.classList.add('error');
    }

    setTimeout(() => {
        toast.classList.remove('show');
    }, duration);
}

// UPDATED: Centralized error/success handling
function showError(message) {
    showToast(message, 'error');
}

function showSuccess(message) {
    showToast(message, 'success');
}

// NEW: Helper to get translation string
function getTranslation(key) {
    const lang = localStorage.getItem('vpo-language') || 'en';
    // Fallback for missing translations object
    if (!window.translations) {
        console.error("Translations object is not loaded.");
        return key;
    }
    const keys = key.split('.');
    let translation = translations[lang];
    for (const k of keys) {
        if (translation && translation[k] !== undefined) {
            translation = translation[k];
        } else {
            // Fallback to English if key not found in current language
            translation = translations.en;
            for (const k2 of keys) {
                if (translation && translation[k2] !== undefined) {
                    translation = translation[k2];
                } else {
                    return key; // Return the key itself if not found anywhere
                }
            }
            break;
        }
    }
    return translation;
}

// Initialize Stripe
async function initializeStripe() {
    try {
        const response = await fetch('/api/stripe-key');
        if (!response.ok) {
            throw new Error('Failed to get Stripe key');
        }
        const { publishableKey } = await response.json();
        stripe = Stripe(publishableKey);
    } catch (error) {
        console.error('Error initializing Stripe:', error);
        showError('Payment system failed to load. Please refresh.');
    }
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

// --- CORE UI FUNCTIONS ---

// Show plans for destination
function showPlans(destination) {
    currentDestination = destination;
    selectedPlan = null;
    
    const container = document.getElementById('plans-display-container');
    const destinationName = document.getElementById('destination-name');
    
    destinationName.textContent = getTranslation(`destinations.${destination}`);
    container.style.display = 'block';
    // Optional: Only scroll on desktop to prevent annoying jumps on mobile
    if (window.innerWidth > 768) {
      container.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    
    renderPlans();
    updateTotalPrice();
}

// UPDATED: Render plans with translated text
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
        
        return `
            <div class="plan-card ${plan.popular ? 'popular' : ''}" data-plan-index="${index}" onclick="selectPlan(${index})">
                ${plan.popular ? `<div class="popular-badge">${getTranslation('plans.popular')}</div>` : ''}
                <div class="plan-checkmark"><i class="fas fa-check-circle"></i></div>
                <div class="plan-header">
                    <h3 class="plan-title">${plan.days} ${getTranslation(plan.days === 1 ? 'plans.day' : 'plans.days')}</h3>
                    <div class="plan-price">${formatPrice(priceUSD)}</div>
                    <div class="plan-price-usd">${formatPrice(priceUSD / plan.days)} ${getTranslation('plans.per_day')}</div>
                    <div class="plan-period">${getTranslation('plans.features.title')}</div>
                </div>
                <div class="plan-features">
                    <ul>
                        <li><i class="fas fa-check"></i> ${getTranslation('plans.features.item1')}</li>
                        <li><i class="fas fa-check"></i> ${getTranslation('plans.features.item2')}</li>
                        <li><i class="fas fa-check"></i> ${getTranslation('plans.features.item3')}</li>
                        <li><i class="fas fa-check"></i> ${getTranslation('plans.features.item4')}</li>
                        <li><i class="fas fa-check"></i> ${getTranslation('plans.features.item5')}</li>
                        <li><i class="fas fa-check"></i> ${getTranslation('plans.features.item6')}</li>
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
        // A simple object is enough here as we only need the days
        const plans = [ { days: 1 }, { days: 2 }, { days: 3 }, { days: 4 } ];
        selectedPlan = plans[index];
        updateTotalPrice();
    }
}

// Update total price
function updateTotalPrice() {
    const totalElement = document.getElementById('total-price-value');
    if (!selectedPlan) {
        totalElement.textContent = formatPrice(0);
        return;
    }
    
    const totalPax = adults + children;
    const groupCount = Math.ceil(totalPax / 10) || 1;
    const basePriceUSD = FIXED_PRICES[selectedPlan.days];
    const totalPriceUSD = basePriceUSD * groupCount;
    totalElement.textContent = formatPrice(totalPriceUSD);
}

// UPDATED: Update passenger UI with translated text
function updatePassengerUI() {
    document.getElementById('adults-count').textContent = adults;
    document.getElementById('children-count').textContent = children;
    
    document.querySelector('.passenger-btn[data-type="adults"][data-action="decrease"]').disabled = adults === 1 && children === 0;
    document.querySelector('.passenger-btn[data-type="children"][data-action="decrease"]').disabled = children === 0;
    
    const totalPax = adults + children;
    const groupCount = Math.ceil(totalPax / 10) || 1;
    
    document.getElementById('total-pax-count').textContent = totalPax;
    document.getElementById('group-size').textContent = `${groupCount} ${getTranslation(groupCount > 1 ? 'plans.groups' : 'plans.group')}`;
    
    let adultText = `${adults} ${getTranslation(adults !== 1 ? 'checkout.adults' : 'checkout.adult')}`;
    let childText = children > 0 ? `, ${children} ${getTranslation(children !== 1 ? 'checkout.children' : 'checkout.child')}` : '';
    document.querySelector('.passenger-text').textContent = adultText + childText;
    
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

// --- VALIDATION AND CHECKOUT ---

// UPDATED: Validation with translated error messages
function validateCheckoutData() {
    // NOTE: Ensure these error keys exist in your translations.js file!
    if (!selectedPlan) {
        throw new Error(getTranslation('error.selectPlan') || 'Please select a plan first.');
    }
    
    const travelDate = document.getElementById('travel-date-input').value;
    if (!travelDate) {
        throw new Error(getTranslation('error.selectDate') || 'Please select an activation date.');
    }
    
    if (adults + children === 0) {
        throw new Error(getTranslation('error.selectPassengers') || 'Please add at least one passenger.');
    }
    
    // To prevent timezone issues, compare dates as strings or UTC
    const selectedDate = new Date(travelDate + 'T00:00:00');
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    if (selectedDate <= today) {
        throw new Error(getTranslation('error.dateInFuture') || 'Please select a date in the future.');
    }
    
    return { travelDate };
}


// Validate customer form
function validateCustomerForm() {
    const errors = {};
    
    const fieldsToValidate = {
        name: document.getElementById('customer-name').value.trim(),
        email: document.getElementById('customer-email').value.trim(),
        phone: document.getElementById('customer-phone').value.trim(),
        address: document.getElementById('customer-address').value.trim(),
        city: document.getElementById('customer-city').value.trim(),
        country: document.getElementById('customer-country').value
    };

    if (!fieldsToValidate.name) errors.name = 'Full name is required';
    if (!fieldsToValidate.email) {
        errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fieldsToValidate.email)) {
        errors.email = 'Please enter a valid email';
    }
    if (!fieldsToValidate.phone) errors.phone = 'Phone number is required';
    if (!fieldsToValidate.address) errors.address = 'Address is required';
    if (!fieldsToValidate.city) errors.city = 'City is required';
    if (!fieldsToValidate.country) errors.country = 'Country is required';

    // Clear all previous errors
    document.querySelectorAll('.form-group .error-message').forEach(el => el.remove());
    document.querySelectorAll('.form-group input, .form-group select').forEach(el => el.classList.remove('error'));

    if (Object.keys(errors).length > 0) {
        Object.keys(errors).forEach(field => {
            const fieldElement = document.getElementById(`customer-${field}`);
            if(fieldElement) {
                fieldElement.classList.add('error');
                const errorDiv = document.createElement('div');
                errorDiv.className = 'error-message';
                errorDiv.textContent = errors[field];
                fieldElement.parentNode.appendChild(errorDiv);
            }
        });
        throw new Error('Please fill in all required fields correctly.');
    }
    
    return {
        fullName: fieldsToValidate.name,
        email: fieldsToValidate.email,
        phone: fieldsToValidate.phone,
        address: fieldsToValidate.address,
        city: fieldsToValidate.city,
        country: fieldsToValidate.country
    };
}


// UPDATED: Show checkout modal with translated content
function showCheckoutModal() {
    try {
        const { travelDate } = validateCheckoutData();
        const modal = document.getElementById('checkout-modal');
        const checkoutDetails = document.getElementById('checkout-details');
        
        const totalPax = adults + children;
        const groupCount = Math.ceil(totalPax / 10) || 1;
        const basePriceUSD = FIXED_PRICES[selectedPlan.days];
        const totalPriceUSD = basePriceUSD * groupCount;

        const adultText = `${adults} ${getTranslation(adults > 1 ? 'checkout.adults' : 'checkout.adult')}`;
        const childText = children > 0 ? `, ${children} ${getTranslation(children > 1 ? 'checkout.children' : 'checkout.child')}` : '';
        const passengerSummary = adultText + childText;
        
        const localeForDate = (localStorage.getItem('vpo-language') || 'en').split('-')[0];

        checkoutDetails.innerHTML = `
            <div style="border-bottom: 1px solid var(--gray-200); padding-bottom: 1rem; margin-bottom: 1rem;">
                <h4>${getTranslation(`destinations.${currentDestination}`)} - ${selectedPlan.days} ${getTranslation(selectedPlan.days > 1 ? 'plans.days' : 'plans.day')}</h4>
                <p>${passengerSummary}</p>
                <p>${getTranslation('checkout.date')}: ${new Date(travelDate + 'T00:00:00').toLocaleDateString(localeForDate)}</p>
                <p>${getTranslation('checkout.groups')}: ${groupCount}</p>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 1.25rem; font-weight: bold;">
                <span>${getTranslation('checkout.total')}:</span>
                <span id="modal-total-price">${formatPrice(totalPriceUSD)}</span>
            </div>
        `;
        
        document.getElementById('checkout-currency').value = currentCurrency;
        modal.style.display = 'block';
        
        const errorDiv = document.getElementById('card-errors');
        if (errorDiv) errorDiv.textContent = '';
        
        initializePayment(totalPriceUSD, travelDate);
        
    } catch (error) {
        showError(error.message); // This now calls the toast notification
    }
}


// Initialize payment
async function initializePayment(totalPriceUSD, travelDate) {
    try {
        if (!stripe) await initializeStripe();
        if (!stripe) throw new Error('Payment system not available');
        
        const elements = stripe.elements({ appearance: { theme: 'stripe' } });
        const cardElement = elements.create('card', {
            style: {
                base: { fontSize: '16px', color: '#32325d', '::placeholder': { color: '#aab7c4' } },
                invalid: { color: '#fa755a', iconColor: '#fa755a' }
            }
        });
        
        const cardElementContainer = document.getElementById('card-element');
        cardElementContainer.innerHTML = ''; // Clear previous instances
        cardElement.mount('#card-element');
        
        cardElement.on('change', (event) => {
            const displayError = document.getElementById('card-errors');
            displayError.textContent = event.error ? event.error.message : '';
        });
        
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
    submitButton.disabled = true;
    submitButton.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${getTranslation('checkout.processing') || 'Processing...'}`;

    try {
        const customerData = validateCustomerForm();
        const errorDiv = document.getElementById('card-errors');
        errorDiv.textContent = '';
        
        const selectedCurrency = document.getElementById('checkout-currency').value;
        const productId = STRIPE_PRODUCTS[currentDestination][selectedPlan.days];

        const response = await fetch('/api/create-payment-intent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                amount: totalPriceUSD,
                currency: selectedCurrency,
                plan: {
                    name: `Remote Guide ${currentDestination} - ${selectedPlan.days} Days`,
                    days: selectedPlan.days,
                    productId: productId
                },
                passengers: adults + children,
                date: travelDate,
                customer: customerData
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Payment setup failed');
        }

        const { clientSecret } = await response.json();
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
            handlePaymentSuccess(result.paymentIntent);
        }

    } catch (error) {
        showError(error.message || 'Payment failed. Please try again.');
    } finally {
        submitButton.disabled = false;
        submitButton.innerHTML = originalButtonText;
    }
}


// Handle successful payment
function handlePaymentSuccess(paymentIntent) {
    showSuccess('Payment successful! Thank you for your purchase.');
    document.getElementById('checkout-modal').style.display = 'none';
    
    // Optional: Redirect to a success page
    // window.location.href = `/success.html?payment_intent=${paymentIntent.id}`;
}

// --- EVENT LISTENERS ---

document.addEventListener('DOMContentLoaded', async () => {
    // Set minimum date for date picker
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    document.getElementById('travel-date-input').min = tomorrow.toISOString().split('T')[0];
    
    // Language Selector
    const languageSelect = document.getElementById('language-select');
    languageSelect.addEventListener('change', (e) => {
        currentLanguage = e.target.value;
        translatePage(currentLanguage); // Assumes translatePage is in another file
        // Re-render dynamic parts
        if (currentDestination) {
            showPlans(currentDestination); 
        }
        updatePassengerUI();
    });

    // Currency Selector
    const currencySelect = document.getElementById('currency-select');
    currencySelect.addEventListener('change', (e) => {
        currentCurrency = e.target.value;
        if (selectedPlan) {
            renderPlans(); // Re-render to show new currency
        }
        updateTotalPrice();
    });

    // Passenger Selector
    const passengerSelector = document.querySelector('.passenger-selector');
    const passengerDisplay = document.querySelector('.passenger-display');
    const passengerDropdown = document.querySelector('.passenger-dropdown');
    
    passengerDisplay.addEventListener('click', (event) => {
        event.stopPropagation();
        passengerDropdown.classList.toggle('show');
    });

    document.addEventListener('click', (event) => {
        if (!passengerSelector.contains(event.target)) {
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
            else children++;
        } else if (action === 'decrease') {
            if (type === 'adults' && (adults > 1 || (adults === 1 && children > 0))) {
                adults--;
            } else if (type === 'children' && children > 0) {
                children--;
            }
        }
        updatePassengerUI();
    });

    // Accordion
    document.querySelectorAll('.accordion-trigger').forEach(trigger => {
        trigger.addEventListener('click', () => toggleAccordion(trigger.parentElement));
    });

    // Checkout button
    const checkoutBtn = document.getElementById('checkout-btn');
    checkoutBtn.addEventListener('click', () => {
        showCheckoutModal();
        // Tracking can be called inside showCheckoutModal on success, or here.
        // Let's assume trackInitiateCheckout is in another file.
        if(typeof trackInitiateCheckout === 'function') trackInitiateCheckout();
    });

    // Modal close
    const closeModal = document.getElementById('close-modal');
    closeModal.addEventListener('click', () => {
        document.getElementById('checkout-modal').style.display = 'none';
    });
    window.addEventListener('click', (event) => {
        if (event.target === document.getElementById('checkout-modal')) {
            event.target.style.display = 'none';
        }
    });
    
    // Initial Setup
    currentLanguage = localStorage.getItem('vpo-language') || 'en';
    languageSelect.value = currentLanguage;
    updatePassengerUI();
    await initializeStripe();
    if (window.lucide) lucide.createIcons();
});

// Expose functions to global scope for inline HTML onclick handlers
window.showPlans = showPlans;
window.selectPlan = selectPlan;
