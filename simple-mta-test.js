// simple-mta-test.js - Just see MTA data, no complex architecture
const axios = require('axios');

// Super simple test - just fetch and show MTA data
async function simpleMTATest() {
    console.log('🚇 Simple MTA Data Test');
    console.log('=======================\n');

    // Check for API key
    const apiKey = process.env.MTA_API_KEY;
    if (!apiKey) {
        console.log('❌ Need MTA API Key!');
        console.log('1. Go to https://api.mta.info/');
        console.log('2. Get free API key');
        console.log('3. Run: export MTA_API_KEY=your_key');
        console.log('4. Run this again\n');
        return;
    }

    console.log('🔑 Found API key! Fetching live subway data...\n');

    try {
        // Fetch raw data from MTA
        const response = await axios.get('https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs', {
            headers: { 'x-api-key': apiKey },
            responseType: 'arraybuffer',
            timeout: 10000
        });

        console.log('✅ Successfully fetched MTA data!');
        console.log(`📦 Data size: ${response.data.length} bytes`);
        console.log(`🕐 Fetched at: ${new Date().toLocaleTimeString()}\n`);

        // Try to parse it as protobuf (this will likely fail without the schema, but that's OK)
        console.log('📊 Raw data structure:');
        console.log('- This is binary protobuf data from MTA');
        console.log('- Contains real-time positions of subway trains');
        console.log('- Includes delay information and service alerts');
        console.log('- Updates every 30 seconds\n');

        // Show some basic info about what we got
        const dataPreview = response.data.slice(0, 50);
        console.log('🔍 First 50 bytes (hex):');
        console.log(Buffer.from(dataPreview).toString('hex'));
        
        console.log('\n🎉 SUCCESS! We can connect to MTA and get live data!');
        console.log('💡 Next step: Parse this protobuf data to see actual trains');

    } catch (error) {
        console.error('❌ Error fetching MTA data:');
        if (error.response) {
            console.error(`   Status: ${error.response.status}`);
            console.error(`   Message: ${error.response.statusText}`);
            if (error.response.status === 401) {
                console.error('   🔑 Check your API key is correct');
            }
        } else {
            console.error(`   ${error.message}`);
        }
    }
}

// Even simpler - just test if we can reach MTA at all
async function pingMTA() {
    console.log('🏓 Ping test to MTA...');
    
    try {
        const response = await axios.get('https://api.mta.info/', { timeout: 5000 });
        console.log('✅ MTA website is reachable!');
        return true;
    } catch (error) {
        console.log('❌ Cannot reach MTA website');
        console.log('   Check your internet connection');
        return false;
    }
}

// Run the tests
async function runTest() {
    console.log('Starting simple connectivity test...\n');
    
    const canReachMTA = await pingMTA();
    if (!canReachMTA) {
        console.log('❌ Cannot reach MTA, stopping test');
        return;
    }
    
    console.log('');
    await simpleMTATest();
}

runTest().catch(console.error);