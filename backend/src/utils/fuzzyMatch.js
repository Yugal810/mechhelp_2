/**
 * Vehicle Name Fuzzy Matching & Confidence Score Calculator
 */

function levenshteinDistance(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,       // deletion
        dp[i][j - 1] + 1,       // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }
  return dp[m][n];
}

function levenshteinSimilarity(a, b) {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1.0;
  const dist = levenshteinDistance(a.toLowerCase(), b.toLowerCase());
  return 1 - dist / maxLen;
}

function getBigrams(str) {
  const s = str.toLowerCase().replace(/[^a-z0-9]/g, "");
  const bigrams = [];
  for (let i = 0; i < s.length - 1; i++) {
    bigrams.push(s.slice(i, i + 2));
  }
  return bigrams;
}

function diceSimilarity(a, b) {
  const bgA = getBigrams(a);
  const bgB = getBigrams(b);
  if (!bgA.length || !bgB.length) return 0;

  let matches = 0;
  const copyB = [...bgB];
  for (const bg of bgA) {
    const idx = copyB.indexOf(bg);
    if (idx !== -1) {
      matches++;
      copyB.splice(idx, 1);
    }
  }
  return (2 * matches) / (bgA.length + bgB.length);
}

function calculateSimilarity(query, target) {
  const qNorm = String(query || "").toLowerCase().trim().replace(/[^a-z0-9\s]/g, "");
  const tNorm = String(target || "").toLowerCase().trim().replace(/[^a-z0-9\s]/g, "");
  if (!qNorm || !tNorm) return 0;
  if (qNorm === tNorm) return 1.0;

  if (tNorm.includes(qNorm) || qNorm.includes(tNorm)) {
    const ratio = Math.min(qNorm.length, tNorm.length) / Math.max(qNorm.length, tNorm.length);
    return Math.max(0.75, ratio);
  }

  const levScore = levenshteinSimilarity(qNorm, tNorm);
  const diceScore = diceSimilarity(qNorm, tNorm);

  return Math.max(levScore, diceScore, (levScore + diceScore) / 2);
}

/**
 * Calculates confidence score (0.0 to 1.0) between user query and a car document.
 */
function calculateCarConfidence(query, car) {
  if (!query || !car) return 0;

  // Clean year digits and dots
  let cleanQuery = String(query)
    .replace(/\b(19\d{2}|20\d{2})\b/gi, "")
    .replace(/[\.\,]/g, "")
    .trim();

  const qNorm = cleanQuery.toLowerCase();
  const qWords = qNorm.split(/\s+/).filter(Boolean);

  const brand = (car.brand || "").toLowerCase().trim();
  const model = (car.model || "").toLowerCase().trim();
  const variant = (car.variant || "").toLowerCase().trim();
  const brandModel = `${brand} ${model}`.trim();

  const compactQuery = qNorm.replace(/\s+/g, "");
  const compactModel = model.replace(/\s+/g, "");
  const compactBrandModel = brandModel.replace(/\s+/g, "");

  let bestScore = 0;

  // 1. Direct model similarity
  const modelSim = calculateSimilarity(qNorm, model);
  bestScore = Math.max(bestScore, modelSim);

  // 2. Compact model similarity (handles "xux 500" vs "xuv500")
  const compactModelSim = calculateSimilarity(compactQuery, compactModel);
  bestScore = Math.max(bestScore, compactModelSim);

  // 3. Brand + Model similarity
  const brandModelSim = calculateSimilarity(qNorm, brandModel);
  bestScore = Math.max(bestScore, brandModelSim * 0.95);

  // 4. Token level matching for multi-word queries
  if (qWords.length > 1) {
    let wordScores = qWords.map((word) => {
      const wModelSim = calculateSimilarity(word, model);
      const wBrandSim = calculateSimilarity(word, brand);
      const wCompactSim = calculateSimilarity(word, compactModel);
      return Math.max(wModelSim, wBrandSim, wCompactSim);
    });
    const avgWordScore = wordScores.reduce((a, b) => a + b, 0) / wordScores.length;
    bestScore = Math.max(bestScore, avgWordScore);
  }

  return Math.round(bestScore * 100) / 100;
}

module.exports = {
  levenshteinSimilarity,
  diceSimilarity,
  calculateSimilarity,
  calculateCarConfidence,
  DEFAULT_CONFIDENCE_THRESHOLD: parseFloat(process.env.VEHICLE_CONFIDENCE_THRESHOLD || "0.60"),
};
