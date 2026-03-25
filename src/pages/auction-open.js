/**
 * ChitraVithika — Open Auction (Bidding Room)
 * Route: /auctions/open/:id
 */
import { getCatalogItem, isLoggedIn, placeBid, addToCollection } from '../js/state.js';
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
          <div style="aspect-ratio:4/3;background:linear-gradient(135deg, ${item.color || '#333'} 0%, var(--color-gradient-end) 100%);border-radius:var(--radius-lg);margin-bottom:var(--space-6);position:relative;overflow:hidden;">
            <img src="/api/image-preview/${item.id}?v=${Date.now()}" alt="${item.title}"
              style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;"
              onerror="this.style.display='none'" />
          </div>
          <h1 style="font-family:var(--font-display);font-size:var(--text-2xl);font-weight:600;color:var(--color-text-primary);margin-bottom:var(--space-2);">${item.title}</h1>
          <p style="font-size:var(--text-sm);color:var(--color-text-secondary);margin-bottom:var(--space-4);">${item.artist}</p>
          <p style="font-size:var(--text-base);color:var(--color-text-secondary);line-height:1.7;">${item.description}</p>
        </div>

        <div class="cv-bid-panel">
          <div class="cv-bid-panel__current">
            <div class="cv-bid-panel__label">Current Price</div>
            <div class="cv-bid-panel__price" id="bid-current-price">$${item.price.toLocaleString()}</div>
            <div style="margin-top:var(--space-2);">
              <auction-timer data-item-id="${item.id}" data-title="${item.title}" data-floor="${item.auctionFloor}" data-start-price="${item.price}" style="display:inline-block;"></auction-timer>
            </div>
          </div>

          <div style="margin-bottom:var(--space-4);">
            <div style="display:flex;justify-content:space-between;font-size:var(--text-xs);color:var(--color-text-tertiary);margin-bottom:var(--space-2);">
              <span>Floor Price</span>
              <span>$${item.auctionFloor.toLocaleString()}</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:var(--text-xs);color:var(--color-text-tertiary);">
              <span>Editions Remaining</span>
              <span>${item.remaining} / ${item.editions}</span>
            </div>
          </div>

          <button class="cv-btn cv-btn--primary cv-btn--full cv-btn--large" id="btn-buy-now">
            Buy at Current Price
          </button>

          <div id="bid-status" style="margin-top:var(--space-3);font-size:var(--text-sm);text-align:center;min-height:1.5em;" role="alert"></div>

          <div style="margin-top:var(--space-6);padding-top:var(--space-4);border-top:1px solid var(--color-border-subtle);">
            <p style="font-size:var(--text-xs);color:var(--color-text-tertiary);line-height:1.7;">
              <strong style="color:var(--color-text-secondary);">How Dutch Auctions work:</strong><br>
              The price starts high and drops every 10 seconds. Click "Buy at Current Price" to win the 
              edition at whatever the price is when you click. Wait for a lower price — but risk someone 
              else buying first.
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

    const btn = document.getElementById('btn-buy-now');
    const status = document.getElementById('bid-status');

    btn?.addEventListener('click', async () => {
        if (!isLoggedIn()) {
            navigate('/login');
            return;
        }

        btn.disabled = true;
        btn.textContent = 'Placing bid…';
        status.textContent = '';

        try {
            const res = await fetch(`/api/bids/${id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount: item.price }),
            });
            const data = await res.json();

            if (data.accepted) {
                status.style.color = 'var(--color-success)';
                status.textContent = `🎉 Acquired for $${data.currentPrice?.toLocaleString() || item.price.toLocaleString()}!`;
                addToCollection({ itemId: item.id, title: item.title, artist: item.artist, price: data.currentPrice || item.price, color: item.color });
                btn.textContent = 'Acquired ✓';
            } else {
                status.style.color = 'var(--color-warning)';
                status.textContent = `Bid placed at $${item.price.toLocaleString()}. Current price: $${data.currentPrice?.toLocaleString() || '—'}`;
                placeBid(item.id, item.price, 'open');
                btn.disabled = false;
                btn.textContent = 'Buy at Current Price';
            }
        } catch (err) {
            status.style.color = 'var(--color-error)';
            status.textContent = err.message;
            btn.disabled = false;
            btn.textContent = 'Buy at Current Price';
        }
    });
}
