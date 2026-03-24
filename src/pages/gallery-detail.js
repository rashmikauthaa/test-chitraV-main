/**
 * ChitraVithika — Gallery Detail Page ("Art Vault")
 * Route: /gallery/:id
 *
 * Features:
 *   - Full image preview with glass overlay (anti-right-click)
 *   - Tiled "PREVIEW" watermark until purchase
 *   - EXIF metadata display (camera, lens, ISO, aperture, shutter)
 *   - Photographer stats + bidding portal
 */
import { getCatalogItem, isLoggedIn, setCart } from '../js/state.js';
import { navigate } from '../js/router.js';

export function render({ id }) {
  const item = getCatalogItem(id);
  if (!item) {
    return `<div class="cv-page-message"><h1 class="cv-page-message__title">Not Found</h1><p class="cv-page-message__text">This photograph doesn't exist.</p><a href="/gallery" class="cv-page-message__link">Back to Gallery</a></div>`;
  }

  const artistSlug = item.artist.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const exif = item.exif || {};
  const hasExif = exif.camera || exif.lens || exif.iso || exif.aperture || exif.shutter;

  return `
    <div class="cv-page-container">
      <div style="margin-bottom:var(--space-6);">
        <a href="/gallery" style="font-size:var(--text-sm);color:var(--color-text-tertiary);letter-spacing:0.1em;text-transform:uppercase;">← Gallery</a>
      </div>

      <div class="cv-detail">
        <!-- IMAGE WITH GLASS OVERLAY & WATERMARK -->
        <div class="cv-detail__image-wrap">
          <div class="cv-detail__image" style="width:100%;height:100%;background:linear-gradient(135deg, ${item.color || '#333'}44, var(--color-gradient-end));position:relative;overflow:hidden;user-select:none;-webkit-user-select:none;">
            <img src="/api/image-preview/${item.id}" alt="${item.title}"
              style="width:100%;height:100%;object-fit:cover;display:block;opacity:0;transition:opacity 0.6s ease;pointer-events:none;"
              onload="this.style.opacity='1'"
              onerror="this.style.display='none'"
              draggable="false" />

            <!-- Tiled Watermark Overlay -->
            <div class="cv-watermark-overlay" aria-hidden="true">
              ${Array(20).fill('<span class="cv-watermark-text">CHITRAVITHIKA</span>').join('')}
            </div>

            <!-- Glass Layer (blocks right-click and interaction) -->
            <div class="cv-glass-layer" oncontextmenu="return false;" ondragstart="return false;"></div>
          </div>
        </div>

        <div class="cv-detail__meta">
          <div>
            <h1 class="cv-detail__title">${item.title}</h1>
            <p class="cv-detail__artist">by <a href="/artists/${artistSlug}">${item.artist}</a></p>
          </div>

          <p class="cv-detail__desc">${item.description || ''}</p>

          <!-- Core Metadata -->
          <div class="cv-detail__meta-grid">
            <div class="cv-detail__meta-item">
              <div class="cv-detail__meta-label">Category</div>
              <div class="cv-detail__meta-value" style="text-transform:capitalize;">${item.category}</div>
            </div>
            <div class="cv-detail__meta-item">
              <div class="cv-detail__meta-label">Editions</div>
              <div class="cv-detail__meta-value">${item.remaining} / ${item.editions}</div>
            </div>
            <div class="cv-detail__meta-item">
              <div class="cv-detail__meta-label">Resolution</div>
              <div class="cv-detail__meta-value">${item.width && item.height ? `${item.width} × ${item.height}` : 'High-Res'}</div>
            </div>
            <div class="cv-detail__meta-item">
              <div class="cv-detail__meta-label">Auction Floor</div>
              <div class="cv-detail__meta-value">$${item.auctionFloor.toLocaleString()}</div>
            </div>
          </div>

          <!-- EXIF Technical Metadata -->
          ${hasExif ? `
          <div class="cv-exif-panel">
            <h3 class="cv-exif-panel__title">📷 Technical Metadata</h3>
            <div class="cv-exif-grid">
              ${exif.camera ? `<div class="cv-exif-item"><span class="cv-exif-label">Camera</span><span class="cv-exif-value">${exif.camera}</span></div>` : ''}
              ${exif.lens ? `<div class="cv-exif-item"><span class="cv-exif-label">Lens</span><span class="cv-exif-value">${exif.lens}</span></div>` : ''}
              ${exif.iso ? `<div class="cv-exif-item"><span class="cv-exif-label">ISO</span><span class="cv-exif-value">${exif.iso}</span></div>` : ''}
              ${exif.aperture ? `<div class="cv-exif-item"><span class="cv-exif-label">Aperture</span><span class="cv-exif-value">${exif.aperture}</span></div>` : ''}
              ${exif.shutter ? `<div class="cv-exif-item"><span class="cv-exif-label">Shutter</span><span class="cv-exif-value">${exif.shutter}</span></div>` : ''}
            </div>
          </div>
          ` : ''}

          <div class="cv-detail__price-block">
            <div class="cv-detail__price">$${item.price.toLocaleString()}</div>
            <div class="cv-detail__price-hint">Instant acquisition price (Personal License)</div>
          </div>

          <div class="cv-detail__actions">
            <button class="cv-btn cv-btn--primary cv-btn--large" id="btn-acquire" style="flex:1;">Acquire Now</button>
            <a href="/auctions/open/${item.id}" class="cv-btn cv-btn--ghost cv-btn--large">Bid in Auction</a>
          </div>

          <div style="padding:var(--space-4);background:var(--color-surface);border:1px solid var(--color-border-subtle);border-radius:var(--radius-md);">
            <p style="font-size:var(--text-xs);color:var(--color-text-tertiary);line-height:1.7;">
              <strong style="color:var(--color-text-secondary);">Tags:</strong> ${(item.tags || []).join(', ')}
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

  // Anti-right-click on the entire detail area
  const imageWrap = document.querySelector('.cv-detail__image-wrap');
  if (imageWrap) {
    imageWrap.addEventListener('contextmenu', (e) => e.preventDefault());
    imageWrap.addEventListener('dragstart', (e) => e.preventDefault());
  }

  document.getElementById('btn-acquire')?.addEventListener('click', () => {
    if (!isLoggedIn()) {
      navigate('/login');
      return;
    }
    setCart({ itemId: item.id, title: item.title, artist: item.artist, price: item.price, license: 'personal', color: item.color });
    navigate(`/checkout/${item.id}`);
  });
}
