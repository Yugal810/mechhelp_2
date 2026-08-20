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
        whatsapp_text: `Sorry, we couldn't find service plan details for *${modelQuery || "your vehicle"
          }* (${fuelType || "Any fuel"}${year ? ", " + year : ""}).\n\nPlease check the spelling or type a different model (e.g. *Honda Amaze 2018*).`,
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
    const isStandard3L = oilNum === null || oilNum === 3.0 || oilNum === 3;

    const vehicleFullName = `${car.brand} ${car.model} ${car.variant}`.trim();
    const oilCapText = car.oilCapacity ? `${car.oilCapacity}` : "Standard";

    let headerMessage = "";
    if (!isStandard3L && rawOilCap) {
      headerMessage = `The *${vehicleFullName}* (${car.fuelType || fuelType || "Petrol"}) has an engine oil capacity of *${oilCapText}*.`;
    } else {
      headerMessage = `*Vehicle:* ${vehicleFullName}\n*Fuel Type:* ${car.fuelType || fuelType || "Petrol"}\n*Engine Oil Capacity:* ${oilCapText}`;
    }

    const planLower = String(selectedPlan).toLowerCase();
    let chosenPlanName = "Mech Basic";
    let rawPriceVal = car.mechBasic;

    if (planLower.includes("lite")) {
      chosenPlanName = "Mech Lite";
      rawPriceVal = car.mechLite;
    } else if (planLower.includes("pro")) {
      chosenPlanName = "Mech Pro";
      rawPriceVal = car.mechPro;
    }

    const whatsappMessage = [
      `*MECHHELP Service Quote*`,
      ``,
      headerMessage,
      ``,
      `Based on your vehicle's oil capacity, your updated plan price is:`,
      `*${chosenPlanName}:* ${formatPrice(rawPriceVal)}`,
      ``,
      `Please click *Proceed* below to continue with your booking!`,
    ]
      .filter(Boolean)
      .join("\n");

    return {
      whatsapp_text: whatsappMessage,
    };
  }

  /**
   * Fetch top 3 nearest garages for AiSensy WhatsApp bot based on user location/address
   */
  async getNearestGarages(params = {}) {
    let address =
      params.address ||
      params.location ||
      params.vname ||
      params.query ||
      params.c1 ||
      "";
    address = String(address).replace(/[\{\}\$]/g, "").trim();

    const addressLower = address.toLowerCase();
    if (
      !address ||
      addressLower === "address" ||
      addressLower === "location" ||
      addressLower === "addr" ||
      addressLower === "customer_address" ||
      addressLower === "delivery_address" ||
      addressLower.includes("{{") ||
      addressLower.includes("}}")
    ) {
      return {
        whatsapp_text: "Please enter your location or address in Nagpur.",
      };
    }

    let nearestList = [];
    try {
      nearestList = await distanceService.getNearestGarages(address);
    } catch (err) {
      console.warn("Distance service geocoding warning:", err.message);
      const allGarages = await distanceService.getGarages();
      nearestList = allGarages.filter((g) => g.is_enabled);
    }

    if (!nearestList || nearestList.length === 0) {
      return {
        whatsapp_text: `Thank you! We received your address (*${address}*). Our customer service executive will contact you shortly to confirm your booking and assign the nearest garage.`,
      };
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
