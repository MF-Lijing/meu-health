/* 竹枕快速适配 —— 规则引擎（与 Android PillowRecommender / Excel 公式同一规则源 shared/rules.json） */
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory();
  else root.BPEngine = factory();
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const TIERS = [5.0, 5.5, 6.0, 6.5, 7.0, 8.0, 9.0, 11.0];
  const CLAMP_TOTAL = [-0.5, 1.0];
  const CLAMP_HEIGHT = [5.0, 11.0];

  function round1(v) { return Math.round(v * 10) / 10; }

  function bmi(heightCm, weightKg) {
    if (!(heightCm > 0) || !(weightKg > 0)) return null;
    return round1(weightKg / Math.pow(heightCm / 100, 2));
  }

  function bodyType(bmiValue, thresholds) {
    if (bmiValue == null) return null;
    if (bmiValue < thresholds.thin) return "偏瘦";
    if (bmiValue < thresholds.normalMax) return "标准";
    return "偏胖";
  }

  function heightBand(heightCm, bands) {
    for (const b of bands) if (heightCm < b.maxExclusive) return b.band;
    return bands[bands.length - 1].band;
  }

  function baseHeight(gender, band, table) {
    const hit = table.find((r) => r.gender === gender && r.heightBand === band);
    return hit ? hit.value : null;
  }

  /** 取最近档；等距取较大（档位升序，链条扫描时"更近或并列"都切到更后的更大档） */
  function takeNearest(recommended) {
    let idx = 0, best = Math.abs(recommended - TIERS[0]);
    for (let i = 1; i < TIERS.length; i++) {
      const d = Math.abs(recommended - TIERS[i]);
      if (d < best + 1e-9) { best = d; idx = i; }
    }
    return TIERS[idx];
  }

  /** 主入口：survey = {gender,heightCm,weightKg,shoulder,posture}；rules=shared/rules.json 对象 */
  function compute(survey, rules) {
    const b = bmi(survey.heightCm, survey.weightKg);
    const type = bodyType(b, rules.bodyTypeThresholds);
    const band = heightBand(survey.heightCm, rules.heightBands);
    const base = baseHeight(survey.gender, band, rules.basePillowHeight);
    const bodyAdj = type != null ? rules.bodyTypeAdjust[type] : null;
    const shoulderAdj = survey.shoulder != null ? rules.shoulderAdjust[survey.shoulder] : null;

    let total = null, recommended = null, finalHeight = null;
    if (bodyAdj != null && shoulderAdj != null) {
      total = Math.min(Math.max(bodyAdj + shoulderAdj, CLAMP_TOTAL[0]), CLAMP_TOTAL[1]);
      total = round1(total);
    }
    if (base != null && total != null) {
      recommended = Math.min(Math.max(base + total, CLAMP_HEIGHT[0]), CLAMP_HEIGHT[1]);
    }
    if (recommended != null) {
      finalHeight = takeNearest(recommended);
    }

    let length = null;
    for (const rule of rules.pillowLengthRules) {
      if (survey.heightCm < rule.maxHeightExclusive) { length = rule.length; break; }
    }

    return {
      bmi: b,
      bodyType: type,
      heightBand: band,
      baseHeight: base,
      bodyTypeAdjust: bodyAdj,
      shoulderAdjust: shoulderAdj,
      totalAdjust: total,
      recommended: recommended != null ? round1(recommended) : null,
      finalHeight: finalHeight,
      pillowLength: length,
      pillowWidth: "待定制",
      sideSleepNote: survey.posture === "侧卧为主" ? rules.sideSleepNote : null
    };
  }

  return { compute, bmi, bodyType, heightBand, baseHeight, takeNearest };
});
