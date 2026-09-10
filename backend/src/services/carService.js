const Car = require("../models/Car");
const {
  calculateCarConfidence,
  DEFAULT_CONFIDENCE_THRESHOLD,
} = require("../utils/fuzzyMatch");

function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

class CarService {
  _rowMatchesYearFilter(rowYearStr, yearMode = null, customYear = null) {
    if (!rowYearStr || rowYearStr === "-") return false;

    const foundYears = [...String(rowYearStr).matchAll(/\b\d{4}\b/g)].map((m) =>
      parseInt(m[0], 10)
    );

    if (customYear && String(customYear).trim()) {
      const typed = String(customYear).trim().toLowerCase();
      const typedDigits = [...typed.matchAll(/\b\d{4}\b/g)].map((m) =>
        parseInt(m[0], 10)
      );

      let targetYr = null;
      if (typedDigits.length) {
        targetYr = typedDigits[0];
      } else if (/^\d{2}$/.test(typed)) {
        const val = parseInt(typed, 10);
        targetYr = val > 50 ? 1900 + val : 2000 + val;
      }

      if (targetYr !== null && foundYears.length) {
        const minYear = Math.min(...foundYears);
        const isPresent = /present/i.test(String(rowYearStr));
        const maxYear = isPresent
          ? Math.max(new Date().getFullYear(), Math.max(...foundYears))
          : Math.max(...foundYears);
        return minYear <= targetYr && targetYr <= maxYear;
      }

      return String(rowYearStr).toLowerCase().includes(typed);
    }

    if (yearMode && foundYears.length) {
      const minYear = Math.min(...foundYears);
      const isPresent = /present/i.test(String(rowYearStr));
      const maxYear = isPresent
        ? Math.max(new Date().getFullYear(), Math.max(...foundYears))
        : Math.max(...foundYears);
      const mode = String(yearMode).trim().toLowerCase();
      if (mode === "after 2020") return maxYear >= 2020;
      if (mode === "before 2020") return minYear < 2020;
    }

    return true;
  }

  async searchCars({
    type = "normal",
    brand = null,
    model = null,
    year_mode = null,
    custom_year = null,
    fuelType = null,
    query = null,
  } = {}) {
    const filter = {};
    if (type) {
      filter.type = String(type).trim().toLowerCase() === "premium" ? "premium" : "normal";
    }

    if (brand && brand.trim()) {
      filter.brand = { $regex: new RegExp(escapeRegExp(brand.trim()), "i") };
    }

    if (model && model.trim()) {
      filter.model = { $regex: new RegExp(escapeRegExp(model.trim()), "i") };
    }

    if (fuelType && fuelType.trim()) {
      filter.fuelType = { $regex: new RegExp(escapeRegExp(fuelType.trim()), "i") };
    }

    if (query && query.trim()) {
      const qRegex = new RegExp(escapeRegExp(query.trim()), "i");
      filter.$or = [
        { brand: qRegex },
        { model: qRegex },
        { variant: qRegex },
      ];
    }

    let cars = await Car.find(filter).lean();

    if (query && query.trim() && cars.length === 0) {
      delete filter.$or;
      const candidates = await Car.find(filter).lean();
      const scored = candidates.map((c) => ({
        car: c,
        score: calculateCarConfidence(query, c),
      }));
      scored.sort((a, b) => b.score - a.score);
      cars = scored
        .filter((item) => item.score >= DEFAULT_CONFIDENCE_THRESHOLD)
        .map((item) => {
          item.car.confidenceScore = item.score;
          return item.car;
        });
    }

    if (year_mode || custom_year) {
      cars = cars.filter((car) =>
        this._rowMatchesYearFilter(car.year, year_mode, custom_year)
      );
    }

    return cars.map((c) => ({
      id: c._id.toString(),
      type: c.type,
      brand: c.brand,
      model: c.model,
      variant: c.variant,
      year: c.year,
      fuelType: c.fuelType,
      oil_capacity: c.oilCapacity,
      pricing_category: c.pricingCategory,
      mech_lite: c.mechLite,
      mech_basic: c.mechBasic,
      mech_pro: c.mechPro,
      confidence_score: c.confidenceScore !== undefined ? c.confidenceScore : 1.0,
      ...c.details,
    }));
  }

  async getOptions({
    type = "normal",
    brand = null,
    model = null,
    fuelType = null,
  } = {}) {
    const targetType = String(type).trim().toLowerCase() === "premium" ? "premium" : "normal";
    const filter = { type: targetType };

    const brands = (await Car.distinct("brand", { type: targetType })).sort();

    if (brand && brand.trim()) {
      filter.brand = { $regex: new RegExp(brand.trim(), "i") };
    }

    const models = (await Car.distinct("model", filter)).sort();

    if (model && model.trim()) {
      filter.model = { $regex: new RegExp(model.trim(), "i") };
    }

    const variants = (await Car.distinct("variant", filter))
      .filter(Boolean)
      .sort();

    const fuelTypes = (await Car.distinct("fuelType", filter))
      .filter(Boolean)
      .sort();

    return {
      brands,
      models,
      variants,
      fuelTypes,
      yearModes: ["after 2020", "before 2020"],
    };
  }
}

module.exports = new CarService();
