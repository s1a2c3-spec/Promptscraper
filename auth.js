// This file currently handles only front-end form behavior.
// Supabase login logic will be added in a later step —
// for now it shows how the form will respond once connected.

const loginForm = document.getElementById('login-form');
const authError = document.getElementById('auth-error');
const googleBtn = document.getElementById('google-login');

if (loginForm) {
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    authError.hidden = true;

    // TODO (next step): replace this with a real Supabase call, e.g.
    // const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    // if (error) { show authError } else { redirect to dashboard.html }

    authError.textContent = 'Login isn\'t connected yet — Supabase wiring comes in the next step.';
    authError.hidden = false;
  });
}

if (googleBtn) {
  googleBtn.addEventListener('click', () => {
    // TODO (next step): supabase.auth.signInWithOAuth({ provider: 'google' })
    alert('Google login will be connected once Supabase is wired up.');
  });
}
