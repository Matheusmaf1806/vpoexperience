// Global variables
let selectedPlan = null;
let adults = 1;
let children = 0;
let currentDestination = null;
let currentCurrency = 'USD';
let stripe = null;

// Fixed pricing (in USD)
const FIXED_PRICES = {
    1: 199,
    2: 397, 
    3: 589,
    4: 749
};

// Currency exchange rates (approximate)
const EXCHANGE_RATES = {
    USD: 1,
    BRL: 5.5,
    EUR: 0.85
};

// Currency symbols
const CURRENCY_SYMBOLS = {
    USD: '$',
    BRL: 'R$',
    EUR: '€'
};

// Initialize Stripe
async function initializeStripe() {
    try {
        const response = await fetch('/api/stripe-key');
        const { publishableKey } = await response.json();
        stripe = Stripe(publishableKey);
    } catch (error) {
        console.error('Error initializing Stripe:', error);
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
                ${plan.popular ? '<div class="popular-badge">MOST POPULAR</div>' : ''}
                <div class="plan-checkmark"><i class="fas fa-check-circle"></i></div>
                <div class="plan-header">
                    <h3 class="plan-title">${plan.days} ${plan.days === 1 ? 'Day' : 'Days'}</h3>
                    <div class="plan-price">${priceConverted}</div>
                    <div class="plan-price-usd">${pricePerDay} per day</div>
                    <div class="plan-period">Complete guidance</div>
                </div>
                <div class="plan-features">
                    <ul>
                        <li><i class="fas fa-check"></i> Park Planning</li>
                        <li><i class="fas fa-check"></i> General tips to avoid queues</li>
                        <li><i class="fas fa-check"></i> Skip the Line scheduling</li>
                        <li><i class="fas fa-check"></i> Detailed planning</li>
                        <li><i class="fas fa-check"></i> Theme restaurant reservations</li>
                        <li><i class="fas fa-check"></i> Bilingual WhatsApp support</li>
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

// Show checkout modal
function showCheckoutModal() {
    const modal = document.getElementById('checkout-modal');
    const checkoutDetails = document.getElementById('checkout-details');
    
    if (!selectedPlan) {
        alert('Please select a plan first.');
        return;
    }
    
    const travelDate = document.getElementById('travel-date-input').value;
    if (!travelDate) {
        alert('Please select an activation date.');
        return;
    }
    
    const totalPax = adults + children;
    if (totalPax === 0) {
        alert('Please select at least one passenger.');
        return;
    }
    
    const groupCount = Math.ceil(totalPax / 10) || 1;
    const basePriceUSD = FIXED_PRICES[selectedPlan.days];
    const totalPriceUSD = basePriceUSD * groupCount;
    
    // Update checkout details
    checkoutDetails.innerHTML = `
        <div style="border-bottom: 1px solid var(--gray-200); padding-bottom: 1rem; margin-bottom: 1rem;">
            <h4>${currentDestination.charAt(0).toUpperCase() + currentDestination.slice(1)} - ${selectedPlan.days} Day${selectedPlan.days > 1 ? 's' : ''}</h4>
            <p>${adults} Adult${adults > 1 ? 's' : ''}${children > 0 ? `, ${children} Child${children > 1 ? 'ren' : ''}` : ''}</p>
            <p>Date: ${new Date(travelDate).toLocaleDateString()}</p>
            <p>Groups: ${groupCount}</p>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 1.25rem; font-weight: bold;">
            <span>Total:</span>
            <span>${formatPrice(totalPriceUSD)}</span>
        </div>
    `;
    
    modal.style.display = 'block';
    
    // Initialize Stripe Elements
    initializePayment(totalPriceUSD);
}

// Initialize payment
async function initializePayment(totalPriceUSD) {
    if (!stripe) {
        await initializeStripe();
    }
    
    const elements = stripe.elements();
    const cardElement = elements.create('card', {
        style: {
            base: {
                fontSize: '16px',
                color: '#424770',
                '::placeholder': {
                    color: '#aab7c4',
                },
            },
        },
    });
    
    const cardElementContainer = document.getElementById('card-element');
    cardElementContainer.innerHTML = '';
    cardElement.mount('#card-element');
    
    // Handle form submission
    const form = document.getElementById('payment-form');
    form.onsubmit = async (event) => {
        event.preventDefault();
        
        const submitButton = document.getElementById('submit-payment');
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
        
        try {
            // Convert price to selected currency
            const totalAmount = totalPriceUSD * EXCHANGE_RATES[currentCurrency];
            
            // Create payment intent
            const response = await fetch('/api/create-payment-intent', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    amount: totalAmount,
                    currency: currentCurrency,
                    plan: {
                        name: `${currentDestination.charAt(0).toUpperCase() + currentDestination.slice(1)} - ${selectedPlan.days} Day${selectedPlan.days > 1 ? 's' : ''}`,
                        days: selectedPlan.days
                    },
                    passengers: adults + children,
                    date: document.getElementById('travel-date-input').value
                }),
            });
            
            const { clientSecret } = await response.json();
            
            // Confirm payment
            const result = await stripe.confirmCardPayment(clientSecret, {
                payment_method: {
                    card: cardElement,
                    billing_details: {
                        name: 'Customer', // In a real app, you'd collect this
                    },
                }
            });
            
            if (result.error) {
                document.getElementById('card-errors').textContent = result.error.message;
                submitButton.disabled = false;
                submitButton.innerHTML = '<span data-i18n="checkout.pay">Pay Now</span>';
            } else {
                // Payment succeeded
                alert('Payment successful! Thank you for your purchase.');
                document.getElementById('checkout-modal').style.display = 'none';
            }
        } catch (error) {
            console.error('Payment error:', error);
            document.getElementById('card-errors').textContent = 'An error occurred. Please try again.';
            submitButton.disabled = false;
            submitButton.innerHTML = '<span data-i18n="checkout.pay">Pay Now</span>';
        }
    };
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize Lucide icons
    if (window.lucide) lucide.createIcons();
    
    // Set minimum date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const minDate = tomorrow.toISOString().split('T')[0];
    document.getElementById('travel-date-input').min = minDate;
    
    // Currency selector
    const currencySelect = document.getElementById('currency-select');
    currencySelect.addEventListener('change', (e) => {
        currentCurrency = e.target.value;
        if (selectedPlan) {
            renderPlans();
        }
        updateTotalPrice();
    });
    
    // Passenger selector logic
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
    
    // Accordion functionality
    document.querySelectorAll('.accordion-trigger').forEach(trigger => {
        trigger.addEventListener('click', () => {
            toggleAccordion(trigger.parentElement);
        });
    });
    
    // Checkout button
    document.getElementById('checkout-btn').addEventListener('click', showCheckoutModal);
    
    // Modal close functionality
    document.getElementById('close-modal').addEventListener('click', () => {
        document.getElementById('checkout-modal').style.display = 'none';
    });
    
    window.addEventListener('click', (event) => {
        const modal = document.getElementById('checkout-modal');
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
    
    // Initial UI setup
    updatePassengerUI();
    
    // Initialize Stripe
    initializeStripe();
});

// Global functions for onclick handlers
window.showPlans = showPlans;
window.selectPlan = selectPlan;
