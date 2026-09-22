// Same plan limits as the backend (api/optimize.js, api/verify.js) —
// used here only to display "X / Y" correctly, not to enforce anything.
const PLAN_LIMITS = {
  free: { optimize: 60, verify: 13, label: 'Free' },
  starter: { optimize: 150, verify: 60, label: 'Starter' },
  pro: { optimize: 500, verify: 180, label: 'Pro' },
};

(async () => {
  const { data: { session } } = await sbClient.auth.getSession();
  if (!session) return; // auth-guard.js already redirects to login in this case

  const user = session.user;
  document.getElementById('account-email').textContent = user.email;

  // Plan (RLS lets a user read only their own profile row)
  const { data: profile } = await sbClient
    .from('profiles')
    .select('plan')
    .eq('id', user.id)
    .maybeSingle();

  const planKey = profile?.plan || 'free';
  const plan = PLAN_LIMITS[planKey] || PLAN_LIMITS.free;
  document.getElementById('plan-name').textContent = plan.label;

  // This month's usage
  const month = new Date().toISOString().slice(0, 7);
  const { data: usage } = await sbClient
    .from('usage')
    .select('optimize_count, verify_count')
    .eq('user_id', user.id)
    .eq('month', month)
    .maybeSingle();

  const optimizeUsed = usage?.optimize_count || 0;
  const verifyUsed = usage?.verify_count || 0;

  document.getElementById('acc-optimize-count').textContent = `${optimizeUsed} / ${plan.optimize}`;
  document.getElementById('acc-optimize-fill').style.width = `${Math.min(100, (optimizeUsed / plan.optimize) * 100)}%`;

  document.getElementById('acc-verify-count').textContent = `${verifyUsed} / ${plan.verify}`;
  document.getElementById('acc-verify-fill').style.width = `${Math.min(100, (verifyUsed / plan.verify) * 100)}%`;
})();
