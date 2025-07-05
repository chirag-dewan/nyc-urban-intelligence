// test/integration/mta-connector-test.js
const MTAConnector = require('../../src/connectors/mta/MTAConnector');
const { getLogger } = require('../../src/utils/Logger');

/**
 * Integration test for the MTA connector
 */
async function testMTAConnector() {
    const logger = getLogger('test');
    
    console.log('🧪 Testing Enhanced MTA Connector...\n');
    
    // Check for API key
    const apiKey = process.env.MTA_API_KEY;
    if (!apiKey) {
        console.log('❌ Please set MTA_API_KEY environment variable');
        console.log('   Get a free key at: https://api.mta.info/');
        return;
    }

    // Create connector with custom configuration
    const config = {
        apiKey: apiKey,
        feedId: 1, // 1,2,3,4,5,6,S lines
        pollInterval: 20000, // 20 seconds for testing
        maxRetries: 2,
        timeout: 8000
    };

    const connector = new MTAConnector(config);
    let dataReceived = 0;
    let lastDataSample = null;

    // Set up event listeners
    connector.on('start', () => {
        logger.info('🚀 Connector started successfully');
    });

    connector.on('data', (data) => {
        dataReceived++;
        lastDataSample = data;
        
        logger.info('📊 New data received', {
            vehicles: data.vehicleUpdates.length,
            trips: data.tripUpdates.length,
            alerts: data.alerts.length,
            feedId: data.feedId,
            timestamp: new Date(data.timestamp).toISOString()
        });

        // Show sample data
        if (data.vehicleUpdates.length > 0) {
            const vehicle = data.vehicleUpdates[0];
            console.log(`   🚇 Sample Vehicle: ${vehicle.trip?.routeId || 'Unknown'} train`);
            console.log(`      Status: ${vehicle.currentStatus}`);
            console.log(`      Stop: ${vehicle.stopId || 'N/A'}`);
            
            if (vehicle.position) {
                console.log(`      Location: ${vehicle.position.latitude}, ${vehicle.position.longitude}`);
            }
        }

        if (data.alerts.length > 0) {
            const alert = data.alerts[0];
            console.log(`   🚨 Sample Alert: ${alert.headerText?.slice(0, 60)}...`);
            console.log(`      Effect: ${alert.effect}`);
            console.log(`      Cause: ${alert.cause}`);
        }

        // Calculate delays for different routes
        const routes = ['1', '2', '3', '4', '5', '6'];
        routes.forEach(route => {
            const avgDelay = connector.calculateAverageDelay(data, route);
            if (avgDelay > 0) {
                console.log(`   ⏱️  Route ${route} avg delay: ${avgDelay} seconds`);
            }
        });
    });

    connector.on('error', (error) => {
        logger.error('❌ Connector error', { 
            message: error.message,
            stack: error.stack 
        });
    });

    connector.on('circuitBreakerOpen', () => {
        logger.warn('🔴 Circuit breaker opened');
    });

    connector.on('circuitBreakerClosed', () => {
        logger.info('🟢 Circuit breaker closed');
    });

    // Validate API key first
    console.log('🔑 Validating API key...');
    try {
        const isValid = await connector.validateApiKey();
        if (!isValid) {
            console.log('❌ Invalid API key');
            return;
        }
        console.log('✅ API key is valid\n');
    } catch (error) {
        console.log('❌ Failed to validate API key:', error.message);
        return;
    }

    // Start the connector
    connector.start();
    
    // Monitor health and status
    const healthInterval = setInterval(() => {
        const health = connector.getHealth();
        const status = connector.getStatus();
        
        console.log('\n💓 Health Check:', {
            status: health.status,
            running: health.isRunning,
            successRate: Math.round(health.successRate * 100) + '%',
            timeSinceLastSuccess: health.timeSinceLastSuccess ? 
                `${Math.round(health.timeSinceLastSuccess / 1000)}s` : 'N/A'
        });

        console.log('📊 Metrics:', {
            totalFetches: status.metrics.totalFetches,
            successful: status.metrics.successfulFetches,
            failed: status.metrics.failedFetches,
            avgResponseTime: Math.round(status.metrics.avgResponseTime) + 'ms'
        });

        // Show feed info
        const feedInfo = connector.getFeedInfo();
        console.log('🚇 Feed Info:', feedInfo);
    }, 60000); // Every minute

    // Stop test after 5 minutes
    setTimeout(() => {
        clearInterval(healthInterval);
        connector.stop();
        
        console.log('\n📈 Test Summary:');
        console.log(`   Data fetches received: ${dataReceived}`);
        console.log(`   Final status: ${connector.getHealth().status}`);
        
        if (lastDataSample) {
            console.log(`   Last data summary:`, lastDataSample.summary);
        }
        
        console.log('\n✅ Test completed successfully!');
        process.exit(0);
    }, 300000); // 5 minutes
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Gracefully shutting down...');
    process.exit(0);
});

process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled promise rejection:', error);
    process.exit(1);
});

// Run the test
testMTAConnector().catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
});