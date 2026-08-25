const aiSensyService = require("../services/aiSensyService");
const connectDB = require("../db");

process.env.MONGODB_URI =
  "mongodb+srv://sonparatey_db_user:pgYGYhorslWaGJnb@mechhelpcluster.hrzzmkp.mongodb.net/mechhelp?appName=MechHelpCluster";

async function testDzire() {
  await connectDB();

  const Car = require("../models/Car");
  const cars = await Car.find({
    $or: [{ brand: /fortuner/i }, { model: /fortuner/i }, { variant: /fortuner/i }],
  }).lean();

  console.log("=== ALL FORTUNER CAR ROWS IN DB ===");
  cars.forEach((c, idx) => {
    console.log(
      `${idx + 1}. Brand: "${c.brand}" | Model: "${c.model}" | Variant: "${c.variant}" | Year: "${c.year}" | Fuel: "${c.fuelType}" | Oil: "${c.oilCapacity}" | Basic: ${c.mechBasic}`
    );
  });

  if (cars.length > 0) {
    const res = await aiSensyService.getServicePlans({
      vname: "Fortuner",
      fuelType: cars[0].fuelType || "Diesel",
      selectedPlan: "Mech Basic",
    });
    console.log("\nTEST RESULT FOR 'Fortuner':\n", JSON.stringify(res, null, 2));
  } else {
    console.log("\nNo cars found matching 'Fortuner'");
  }

  process.exit(0);
}

testDzire();
