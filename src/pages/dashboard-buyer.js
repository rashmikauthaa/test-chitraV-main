/**
 * ChitraVithika — Buyer Dashboard
 * Route: /dashboard/buyer
 */
import { isLoggedIn, currentUser, getState, syncBuyerDashboardFromApi } from '../js/state.js';
import { navigate } from '../js/router.js';

const PAGE_SIZE = 5;
let colPage = 1;
let bidPage = 1;
let wonPage = 1;

function totalPages(len) {
    return Math.max(1, Math.ceil(len / PAGE_SIZE));
}

function slicePage(arr, page) {
    const tp = totalPages(arr.length);
    const p = Math.min(Math.max(1, page), tp);
    const start = (p - 1) * PAGE_SIZE;
    return { items: arr.slice(start, start + PAGE_SIZE), page: p, totalPages: tp };
}

function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function bidStatusLabel(b) {
    const st = b.bid_status || 'active';
    if (st === 'pending') return '<span class="cv-badge" style="background:rgba(200,169,110,0.2);color:var(--color-accent);">Pending seller</span>';
    if (st === 'declined') return '<span class="cv-badge" style="background:rgba(180,80,80,0.15);color:#c44;">Declined</span>';
    if (st === 'cancelled') return '<span class="cv-badge" style="opacity:0.8;">Closed</span>';
    if (st === 'accepted') return '<span class="cv-badge cv-badge--live">Won</span>';
    return '<span class="cv-badge cv-badge--live">Active</span>';
}

function pagerHtml(prefix, page, tp, totalItems) {
    if (totalItems <= PAGE_SIZE) return '';
    return `
      <div class="cv-dash-pager" style="display:flex;align-items:center;justify-content:center;gap:var(--space-4);margin-top:var(--space-4);font-size:var(--text-sm);">
        <button type="button" class="cv-btn cv-btn--ghost cv-btn--small" data-pager="${prefix}" data-dir="prev" ${page <= 1 ? 'disabled' : ''}>Previous</button>
        <span style="color:var(--color-text-tertiary);">Page ${page} / ${tp}</span>
        <button type="button" class="cv-btn cv-btn--ghost cv-btn--small" data-pager="${prefix}" data-dir="next" ${page >= tp ? 'disabled' : ''}>Next</button>
      </div>`;
}

export function render() {
    if (!isLoggedIn()) {
        return `<div class="cv-page-message"><p class="cv-page-message__text">Redirecting to login…</p></div>`;
    }

    const user = currentUser();
    const collection = getState('collection') || [];
    const activeBids = getState('bids.active') || [];
    const wonBids = getState('bids.won') || [];

    const colSlice = slicePage(collection, colPage);
    const bidSlice = slicePage(activeBids, bidPage);
    const wonSlice = slicePage(wonBids, wonPage);

    return `
    <div class="cv-page-container">
      <div class="cv-page-header">
        <p class="cv-page-header__eyebrow">Dashboard</p>
        <h1 class="cv-page-header__title">Welcome, ${escapeHtml(user.name)}</h1>
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
            ${colSlice.items.map(item => `
              <a href="/gallery/${item.itemId}" class="cv-collection-card" style="text-decoration:none;color:inherit;">
                <div class="cv-collection-card__thumb" style="background:linear-gradient(135deg,${item.color || '#333'},var(--color-gradient-end));position:relative;overflow:hidden;">
                  <img src="/api/image-preview/${item.itemId}" alt="${escapeHtml(item.title)}"
                    style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;"
                    onerror="this.style.display='none'" />
                </div>
                <div>
                  <div class="cv-collection-card__title">${escapeHtml(item.title)}</div>
                  <div class="cv-collection-card__artist">${escapeHtml(item.artist)} · ${escapeHtml(item.license || 'commercial')} license</div>
                </div>
                <div class="cv-collection-card__price">$${(item.price || 0).toLocaleString()}</div>
              </a>
            `).join('')}
          </div>
          ${pagerHtml('col', colSlice.page, colSlice.totalPages, collection.length)}
        `}
      </div>

      <!-- Active Bids -->
      <div class="cv-dash-section">
        <h2 class="cv-dash-section__title">My Bids</h2>
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
                ${bidSlice.items.map(bid => `
                  <tr>
                    <td><a href="/auctions/${bid.type === 'silent' ? 'silent' : 'open'}/${bid.itemId}" style="color:var(--color-accent);">${escapeHtml(bid.title || `Item #${bid.itemId}`)}</a></td>
                    <td style="font-family:var(--font-mono);color:var(--color-accent);">$${bid.amount.toLocaleString()}</td>
                    <td style="text-transform:capitalize;">${bid.type}</td>
                    <td>${bidStatusLabel(bid)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          ${pagerHtml('bid', bidSlice.page, bidSlice.totalPages, activeBids.length)}
        `}
      </div>

      <!-- Won Auctions -->
      ${wonBids.length > 0 ? `
        <div class="cv-dash-section">
          <h2 class="cv-dash-section__title">Auctions Won</h2>
          <div class="cv-table-wrap">
            <table class="cv-table">
              <thead><tr>
                <th>Work</th>
                <th>Artist</th>
                <th>Winning Bid</th>
                <th>Won On</th>
              </tr></thead>
              <tbody>
                ${wonSlice.items.map(bid => `
                  <tr>
                    <td style="color:var(--color-text-primary);">${escapeHtml(bid.title)}</td>
                    <td>${escapeHtml(bid.artist)}</td>
                    <td style="font-family:var(--font-mono);color:var(--color-accent);">$${bid.amount.toLocaleString()}</td>
                    <td>${new Date(bid.wonAt).toLocaleDateString()}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          ${pagerHtml('won', wonSlice.page, wonSlice.totalPages, wonBids.length)}
        </div>
      ` : ''}
    </div>
  `;
}

function bindPager() {
    document.querySelectorAll('[data-pager]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const prefix = btn.getAttribute('data-pager');
            const dir = btn.getAttribute('data-dir');
            const delta = dir === 'next' ? 1 : -1;
            if (prefix === 'col') colPage += delta;
            if (prefix === 'bid') bidPage += delta;
            if (prefix === 'won') wonPage += delta;
            const outlet = document.getElementById('cv-page');
            if (outlet) outlet.innerHTML = render();
            bindPager();
            document.getElementById('btn-logout')?.addEventListener('click', onLogout);
        });
    });
}

function onLogout() {
    import('../js/state.js').then((s) => {
        s.logout();
        navigate('/');
    });
}

export function mount() {
    if (!isLoggedIn()) {
        setTimeout(() => navigate('/login', { replace: true }), 50);
        return;
    }

    (async () => {
        try {
            await syncBuyerDashboardFromApi();
        } catch (e) {
            console.warn('[dashboard-buyer] sync failed', e);
        }
        const outlet = document.getElementById('cv-page');
        if (outlet) outlet.innerHTML = render();
        bindPager();
        document.getElementById('btn-logout')?.addEventListener('click', onLogout);
    })();
}
