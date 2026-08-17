const connectDB = require("../db");
const aiSensyService = require("../services/aiSensyService");

async function runTest() {
  try {
    console.log("Connecting to DB...");
    await connectDB();

    const testCases = [
      {
        description: "Test 1: Query with model, year, and fuelType separate",
        params: { query: "Honda Amaze", year: "2018", fuelType: "Petrol" },
      },
      {
        description: "Test 2: Combined text query in 'c1' variable (from AiSensy question block)",
        params: { c1: "Honda Amaze 2018", fuelType: "Petrol" },
      },
      {
        description: "Test 3: Query with Swift Diesel",
        params: { vehicle: "Swift 2020", fuel: "Diesel" },
      },
    ];

    for (const tc of testCases) {
      console.log(`\n----------------------------------------`);
      console.log(`📌 ${tc.description}`);
      console.log(`Input:`, JSON.stringify(tc.params));
      const res = await aiSensyService.getServicePlans(tc.params);
      console.log(`Matched: ${res.matched}`);
      if (res.matched) {
        console.log(`Car: ${res.car.brand} ${res.car.model} (${res.car.fuelType})`);
        console.log(`Plans:`, res.service_plans);
        console.log(`\nWhatsApp Message:\n${res.whatsapp_text}`);
      } else {
        console.log(`Message: ${res.message}`);
      }
    }

    process.exit(0);
  } catch (err) {
    console.error("Test failed:", err);
    process.exit(1);
  }
}

runTest();
