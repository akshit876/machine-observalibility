import {
  setData,
  getData,
  deleteData,
  getAllData,
} from "./services/lowDbService.js";

async function testDatabase() {
  try {
    console.log("Testing database...");

    // Test setting data
    await setData("testKey", "testValue");
    console.log("Data set successfully.");

    // Test getting data
    const value = await getData("testKey");
    console.log("Fetched value:", value);

    // Test deleting data
    const deleteSuccess = await deleteData("testKey");
    console.log("Delete operation successful:", deleteSuccess);

    // Test fetching all data
    const allData = await getAllData();
    console.log("All data:", allData);
  } catch (error) {
    console.error("Database test failed:", error);
  }
}

testDatabase();
