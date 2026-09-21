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
  verifyBtn.addEventListener('click', () => {
    const answer = document.getElementById('ai-answer').value.trim();
    if (!answer) {
      verifyOutput.innerHTML = '<p class="output-placeholder">Paste an AI answer first.</p>';
      return;
    }

    // TODO (next step): send `answer` to the backend API, which extracts
    // claims, checks them against web search results, and returns a
    // verdict per claim plus an overall trust score.
    verifyOutput.innerHTML = '<p class="output-placeholder">Verifier isn\'t connected to search/AI yet — this comes in the next step (backend API wiring).</p>';
    copyReportBtn.disabled = true;
  });
}

if (copyReportBtn) {
  copyReportBtn.addEventListener('click', () => {
    const text = verifyOutput.innerText;
    navigator.clipboard.writeText(text);
  });
}
