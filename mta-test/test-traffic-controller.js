// test-traffic-connector.js
require('dotenv').config();
const TrafficConnector = require('../src/connectors/traffic/TrafficConnector');

/**
 * Test script for 511NY Traffic Connector
 * Shows real-time traffic data for NYC
 */
async function testTrafficConnector() {
    console.log('🚗 Testing 511NY Traffic Connector\n');
    console.log('='.repeat(50));
    
    // Check for API key
    const apiKey = process.env.TRAFFIC_511NY_API_KEY;
    if (!apiKey) {
        console.log('❌ Missing 511NY API Key!');
        console.log('');
        console.log('To get started:');
        console.log('1. Go to https://511ny.org/developers/register');
        console.log('2. Sign up for a free API key');
        console.log('3. Add to .env file: TRAFFIC_511NY_API_KEY=your_key_here');
        console.log('4. Run this test again');
        return;
    }

    console.log('🔑 API Key found! Initializing connector...\n');

    // Create traffic connector
    const trafficConnector = new TrafficConnector({
        apiKey: apiKey,
        pollInterval: 60000, // 1 minute
        timeout: 15000
    });

    // Validate API key
    console.log('🔑 Validating 511NY API key...');
    try {
        const isValid = await trafficConnector.validateApiKey();
        if (!isValid) {
            console.log('❌ Invalid API key');
            return;
        }
        console.log('✅ API key is valid\n');
    } catch (error) {
        console.log('❌ Failed to validate API key:', error.message);
        return;
    }

    // Test single fetch
    console.log('📡 Fetching traffic data...\n');
    try {
        const data = await trafficConnector.fetchData();
        
        displayTrafficSummary(data);
        displayIncidentDetails(data);
        displayCameraInfo(data);
        displayAlerts(data);
        displayMetrics(data);
        displayHotspots(data);
        
    } catch (error) {
        console.error('❌ Error fetching traffic data:', error.message);
        return;
    }

    // Set up continuous monitoring
    console.log('\n🔄 Starting continuous monitoring (press Ctrl+C to stop)...\n');
    
    let updateCount = 0;
    trafficConnector.on('data', (data) => {
        updateCount++;
        console.log(`\n📊 Update #${updateCount} at ${new Date().toLocaleTimeString()}`);
        console.log('='.repeat(50));
        
        // Show summary metrics
        console.log('📈 Quick Summary:');
        console.log(`   Total Events: ${data.events.length}`);
        console.log(`   Active Cameras: ${data.cameras.filter(c => c.status === 'active').length}/${data.cameras.length}`);
        console.log(`   Active Alerts: ${data.alerts.length}`);
        console.log(`   Message Signs: ${data.messageSigns.length}`);
        
        // Show congestion levels
        console.log('\n🚦 Congestion by Borough:');
        Object.entries(data.metrics.congestionLevels).forEach(([borough, level]) => {
            const emoji = {
                'free-flow': '🟢',
                'light': '🟡',
                'moderate': '🟠',
                'heavy': '🔴',
                'severe': '🟣'
            }[level] || '⚪';
            console.log(`   ${emoji} ${borough}: ${level} (${Math.round(data.metrics.averageSpeeds[borough] || 0)} mph avg)`);
        });
        
        // Show high severity events
        const severeEvents = data.events.filter(e => ['major', 'severe'].includes(e.severity));
        if (severeEvents.length > 0) {
            console.log('\n🚨 High Severity Events:');
            severeEvents.slice(0, 3).forEach(event => {
                console.log(`   • ${event.type} on ${event.location.roadway || 'Unknown road'}`);
                console.log(`     ${event.description || 'No description'}`);
                if (event.impact.delay_minutes) {
                    console.log(`     Delay: ${event.impact.delay_minutes} minutes`);
                }
            });
        }
        
        // Show hotspots
        if (data.geoSummary.eventHotspots.length > 0) {
            console.log('\n🔥 Traffic Hotspots:');
            data.geoSummary.eventHotspots.slice(0, 3).forEach(hotspot => {
                console.log(`   • ${hotspot.eventCount} incidents near ${hotspot.center.lat.toFixed(4)}, ${hotspot.center.lon.toFixed(4)}`);
                console.log(`     Types: ${hotspot.types.join(', ')}`);
            });
        }
    });

    trafficConnector.on('error', (error) => {
        console.error('❌ Connector error:', error.message);
    });

    // Start the connector
    trafficConnector.start();
}

function displayTrafficSummary(data) {
    console.log('📊 TRAFFIC DATA SUMMARY');
    console.log('='.repeat(30));
    console.log(`Timestamp: ${new Date(data.timestamp).toLocaleString()}`);
    console.log(`Total Events: ${data.events.length}`);
    console.log(`Total Cameras: ${data.cameras.length}`);
    console.log(`Total Alerts: ${data.alerts.length}`);
    console.log(`Message Signs: ${data.messageSigns.length}`);
    if (data.winterConditions) {
        console.log(`Winter Conditions: ${data.winterConditions.length}`);
    }
    console.log('');
}

function displayIncidentDetails(data) {
    console.log('🚨 TRAFFIC INCIDENTS');
    console.log('='.repeat(30));
    
    // Group by severity
    const bySeverity = {};
    data.events.forEach(event => {
        if (!bySeverity[event.severity]) bySeverity[event.severity] = [];
        bySeverity[event.severity].push(event);
    });
    
    // Show counts by severity
    Object.entries(bySeverity).forEach(([severity, events]) => {
        console.log(`${severity}: ${events.length} events`);
    });
    
    // Show top 5 incidents
    console.log('\nTop Incidents:');
    const topEvents = data.events
        .filter(e => ['major', 'severe'].includes(e.severity))
        .slice(0, 5);
    
    topEvents.forEach((event, index) => {
        console.log(`\n${index + 1}. ${event.type.toUpperCase()} - ${event.severity}`);
        console.log(`   Location: ${event.location.roadway || 'Unknown'} ${event.location.direction || ''}`);
        console.log(`   Borough: ${event.location.borough || 'Unknown'}`);
        if (event.location.from && event.location.to) {
            console.log(`   Between: ${event.location.from} and ${event.location.to}`);
        }
        console.log(`   Description: ${event.description || 'N/A'}`);
        if (event.impact.lanes_blocked) {
            console.log(`   Lanes Blocked: ${event.impact.lanes_blocked}${event.impact.lanes_total ? `/${event.impact.lanes_total}` : ''}`);
        }
        if (event.impact.delay_minutes) {
            console.log(`   Estimated Delay: ${event.impact.delay_minutes} minutes`);
        }
        if (event.timing.estimated_end) {
            console.log(`   Est. Clear Time: ${new Date(event.timing.estimated_end).toLocaleTimeString()}`);
        }
    });
    console.log('');
}

function displayCameraInfo(data) {
    console.log('📹 TRAFFIC CAMERAS');
    console.log('='.repeat(30));
    
    const activeCameras = data.cameras.filter(c => c.status === 'active');
    console.log(`Active: ${activeCameras.length}/${data.cameras.length}`);
    
    // Group by borough
    const byBorough = {};
    activeCameras.forEach(camera => {
        const borough = camera.location.borough || 'Unknown';
        byBorough[borough] = (byBorough[borough] || 0) + 1;
    });
    
    console.log('\nCameras by Borough:');
    Object.entries(byBorough).forEach(([borough, count]) => {
        console.log(`   ${borough}: ${count}`);
    });
    
    // Show sample cameras
    console.log('\nSample Active Cameras:');
    activeCameras.slice(0, 3).forEach(camera => {
        console.log(`   • ${camera.name}`);
        console.log(`     Location: ${camera.location.roadway || 'Unknown'}`);
        if (camera.urls.snapshot) {
            console.log(`     Has snapshot URL`);
        }
    });
    console.log('');
}

function displayAlerts(data) {
    if (data.alerts.length === 0) {
        console.log('📢 No active traffic alerts\n');
        return;
    }
    
    console.log('📢 TRAFFIC ALERTS');
    console.log('='.repeat(30));
    
    data.alerts.slice(0, 3).forEach(alert => {
        console.log(`\n${alert.priority.toUpperCase()} Priority Alert`);
        console.log(`   ${alert.message.headline}`);
        if (alert.message.description) {
            console.log(`   ${alert.message.description}`);
        }
        if (alert.affected_routes.length > 0) {
            console.log(`   Affected Routes: ${alert.affected_routes.join(', ')}`);
        }
        if (alert.timing.expires) {
            console.log(`   Expires: ${new Date(alert.timing.expires).toLocaleString()}`);
        }
    });
    console.log('');
}

function displayMetrics(data) {
    console.log('📈 TRAFFIC METRICS');
    console.log('='.repeat(30));
    
    // Average speeds by borough
    console.log('Average Speeds by Borough:');
    Object.entries(data.metrics.averageSpeeds).forEach(([borough, speed]) => {
        const congestion = data.metrics.congestionLevels[borough];
        console.log(`   ${borough}: ${Math.round(speed)} mph (${congestion})`);
    });
    
    // Event breakdown
    console.log('\nEvent Type Breakdown:');
    const typeCount = {};
    data.events.forEach(event => {
        typeCount[event.type] = (typeCount[event.type] || 0) + 1;
    });
    Object.entries(typeCount).forEach(([type, count]) => {
        console.log(`   ${type}: ${count}`);
    });
    
    console.log('');
}

function displayHotspots(data) {
    if (data.geoSummary.eventHotspots.length === 0) {
        console.log('🗺️ No significant traffic hotspots detected\n');
        return;
    }
    
    console.log('🔥 TRAFFIC HOTSPOTS');
    console.log('='.repeat(30));
    
    data.geoSummary.eventHotspots.slice(0, 5).forEach((hotspot, index) => {
        console.log(`\n${index + 1}. Hotspot with ${hotspot.eventCount} incidents`);
        console.log(`   Location: ${hotspot.center.lat.toFixed(4)}, ${hotspot.center.lon.toFixed(4)}`);
        console.log(`   Severity: ${hotspot.severity}`);
        console.log(`   Event Types: ${hotspot.types.join(', ')}`);
    });
    
    if (data.geoSummary.congestedAreas.length > 0) {
        console.log('\n🚦 Congested Areas:');
        data.geoSummary.congestedAreas.forEach(area => {
            console.log(`   • ${area.borough}: ${area.level} congestion`);
        });
    }
    console.log('');
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n👋 Shutting down traffic monitoring...');
    process.exit(0);
});

// Run the test
testTrafficConnector().catch(error => {
    console.error('💥 Test failed:', error);
    process.exit(1);
});