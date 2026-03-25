/**
 * ChitraVithika — Artist Detail Page
 * Route: /artists/:id
 */
import { getArtistById } from '../js/state.js';

export function render({ id }) {
    const artist = getArtistById(id);
    if (!artist) {
        return `<div class="cv-page-message"><h1 class="cv-page-message__title">Not Found</h1><p class="cv-page-message__text">This artist doesn't exist.</p><a href="/artists" class="cv-page-message__link">Back to Artists</a></div>`;
    }

    return `
    <div class="cv-page-container">
      <div style="margin-bottom:var(--space-6);">
        <a href="/artists" style="font-size:var(--text-sm);color:var(--color-text-tertiary);letter-spacing:0.1em;text-transform:uppercase;">← Artists</a>
      </div>

      <div style="display:flex;align-items:center;gap:var(--space-6);margin-bottom:var(--space-10);">
        <div class="cv-artist-card__avatar" style="width:80px;height:80px;font-size:var(--text-2xl);background:linear-gradient(135deg, ${artist.color || '#8c7248'}, var(--color-avatar-gradient-end))">
          ${artist.name.charAt(0)}
        </div>
        <div>
          <h1 style="font-family:var(--font-display);font-size:var(--text-2xl);font-weight:600;color:var(--color-text-primary);">${artist.name}</h1>
          <p style="font-size:var(--text-sm);color:var(--color-text-secondary);">${artist.works.length} work${artist.works.length !== 1 ? 's' : ''} · ${artist.works.map(w => w.category).filter((v, i, a) => a.indexOf(v) === i).join(', ')}</p>
        </div>
      </div>

      <h2 style="font-family:var(--font-display);font-size:var(--text-lg);font-weight:600;color:var(--color-text-primary);margin-bottom:var(--space-6);">Portfolio</h2>

      <div class="cv-cards-grid">
        ${artist.works.map(item => `
          <a href="/gallery/${item.id}" style="text-decoration:none;color:inherit;">
            <div style="aspect-ratio:4/3;background:linear-gradient(135deg, ${item.color || '#333'} 0%, var(--color-gradient-end) 100%);border-radius:var(--radius-lg);margin-bottom:var(--space-3);position:relative;overflow:hidden;">
              <img src="/api/image-preview/${item.id}?v=${Date.now()}" loading="lazy" alt="${item.title}"
                style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;"
                onerror="this.style.display='none'" />
            </div>
            <h3 style="font-family:var(--font-display);font-size:var(--text-md);font-weight:600;color:var(--color-text-primary);margin-bottom:2px;">${item.title}</h3>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:var(--space-2);">
              <span style="font-family:var(--font-mono);font-size:var(--text-sm);color:var(--color-accent);">$${item.price.toLocaleString()}</span>
              <span style="font-size:var(--text-xs);color:var(--color-text-tertiary);">${item.remaining}/${item.editions} left</span>
            </div>
          </a>
        `).join('')}
      </div>
    </div>
  `;
}

export function mount() {
    // Static portfolio page — links handle navigation
}
