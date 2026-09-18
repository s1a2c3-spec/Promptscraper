// Handles real sign-up via Supabase Auth.

const signupForm = document.getElementById('signup-form');
const authError = document.getElementById('auth-error');
const googleBtn = document.getElementById('google-signup');

if (signupForm) {
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    authError.hidden = true;

    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const submitBtn = signupForm.querySelector('button[type="submit"]');

    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating account...';

    const { data, error } = await sbClient.auth.signUp({
      email,
      password,
      options: { data: { name } }
    });

    submitBtn.disabled = false;
    submitBtn.textContent = 'Create account';

    if (error) {
      authError.textContent = error.message;
      authError.hidden = false;
      return;
    }

    if (data.session) {
      // Email confirmation is off — logged in immediately
      window.location.href = 'dashboard.html';
    } else {
      // Email confirmation is on — Supabase sent a confirmation email
      authError.textContent = 'Account created! Check your email to confirm, then log in.';
      authError.style.color = 'var(--teal)';
      authError.hidden = false;
      signupForm.reset();
    }
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
