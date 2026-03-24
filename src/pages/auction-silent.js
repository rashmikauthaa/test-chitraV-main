/**
 * ChitraVithika — Silent Auction Page
 * Route: /auctions/silent/:id
 */
import { getCatalogItem, isLoggedIn, placeBid } from '../js/state.js';
import { navigate } from '../js/router.js';

export function render({ id }) {
    const item = getCatalogItem(id);
    if (!item) {
        return `<div class="cv-page-message"><h1 class="cv-page-message__title">Not Found</h1><p class="cv-page-message__text">This auction doesn't exist.</p><a href="/auctions" class="cv-page-message__link">Back to Auctions</a></div>`;
    }

    return `
    <div class="cv-page-container">
      <div style="margin-bottom:var(--space-6);">
        <a href="/auctions" style="font-size:var(--text-sm);color:var(--color-text-tertiary);letter-spacing:0.1em;text-transform:uppercase;">← Auctions</a>
      </div>

      <div class="cv-bid-room">
        <div>
          <div style="aspect-ratio:4/3;background:linear-gradient(135deg,${item.color || '#333'}40,var(--color-gradient-end));border-radius:var(--radius-lg);margin-bottom:var(--space-6);display:flex;align-items:center;justify-content:center;">
            <span style="font-size:var(--text-xs);color:rgba(255,255,255,0.3);letter-spacing:0.2em;text-transform:uppercase;">Sealed Bid Auction</span>
          </div>
          <h1 style="font-family:var(--font-display);font-size:var(--text-2xl);font-weight:600;color:var(--color-text-primary);margin-bottom:var(--space-2);">${item.title}</h1>
          <p style="font-size:var(--text-sm);color:var(--color-text-secondary);margin-bottom:var(--space-4);">${item.artist}</p>
          <p style="font-size:var(--text-base);color:var(--color-text-secondary);line-height:1.7;">${item.description}</p>
        </div>

        <div class="cv-bid-panel">
          <h2 style="font-family:var(--font-display);font-size:var(--text-lg);font-weight:600;color:var(--color-text-primary);margin-bottom:var(--space-4);">Place Your Sealed Bid</h2>
          
          <p style="font-size:var(--text-sm);color:var(--color-text-secondary);margin-bottom:var(--space-6);line-height:1.7;">
            Submit a sealed bid. All bids are hidden until the auction closes. Highest bidder wins.
            Minimum bid: <strong style="color:var(--color-accent);">$${item.auctionFloor.toLocaleString()}</strong>
          </p>

          <form id="silent-bid-form" class="cv-form">
            <div class="cv-form-group">
              <label for="bid-amount" class="cv-form-label">Your Bid</label>
              <div class="cv-masked-input">
                <span class="cv-masked-input__prefix">$</span>
                <input
                  type="number"
                  id="bid-amount"
                  name="amount"
                  class="cv-form-input"
                  min="${item.auctionFloor}"
                  step="50"
                  value="${item.auctionFloor}"
                  required
                />
              </div>
            </div>

            <div id="silent-bid-error" class="cv-form-error" role="alert"></div>

            <button type="submit" class="cv-btn cv-btn--primary cv-btn--full cv-btn--large" id="btn-silent-bid">
              Submit Sealed Bid
            </button>
          </form>

          <div id="silent-bid-status" style="margin-top:var(--space-4);" role="alert"></div>

          <div style="margin-top:var(--space-6);padding-top:var(--space-4);border-top:1px solid var(--color-border-subtle);">
            <p style="font-size:var(--text-xs);color:var(--color-text-tertiary);line-height:1.7;">
              <strong style="color:var(--color-text-secondary);">How Silent Auctions work:</strong><br>
              All bids are sealed — no one can see competing bids. When the auction closes, the highest 
              bidder wins. You'll be notified of the outcome.
            </p>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function mount({ id }) {
    const item = getCatalogItem(id);
    if (!item) return;

    const form = document.getElementById('silent-bid-form');
    const errorEl = document.getElementById('silent-bid-error');
    const statusEl = document.getElementById('silent-bid-status');
    const submitBtn = document.getElementById('btn-silent-bid');

    form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!isLoggedIn()) { navigate('/login'); return; }

        const amount = parseFloat(form.elements['amount'].value);
        errorEl.textContent = '';

        if (isNaN(amount) || amount < item.auctionFloor) {
            errorEl.textContent = `Minimum bid is $${item.auctionFloor.toLocaleString()}`;
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting…';

        try {
            placeBid(item.id, amount, 'silent');
            statusEl.innerHTML = `
        <div class="cv-success-card" style="margin:0;">
          <div class="cv-success-card__icon">🔒</div>
          <div class="cv-success-card__title">Bid Submitted</div>
          <div class="cv-success-card__text">Your sealed bid of <strong>$${amount.toLocaleString()}</strong> for "${item.title}" has been recorded.</div>
          <a href="/dashboard/buyer" class="cv-btn cv-btn--ghost">View My Bids</a>
        </div>
      `;
            form.style.display = 'none';
        } catch (err) {
            errorEl.textContent = err.message;
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit Sealed Bid';
        }
    });
}
