/**
 * ChitraVithika — Artists Directory Page
 * Route: /artists
 */
import { getArtists } from '../js/state.js';

export function render() {
    const artists = getArtists();

    return `
    <div class="cv-page-container cv-page-container--wide">
      <div class="cv-page-header">
        <p class="cv-page-header__eyebrow">Creative Ecosystem</p>
        <h1 class="cv-page-header__title">Our Artists</h1>
        <p class="cv-page-header__subtitle">
          The voices behind the light. Every photographer on ChitraVithika has been selected for 
          their singular vision and commitment to the art of image-making.
        </p>
      </div>

      <div class="cv-cards-grid cv-cards-grid--3">
        ${artists.map(artist => `
          <a href="/artists/${artist.id}" class="cv-artist-card" style="text-decoration:none;color:inherit;">
            <div class="cv-artist-card__avatar" style="background:linear-gradient(135deg, ${artist.color || '#8c7248'}, var(--color-avatar-gradient-end))">
              ${artist.name.charAt(0)}
            </div>
            <h3 class="cv-artist-card__name">${artist.name}</h3>
            <p class="cv-artist-card__works">${artist.works.length} work${artist.works.length !== 1 ? 's' : ''} listed</p>
            <p style="font-size:var(--text-xs);color:var(--color-text-tertiary);margin-top:var(--space-2);line-height:1.6;">
              ${artist.works.map(w => w.category).filter((v, i, a) => a.indexOf(v) === i).join(' · ')}
            </p>
          </a>
        `).join('')}
      </div>

      ${artists.length === 0 ? `
        <div class="cv-empty-state">
          <div class="cv-empty-state__icon">📷</div>
          <h3 class="cv-empty-state__title">No artists yet</h3>
          <p class="cv-empty-state__text">Be the first to join our creative ecosystem.</p>
          <a href="/register" class="cv-btn cv-btn--primary">Become an Artist</a>
        </div>
      ` : ''}
    </div>
  `;
}

export function mount() {
    // Static page — artist cards are links, no extra JS needed
}
