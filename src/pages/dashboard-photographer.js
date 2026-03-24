/**
 * ChitraVithika — Photographer Dashboard
 * Route: /dashboard/photographer
 *
 * Features:
 *   - Stats overview (listings, sold, revenue, editions)
 *   - Listings table with Quality Health indicator
 *   - Bid History section
 *   - Submit new work CTA
 */
import { isLoggedIn, currentUser, getCatalog, getState, logout } from '../js/state.js';
import { navigate } from '../js/router.js';

function qualityBadge(item) {
    // Determine quality tier based on file size and resolution
    const hasHighRes = (item.width && item.height && item.width >= 3000);
    const hasExif = item.exif && (item.exif.camera || item.exif.lens);

    if (hasHighRes && hasExif) {
        return `<span class="cv-quality-badge cv-quality-badge--high">● Lossless</span>`;
    } else if (hasHighRes || hasExif) {
        return `<span class="cv-quality-badge cv-quality-badge--medium">● Good</span>`;
    } else {
        return `<span class="cv-quality-badge cv-quality-badge--low">● Basic</span>`;
    }
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
    const bids = getState('bids.active') || [];

    return `
    <div class="cv-page-container">
      <div class="cv-page-header">
        <p class="cv-page-header__eyebrow">Photographer Dashboard</p>
        <h1 class="cv-page-header__title">Welcome, ${user.name}</h1>
        <p class="cv-page-header__subtitle">Manage your listings, track earnings, and submit new work.</p>
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

      <!-- Listings with Quality Health -->
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
                    <td><a href="/gallery/${item.id}" style="color:var(--color-accent);">${item.title}</a></td>
                    <td style="text-transform:capitalize;">${item.category}</td>
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
        `}
      </div>

      <!-- Bid History -->
      <div class="cv-dash-section">
        <h2 class="cv-dash-section__title">Bid History</h2>
        ${bids.length === 0 ? `
          <p style="color:var(--color-text-tertiary);font-size:var(--text-sm);font-style:italic;">
            No bids received yet. Active bids on your works will appear here.
          </p>
        ` : `
          <div class="cv-table-wrap">
            <table class="cv-table">
              <thead><tr>
                <th>Work</th>
                <th>Bid Amount</th>
                <th>Type</th>
                <th>Status</th>
              </tr></thead>
              <tbody>
                ${bids.map(bid => `
                  <tr>
                    <td>Item #${bid.itemId}</td>
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
        logout();
        const authBtn = document.getElementById('btn-auth');
        if (authBtn) authBtn.textContent = 'Login';
        const logoutBtn = document.getElementById('btn-logout');
        if (logoutBtn) logoutBtn.style.display = 'none';
        navigate('/');
    });
}
