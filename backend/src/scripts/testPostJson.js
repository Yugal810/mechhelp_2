const aiSensyService = require("../services/aiSensyService");
const connectDB = require("../db");

async function testNearestGarages() {
  await connectDB();

  console.log("=== Testing Nearest Garages Endpoint ===");
  const res = await aiSensyService.getNearestGarages({
    address: "Dharampeth, Nagpur",
  });
  console.log("WhatsApp Output:\n");
  console.log(res.whatsapp_text);

  process.exit(0);
}

testNearestGarages();
