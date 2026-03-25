/**
 * ChitraVithika — Login Page
 * Route: /login
 *
 * Features:
 *   - Email/password authentication
 *   - Gradient background
 */
import { login, isLoggedIn, currentUser } from '../js/state.js';
import { navigate } from '../js/router.js';
import { getNextPathAfterAuth } from '../js/auth-routes.js';

const BG_COLORS = ['#4A148C', '#E040FB', '#0D47A1', '#F9A825', '#00BCD4', '#1B5E20'];

function buildAuthBackgroundSlides() {
    return BG_COLORS.map((color, i) =>
        `<div class="cv-auth-bg__slide ${i === 0 ? 'active' : ''}"
      style="background:linear-gradient(135deg,${color} 0%, var(--color-gradient-end) 100%);"
      data-slide="${i}"></div>`
    ).join('');
}

export function render() {
    if (isLoggedIn()) {
        return `<div class="cv-page-message"><p class="cv-page-message__text">Redirecting…</p></div>`;
    }

    const slides = buildAuthBackgroundSlides();

    return `
    <!-- Rotating Gallery Background -->
    <div class="cv-auth-bg" id="cv-auth-bg">
      ${slides}
    </div>

    <div class="cv-auth-container" style="position:relative;z-index:1;">
      <div class="cv-auth-card" style="backdrop-filter:blur(10px);background:var(--color-auth-card-scrim);">
        <h1 class="cv-auth-card__title">Welcome Back</h1>
        <p class="cv-auth-card__subtitle">Sign in to your ChitraVithika account</p>

        <form id="cv-login-form" class="cv-form" novalidate>
          <div class="cv-form-group">
            <label for="login-email" class="cv-form-label">Email</label>
            <input
              type="email"
              id="login-email"
              name="email"
              class="cv-form-input"
              placeholder="you@example.com"
              required
              autocomplete="email"
            />
          </div>

          <div class="cv-form-group">
            <label for="login-password" class="cv-form-label">Password</label>
            <input
              type="password"
              id="login-password"
              name="password"
              class="cv-form-input"
              placeholder="••••••••"
              required
              autocomplete="current-password"
            />
          </div>

          <div id="login-error" class="cv-form-error" role="alert"></div>

          <button type="submit" class="cv-btn cv-btn--primary cv-btn--full cv-btn--large" id="login-submit">
            Sign In
          </button>
        </form>

        <div class="cv-auth-card__footer">
          Don't have an account? <a href="/register" id="login-to-register">Create one</a>
        </div>
      </div>
    </div>
  `;
}

let bgInterval = null;

function dashForUser(user) {
    return user.role === 'photographer' ? '/dashboard/photographer' : '/dashboard/buyer';
}

export function mount() {
    if (isLoggedIn()) {
        const user = currentUser();
        const next = getNextPathAfterAuth();
        const dest = next || dashForUser(user);
        setTimeout(() => navigate(dest, { replace: true }), 50);
        return;
    }

    const reg = document.getElementById('login-to-register');
    if (reg && window.location.search) reg.setAttribute('href', '/register' + window.location.search);

    const slides = document.querySelectorAll('.cv-auth-bg__slide');
    if (slides.length > 1) {
        let current = 0;
        bgInterval = setInterval(() => {
            slides[current].classList.remove('active');
            current = (current + 1) % slides.length;
            slides[current].classList.add('active');
        }, 4000);
    }

    const form = document.getElementById('cv-login-form');
    const submitBtn = document.getElementById('login-submit');
    const errorEl = document.getElementById('login-error');

    form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (errorEl) errorEl.textContent = '';
        submitBtn.disabled = true;
        submitBtn.textContent = 'Signing in…';

        const email = form.elements['email'].value.trim();
        const password = form.elements['password'].value;

        try {
            const user = await login(email, password);
            const authBtn = document.getElementById('btn-auth');
            if (authBtn) authBtn.textContent = user.name;
            const next = getNextPathAfterAuth();
            navigate(next || dashForUser(user));
        } catch (err) {
            if (errorEl) errorEl.textContent = err.message;
            submitBtn.disabled = false;
            submitBtn.textContent = 'Sign In';
        }
    });

    return () => {
        if (bgInterval) {
            clearInterval(bgInterval);
            bgInterval = null;
        }
        document.getElementById('cv-auth-bg')?.remove();
    };
}
