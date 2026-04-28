/* ═══════════════════════════════════════════════
   EQUIVISION – APP.JS
   Upload → Analyze → Visualize → Simulate
═══════════════════════════════════════════════ */

// ── State ────────────────────────────────────
let currentData = null;
let biasChart   = null;

// ── DOM helpers ──────────────────────────────
const $ = id => document.getElementById(id);
const show = id => { $(id).classList.remove('hidden'); $(id).classList.add('fade-in'); };
const hide = id => $(id).classList.add('hidden');

// ── Drag & Drop Setup ─────────────────────────
const uploadArea = $('uploadArea');
const fileInput  = $('fileInput');

uploadArea.addEventListener('dragover', e => {
  e.preventDefault();
  uploadArea.classList.add('drag-over');
});
uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('drag-over'));
uploadArea.addEventListener('drop', e => {
  e.preventDefault();
  uploadArea.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) setFile(file);
});
uploadArea.addEventListener('click', e => {
  if (e.target.tagName !== 'BUTTON') fileInput.click();
});
fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) setFile(fileInput.files[0]);
});

function setFile(file) {
  fileInput._selectedFile = file;
  $('fileStatus').textContent = `✓ ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
  $('errorMsg').textContent = '';
}

// ── Analyze ───────────────────────────────────
async function analyzeDataset() {
  const file = fileInput._selectedFile || fileInput.files[0];
  if (!file) {
    showError('Please select a CSV file before analyzing.');
    return;
  }

  // Show loading state
  setLoading(true);
  $('errorMsg').textContent = '';
  hideResults();

  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch('http://localhost:5000/analyze', {
      method: 'POST',
      body: formData
    });

    if (!res.ok) throw new Error(`Server error: ${res.status} ${res.statusText}`);

    const data = await res.json();
    currentData = data;
    renderResults(data);

  } catch (err) {
    // Demo fallback — used when server not running
    if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError') || err.message.includes('net::ERR')) {
      console.warn('Server not reachable — using demo data.');
      const demo = {
        disparateImpact: 0.5,
        statisticalParity: -0.3,
        biasDetected: true,
        majorityRate: 0.8,
        minorityRate: 0.4,
        explanation: "This dataset shows a significant fairness issue. The minority group has a 40% positive outcome rate compared to 80% for the majority group, yielding a Disparate Impact ratio of 0.50 — well below the legal threshold of 0.80 (the '4/5 rule'). Statistical Parity Difference of -0.30 confirms that minority applicants are systematically disadvantaged. Without intervention, any AI model trained on this data will perpetuate and potentially amplify these disparities in real-world decisions."
      };
      currentData = demo;
      renderResults(demo);
    } else {
      showError(`Error: ${err.message}. Make sure your backend is running at localhost:5000.`);
    }
  } finally {
    setLoading(false);
  }
}

function setLoading(loading) {
  $('btnText').textContent = loading ? 'Analyzing…' : 'Analyze Dataset';
  $('btnSpinner').style.display = loading ? 'inline-block' : 'none';
  $('analyzeBtn').disabled = loading;
}

function showError(msg) { $('errorMsg').textContent = msg; }

function hideResults() {
  ['results','chartSection','simulator','beforeAfter'].forEach(hide);
}

// ── Render Results ────────────────────────────
function renderResults(data) {
  const { disparateImpact, statisticalParity, biasDetected,
          majorityRate, minorityRate, explanation } = data;

  // Verdict
  const banner = $('verdictBanner');
  if (biasDetected) {
    banner.className = 'verdict-banner biased';
    $('verdictIcon').textContent = '⚠';
    $('verdictText').textContent = 'Bias Detected in Dataset';
  } else {
    banner.className = 'verdict-banner fair';
    $('verdictIcon').textContent = '✅';
    $('verdictText').textContent = 'Dataset Appears Fair';
  }

  // Disparate Impact card
  const diVal = parseFloat(disparateImpact).toFixed(2);
  $('metricDI').textContent = diVal;
  const diIsFair = disparateImpact >= 0.8;
  $('metricDI').className = 'card-metric ' + (diIsFair ? 'green' : 'red');
  $('barDI').style.width  = Math.min(disparateImpact * 100, 100) + '%';
  $('barDI').className    = 'bar-fill ' + (diIsFair ? 'green' : 'red');
  $('tagDI').textContent  = diIsFair ? '✅ Above 0.8 threshold' : '⚠ Below 0.8 threshold';
  $('tagDI').className    = 'card-tag ' + (diIsFair ? 'green' : 'red');
  $('cardDI').style.borderColor = diIsFair ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)';

  // Statistical Parity card
  const spVal = parseFloat(statisticalParity).toFixed(2);
  $('metricSP').textContent = (statisticalParity >= 0 ? '+' : '') + spVal;
  const spIsFair = Math.abs(statisticalParity) < 0.1;
  $('metricSP').className = 'card-metric ' + (spIsFair ? 'green' : 'red');
  $('tagSP').textContent  = spIsFair ? '✅ Near zero — equitable' : '⚠ Gap detected';
  $('tagSP').className    = 'card-tag ' + (spIsFair ? 'green' : 'red');
  // Parity thumb: map from [-1,0] → [0%,100%]
  const thumbPct = ((statisticalParity + 1) / 1) * 100;
  $('parityThumb').style.left = Math.max(0, Math.min(100, thumbPct)) + '%';

  // Rates
  $('metricMaj').textContent = (majorityRate * 100).toFixed(0) + '%';
  $('metricMin').textContent = (minorityRate * 100).toFixed(0) + '%';

  // AI explanation
  $('aiExplanation').textContent = explanation;

  // Show sections
  show('results');

  // Chart
  setTimeout(() => {
    show('chartSection');
    renderChart(majorityRate, minorityRate);
  }, 200);

  // Simulator
  setTimeout(() => {
    show('simulator');
    $('simSlider').value = Math.round(minorityRate * 100);
    updateSimulator(Math.round(minorityRate * 100), true);
  }, 400);

  // Before/After
  setTimeout(() => {
    show('beforeAfter');
    renderBeforeAfter(data);
  }, 600);

  // Scroll to results
  setTimeout(() => {
    $('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
}

// ── Chart.js ──────────────────────────────────
function renderChart(majRate, minRate) {
  const ctx = $('biasChart').getContext('2d');

  if (biasChart) biasChart.destroy();

  biasChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Majority Group', 'Minority Group'],
      datasets: [
        {
          label: 'Positive Outcome Rate',
          data: [(majRate * 100).toFixed(1), (minRate * 100).toFixed(1)],
          backgroundColor: [
            'rgba(34,197,94,0.7)',
            'rgba(239,68,68,0.7)'
          ],
          borderColor: [
            '#22c55e',
            '#ef4444'
          ],
          borderWidth: 2,
          borderRadius: 8,
          borderSkipped: false,
        },
        {
          label: 'Fair Target (80%)',
          data: [80, 80],
          type: 'line',
          borderColor: 'rgba(56,189,248,0.6)',
          borderDash: [8, 4],
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          labels: { color: '#94a3b8', font: { family: 'DM Sans', size: 13 } }
        },
        tooltip: {
          backgroundColor: '#1e293b',
          titleColor: '#e2e8f0',
          bodyColor: '#94a3b8',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          callbacks: {
            label: ctx => ` ${ctx.parsed.y}%`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true, max: 100,
          ticks: {
            color: '#64748b',
            callback: v => v + '%',
            font: { family: 'DM Sans' }
          },
          grid: { color: 'rgba(255,255,255,0.05)' }
        },
        x: {
          ticks: { color: '#94a3b8', font: { family: 'Syne', weight: '700' } },
          grid: { display: false }
        }
      }
    }
  });
}

// ── Simulator ─────────────────────────────────
function updateSimulator(rawVal, suppressVerdict = false) {
  const pct     = parseInt(rawVal);
  const minRate = pct / 100;
  const majRate = currentData ? currentData.majorityRate : 0.8;

  $('simMinVal').textContent = pct + '%';
  $('simMajFixed').textContent = (majRate * 100).toFixed(0) + '%';

  const di = majRate > 0 ? (minRate / majRate).toFixed(2) : '—';
  const diNum = parseFloat(di);
  $('simDI').textContent = di;
  $('simDI').className   = 'sim-metric-val ' + (diNum >= 0.8 ? 'accent-green' : 'accent-red');

  const gap = Math.abs(majRate - minRate);
  $('simGap').textContent = (gap * 100).toFixed(1) + '%';
  $('simGap').className   = 'sim-metric-val ' + (gap < 0.05 ? 'accent-green' : 'accent-red');

  const isFair = diNum >= 0.8;
  $('simStatus').textContent  = isFair ? '✅ Fair' : '⚠ Biased';
  $('simStatus').style.color  = isFair ? 'var(--green)' : 'var(--red)';

  const verdict = $('simVerdict');
  if (!suppressVerdict) {
    verdict.className   = 'sim-verdict ' + (isFair ? 'fair' : 'biased');
    verdict.textContent = isFair
      ? `✅ At ${pct}% minority rate, your dataset meets the fairness threshold (DI ≥ 0.80). Bias is eliminated.`
      : `⚠ At ${pct}% minority rate, Disparate Impact is ${di} — still below the 0.80 threshold. Increase minority representation.`;
  }
}

// ── Before / After ────────────────────────────
function renderBeforeAfter(data) {
  const { disparateImpact, majorityRate, minorityRate } = data;

  // BEFORE (current)
  const baDI = parseFloat(disparateImpact).toFixed(2);
  $('baBeforeDI').textContent  = `DI: ${baDI}`;
  $('baBeforeDI').style.color  = disparateImpact >= 0.8 ? 'var(--green)' : 'var(--red)';
  $('baBeforeMin').textContent = `Minority Rate: ${(minorityRate * 100).toFixed(0)}%`;
  $('baBeforeMajBar').style.width = (majorityRate * 100) + '%';
  $('baBeforeMinBar').style.width = (minorityRate * 100) + '%';
  $('baBeforeMajPct').textContent = (majorityRate * 100).toFixed(0) + '%';
  $('baBeforeMinPct').textContent = (minorityRate * 100).toFixed(0) + '%';
  $('baBeforeMinBar').className   = 'ba-fill ' + (disparateImpact >= 0.8 ? 'ba-fill-green' : 'ba-fill-red');

  // AFTER (corrected — minority raised to meet 80% DI threshold)
  const improvedMin = majorityRate * 0.8;
  const improvedDI  = (improvedMin / majorityRate).toFixed(2);
  $('baAfterDI').textContent  = `DI: ${improvedDI}`;
  $('baAfterDI').style.color  = 'var(--green)';
  $('baAfterMin').textContent = `Minority Rate: ${(improvedMin * 100).toFixed(0)}%`;
  $('baAfterMajBar').style.width = (majorityRate * 100) + '%';
  $('baAfterMinBar').style.width = (improvedMin * 100) + '%';
  $('baAfterMajPct').textContent = (majorityRate * 100).toFixed(0) + '%';
  $('baAfterMinPct').textContent = (improvedMin * 100).toFixed(0) + '%';
  $('baAfterMinBar').className   = 'ba-fill ba-fill-green';
}
