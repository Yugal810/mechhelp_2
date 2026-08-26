const Car = require("../models/Car");
const carService = require("./carService");
const distanceService = require("./distanceService");

function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

class AISensyService {
  /**
   * Parse user query string and parameters to extract fuelType, year, car model query, and selected plan.
   */
  parseInput(params = {}) {
    if (typeof params === "string") {
      params = { vname: params };
    }

    let rawQuery = params.vname || params.vehicle || params.query || "";
    let rawFuel = params.fuelType || params.fuel_type || params.fuel || "";
    let rawYear = params.year || "";
    let selectedPlan = params.selectedPlan || params.selected_plan || params.plan || "";

    // Clean any leftover {{ }} or $ template wrappers
    rawQuery = String(rawQuery).replace(/[\{\}\$]/g, "").trim();
    rawFuel = String(rawFuel).replace(/[\{\}\$]/g, "").trim();
    rawYear = String(rawYear).replace(/[\{\}\$]/g, "").trim();
    selectedPlan = String(selectedPlan).replace(/[\{\}\$]/g, "").trim();

    // Extract Fuel Type if present in query string
    if (!rawFuel) {
      if (/\bpetrol\b/i.test(rawQuery)) {
        rawFuel = "Petrol";
        rawQuery = rawQuery.replace(/\bpetrol\b/gi, "").trim();
      } else if (/\bdiesel\b/i.test(rawQuery)) {
        rawFuel = "Diesel";
        rawQuery = rawQuery.replace(/\bdiesel\b/gi, "").trim();
      }
    }

    // Extract 4-digit year from query string if not explicitly passed
    if (!rawYear) {
      const yearMatch = rawQuery.match(/\b(19\d{2}|20\d{2})\b/);
      if (yearMatch) {
        rawYear = yearMatch[1];
        rawQuery = rawQuery.replace(/\b(19\d{2}|20\d{2})\b/gi, "").trim();
      }
    }

    return {
      modelQuery: rawQuery.replace(/\s+/g, " ").trim(),
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
        found: false,
        whatsapp_text:
          "Please provide your vehicle model and year (e.g. *Honda Amaze 2018*).",
      };
    }

    // Search cars matching inputs
    const filter = {};
    if (fuelType) {
      filter.fuelType = { $regex: new RegExp(`^${escapeRegExp(fuelType)}`, "i") };
    }

    let cars = [];
    if (modelQuery) {
      const words = modelQuery.split(" ").filter(Boolean);
      const wordRegexes = words.map((w) => new RegExp(escapeRegExp(w), "i"));

      filter.$and = wordRegexes.map((r) => ({
        $or: [{ brand: r }, { model: r }, { variant: r }],
      }));

      cars = await Car.find(filter).lean();

      if (cars.length === 0 && words.length > 1) {
        delete filter.$and;
        const qRegex = new RegExp(escapeRegExp(modelQuery), "i");
        filter.$or = [{ brand: qRegex }, { model: qRegex }, { variant: qRegex }];
        cars = await Car.find(filter).lean();
      }
    } else {
      cars = await Car.find(filter).lean();
    }

    let yearMismatchRanges = [];
    if (year && cars.length > 0) {
      const yearFiltered = cars.filter((car) =>
        carService._rowMatchesYearFilter(car.year, null, year)
      );
      if (yearFiltered.length > 0) {
        cars = yearFiltered;
      } else {
        yearMismatchRanges = Array.from(
          new Set(cars.map((c) => c.year).filter(Boolean))
        );
        cars = [];
      }
    }

    if (cars.length > 1 && modelQuery) {
      const qLower = modelQuery.toLowerCase().trim();
      cars.sort((a, b) => {
        const aModel = String(a.model || "").toLowerCase().trim();
        const bModel = String(b.model || "").toLowerCase().trim();

        const aExact = aModel === qLower;
        const bExact = bModel === qLower;
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;

        const aStarts = aModel.startsWith(qLower);
        const bStarts = bModel.startsWith(qLower);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;

        return aModel.length - bModel.length;
      });
    }

    if (!cars || cars.length === 0) {
      const fullSearchTerm = `${modelQuery || "your vehicle"}${year ? " " + year : ""}`.trim();
      let notFoundMsg = `Sorry, we couldn't find service plan details for *${fullSearchTerm}* (${fuelType || "Any fuel"}).`;

      if (yearMismatchRanges.length > 0) {
        const rangesStr = yearMismatchRanges.map((r) => `*${r}*`).join(", ");
        notFoundMsg += `\n\nThe available model years in our database for *${modelQuery}* are: ${rangesStr}.\n\nPlease re-enter your request with a valid model year!`;
      } else {
        notFoundMsg += `\n\nPlease check the spelling or type a different model (e.g. *Honda Amaze 2018*).`;
      }

      return {
        found: false,
        whatsapp_text: notFoundMsg,
      };
    }

    const car = cars[0];

    const formatPrice = (val) => {
      if (!val || val === "-" || String(val).toLowerCase() === "n/a") return "N/A";
      const cleaned = String(val).replace(/[^0-9]/g, "");
      if (!cleaned) return String(val);
      return `₹${parseInt(cleaned, 10).toLocaleString("en-IN")}`;
    };

    const rawOilCap = String(car.oilCapacity || "").trim();
    const oilNumMatch = rawOilCap.match(/\d+(\.\d+)?/);
    const oilNum = oilNumMatch ? parseFloat(oilNumMatch[0]) : null;
    const isAbove3_7 = oilNum !== null && oilNum >= 3.7;

    const pricingCat = String(car.pricingCategory || "").toUpperCase().trim();
    const isBS6 = pricingCat.includes("BS6") || rawOilCap.toUpperCase().includes("BS6");

    const vehicleFullName = `${car.brand} ${car.model} ${car.variant}`.trim();
    const fullVehicleNameWithYear = year ? `${vehicleFullName} ${year}` : vehicleFullName;

    let rawOilCapVal = car.oilCapacity ? String(car.oilCapacity).trim() : "";
    let oilCapText = rawOilCapVal;
    if (rawOilCapVal && !/l$/i.test(rawOilCapVal)) {
      oilCapText = `${rawOilCapVal}L`;
    }
    if (!oilCapText) oilCapText = "Standard";

    if (isBS6 && !oilCapText.toUpperCase().includes("BS6")) {
      oilCapText = `${oilCapText} BS6`;
    }

    let headerMessage = "";
    if (isAbove3_7 && rawOilCap) {
      headerMessage = `The *${fullVehicleNameWithYear}* (${car.fuelType || fuelType || "Petrol"}) has an engine oil capacity of *${oilCapText}*.`;
    } else {
      headerMessage = `*Vehicle:* ${fullVehicleNameWithYear}\n*Fuel Type:* ${car.fuelType || fuelType || "Petrol"}\n*Engine Oil Capacity:* ${oilCapText}`;
    }

    const mechLitePrice = formatPrice(car.mechLite);
    const mechBasicPrice = formatPrice(car.mechBasic);
    const mechProPrice = formatPrice(car.mechPro);

    const planLower = String(selectedPlan).toLowerCase();
    let chosenPlanLine = null;
    let otherPlansLines = [];

    if (planLower.includes("lite")) {
      chosenPlanLine = `*Chosen Plan (Mech Lite):* ${mechLitePrice}`;
      otherPlansLines = [
        `*Mech Basic:* ${mechBasicPrice}`,
        `*Mech Pro:* ${mechProPrice}`,
      ];
    } else if (planLower.includes("pro")) {
      chosenPlanLine = `*Chosen Plan (Mech Pro):* ${mechProPrice}`;
      otherPlansLines = [
        `*Mech Lite:* ${mechLitePrice}`,
        `*Mech Basic:* ${mechBasicPrice}`,
      ];
    } else if (planLower.includes("basic")) {
      chosenPlanLine = `*Chosen Plan (Mech Basic):* ${mechBasicPrice}`;
      otherPlansLines = [
        `*Mech Lite:* ${mechLitePrice}`,
        `*Mech Pro:* ${mechProPrice}`,
      ];
    } else {
      otherPlansLines = [
        `*Mech Lite:* ${mechLitePrice}`,
        `*Mech Basic:* ${mechBasicPrice}`,
        `*Mech Pro:* ${mechProPrice}`,
      ];
    }

    const divider = "━━━━━━━━━━━━━━━━━━━━";
    let whatsappMessage = "";

    if (isAbove3_7) {
      let chosenPlanHighlight = `💰 *Mech Basic - ${mechBasicPrice}*`;
      let otherOptionsList = [
        `Mech Lite - ${mechLitePrice}`,
        `Mech Pro - ${mechProPrice}`,
      ];

      if (planLower.includes("lite")) {
        chosenPlanHighlight = `💰 *Mech Lite - ${mechLitePrice}*`;
        otherOptionsList = [
          `Mech Basic - ${mechBasicPrice}`,
          `Mech Pro - ${mechProPrice}`,
        ];
      } else if (planLower.includes("pro")) {
        chosenPlanHighlight = `💰 *Mech Pro - ${mechProPrice}*`;
        otherOptionsList = [
          `Mech Lite - ${mechLitePrice}`,
          `Mech Basic - ${mechBasicPrice}`,
        ];
      }

      whatsappMessage = [
        `⚠️ *Pricing Revised – MECHHELP*`,
        ``,
        `Your ${fullVehicleNameWithYear} (${car.fuelType || fuelType || "Petrol"}) needs *${oilCapText}* engine oil — a bit more than our standard 3.6L plans, so pricing is adjusted accordingly.`,
        ``,
        chosenPlanHighlight,
        ``,
        `Other options:`,
        ...otherOptionsList,
        ``,
        `Choose an option below 👇`,
      ].join("\n");
    } else if (isBS6) {
      let chosenPlanHighlight = `💰 *Mech Basic - ${mechBasicPrice}*`;
      let otherOptionsList = [
        `Mech Lite - ${mechLitePrice}`,
        `Mech Pro - ${mechProPrice}`,
      ];

      if (planLower.includes("lite")) {
        chosenPlanHighlight = `💰 *Mech Lite - ${mechLitePrice}*`;
        otherOptionsList = [
          `Mech Basic - ${mechBasicPrice}`,
          `Mech Pro - ${mechProPrice}`,
        ];
      } else if (planLower.includes("pro")) {
        chosenPlanHighlight = `💰 *Mech Pro - ${mechProPrice}*`;
        otherOptionsList = [
          `Mech Lite - ${mechLitePrice}`,
          `Mech Basic - ${mechBasicPrice}`,
        ];
      }

      const displayOilNum = oilNum ? `${oilNum}L` : oilCapText;

      whatsappMessage = [
        `⚠️ *Pricing Revised – MECHHELP*`,
        ``,
        `Your ${fullVehicleNameWithYear} (${car.fuelType || fuelType || "Petrol"}) needs *${displayOilNum}* of BS6-compliant engine oil.`,
        `Because BS6-grade oil requires specialized formulations , our standard plan pricing has been adjusted accordingly.`,
        ``,
        chosenPlanHighlight,
        ``,
        `Other options:`,
        ...otherOptionsList,
        ``,
        `Choose an option below 👇`,
      ].join("\n");
    } else {
      whatsappMessage = [
        `*MECHHELP Service Quote*`,
        headerMessage,
        `Based on your vehicle's oil capacity, here is your updated plan pricing:`,
        divider,
        chosenPlanLine ? chosenPlanLine : null,
        divider,
        otherPlansLines.length > 0 ? `More Plan Pricing for Your Vehicle:` : null,
        ...otherPlansLines,
        divider,
        `Please click *Proceed* below to continue with your chosen plan or select a different plan!`,
      ]
        .filter(Boolean)
        .join("\n");
    }

    let chosenPlanName = "Mech Basic";
    let chosenPrice = mechBasicPrice;

    if (planLower.includes("lite")) {
      chosenPlanName = "Mech Lite";
      chosenPrice = mechLitePrice;
    } else if (planLower.includes("pro")) {
      chosenPlanName = "Mech Pro";
      chosenPrice = mechProPrice;
    }

    const confirmationMessage = [
      `*✅ Booking Confirmed - MECHHELP*`,
      ``,
      `🚗 Booked For - *${fullVehicleNameWithYear} (${car.fuelType || fuelType || "Petrol"})*`,
      `🔧 Plan Selected - *${chosenPlanName}*`,
      `💰 Final Price - *${chosenPrice}*`,
    ].join("\n");

    const isAboveStr = isAbove3_7 ? "True" : "False";
    const isBS6Str = isBS6 ? "True" : "False";

    return {
      found: true,
      whatsapp_text: whatsappMessage,
      confirmation_text: confirmationMessage,
      is_above_3_7: isAboveStr,
      is_bs6: isBS6Str,
    };
  }

  /**
   * Fetch top 3 nearest garages for AiSensy WhatsApp bot based on user location/address
   */
  async getNearestGarages(params = {}) {
    let rawAddress =
      params.address ||
      params.location ||
      params.vname ||
      params.query ||
      params.c1 ||
      "";
    rawAddress = String(rawAddress).trim();

    // Strip curly braces / dollar signs from template tags
    let address = rawAddress
      .replace(/[\{\}\$]/g, "")
      .trim();

    // If address is empty or unreplaced test string, default to "Nagpur" for editor modal testing
    const lower = address.toLowerCase();
    if (!address || ["address", "location", "c1", "addr", "customer_address"].includes(lower)) {
      address = "Nagpur";
    }

    let nearestList = [];
    try {
      nearestList = await distanceService.getNearestGarages(address);
    } catch (err) {
      console.warn("Distance service geocoding warning:", err.message);
      const allGarages = await distanceService.getGarages();
      nearestList = allGarages.filter((g) => g.is_enabled);
    }

    const top3 = nearestList.slice(0, 3);
    const garageLines = top3.map((g, idx) => {
      const distStr = g.distance_km || g.distance || "Nearby";
      return [
        `${idx + 1}. *${g.garage_name}*`,
        `Distance: ${distStr}`,
      ].join("\n");
    });

    const whatsappMessage = [
      `*Nearest MECHHELP Partner Garages*`,
      ``,
      `Here are the top 3 partner garages closest to your location (*${address}*):`,
      ``,
      garageLines.join("\n\n"),
      ``,
      `Our customer support executive will call you shortly to confirm your pickup time!`,
    ].join("\n");

    const g1 = top3[0] ? top3[0].garage_name.substring(0, 20) : "";
    const g2 = top3[1] ? top3[1].garage_name.substring(0, 20) : "";
    const g3 = top3[2] ? top3[2].garage_name.substring(0, 20) : "";

    return {
      whatsapp_text: whatsappMessage,
      garage_1: g1,
      garage_2: g2,
      garage_3: g3,
    };
  }
}

module.exports = new AISensyService();
