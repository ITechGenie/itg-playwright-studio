import path from 'path';

async function testResolution() {
  console.log("=== Testing API Endpoint Resolution ===");
  try {
    const resRoot = await fetch('http://localhost:3000/api/projects/1/files');
    const rootData = await resRoot.json();
    console.log(`[TEST] Root Items Count: ${rootData.length}`);
    
    const resChild = await fetch('http://localhost:3000/api/projects/1/files?path=login-flow');
    const childData = await resChild.json();
    console.log(`[TEST] Subpath Items Count: ${childData.length}`);

  } catch (err) {
    console.error("Test Failed!", err);
  }
}
testResolution();
