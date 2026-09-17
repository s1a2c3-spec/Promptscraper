// This file currently handles only front-end form behavior.
// Supabase signup logic will be added in a later step —
// for now it shows how the form will respond once connected.

const signupForm = document.getElementById('signup-form');
const authError = document.getElementById('auth-error');
const googleBtn = document.getElementById('google-signup');

if (signupForm) {
  signupForm.addEventListener('submit', (e) => {
    e.preventDefault();
    authError.hidden = true;

    // TODO (next step): replace this with a real Supabase call, e.g.
    // const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name } } });
    // if (error) { show authError } else { redirect to dashboard.html }

    authError.textContent = 'Sign-up isn\'t connected yet — Supabase wiring comes in the next step.';
    authError.hidden = false;
  });
}

if (googleBtn) {
  googleBtn.addEventListener('click', () => {
    // TODO (next step): supabase.auth.signInWithOAuth({ provider: 'google' })
    alert('Google sign-up will be connected once Supabase is wired up.');
  });
}
