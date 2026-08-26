const aiSensyService = require("../services/aiSensyService");
const connectDB = require("../db");

process.env.MONGODB_URI =
  "mongodb+srv://sonparatey_db_user:pgYGYhorslWaGJnb@mechhelpcluster.hrzzmkp.mongodb.net/mechhelp?appName=MechHelpCluster";

async function testDzire() {
  await connectDB();

  console.log("=== Testing 'Tata Altroz 2020' Petrol Service Plans (BS6 Pricing Revised Template) ===");
  const res = await aiSensyService.getServicePlans({
    vname: "Tata Altroz 2020",
    fuelType: "Petrol",
    selectedPlan: "Mech Basic",
  });
  console.log("RESULT:\n", JSON.stringify(res, null, 2));

  process.exit(0);
}

testDzire();
