// Tab switching
const tabButtons = document.querySelectorAll('.tab-btn');
const panels = {
  optimize: document.getElementById('panel-optimize'),
  verify: document.getElementById('panel-verify'),
};

tabButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    tabButtons.forEach((b) => {
      b.classList.remove('active');
      b.setAttribute('aria-selected', 'false');
    });
    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');

    Object.entries(panels).forEach(([key, panel]) => {
      panel.hidden = key !== btn.dataset.tab;
    });
  });
});

// --- Optimizer (placeholder — real API call comes in next step) ---
const optimizeBtn = document.getElementById('optimize-btn');
const optimizeOutput = document.getElementById('optimize-output');
const copyOptimizeBtn = document.getElementById('copy-optimize');

if (optimizeBtn) {
  optimizeBtn.addEventListener('click', async () => {
    const roughPrompt = document.getElementById('rough-prompt').value.trim();
    if (!roughPrompt) {
      optimizeOutput.innerHTML = '<p class="output-placeholder">Type a prompt first.</p>';
      return;
    }

    const targetAI = document.getElementById('target-ai').value;
    const style = document.getElementById('prompt-style').value;

    optimizeBtn.disabled = true;
    optimizeBtn.textContent = 'Optimizing...';
    optimizeOutput.innerHTML = '<p class="output-placeholder">Working on it...</p>';

    try {
      const { data: { session } } = await sbClient.auth.getSession();
      if (!session) {
        window.location.href = 'login.html';
        return;
      }

      const res = await fetch('/api/optimize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ roughPrompt, targetAI, style }),
      });

      const result = await res.json();

      if (!res.ok) {
        optimizeOutput.innerHTML = `<p class="output-placeholder">${result.error || 'Something went wrong. Please try again.'}</p>`;
        copyOptimizeBtn.disabled = true;
        return;
      }

      optimizeOutput.innerHTML = `<p class="result-text">${result.optimizedPrompt}</p>`;
      copyOptimizeBtn.disabled = false;

      if (result.usage) {
        document.getElementById('optimize-count').textContent = `${result.usage.optimize} / ${result.usage.optimizeLimit}`;
        const pct = Math.min(100, (result.usage.optimize / result.usage.optimizeLimit) * 100);
        document.getElementById('optimize-fill').style.width = `${pct}%`;
      }
    } catch (err) {
      optimizeOutput.innerHTML = '<p class="output-placeholder">Network error. Please check your connection and try again.</p>';
    } finally {
      optimizeBtn.disabled = false;
      optimizeBtn.textContent = 'Optimize prompt';
    }
  });
}

if (copyOptimizeBtn) {
  copyOptimizeBtn.addEventListener('click', () => {
    const text = optimizeOutput.innerText;
    navigator.clipboard.writeText(text);
  });
}

// --- Verifier (placeholder — real API call comes in next step) ---
const verifyBtn = document.getElementById('verify-btn');
const verifyOutput = document.getElementById('verify-output');
const copyReportBtn = document.getElementById('copy-report');

if (verifyBtn) {
  verifyBtn.addEventListener('click', async () => {
    const answer = document.getElementById('ai-answer').value.trim();
    if (!answer) {
      verifyOutput.innerHTML = '<p class="output-placeholder">Paste an AI answer first.</p>';
      return;
    }

    verifyBtn.disabled = true;
    verifyBtn.textContent = 'Verifying...';
    verifyOutput.innerHTML = '<p class="output-placeholder">Checking claims against sources...</p>';

    try {
      const { data: { session } } = await sbClient.auth.getSession();
      if (!session) {
        window.location.href = 'login.html';
        return;
      }

      const res = await fetch('/api/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ answer }),
      });

      const result = await res.json();

      if (!res.ok) {
        verifyOutput.innerHTML = `<p class="output-placeholder">${result.error || 'Something went wrong. Please try again.'}</p>`;
        copyReportBtn.disabled = true;
        return;
      }

      if (!result.claims || result.claims.length === 0) {
        verifyOutput.innerHTML = `<p class="output-placeholder">${result.note || 'No checkable claims found.'}</p>`;
        copyReportBtn.disabled = true;
        return;
      }

      const statusMap = {
        verified: { dot: 'claim-verified', label: 'Verified' },
        uncertain: { dot: 'claim-uncertain', label: 'Uncertain' },
        wrong: { dot: 'claim-wrong', label: 'Likely Wrong' },
      };

      const rows = result.claims
        .map((c) => {
          const s = statusMap[c.status] || statusMap.uncertain;
          return `<div class="claim-row"><span class="claim-dot ${s.dot}"></span><span><strong>${s.label}:</strong> ${c.claim} — <span style="color:var(--text-muted)">${c.reason || ''}</span></span></div>`;
        })
        .join('');

      verifyOutput.innerHTML = `${rows}<div class="trust-score">Trust score: <strong>${result.trustScore}%</strong></div>`;
      copyReportBtn.disabled = false;

      if (result.usage) {
        document.getElementById('verify-count').textContent = `${result.usage.verify} / ${result.usage.verifyLimit}`;
        const pct = Math.min(100, (result.usage.verify / result.usage.verifyLimit) * 100);
        document.getElementById('verify-fill').style.width = `${pct}%`;
      }
    } catch (err) {
      verifyOutput.innerHTML = '<p class="output-placeholder">Network error. Please check your connection and try again.</p>';
    } finally {
      verifyBtn.disabled = false;
      verifyBtn.textContent = 'Verify answer';
    }
  });
}

if (copyReportBtn) {
  copyReportBtn.addEventListener('click', () => {
    const text = verifyOutput.innerText;
    navigator.clipboard.writeText(text);
  });
}
