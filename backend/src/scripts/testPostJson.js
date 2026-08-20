const aiSensyService = require("../services/aiSensyService");
const connectDB = require("../db");

async function testCleanOutput() {
  await connectDB();

  console.log("=== Test 1: User Selected Mech Basic Plan ===");
  const res1 = await aiSensyService.getServicePlans({
    selectedPlan: "Mech Basic",
    fuelType: "Petrol",
    vname: "Tata Altroz 2023",
  });
  console.log(res1.whatsapp_text);

  console.log("\n=== Test 2: User Did Not Select Specific Plan ===");
  const res2 = await aiSensyService.getServicePlans({
    fuelType: "Diesel",
    vname: "Maruti Suzuki S Cross 2018",
  });
  console.log(res2.whatsapp_text);

  process.exit(0);
}

testCleanOutput();
