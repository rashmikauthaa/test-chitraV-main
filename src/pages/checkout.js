/**
 * ChitraVithika — Checkout Page
 * Route: /checkout/:id
 */
import { getCatalogItem, getState, clearCart, addToCollection, isLoggedIn } from '../js/state.js';
import { navigate } from '../js/router.js';

export function render({ id }) {
    if (!isLoggedIn()) {
        return `<div class="cv-page-message"><p class="cv-page-message__text">Redirecting to login…</p></div>`;
    }

    const cart = getState('cart');
    const item = getCatalogItem(id) || cart;

    if (!item) {
        return `<div class="cv-page-message"><h1 class="cv-page-message__title">Empty Cart</h1><p class="cv-page-message__text">No item selected for checkout.</p><a href="/gallery" class="cv-page-message__link">Browse Gallery</a></div>`;
    }

    const licenses = [
        { id: 'personal', name: 'Personal', price: item.price || 0, features: ['Personal display', 'Digital viewing', 'Non-commercial use', 'Single device'] },
        { id: 'editorial', name: 'Editorial', price: Math.round((item.price || 0) * 1.8), features: ['All Personal rights', 'Publication use', 'Editorial contexts', 'Attribution required'] },
        { id: 'commercial', name: 'Commercial', price: Math.round((item.price || 0) * 3.5), features: ['All Editorial rights', 'Commercial use', 'Advertising & branding', 'Unlimited distribution'] },
    ];

    const selectedLicense = cart?.license || 'personal';

    return `
    <div class="cv-page-container">
      <div style="margin-bottom:var(--space-6);">
        <a href="/gallery/${id}" style="font-size:var(--text-sm);color:var(--color-text-tertiary);letter-spacing:0.1em;text-transform:uppercase;">← Back</a>
      </div>

      <h1 class="cv-page-header__title" style="margin-bottom:var(--space-8);">Checkout</h1>

      <div class="cv-checkout-layout">
        <div>
          <h2 style="font-family:var(--font-display);font-size:var(--text-lg);font-weight:600;color:var(--color-text-primary);margin-bottom:var(--space-6);">Select License</h2>

          <div class="cv-license-grid" id="license-grid">
            ${licenses.map(lic => `
              <div class="cv-license-card ${lic.id === selectedLicense ? 'selected' : ''}" data-license="${lic.id}" data-price="${lic.price}" tabindex="0" role="radio" aria-checked="${lic.id === selectedLicense}">
                <div class="cv-license-card__name">${lic.name}</div>
                <div class="cv-license-card__price">$${lic.price.toLocaleString()}</div>
                <div class="cv-license-card__features">
                  ${lic.features.map(f => `<div class="cv-license-card__feature">${f}</div>`).join('')}
                </div>
              </div>
            `).join('')}
          </div>

          <div style="margin-top:var(--space-8);">
            <h2 style="font-family:var(--font-display);font-size:var(--text-lg);font-weight:600;color:var(--color-text-primary);margin-bottom:var(--space-4);">Payment Details</h2>
            <form id="checkout-form" class="cv-form">
              <div class="cv-form-group">
                <label for="card-name" class="cv-form-label">Cardholder Name</label>
                <input type="text" id="card-name" class="cv-form-input" value="Demo Collector" required />
              </div>
              <div class="cv-form-group">
                <label for="card-number" class="cv-form-label">Card Number</label>
                <input type="text" id="card-number" class="cv-form-input" placeholder="4242 4242 4242 4242" value="4242 4242 4242 4242" maxlength="19" required />
              </div>
              <div class="cv-form-row">
                <div class="cv-form-group">
                  <label for="card-expiry" class="cv-form-label">Expiry</label>
                  <input type="text" id="card-expiry" class="cv-form-input" placeholder="MM/YY" value="12/28" maxlength="5" required />
                </div>
                <div class="cv-form-group">
                  <label for="card-cvc" class="cv-form-label">CVC</label>
                  <input type="text" id="card-cvc" class="cv-form-input" placeholder="123" value="123" maxlength="4" required />
                </div>
              </div>

              <div id="checkout-error" class="cv-form-error" role="alert"></div>

              <button type="submit" class="cv-btn cv-btn--primary cv-btn--full cv-btn--large" id="btn-pay">
                Complete Purchase
              </button>
            </form>
          </div>
        </div>

        <div class="cv-checkout-summary">
          <div class="cv-checkout-summary__title">Order Summary</div>
          <div style="margin-bottom:var(--space-4);">
            <div style="aspect-ratio:16/9;background:linear-gradient(135deg,${item.color || '#333'},var(--color-gradient-end));border-radius:var(--radius-md);margin-bottom:var(--space-3);"></div>
            <h3 style="font-family:var(--font-display);font-size:var(--text-md);font-weight:600;color:var(--color-text-primary);">${item.title || 'Untitled'}</h3>
            <p style="font-size:var(--text-xs);color:var(--color-text-tertiary);">${item.artist || 'Unknown'}</p>
          </div>
          <div class="cv-checkout-summary__row">
            <span style="color:var(--color-text-secondary);">License</span>
            <span id="summary-license" style="color:var(--color-text-primary);text-transform:capitalize;">${selectedLicense}</span>
          </div>
          <div class="cv-checkout-summary__row cv-checkout-summary__row--total">
            <span>Total</span>
            <span class="cv-checkout-summary__val" id="summary-total">$${(item.price || 0).toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div id="checkout-success" style="display:none;"></div>
    </div>
  `;
}

export function mount({ id }) {
    if (!isLoggedIn()) {
        setTimeout(() => navigate('/login', { replace: true }), 50);
        return;
    }

    const item = getCatalogItem(id) || getState('cart');
    if (!item) return;

    // License selection
    const licenseGrid = document.getElementById('license-grid');
    const summaryLicense = document.getElementById('summary-license');
    const summaryTotal = document.getElementById('summary-total');

    licenseGrid?.addEventListener('click', (e) => {
        const card = e.target.closest('.cv-license-card');
        if (!card) return;
        licenseGrid.querySelectorAll('.cv-license-card').forEach(c => {
            c.classList.remove('selected');
            c.setAttribute('aria-checked', 'false');
        });
        card.classList.add('selected');
        card.setAttribute('aria-checked', 'true');
        summaryLicense.textContent = card.dataset.license;
        summaryTotal.textContent = `$${parseInt(card.dataset.price).toLocaleString()}`;
    });

    // Payment form
    const form = document.getElementById('checkout-form');
    const payBtn = document.getElementById('btn-pay');
    const errorEl = document.getElementById('checkout-error');
    const successEl = document.getElementById('checkout-success');

    form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorEl.textContent = '';
        payBtn.disabled = true;
        payBtn.textContent = 'Processing…';

        // Simulate payment processing
        await new Promise(r => setTimeout(r, 1500));

        const selectedCard = licenseGrid?.querySelector('.cv-license-card.selected');
        const license = selectedCard?.dataset.license || 'personal';
        const price = parseInt(selectedCard?.dataset.price || item.price);

        addToCollection({
            itemId: item.id || id,
            title: item.title || 'Untitled',
            artist: item.artist || 'Unknown',
            price,
            license,
            color: item.color,
        });
        clearCart();

        // Show success
        document.querySelector('.cv-checkout-layout').style.display = 'none';
        successEl.style.display = '';
        successEl.innerHTML = `
      <div class="cv-success-card">
        <div class="cv-success-card__icon">🎉</div>
        <div class="cv-success-card__title">Purchase Complete!</div>
        <div class="cv-success-card__text">
          "${item.title || 'Untitled'}" has been added to your collection with a ${license} license.
          Your encrypted download link has been sent to your email.
        </div>
        <div style="display:flex;gap:var(--space-3);justify-content:center;flex-wrap:wrap;">
          <a href="/dashboard/buyer" class="cv-btn cv-btn--primary">View Collection</a>
          <a href="/gallery" class="cv-btn cv-btn--ghost">Continue Browsing</a>
        </div>
      </div>
    `;
    });
}
