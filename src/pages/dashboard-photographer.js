/**
 * ChitraVithika — Photographer Dashboard
 * Route: /dashboard/photographer
 */
import { isLoggedIn, currentUser, getCatalog, getAuthToken, logout } from '../js/state.js';
import { navigate } from '../js/router.js';

const PAGE_SIZE = 5;
let bidPage = 1;
let incomingBids = [];

function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function qualityBadge(item) {
    const hasHighRes = (item.width && item.height && item.width >= 3000);
    const hasExif = item.exif && (item.exif.camera || item.exif.lens);
    if (hasHighRes && hasExif) {
        return `<span class="cv-quality-badge cv-quality-badge--high">● Lossless</span>`;
    }
    if (hasHighRes || hasExif) {
        return `<span class="cv-quality-badge cv-quality-badge--medium">● Good</span>`;
    }
    return `<span class="cv-quality-badge cv-quality-badge--low">● Basic</span>`;
}

function bidRowStatus(b) {
    const st = b.bid_status || 'active';
    if (st === 'pending') return '<span class="cv-badge" style="background:rgba(200,169,110,0.2);color:var(--color-accent);">Pending</span>';
    if (st === 'declined') return '<span class="cv-badge" style="background:rgba(180,80,80,0.15);color:#c44;">Declined</span>';
    if (st === 'cancelled') return '<span class="cv-badge" style="opacity:0.8;">Closed</span>';
    if (st === 'accepted') return '<span class="cv-badge cv-badge--live">Won by buyer</span>';
    return '<span class="cv-badge cv-badge--live">Active</span>';
}

function pagerHtml(page, tp, total) {
    if (total <= PAGE_SIZE) return '';
    return `
      <div class="cv-dash-pager" style="display:flex;align-items:center;justify-content:center;gap:var(--space-4);margin-top:var(--space-4);font-size:var(--text-sm);">
        <button type="button" class="cv-btn cv-btn--ghost cv-btn--small" data-pager="bid" data-dir="prev" ${page <= 1 ? 'disabled' : ''}>Previous</button>
        <span style="color:var(--color-text-tertiary);">Page ${page} / ${tp}</span>
        <button type="button" class="cv-btn cv-btn--ghost cv-btn--small" data-pager="bid" data-dir="next" ${page >= tp ? 'disabled' : ''}>Next</button>
      </div>`;
}

export function render() {
    if (!isLoggedIn()) {
        return `<div class="cv-page-message"><p class="cv-page-message__text">Redirecting to login…</p></div>`;
    }

    const user = currentUser();
    const catalog = getCatalog();
    const myWorks = catalog.filter(i => i.artist === user.name);
    const totalRevenue = myWorks.reduce((sum, i) => sum + (i.price * (i.editions - i.remaining)), 0);
    const totalSold = myWorks.reduce((sum, i) => sum + (i.editions - i.remaining), 0);

    const tp = Math.max(1, Math.ceil(incomingBids.length / PAGE_SIZE));
    const p = Math.min(Math.max(1, bidPage), tp);
    const start = (p - 1) * PAGE_SIZE;
    const slice = incomingBids.slice(start, start + PAGE_SIZE);

    const photoEndButtons = [...new Map(myWorks.map((w) => [w.id, w])).values()]
        .map((w) => `
          <button type="button" class="cv-btn cv-btn--ghost cv-btn--small" data-end-auction="${w.id}" title="End without selling (cancels pending sealed bids)">
            End #${w.id}
          </button>
        `).join(' ');

    return `
    <div class="cv-page-container">
      <div class="cv-page-header">
        <p class="cv-page-header__eyebrow">Photographer Dashboard</p>
        <h1 class="cv-page-header__title">Welcome, ${escapeHtml(user.name)}</h1>
        <p class="cv-page-header__subtitle">Manage your listings, sealed bids, and earnings.</p>
      </div>

      <div class="cv-stats-row">
        <div class="cv-stat-card">
          <div class="cv-stat-card__value">${myWorks.length}</div>
          <div class="cv-stat-card__label">Listed Works</div>
        </div>
        <div class="cv-stat-card">
          <div class="cv-stat-card__value">${totalSold}</div>
          <div class="cv-stat-card__label">Editions Sold</div>
        </div>
        <div class="cv-stat-card">
          <div class="cv-stat-card__value">$${totalRevenue.toLocaleString()}</div>
          <div class="cv-stat-card__label">Total Revenue</div>
        </div>
        <div class="cv-stat-card">
          <div class="cv-stat-card__value">${myWorks.reduce((s, i) => s + i.remaining, 0)}</div>
          <div class="cv-stat-card__label">Available Editions</div>
        </div>
      </div>

      <div style="margin-bottom:var(--space-8);">
        <a href="/submit" class="cv-btn cv-btn--primary cv-btn--large">+ Submit New Work</a>
      </div>

      <div class="cv-dash-section">
        <h2 class="cv-dash-section__title">Your Listings</h2>
        ${myWorks.length === 0 ? `
          <div class="cv-empty-state">
            <div class="cv-empty-state__icon">📸</div>
            <h3 class="cv-empty-state__title">No works listed yet</h3>
            <p class="cv-empty-state__text">Upload your first photograph to start reaching collectors worldwide.</p>
            <a href="/submit" class="cv-btn cv-btn--primary">Submit Work</a>
          </div>
        ` : `
          <div class="cv-table-wrap">
            <table class="cv-table">
              <thead><tr>
                <th>Title</th>
                <th>Category</th>
                <th>Price</th>
                <th>Editions</th>
                <th>Sold</th>
                <th>Revenue</th>
                <th>Quality</th>
              </tr></thead>
              <tbody>
                ${myWorks.map(item => `
                  <tr>
                    <td><a href="/gallery/${item.id}" style="color:var(--color-accent);">${escapeHtml(item.title)}</a></td>
                    <td style="text-transform:capitalize;">${escapeHtml(item.category)}</td>
                    <td style="font-family:var(--font-mono);color:var(--color-accent);">$${item.price.toLocaleString()}</td>
                    <td>${item.editions}</td>
                    <td>${item.editions - item.remaining}</td>
                    <td style="font-family:var(--font-mono);">$${(item.price * (item.editions - item.remaining)).toLocaleString()}</td>
                    <td>${qualityBadge(item)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          ${myWorks.length ? `<p style="margin-top:var(--space-3);font-size:var(--text-sm);color:var(--color-text-secondary);">End an auction without selling: ${photoEndButtons}</p>` : ''}
        `}
      </div>

      <div class="cv-dash-section">
        <h2 class="cv-dash-section__title">Incoming bids</h2>
        <p style="font-size:var(--text-sm);color:var(--color-text-tertiary);margin-bottom:var(--space-4);">
          For <strong>sealed</strong> listings, grant a bid to sell to that collector, decline individual bids, or end the auction without a sale.
        </p>
        ${incomingBids.length === 0 ? `
          <p style="color:var(--color-text-tertiary);font-size:var(--text-sm);font-style:italic;">No bids yet.</p>
        ` : `
          <div class="cv-table-wrap">
            <table class="cv-table">
              <thead><tr>
                <th>Work</th>
                <th>Bidder</th>
                <th>Amount</th>
                <th>Type</th>
                <th>Status</th>
                <th>Actions</th>
              </tr></thead>
              <tbody>
                ${slice.map((b) => `
                  <tr>
                    <td><a href="/gallery/${b.photo_id}" style="color:var(--color-accent);">${escapeHtml(b.work_title || 'Work')}</a></td>
                    <td>${escapeHtml(b.user_name || '—')}</td>
                    <td style="font-family:var(--font-mono);color:var(--color-accent);">$${b.amount.toLocaleString()}</td>
                    <td style="text-transform:capitalize;">${escapeHtml(b.auction_type || '')}</td>
                    <td>${bidRowStatus(b)}</td>
                    <td style="white-space:nowrap;">
                      ${b.auction_type === 'silent' && b.bid_status === 'pending' && !b.sold && !b.ended_at ? `
                        <button type="button" class="cv-btn cv-btn--primary cv-btn--small" data-grant-bid="${b.id}">Grant</button>
                        <button type="button" class="cv-btn cv-btn--ghost cv-btn--small" data-decline-bid="${b.id}">Decline</button>
                      ` : '—'}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          ${pagerHtml(p, tp, incomingBids.length)}
        `}
      </div>
    </div>
  `;
}

function redraw() {
    const outlet = document.getElementById('cv-page');
    if (outlet) outlet.innerHTML = render();
    bind();
}

export function mount() {
    if (!isLoggedIn()) {
        setTimeout(() => navigate('/login', { replace: true }), 50);
        return;
    }

    (async () => {
        const token = getAuthToken();
        if (token) {
            try {
                const res = await fetch('/api/seller/incoming-bids', {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (res.ok) {
                    incomingBids = await res.json();
                }
            } catch (e) {
                console.warn('[photographer] incoming bids', e);
            }
        }
        redraw();
    })();
}

function bind() {
    document.querySelectorAll('[data-pager]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const dir = btn.getAttribute('data-dir');
            bidPage += dir === 'next' ? 1 : -1;
            redraw();
        });
    });

    document.querySelectorAll('[data-grant-bid]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const id = btn.getAttribute('data-grant-bid');
            if (!confirm('Grant this bid? The buyer will acquire the work at this price.')) return;
            await fetch(`/api/seller/bids/${id}/accept`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${getAuthToken()}` },
            });
            const res = await fetch('/api/seller/incoming-bids', {
                headers: { Authorization: `Bearer ${getAuthToken()}` },
            });
            if (res.ok) incomingBids = await res.json();
            redraw();
        });
    });

    document.querySelectorAll('[data-decline-bid]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const id = btn.getAttribute('data-decline-bid');
            if (!confirm('Decline this bid?')) return;
            await fetch(`/api/seller/bids/${id}/decline`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${getAuthToken()}` },
            });
            const res = await fetch('/api/seller/incoming-bids', {
                headers: { Authorization: `Bearer ${getAuthToken()}` },
            });
            if (res.ok) incomingBids = await res.json();
            redraw();
        });
    });

    document.querySelectorAll('[data-end-auction]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const photoId = btn.getAttribute('data-end-auction');
            if (!confirm('End this auction without a sale? Pending sealed bids will be cancelled.')) return;
            await fetch(`/api/seller/auctions/${photoId}/end`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${getAuthToken()}` },
            });
            const res = await fetch('/api/seller/incoming-bids', {
                headers: { Authorization: `Bearer ${getAuthToken()}` },
            });
            if (res.ok) incomingBids = await res.json();
            redraw();
        });
    });

    document.getElementById('btn-logout')?.addEventListener('click', () => {
        logout();
        navigate('/');
    });
}
