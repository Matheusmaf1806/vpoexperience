// Enhanced Tracking Functions for VPO Experience Guide

class VPOTracking {
    constructor() {
        this.initializeTracking();
    }

    initializeTracking() {
        // Ensure all tracking scripts are loaded
        this.waitForTracking();
        
        // Track page interactions
        this.trackPageInteractions();
        
        // Track form interactions
        this.trackFormInteractions();
    }

    waitForTracking() {
        // Wait for all tracking scripts to be available
        const checkTracking = setInterval(() => {
            if (typeof gtag !== 'undefined' && typeof fbq !== 'undefined') {
                clearInterval(checkTracking);
                this.trackPageLoaded();
            }
        }, 100);
    }

    trackPageLoaded() {
        // Enhanced page view tracking with user engagement data
        gtag('event', 'page_view', {
            'page_title': document.title,
            'page_location': window.location.href,
            'custom_parameters': {
                'user_agent': navigator.userAgent,
                'screen_resolution': `${screen.width}x${screen.height}`,
                'language': navigator.language
            }
        });

        // Track scroll depth
        this.trackScrollDepth();
    }

    trackScrollDepth() {
        let maxScroll = 0;
        const milestones = [25, 50, 75, 90, 100];
        let trackedMilestones = new Set();

        window.addEventListener('scroll', () => {
            const scrollPercent = Math.round(
                (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100
            );

            if (scrollPercent > maxScroll) {
                maxScroll = scrollPercent;
                
                milestones.forEach(milestone => {
                    if (scrollPercent >= milestone && !trackedMilestones.has(milestone)) {
                        trackedMilestones.add(milestone);
                        
                        // Track scroll milestone
                        gtag('event', 'scroll', {
                            'percent_scrolled': milestone
                        });

                        fbq('trackCustom', 'ScrollDepth', {
                            'scroll_percent': milestone
                        });
                    }
                });
            }
        });
    }

    trackPageInteractions() {
        // Track navigation clicks
        document.querySelectorAll('nav a').forEach(link => {
            link.addEventListener('click', (e) => {
                const linkText = e.target.textContent.trim();
                gtag('event', 'click', {
                    'event_category': 'Navigation',
                    'event_label': linkText
                });

                fbq('trackCustom', 'NavigationClick', {
                    'link_text': linkText
                });
            });
        });

        // Track CTA button clicks
        document.querySelectorAll('.btn-primary').forEach(button => {
            button.addEventListener('click', (e) => {
                const buttonText = e.target.textContent.trim();
                gtag('event', 'click', {
                    'event_category': 'CTA',
                    'event_label': buttonText
                });

                fbq('trackCustom', 'CTAClick', {
                    'button_text': buttonText
                });
            });
        });

        // Track destination selection
        document.querySelectorAll('.destination-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const destination = card.querySelector('.destination-name').textContent.trim();
                gtag('event', 'select_content', {
                    'content_type': 'destination',
                    'content_id': destination.toLowerCase()
                });

                fbq('trackCustom', 'DestinationSelect', {
                    'destination': destination
                });

                this.trackViewContent(`${destination} Plans`, 'destination_plans');
            });
        });
    }

    trackFormInteractions() {
        // Track form field interactions in checkout
        const formFields = ['customer-name', 'customer-email', 'customer-phone', 'customer-country'];
        
        formFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                field.addEventListener('focus', () => {
                    gtag('event', 'form_start', {
                        'form_name': 'checkout',
                        'field_name': fieldId
                    });
                });

                field.addEventListener('blur', () => {
                    if (field.value) {
                        gtag('event', 'form_progress', {
                            'form_name': 'checkout',
                            'field_name': fieldId
                        });
                    }
                });
            }
        });
    }

    // Enhanced conversion tracking methods
    trackInitiateCheckout(planData = {}) {
        const totalPrice = this.getCurrentTotalPrice();
        const currency = this.getCurrentCurrency();

        // Google Ads Enhanced Conversion
        gtag('event', 'begin_checkout', {
            'send_to': 'AW-17439659867',
            'conversion_id': '17439659867',
            'conversion_label': 'c9A1CMKroIAbENuu8PtA',
            'value': totalPrice,
            'currency': currency,
            'custom_parameters': {
                'destination': planData.destination || 'unknown',
                'plan_type': planData.planType || 'unknown',
                'passengers': planData.passengers || 1
            }
        });
        
        // Facebook Pixel Enhanced
        fbq('track', 'InitiateCheckout', {
            value: totalPrice,
            currency: currency,
            content_name: planData.planName || 'VPO Guide Service',
            content_category: 'travel_service',
            contents: [{
                id: planData.planId || 'vpo-guide',
                quantity: planData.passengers || 1,
                item_price: totalPrice
            }]
        });
        
        // Google Analytics 4
        gtag('event', 'begin_checkout', {
            'currency': currency,
            'value': totalPrice,
            'items': [{
                'item_id': planData.planId || 'vpo-guide',
                'item_name': planData.planName || 'VPO Guide Service',
                'item_category': 'travel_service',
                'quantity': planData.passengers || 1,
                'price': totalPrice
            }]
        });

        console.log('Checkout initiated:', {
            value: totalPrice,
            currency: currency,
            plan: planData
        });
    }

    trackPurchase(orderData = {}) {
        const totalPrice = this.getCurrentTotalPrice();
        const currency = this.getCurrentCurrency();
        const transactionId = orderData.transactionId || Date.now().toString();

        // Google Ads Purchase Conversion
        gtag('event', 'purchase', {
            'send_to': 'AW-17439659867',
            'conversion_id': '17439659867',
            'conversion_label': 'KuihCL-roIAbENuu8PtA',
            'transaction_id': transactionId,
            'value': totalPrice,
            'currency': currency,
            'custom_parameters': {
                'customer_email': orderData.customerEmail || '',
                'customer_phone': orderData.customerPhone || '',
                'destination': orderData.destination || 'unknown'
            }
        });
        
        // Facebook Pixel Purchase with enhanced data
        fbq('track', 'Purchase', {
            value: totalPrice,
            currency: currency,
            transaction_id: transactionId,
            content_name: orderData.planName || 'VPO Guide Service',
            content_type: 'product',
            contents: [{
                id: orderData.planId || 'vpo-guide',
                quantity: orderData.passengers || 1,
                item_price: totalPrice
            }]
        });
        
        // Google Analytics 4 Enhanced Ecommerce
        gtag('event', 'purchase', {
            'transaction_id': transactionId,
            'value': totalPrice,
            'currency': currency,
            'items': [{
                'item_id': orderData.planId || 'vpo-guide',
                'item_name': orderData.planName || 'VPO Guide Service',
                'item_category': 'travel_service',
                'quantity': orderData.passengers || 1,
                'price': totalPrice
            }]
        });

        // Track successful conversion
        console.log('Purchase completed:', {
            transaction_id: transactionId,
            value: totalPrice,
            currency: currency,
            order: orderData
        });
    }

    trackLead(leadData = {}) {
        // Facebook Lead tracking
        fbq('track', 'Lead', {
            content_name: 'VPO Guide Interest',
            value: this.getCurrentTotalPrice(),
            currency: this.getCurrentCurrency()
        });

        // Google Ads Lead
        gtag('event', 'generate_lead', {
            'send_to': 'AW-17439659867',
            'value': this.getCurrentTotalPrice(),
            'currency': this.getCurrentCurrency()
        });

        console.log('Lead tracked:', leadData);
    }

    trackViewContent(contentName, contentCategory = 'general') {
        // Facebook View Content
        fbq('track', 'ViewContent', {
            content_name: contentName,
            content_category: contentCategory,
            value: this.getCurrentTotalPrice(),
            currency: this.getCurrentCurrency()
        });

        // Google Analytics
        gtag('event', 'view_item', {
            'currency': this.getCurrentCurrency(),
            'value': this.getCurrentTotalPrice(),
            'items': [{
                'item_name': contentName,
                'item_category': contentCategory
            }]
        });
    }

    // Helper methods
    getCurrentTotalPrice() {
        const totalElement = document.getElementById('total-price-value');
        if (totalElement) {
            const priceText = totalElement.textContent.replace(/[^0-9.]/g, '');
            return parseFloat(priceText) || 0;
        }
        return 0;
    }

    getCurrentCurrency() {
        const currencySelect = document.getElementById('currency-select') || document.getElementById('checkout-currency');
        return currencySelect ? currencySelect.value : 'USD';
    }

    // Conversion API methods for Facebook
    sendConversionAPI(eventName, eventData) {
        // This would typically be handled server-side
        // For client-side tracking, we'll use the standard pixel
        console.log('Conversion API event:', eventName, eventData);
    }

    // Enhanced error tracking
    trackError(errorType, errorMessage, errorDetails = {}) {
        gtag('event', 'exception', {
            'description': `${errorType}: ${errorMessage}`,
            'fatal': false
        });

        fbq('trackCustom', 'Error', {
            'error_type': errorType,
            'error_message': errorMessage,
            'error_details': JSON.stringify(errorDetails)
        });

        console.error('Tracked error:', {
            type: errorType,
            message: errorMessage,
            details: errorDetails
        });
    }
}

// Initialize tracking when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.vpoTracking = new VPOTracking();
});

// Global tracking functions for backwards compatibility
window.trackInitiateCheckout = function(planData) {
    if (window.vpoTracking) {
        window.vpoTracking.trackInitiateCheckout(planData);
    }
};

window.trackPurchase = function(orderData) {
    if (window.vpoTracking) {
        window.vpoTracking.trackPurchase(orderData);
    }
};

window.trackLead = function(leadData) {
    if (window.vpoTracking) {
        window.vpoTracking.trackLead(leadData);
    }
};

window.trackViewContent = function(contentName, contentCategory) {
    if (window.vpoTracking) {
        window.vpoTracking.trackViewContent(contentName, contentCategory);
    }
};

// Error handling for tracking scripts
window.addEventListener('error', (event) => {
    if (window.vpoTracking) {
        window.vpoTracking.trackError('JavaScript Error', event.message, {
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno
        });
    }
});
