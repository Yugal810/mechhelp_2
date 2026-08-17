const aiSensyService = require("../services/aiSensyService");

function testParsing() {
  console.log("=== Testing Input Parsing Logic ===");

  const cases = [
    {
      input: { c1: "Honda Amaze 2018", fuelType: "Petrol" },
      expected: { modelQuery: "Honda Amaze", fuelType: "Petrol", year: "2018" },
    },
    {
      input: { query: "Swift Petrol 2020" },
      expected: { modelQuery: "Swift", fuelType: "Petrol", year: "2020" },
    },
    {
      input: { vehicle: "Hyundai i20 2019 Diesel" },
      expected: { modelQuery: "Hyundai i20", fuelType: "Diesel", year: "2019" },
    },
  ];

  let passed = true;
  for (const c of cases) {
    const res = aiSensyService.parseInput(c.input);
    const match =
      res.modelQuery === c.expected.modelQuery &&
      res.fuelType === c.expected.fuelType &&
      res.year === c.expected.year;

    if (match) {
      console.log(`✅ Passed for input: ${JSON.stringify(c.input)} -> ${JSON.stringify(res)}`);
    } else {
      console.error(`❌ Failed for input: ${JSON.stringify(c.input)}`);
      console.error(`Got:`, res);
      console.error(`Expected:`, c.expected);
      passed = false;
    }
  }

  return passed;
}

if (!testParsing()) {
  process.exit(1);
} else {
  console.log("🎉 All unit tests passed!");
  process.exit(0);
}
