// quick-test.js - Simplified test to see real MTA data flowing through our system
require('dotenv').config();

const MTAConnector = require('./src/connectors/mta/MTAConnector');
const DataIngestionService = require('./src/pipeline/ingestion/DataIngestionService');

/**
 * Quick test to see our system working with real MTA data
 */
async function quickTest() {
    console.log('🚇 NYC Urban Intelligence Platform - Live Data Test');
    console.log('='.repeat(55));
    console.log('');

    // Check for API key
    const apiKey = process.env.MTA_API_KEY;
    if (!apiKey) {
        console.log('❌ Missing MTA API Key!');
        console.log('');
        console.log('To get started:');
        console.log('1. Go to https://api.mta.info/');
        console.log('2. Sign up for a free API key');
        console.log('3. Create a .env file with: MTA_API_KEY=your_key_here');
        console.log('4. Run this test again');
        return;
    }

    console.log('🔑 API Key found! Starting system...\n');

    // Create our pipeline
    const pipeline = new DataIngestionService({
        messageQueue: { type: 'memory' }, // Use memory for this test
        healthCheckInterval: 30000
    });

    // Create MTA connector for the 4/5/6 lines (busy Manhattan routes)
    const mtaConnector = new MTAConnector({
        apiKey: apiKey,
        feedId: 1, // Feed 1 covers 1,2,3,4,5,6,S lines
        pollInterval: 15000 // Every 15 seconds for this demo
    });

    let dataCount = 0;
    let lastDataSample = null;

    // Listen for data coming through the pipeline
    pipeline.on('dataIngested', (event) => {
        dataCount++;
        lastDataSample = event.data;
        
        console.log(`📊 Data Batch #${dataCount} from ${event.connector}`);
        console.log(`   Timestamp: ${new Date(event.data.timestamp).toLocaleTimeString()}`);
        console.log(`   Vehicles: ${event.data.vehicleUpdates?.length || 0}`);
        console.log(`   Trips: ${event.data.tripUpdates?.length || 0}`);
        console.log(`   Alerts: ${event.data.alerts?.length || 0}`);
        
        // Show some interesting real data
        showInterestingData(event.data);
        console.log('');
    });

    // Register the connector and start the pipeline
    pipeline.registerConnector('mta-subway', mtaConnector);
    await pipeline.start();

    console.log('🚀 System started! Watching live MTA data...\n');

    // Show status every 30 seconds
    const statusInterval = setInterval(async () => {
        const status = pipeline.getStatus();
        const health = await pipeline.getHealth();
        
        console.log('💓 System Status:');
        console.log(`   Health: ${health.status.toUpperCase()}`);
        console.log(`   Data Batches Received: ${dataCount}`);
        console.log(`   System Uptime: ${Math.round(status.uptime / 1000)}s`);
        
        // Show connector performance
        Object.entries(status.connectors).forEach(([name, connectorStatus]) => {
            const metrics = connectorStatus.connectorStatus.metrics;
            const successRate = metrics.totalFetches > 0 ? 
                Math.round((metrics.successfulFetches / metrics.totalFetches) * 100) : 0;
            
            console.log(`   ${name}: ${successRate}% success, ${Math.round(metrics.avgResponseTime)}ms avg response`);
        });
        console.log('');
    }, 30000);

    // Run for 2 minutes then show summary
    setTimeout(async () => {
        clearInterval(statusInterval);
        
        console.log('⏰ Test complete! Here\'s what we captured:\n');
        
        if (lastDataSample) {
            showDetailedDataAnalysis(lastDataSample);
        }
        
        await pipeline.stop();
        console.log('✅ System stopped. Test completed successfully!');
        
    }, 120000); // 2 minutes
}

function showInterestingData(data) {
    // Show some real subway trains in action
    if (data.vehicleUpdates && data.vehicleUpdates.length > 0) {
        const activeTrains = data.vehicleUpdates.slice(0, 3); // Show first 3 trains
        
        activeTrains.forEach(train => {
            const route = train.trip?.routeId || 'Unknown';
            const status = train.currentStatus || 'unknown';
            const stopId = train.stopId || 'N/A';
            
            let locationInfo = '';
            if (train.position && train.position.latitude) {
                locationInfo = ` at ${train.position.latitude.toFixed(4)}, ${train.position.longitude.toFixed(4)}`;
            }
            
            console.log(`   🚇 ${route} train: ${status} (stop ${stopId})${locationInfo}`);
        });
    }

    // Show any current alerts
    if (data.alerts && data.alerts.length > 0) {
        const activeAlert = data.alerts[0];
        if (activeAlert.headerText) {
            console.log(`   🚨 Alert: ${activeAlert.headerText.slice(0, 60)}...`);
        }
    }

    // Show some delay information
    if (data.tripUpdates && data.tripUpdates.length > 0) {
        const delayedTrips = data.tripUpdates
            .filter(trip => trip.delay && trip.delay > 0)
            .slice(0, 2);
        
        delayedTrips.forEach(trip => {
            const route = trip.trip?.routeId || 'Unknown';
            const delayMinutes = Math.round(trip.delay / 60);
            console.log(`   ⏱️  ${route} train delayed ${delayMinutes} minutes`);
        });
    }
}

function showDetailedDataAnalysis(data) {
    console.log('📈 Data Analysis Summary:');
    console.log('========================');
    
    // Route analysis
    const routeCounts = {};
    if (data.vehicleUpdates) {
        data.vehicleUpdates.forEach(vehicle => {
            const route = vehicle.trip?.routeId;
            if (route) {
                routeCounts[route] = (routeCounts[route] || 0) + 1;
            }
        });
    }
    
    console.log('🚇 Active trains by route:');
    Object.entries(routeCounts)
        .sort(([,a], [,b]) => b - a)
        .forEach(([route, count]) => {
            console.log(`   ${route} line: ${count} trains`);
        });
    
    // Status analysis
    const statusCounts = {};
    if (data.vehicleUpdates) {
        data.vehicleUpdates.forEach(vehicle => {
            const status = vehicle.currentStatus || 'unknown';
            statusCounts[status] = (statusCounts[status] || 0) + 1;
        });
    }
    
    console.log('\n🚦 Train status distribution:');
    Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`   ${status.replace(/_/g, ' ')}: ${count} trains`);
    });
    
    // Alert analysis
    if (data.alerts && data.alerts.length > 0) {
        console.log('\n🚨 Current service alerts:');
        data.alerts.slice(0, 3).forEach((alert, index) => {
            console.log(`   ${index + 1}. ${alert.headerText?.slice(0, 80) || 'No description'}...`);
            console.log(`      Effect: ${alert.effect || 'unknown'}`);
            console.log(`      Cause: ${alert.cause || 'unknown'}`);
        });
    }
    
    console.log(`\n📊 Total data points processed: ${
        (data.vehicleUpdates?.length || 0) + 
        (data.tripUpdates?.length || 0) + 
        (data.alerts?.length || 0)
    }`);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Shutting down...');
    process.exit(0);
});

// Run the test
quickTest().catch(error => {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
});