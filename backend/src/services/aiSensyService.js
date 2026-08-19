const Car = require("../models/Car");
const carService = require("./carService");

function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

class AISensyService {
  /**
   * Parse user query string and parameters to extract fuelType, year, car model query, and selected plan.
   */
  parseInput(params = {}) {
    let rawQuery =
      params.query ||
      params.vehicle ||
      params.model ||
      params.vname ||
      params.c1 ||
      params.text ||
      "";
    let rawFuel = params.fuelType || params.fuel_type || params.fuel || "";
    let rawYear = params.year || params.custom_year || "";
    let selectedPlan =
      params.selected_plan || params.selectedPlan || params.plan || "";

    rawQuery = String(rawQuery).trim();
    rawFuel = String(rawFuel).trim();
    rawYear = String(rawYear).trim();
    selectedPlan = String(selectedPlan).trim();

    // 1. Extract Fuel Type if present in query string
    if (!rawFuel) {
      if (/\bpetrol\b/i.test(rawQuery)) {
        rawFuel = "Petrol";
        rawQuery = rawQuery.replace(/\bpetrol\b/gi, "").trim();
      } else if (/\bdiesel\b/i.test(rawQuery)) {
        rawFuel = "Diesel";
        rawQuery = rawQuery.replace(/\bdiesel\b/gi, "").trim();
      } else if (/\bcng\b/i.test(rawQuery)) {
        rawFuel = "CNG";
        rawQuery = rawQuery.replace(/\bcng\b/gi, "").trim();
      } else if (/\belectric\b/i.test(rawQuery)) {
        rawFuel = "Electric";
        rawQuery = rawQuery.replace(/\belectric\b/gi, "").trim();
      }
    }

    // 2. Extract 4-digit year from query string if not explicitly passed
    if (!rawYear) {
      const yearMatch = rawQuery.match(/\b(19\d{2}|20\d{2})\b/);
      if (yearMatch) {
        rawYear = yearMatch[1];
        rawQuery = rawQuery.replace(/\b(19\d{2}|20\d{2})\b/gi, "").trim();
      }
    }

    // Clean up extra spaces in query
    let modelQuery = rawQuery.replace(/\s+/g, " ").trim();

    // If template placeholder wasn't replaced by AiSensy (e.g. attribute name mismatch), clear placeholder
    if (modelQuery.includes("{{$") || modelQuery.includes("{{")) {
      modelQuery = "";
    }
    if (rawFuel.includes("{{$") || rawFuel.includes("{{")) {
      rawFuel = "";
    }
    if (selectedPlan.includes("{{$") || selectedPlan.includes("{{")) {
      selectedPlan = "";
    }

    return {
      modelQuery,
      fuelType: rawFuel,
      year: rawYear,
      selectedPlan,
    };
  }

  /**
   * Fetch service plans for AiSensy WhatsApp bot based on user input parameters
   */
  async getServicePlans(params = {}) {
    const { modelQuery, fuelType, year, selectedPlan } = this.parseInput(params);

    if (!modelQuery && !fuelType && !year) {
      return {
        success: false,
        matched: false,
        message: "Please provide vehicle model and year.",
        whatsapp_text:
          "⚠️ Please provide your vehicle model and year (e.g. *Honda Amaze 2018*).",
      };
    }

    // Search cars matching inputs
    const filter = {};

    if (fuelType) {
      filter.fuelType = { $regex: new RegExp(`^${escapeRegExp(fuelType)}`, "i") };
    }

    let cars = [];

    if (modelQuery) {
      // Split words to attempt multi-field search
      const words = modelQuery.split(" ").filter(Boolean);
      const wordRegexes = words.map((w) => new RegExp(escapeRegExp(w), "i"));

      // 1. Try finding cars matching all search words in brand/model/variant
      filter.$and = wordRegexes.map((r) => ({
        $or: [{ brand: r }, { model: r }, { variant: r }],
      }));

      cars = await Car.find(filter).lean();

      // 2. If no results, fall back to matching any word
      if (cars.length === 0 && words.length > 1) {
        delete filter.$and;
        const qRegex = new RegExp(escapeRegExp(modelQuery), "i");
        filter.$or = [{ brand: qRegex }, { model: qRegex }, { variant: qRegex }];
        cars = await Car.find(filter).lean();
      }
    } else {
      cars = await Car.find(filter).lean();
    }

    // Filter by year if year was provided
    if (year && cars.length > 0) {
      const yearFiltered = cars.filter((car) =>
        carService._rowMatchesYearFilter(car.year, null, year)
      );
      if (yearFiltered.length > 0) {
        cars = yearFiltered;
      }
    }

    if (!cars || cars.length === 0) {
      return {
        success: true,
        matched: false,
        query: { modelQuery, fuelType, year, selectedPlan },
        message: `No service plans found for '${modelQuery || "vehicle"}'${
          fuelType ? " (" + fuelType + ")" : ""
        }${year ? " " + year : ""}.`,
        whatsapp_text: `❌ Sorry, we couldn't find service plan details for *${
          modelQuery || "your vehicle"
        }* (${fuelType || "Any fuel"}${year ? ", " + year : ""}).\n\nPlease check the spelling or type a different model (e.g. *Honda Amaze 2018*).`,
      };
    }

    // Pick best match (first matching car record)
    const car = cars[0];

    const formatPrice = (val) => {
      if (!val || val === "-" || String(val).toLowerCase() === "n/a") return "N/A";
      const cleaned = String(val).replace(/[^0-9]/g, "");
      if (!cleaned) return String(val);
      return `₹${parseInt(cleaned, 10).toLocaleString("en-IN")}`;
    };

    const mechLitePrice = formatPrice(car.mechLite);
    const mechBasicPrice = formatPrice(car.mechBasic);
    const mechProPrice = formatPrice(car.mechPro);

    // Analyze Oil Capacity
    const rawOilCap = String(car.oilCapacity || "").trim();
    const oilNumMatch = rawOilCap.match(/\d+(\.\d+)?/);
    const oilNum = oilNumMatch ? parseFloat(oilNumMatch[0]) : null;
    const isStandard3L = oilNum === null || oilNum === 3.0 || oilNum === 3;

    let oilCapacityNotice = "";
    if (!isStandard3L && rawOilCap) {
      oilCapacityNotice = `💡 *Note:* Your *${car.brand} ${car.model}* requires *${rawOilCap}* of engine oil. Below is the updated plan price tailored for your vehicle capacity:`;
    }

    // Determine plan specific highlight if selectedPlan passed
    let planHighlight = "";
    if (selectedPlan) {
      const planLower = selectedPlan.toLowerCase();
      if (planLower.includes("lite")) {
        planHighlight = `⭐ *Chosen Plan (Mech Lite):* ${mechLitePrice}`;
      } else if (planLower.includes("basic")) {
        planHighlight = `⭐ *Chosen Plan (Mech Basic):* ${mechBasicPrice}`;
      } else if (planLower.includes("pro")) {
        planHighlight = `⭐ *Chosen Plan (Mech Pro):* ${mechProPrice}`;
      }
    }

    const vehicleFullName = `${car.brand} ${car.model} ${car.variant}`.trim();
    const oilCapText = car.oilCapacity || "Standard";

    let headerMessage = "";
    if (!isStandard3L && rawOilCap) {
      headerMessage = `The *${vehicleFullName}* (${car.fuelType || fuelType || "Petrol"}) has an engine oil capacity of *${oilCapText}*.\n\nBased on your vehicle's oil capacity, here is your updated plan pricing:`;
    } else {
      headerMessage = `🚘 *Vehicle:* ${vehicleFullName}\n⛽ *Fuel Type:* ${car.fuelType || fuelType || "Petrol"}\n🛢️ *Engine Oil Capacity:* ${oilCapText}`;
    }

    const whatsappMessage = [
      `🚗 *MECHHELP Service Quote*`,
      ``,
      headerMessage,
      ``,
      planHighlight ? planHighlight : null,
      planHighlight ? `` : null,
      `📋 *Plan Pricing for Your Vehicle:*`,
      `🔹 *Mech Lite:* ${mechLitePrice}`,
      `🔹 *Mech Basic:* ${mechBasicPrice}`,
      `🔹 *Mech Pro:* ${mechProPrice}`,
      ``,
      `Please click *Proceed* below to continue with your booking!`,
    ]
      .filter(Boolean)
      .join("\n");

    const responsePayload = {
      success: true,
      matched: true,
      total_matches: cars.length,
      query: { modelQuery, fuelType, year, selectedPlan },
      selected_plan: selectedPlan || "all",
      is_standard_3l: isStandard3L,
      oil_capacity_notice: oilCapacityNotice,
      car: {
        id: car._id.toString(),
        brand: car.brand,
        model: car.model,
        variant: car.variant,
        fuelType: car.fuelType,
        year: car.year,
        pricingCategory: car.pricingCategory,
        oilCapacity: car.oilCapacity,
      },
      service_plans: {
        mech_lite: mechLitePrice,
        mech_basic: mechBasicPrice,
        mech_pro: mechProPrice,
        raw_lite: car.mechLite,
        raw_basic: car.mechBasic,
        raw_pro: car.mechPro,
      },
      whatsapp_text: whatsappMessage,
      text: whatsappMessage,
      message: whatsappMessage,
      data: {
        whatsapp_text: whatsappMessage,
        text: whatsappMessage,
        message: whatsappMessage,
        mech_lite: mechLitePrice,
        mech_basic: mechBasicPrice,
        mech_pro: mechProPrice,
      },
    };

    return responsePayload;
  }
}

module.exports = new AISensyService();
