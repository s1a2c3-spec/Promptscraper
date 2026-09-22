const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://hjzevqeopdcftjrkdtpl.supabase.co';

const PLAN_LIMITS = {
  free: { optimize: 60, verify: 13 },
  starter: { optimize: 150, verify: 60 },
  pro: { optimize: 500, verify: 180 },
};

const MAX_ANSWER_LENGTH = 3000;
const MAX_CLAIMS = 5; // caps both AI cost and number of web searches per verify call

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const origin = req.headers.origin || req.headers.referer || '';
  const isAllowedOrigin =
    origin.includes('promptscaper.com') ||
    origin.includes('.vercel.app') ||
    origin.includes('localhost');
  if (!isAllowedOrigin) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Please log in to use the verifier.' });
  }

  const supabaseAdmin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const { data: userData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !userData?.user) {
    return res.status(401).json({ error: 'Session expired. Please log in again.' });
  }
  const user = userData.user;

  const { answer } = req.body || {};
  if (!answer || typeof answer !== 'string' || !answer.trim()) {
    return res.status(400).json({ error: 'Please paste an AI answer to verify.' });
  }
  if (answer.length > MAX_ANSWER_LENGTH) {
    return res.status(400).json({ error: `Answer is too long (max ${MAX_ANSWER_LENGTH} characters).` });
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('plan')
    .eq('id', user.id)
    .maybeSingle();
  const plan = profile?.plan || 'free';
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;

  const month = new Date().toISOString().slice(0, 7);
  const { data: usageRow } = await supabaseAdmin
    .from('usage')
    .select('optimize_count, verify_count')
    .eq('user_id', user.id)
    .eq('month', month)
    .maybeSingle();

  const currentOptimizeCount = usageRow?.optimize_count || 0;
  const currentVerifyCount = usageRow?.verify_count || 0;

  if (currentVerifyCount >= limits.verify) {
    return res.status(429).json({
      error: `You've used all ${limits.verify} verifies for this month on the ${plan} plan. Upgrade to continue.`,
    });
  }

  // ---- helper to call Claude (Haiku) ----
  async function callClaude(systemPrompt, userMessage, maxTokens) {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });
    if (!r.ok) {
      const errText = await r.text();
      console.error('Anthropic API error:', errText);
      throw new Error('AI service error');
    }
    const data = await r.json();
    return data?.content?.[0]?.text?.trim() || '';
  }

  // ---- Step 1: extract factual claims ----
  let claims;
  try {
    const extractionPrompt = `Extract up to ${MAX_CLAIMS} distinct, checkable factual claims from the user's text (which may be in Hindi, Hinglish, or English). Ignore opinions and obvious filler. Respond with ONLY a JSON array of short claim strings, nothing else — no markdown fences, no explanation. Example: ["Claim one text", "Claim two text"]`;
    const rawClaims = await callClaude(extractionPrompt, answer, 400);
    claims = JSON.parse(rawClaims.replace(/```json|```/g, '').trim());
    if (!Array.isArray(claims)) throw new Error('not an array');
    claims = claims.slice(0, MAX_CLAIMS);
  } catch (err) {
    console.error('Claim extraction failed:', err);
    return res.status(502).json({ error: 'Could not analyze the answer. Please try again.' });
  }

  if (claims.length === 0) {
    return res.status(200).json({
      claims: [],
      trustScore: null,
      note: 'No checkable factual claims were found in this text.',
    });
  }

  // ---- Step 2: web search each claim via Tavily ----
  const searchResults = await Promise.all(
    claims.map(async (claim) => {
      try {
        const r = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: process.env.TAVILY_API_KEY,
            query: claim,
            search_depth: 'basic',
            max_results: 3,
          }),
        });
        if (!r.ok) return { claim, snippets: [] };
        const data = await r.json();
        const snippets = (data.results || []).map((res) => res.content).slice(0, 3);
        return { claim, snippets };
      } catch (err) {
        console.error('Tavily search failed for claim:', claim, err);
        return { claim, snippets: [] };
      }
    })
  );

  // ---- Step 3: ask Claude to judge each claim against the search snippets ----
  let verdicts;
  try {
    const verificationPrompt = `You will receive a list of claims, each with short web search snippets. For each claim, decide a status: "verified" (snippets support it), "uncertain" (mixed, weak, or no strong evidence), or "wrong" (snippets contradict it). Give a one-sentence reason for each. Respond with ONLY a JSON array like: [{"claim": "...", "status": "verified", "reason": "..."}]. No markdown fences, no other text.`;
    const inputForClaude = JSON.stringify(searchResults);
    const rawVerdicts = await callClaude(verificationPrompt, inputForClaude, 700);
    verdicts = JSON.parse(rawVerdicts.replace(/```json|```/g, '').trim());
    if (!Array.isArray(verdicts)) throw new Error('not an array');
  } catch (err) {
    console.error('Verification step failed:', err);
    return res.status(502).json({ error: 'Could not verify the claims. Please try again.' });
  }

  const verifiedCount = verdicts.filter((v) => v.status === 'verified').length;
  const trustScore = Math.round((verifiedCount / verdicts.length) * 100);

  // ---- Only increment usage after a fully successful verify ----
  await supabaseAdmin.from('usage').upsert(
    {
      user_id: user.id,
      month,
      optimize_count: currentOptimizeCount,
      verify_count: currentVerifyCount + 1,
    },
    { onConflict: 'user_id,month' }
  );

  return res.status(200).json({
    claims: verdicts,
    trustScore,
    usage: { verify: currentVerifyCount + 1, verifyLimit: limits.verify },
  });
};
