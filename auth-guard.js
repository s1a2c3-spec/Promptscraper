// Runs before the rest of the dashboard. Redirects to login.html
// if there's no active session, so /dashboard.html can't be reached
// just by typing the URL.

(async () => {
  const { data: { session } } = await sbClient.auth.getSession();

  if (!session) {
    window.location.href = 'login.html';
    return;
  }

  // Optional: show the user's name somewhere later, e.g.
  // document.getElementById('user-name').textContent = session.user.user_metadata?.name || session.user.email;
})();

document.addEventListener('DOMContentLoaded', () => {
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      await sbClient.auth.signOut();
      window.location.href = 'index.html';
    });
  }
});
