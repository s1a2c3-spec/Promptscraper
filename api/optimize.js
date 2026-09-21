const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://hjzevqeopdcftjrkdtpl.supabase.co';

// Monthly caps per plan (must match what's shown on the Pricing page)
const PLAN_LIMITS = {
  free: { optimize: 60, verify: 13 },
  starter: { optimize: 150, verify: 60 },
  pro: { optimize: 500, verify: 180 },
};

const MAX_PROMPT_LENGTH = 1500;

module.exports = async (req, res) => {
  // 1. Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 2. Basic origin check — blocks random outside callers hitting this endpoint directly
  const origin = req.headers.origin || req.headers.referer || '';
  const isAllowedOrigin =
    origin.includes('promptscaper.com') ||
    origin.includes('.vercel.app') ||
    origin.includes('localhost');
  if (!isAllowedOrigin) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // 3. Require login — verify the Supabase session token
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Please log in to use the optimizer.' });
  }

  const supabaseAdmin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const { data: userData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !userData?.user) {
    return res.status(401).json({ error: 'Session expired. Please log in again.' });
  }
  const user = userData.user;

  // 4. Validate input
  const { roughPrompt, targetAI, style } = req.body || {};
  if (!roughPrompt || typeof roughPrompt !== 'string' || !roughPrompt.trim()) {
    return res.status(400).json({ error: 'Please enter a prompt to optimize.' });
  }
  if (roughPrompt.length > MAX_PROMPT_LENGTH) {
    return res.status(400).json({ error: `Prompt is too long (max ${MAX_PROMPT_LENGTH} characters).` });
  }

  // 5. Look up the user's plan
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('plan')
    .eq('id', user.id)
    .maybeSingle();
  const plan = profile?.plan || 'free';
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;

  // 6. Check this month's usage BEFORE calling Claude — this is what protects your money
  const month = new Date().toISOString().slice(0, 7); // e.g. "2026-09"
  const { data: usageRow } = await supabaseAdmin
    .from('usage')
    .select('optimize_count, verify_count')
    .eq('user_id', user.id)
    .eq('month', month)
    .maybeSingle();

  const currentOptimizeCount = usageRow?.optimize_count || 0;
  const currentVerifyCount = usageRow?.verify_count || 0;

  if (currentOptimizeCount >= limits.optimize) {
    return res.status(429).json({
      error: `You've used all ${limits.optimize} optimizes for this month on the ${plan} plan. Upgrade to continue.`,
    });
  }

  // 7. Call Claude — with a hard output cap so every call has a known max cost
  const systemPrompt = `You are a prompt optimization assistant for Promptscaper. The user may write their rough prompt in Hindi, Hinglish, or English — understand their intent regardless of language. Always rewrite the prompt in clear, detailed English, since the target AI performs best with English prompts. Target AI: ${targetAI || 'ChatGPT'}. Desired style: ${style || 'Concise'}. Return ONLY the optimized prompt text — no preamble, no explanation, no quotation marks around it.`;

  let aiResponse;
  try {
    aiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        system: systemPrompt,
        messages: [{ role: 'user', content: roughPrompt }],
      }),
    });
  } catch (err) {
    console.error('Network error calling Anthropic:', err);
    return res.status(502).json({ error: 'Could not reach the AI service. Please try again.' });
  }

  if (!aiResponse.ok) {
    const errText = await aiResponse.text();
    console.error('Anthropic API error:', errText);
    return res.status(502).json({ error: 'AI service returned an error. Please try again.' });
  }

  const data = await aiResponse.json();
  const optimizedPrompt = data?.content?.[0]?.text?.trim() || '';

  // 8. Only increment usage AFTER a successful call
  await supabaseAdmin.from('usage').upsert(
    {
      user_id: user.id,
      month,
      optimize_count: currentOptimizeCount + 1,
      verify_count: currentVerifyCount,
    },
    { onConflict: 'user_id,month' }
  );

  return res.status(200).json({
    optimizedPrompt,
    usage: { optimize: currentOptimizeCount + 1, optimizeLimit: limits.optimize },
  });
};
