/**
 * ChitraVithika — Buyer Dashboard
 * Route: /dashboard/buyer
 */
import { isLoggedIn, currentUser, getState, subscribe } from '../js/state.js';
import { navigate } from '../js/router.js';

export function render() {
    if (!isLoggedIn()) {
        return `<div class="cv-page-message"><p class="cv-page-message__text">Redirecting to login…</p></div>`;
    }

    const user = currentUser();
    const collection = getState('collection') || [];
    const activeBids = getState('bids.active') || [];
    const wonBids = getState('bids.won') || [];

    return `
    <div class="cv-page-container">
      <div class="cv-page-header">
        <p class="cv-page-header__eyebrow">Dashboard</p>
        <h1 class="cv-page-header__title">Welcome, ${user.name}</h1>
        <p class="cv-page-header__subtitle">Manage your collection and active bids.</p>
      </div>

      <div class="cv-stats-row">
        <div class="cv-stat-card">
          <div class="cv-stat-card__value">${collection.length}</div>
          <div class="cv-stat-card__label">Acquired Works</div>
        </div>
        <div class="cv-stat-card">
          <div class="cv-stat-card__value">${activeBids.length}</div>
          <div class="cv-stat-card__label">Active Bids</div>
        </div>
        <div class="cv-stat-card">
          <div class="cv-stat-card__value">${wonBids.length}</div>
          <div class="cv-stat-card__label">Auctions Won</div>
        </div>
        <div class="cv-stat-card">
          <div class="cv-stat-card__value">$${collection.reduce((s, c) => s + (c.price || 0), 0).toLocaleString()}</div>
          <div class="cv-stat-card__label">Collection Value</div>
        </div>
      </div>

      <!-- My Collection -->
      <div class="cv-dash-section">
        <h2 class="cv-dash-section__title">My Collection</h2>
        ${collection.length === 0 ? `
          <div class="cv-empty-state">
            <div class="cv-empty-state__icon">🖼️</div>
            <h3 class="cv-empty-state__title">Your collection is empty</h3>
            <p class="cv-empty-state__text">Start acquiring fine-art photography to build your collection.</p>
            <a href="/gallery" class="cv-btn cv-btn--primary">Explore Gallery</a>
          </div>
        ` : `
          <div class="cv-dash-grid">
            ${collection.map(item => `
              <a href="/gallery/${item.itemId}" class="cv-collection-card" style="text-decoration:none;color:inherit;">
                <div class="cv-collection-card__thumb" style="background:linear-gradient(135deg,${item.color || '#333'},var(--color-gradient-end));position:relative;overflow:hidden;">
                  <img src="/api/image-preview/${item.itemId}" alt="${item.title}"
                    style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;"
                    onerror="this.style.display='none'" />
                </div>
                <div>
                  <div class="cv-collection-card__title">${item.title}</div>
                  <div class="cv-collection-card__artist">${item.artist} · ${item.license} license</div>
                </div>
                <div class="cv-collection-card__price">$${(item.price || 0).toLocaleString()}</div>
              </a>
            `).join('')}
          </div>
        `}
      </div>

      <!-- Active Bids -->
      <div class="cv-dash-section">
        <h2 class="cv-dash-section__title">Active Bids</h2>
        ${activeBids.length === 0 ? `
          <p style="color:var(--color-text-tertiary);font-size:var(--text-sm);font-style:italic;">No active bids. <a href="/auctions" style="color:var(--color-accent);">Browse auctions</a></p>
        ` : `
          <div class="cv-table-wrap">
            <table class="cv-table">
              <thead><tr>
                <th>Item</th>
                <th>Amount</th>
                <th>Type</th>
                <th>Status</th>
              </tr></thead>
              <tbody>
                ${activeBids.map(bid => `
                  <tr>
                    <td><a href="/auctions/${bid.type}/${bid.itemId}" style="color:var(--color-accent);">Item #${bid.itemId}</a></td>
                    <td style="font-family:var(--font-mono);color:var(--color-accent);">$${bid.amount.toLocaleString()}</td>
                    <td style="text-transform:capitalize;">${bid.type}</td>
                    <td><span class="cv-badge cv-badge--live">Active</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>

      <!-- Won Bids -->
      ${wonBids.length > 0 ? `
        <div class="cv-dash-section">
          <h2 class="cv-dash-section__title">Won Auctions</h2>
          <div class="cv-table-wrap">
            <table class="cv-table">
              <thead><tr>
                <th>Work</th>
                <th>Artist</th>
                <th>Winning Bid</th>
                <th>Won On</th>
              </tr></thead>
              <tbody>
                ${wonBids.map(bid => `
                  <tr>
                    <td style="color:var(--color-text-primary);">${bid.title}</td>
                    <td>${bid.artist}</td>
                    <td style="font-family:var(--font-mono);color:var(--color-accent);">$${bid.amount.toLocaleString()}</td>
                    <td>${new Date(bid.wonAt).toLocaleDateString()}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      ` : ''}

      <div style="margin-top:var(--space-8);text-align:center;">
        <button class="cv-btn cv-btn--danger" id="btn-logout">Sign Out</button>
      </div>
    </div>
  `;
}

export function mount() {
    if (!isLoggedIn()) {
        setTimeout(() => navigate('/login', { replace: true }), 50);
        return;
    }

    document.getElementById('btn-logout')?.addEventListener('click', () => {
        import('../js/state.js').then(s => {
            s.logout();
            const authBtn = document.getElementById('btn-auth');
            if (authBtn) authBtn.textContent = 'Login';
            navigate('/');
        });
    });
}
