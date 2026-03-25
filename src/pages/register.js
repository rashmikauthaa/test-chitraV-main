/**
 * ChitraVithika — Register Page
 * Route: /register
 */
import { register, isLoggedIn } from '../js/state.js';
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
    <div class="cv-auth-bg" id="cv-auth-bg">${slides}</div>

    <div class="cv-auth-container" style="position:relative;z-index:1;">
      <div class="cv-auth-card" style="backdrop-filter:blur(10px);background:var(--color-auth-card-scrim);">
        <h1 class="cv-auth-card__title">Join ChitraVithika</h1>
        <p class="cv-auth-card__subtitle">Create your account and start your journey</p>

        <form id="cv-register-form" class="cv-form" novalidate>
          <div class="cv-form-group">
            <label class="cv-form-label">I am a…</label>
            <div class="cv-role-chooser">
              <div class="cv-role-option selected" data-role="buyer" tabindex="0" role="radio" aria-checked="true">
                <div class="cv-role-option__icon">🖼️</div>
                <div class="cv-role-option__label">Collector</div>
                <div class="cv-role-option__desc">Acquire limited editions</div>
              </div>
              <div class="cv-role-option" data-role="photographer" tabindex="0" role="radio" aria-checked="false">
                <div class="cv-role-option__icon">📷</div>
                <div class="cv-role-option__label">Photographer</div>
                <div class="cv-role-option__desc">Sell your work</div>
              </div>
            </div>
            <input type="hidden" name="role" id="reg-role" value="buyer" />
          </div>

          <div class="cv-form-group">
            <label for="reg-name" class="cv-form-label">Full Name</label>
            <input
              type="text"
              id="reg-name"
              name="name"
              class="cv-form-input"
              placeholder="Your full name"
              required
              autocomplete="name"
            />
          </div>

          <div class="cv-form-group">
            <label for="reg-email" class="cv-form-label">Email</label>
            <input
              type="email"
              id="reg-email"
              name="email"
              class="cv-form-input"
              placeholder="you@example.com"
              required
              autocomplete="email"
            />
          </div>

          <div class="cv-form-group">
            <label for="reg-password" class="cv-form-label">Password</label>
            <input
              type="password"
              id="reg-password"
              name="password"
              class="cv-form-input"
              placeholder="Minimum 6 characters"
              required
              minlength="6"
              autocomplete="new-password"
            />
          </div>

          <div id="register-error" class="cv-form-error" role="alert"></div>

          <button type="submit" class="cv-btn cv-btn--primary cv-btn--full cv-btn--large" id="register-submit">
            Create Account
          </button>
        </form>

        <div class="cv-auth-card__footer">
          Already have an account? <a href="/login" id="register-to-login">Sign in</a>
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
        const next = getNextPathAfterAuth();
        setTimeout(() => navigate(next || '/dashboard/buyer', { replace: true }), 50);
        return;
    }

    const loginLink = document.getElementById('register-to-login');
    if (loginLink && window.location.search) loginLink.setAttribute('href', '/login' + window.location.search);

    const slides = document.querySelectorAll('.cv-auth-bg__slide');
    if (slides.length > 1) {
        let current = 0;
        bgInterval = setInterval(() => {
            slides[current].classList.remove('active');
            current = (current + 1) % slides.length;
            slides[current].classList.add('active');
        }, 4000);
    }

    const form = document.getElementById('cv-register-form');
    const submitBtn = document.getElementById('register-submit');
    const roleInput = document.getElementById('reg-role');
    const errorEl = document.getElementById('register-error');

    document.querySelectorAll('.cv-role-option').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.cv-role-option').forEach(b => {
                b.classList.remove('selected');
                b.setAttribute('aria-checked', 'false');
            });
            btn.classList.add('selected');
            btn.setAttribute('aria-checked', 'true');
            roleInput.value = btn.dataset.role;
        });
        btn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                btn.click();
            }
        });
    });

    form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (errorEl) errorEl.textContent = '';

        const name = form.elements['name'].value.trim();
        const email = form.elements['email'].value.trim();
        const password = form.elements['password'].value;
        const role = roleInput.value;

        if (!name || !email || !password) {
            if (errorEl) errorEl.textContent = 'All fields are required.';
            return;
        }
        if (password.length < 6) {
            if (errorEl) errorEl.textContent = 'Password must be at least 6 characters.';
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating account…';

        try {
            const user = await register({ name, email, password, role });
            const authBtn = document.getElementById('btn-auth');
            if (authBtn) authBtn.textContent = user.name;
            const next = getNextPathAfterAuth();
            navigate(next || dashForUser(user));
        } catch (err) {
            if (errorEl) errorEl.textContent = err.message;
            submitBtn.disabled = false;
            submitBtn.textContent = 'Create Account';
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
