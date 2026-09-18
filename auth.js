// Handles real login via Supabase Auth.

const loginForm = document.getElementById('login-form');
const authError = document.getElementById('auth-error');
const googleBtn = document.getElementById('google-login');

if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    authError.hidden = true;

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const submitBtn = loginForm.querySelector('button[type="submit"]');

    submitBtn.disabled = true;
    submitBtn.textContent = 'Logging in...';

    const { data, error } = await sbClient.auth.signInWithPassword({ email, password });

    submitBtn.disabled = false;
    submitBtn.textContent = 'Log in';

    if (error) {
      authError.textContent = error.message === 'Invalid login credentials'
        ? 'Incorrect email or password.'
        : error.message;
      authError.hidden = false;
      return;
    }

    // Success — go to dashboard
    window.location.href = 'dashboard.html';
  });
}

if (googleBtn) {
  googleBtn.addEventListener('click', async () => {
    await sbClient.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/dashboard.html' }
    });
  });
}
