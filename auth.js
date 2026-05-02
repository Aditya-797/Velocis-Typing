// Auth module for Velocis Typing
class Auth {
  constructor(app) {
    this.app = app;
    this.user = null;
    this.bind();
    this.initSplash();
  }
  bind() {
    document.getElementById('nav-login-btn').addEventListener('click', () => this.showModal());
    document.getElementById('auth-modal-close').addEventListener('click', () => this.hideModal());
    document.getElementById('auth-modal').addEventListener('click', e => { if (e.target.id === 'auth-modal') this.hideModal(); });
    document.querySelectorAll('.auth-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById('login-form').classList.toggle('hidden', tab.dataset.tab !== 'login');
        document.getElementById('register-form').classList.toggle('hidden', tab.dataset.tab !== 'register');
        document.getElementById('auth-error').classList.add('hidden');
      });
    });
    document.getElementById('login-form').addEventListener('submit', e => { e.preventDefault(); this.login(); });
    document.getElementById('register-form').addEventListener('submit', e => { e.preventDefault(); this.register(); });
    document.getElementById('user-avatar-btn').addEventListener('click', () => {
      document.getElementById('user-dropdown').classList.toggle('hidden');
    });
    document.getElementById('nav-logout').addEventListener('click', () => this.logout());
    document.addEventListener('click', e => {
      if (!e.target.closest('.user-menu')) document.getElementById('user-dropdown').classList.add('hidden');
    });
    
    // Social Logins
    document.getElementById('google-login').addEventListener('click', () => this.socialLogin('Google'));
    document.getElementById('github-login').addEventListener('click', () => this.socialLogin('GitHub'));
    document.getElementById('facebook-login').addEventListener('click', () => this.socialLogin('Facebook'));

    this.bindProfile();
  }
  bindProfile() {
    document.getElementById('profile-avatar-upload').addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_SIZE = 256;
          let width = img.width, height = img.height;
          if (width > height) { if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; } } 
          else { if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; } }
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          document.getElementById('profile-avatar-preview').style.backgroundImage = `url(${dataUrl})`;
          document.getElementById('profile-avatar-preview').textContent = '';
          this.pendingAvatar = dataUrl;
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });
    document.getElementById('profile-form').addEventListener('submit', async e => {
      e.preventDefault();
      const displayName = document.getElementById('profile-displayname').value.trim();
      const bio = document.getElementById('profile-bio').value.trim();
      const experience = document.getElementById('profile-experience').value;
      const keyboardLayout = document.getElementById('profile-layout').value;
      const keyboardModel = document.getElementById('profile-kb-model').value.trim();
      const keyboardSwitches = document.getElementById('profile-kb-switches').value.trim();
      const avatar = this.pendingAvatar !== undefined ? this.pendingAvatar : (this.user ? this.user.avatar : null);
      try {
        const payload = { displayName, bio, avatar, experience, keyboardLayout, keyboardModel, keyboardSwitches };
        const r = await fetch('/api/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const d = await r.json();
        if (r.ok) {
          this.setUser(d.user);
          this.toast('Profile updated successfully!');
        } else {
          if (r.status === 401) {
            this.logout();
            this.showModal();
            this.showError('Your session expired. Please log in again.');
          } else {
            this.toast(d.error || 'Error updating profile');
          }
        }
      } catch (err) { this.toast('Connection error'); }
    });
  }
  showModal() { document.getElementById('auth-modal').classList.remove('hidden'); }
  hideModal() { document.getElementById('auth-modal').classList.add('hidden'); document.getElementById('auth-error').classList.add('hidden'); }
  showError(msg) { const el = document.getElementById('auth-error'); el.textContent = msg; el.classList.remove('hidden'); }
  toast(msg) {
    const t = document.getElementById('toast'); const m = document.getElementById('toast-msg');
    m.textContent = msg; t.classList.remove('hidden');
    setTimeout(() => t.classList.add('hidden'), 3000);
  }
  async checkSession() {
    try {
      const r = await fetch('/api/me');
      const d = await r.json();
      if (d.user) this.setUser(d.user);
      return !!d.user;
    } catch (e) { 
      return false; 
    }
  }
  
  initSplash() {
    const splash = document.getElementById('splash-screen');
    const bar = splash.querySelector('.loader-bar');
    
    // Set theme-specific splash color
    if (this.app.settings.theme === 'aditya') {
      splash.style.background = 'radial-gradient(circle at center, #1a1a3a, #050510)';
      if (bar) bar.style.background = 'linear-gradient(90deg, #ffcc33, #f43f5e)';
    } else if (this.app.settings.theme === 'light') {
      splash.style.background = '#f0f2f5';
      splash.querySelector('.splash-title').style.color = '#1a1a2e';
      splash.querySelector('.splash-text').style.color = '#718096';
      if (bar) bar.style.background = 'var(--accent-gradient)';
    }

    // Start loader animation
    setTimeout(() => {
      if (bar) bar.style.width = '100%';
    }, 100);

    // After loading animation
    setTimeout(async () => {
      const isLoggedIn = await this.checkSession();
      
      splash.classList.add('fade-out');
      
      setTimeout(() => {
        if (!isLoggedIn) {
          this.showModal();
          // Auto-select login tab
          document.querySelector('.auth-tab[data-tab="login"]').click();
        }
      }, 800);
    }, 2800);
  }

  socialLogin(provider) {
    const endpoint = `/auth/${provider.toLowerCase()}`;
    this.toast(`Redirecting to ${provider} Secure Login...`);
    window.location.href = endpoint;
  }
  async login() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    try {
      const r = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
      const d = await r.json();
      if (!r.ok) return this.showError(d.error);
      this.setUser(d.user); this.hideModal(); this.toast('Welcome back, ' + d.user.displayName + '!');
      this.app.loadFromServer();
    } catch (e) { this.showError('Connection error. Is the server running?'); }
  }
  async register() {
    const displayName = document.getElementById('reg-displayname').value.trim();
    const username = document.getElementById('reg-username').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    try {
      const r = await fetch('/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, email, password, displayName }) });
      const d = await r.json();
      if (!r.ok) return this.showError(d.error);
      this.setUser(d.user); this.hideModal(); this.toast('Account created! Welcome, ' + d.user.displayName + '!');
    } catch (e) { this.showError('Connection error. Is the server running?'); }
  }
  async logout() {
    try { await fetch('/api/logout', { method: 'POST' }); } catch (e) {}
    this.user = null;
    document.getElementById('nav-login-btn').classList.remove('hidden');
    document.getElementById('user-menu').classList.add('hidden');
    document.getElementById('user-dropdown').classList.add('hidden');
    document.getElementById('nav-insights').classList.add('hidden');
    this.toast('Logged out successfully');
  }
  setUser(user) {
    this.user = user;
    document.getElementById('nav-login-btn').classList.add('hidden');
    document.getElementById('user-menu').classList.remove('hidden');
    
    const initial = (user.displayName || user.username)[0].toUpperCase();
    const btn = document.getElementById('user-avatar-btn');
    const preview = document.getElementById('profile-avatar-preview');
    
    if (user.avatar) {
      btn.style.backgroundImage = `url(${user.avatar})`;
      btn.style.backgroundSize = 'cover';
      btn.textContent = '';
      if(preview) {
        preview.style.backgroundImage = `url(${user.avatar})`;
        preview.textContent = '';
      }
    } else {
      btn.style.backgroundImage = 'none';
      btn.textContent = initial;
      if(preview) {
        preview.style.backgroundImage = 'none';
        preview.textContent = initial;
      }
    }
    
    document.getElementById('dropdown-name').textContent = user.displayName || user.username;
    document.getElementById('dropdown-email').textContent = user.email;
    
    // Admin check
    const insightsBtn = document.getElementById('nav-insights');
    if (user.isAdmin) insightsBtn.classList.remove('hidden');
    else insightsBtn.classList.add('hidden');
    
    // Fill profile form
    const dnInput = document.getElementById('profile-displayname');
    const bioInput = document.getElementById('profile-bio');
    const expInput = document.getElementById('profile-experience');
    const layInput = document.getElementById('profile-layout');
    const kmInput = document.getElementById('profile-kb-model');
    const ksInput = document.getElementById('profile-kb-switches');
    if(dnInput) dnInput.value = user.displayName || user.username || '';
    if(bioInput) bioInput.value = user.bio || '';
    if(expInput) expInput.value = user.experience || '';
    if(layInput) layInput.value = user.keyboard_layout || '';
    if(kmInput) kmInput.value = user.keyboard_model || '';
    if(ksInput) ksInput.value = user.keyboard_switches || '';
  }
  isLoggedIn() { return !!this.user; }
}
