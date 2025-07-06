// multi-modal-test.js - Combined MTA Subway + Traffic Intelligence
require('dotenv').config();

const MTAConnector = require('../src/connectors/mta/MTAConnector');
const TrafficConnector = require('../src/connectors/traffic/TrafficConnector');
const DataIngestionService = require('../src/pipeline/ingestion/DataIngestionService');
const { getLogger } = require('../src/utils/Logger');

/**
 * Multi-Modal Urban Intelligence System
 * Combines subway and traffic data for comprehensive city analysis
 */
class MultiModalIntelligence {
    constructor() {
        this.logger = getLogger('MultiModal');
        this.pipeline = null;
        this.latestData = {
            subway: null,
            traffic: null
        };
        this.correlations = [];
        this.unifiedAlerts = [];
    }

    async initialize() {
        console.log('🌆 NYC Multi-Modal Intelligence System');
        console.log('=====================================\n');

        // Check API keys
        if (!process.env.MTA_API_KEY || !process.env.TRAFFIC_511NY_API_KEY) {
            console.log('❌ Missing required API keys!');
            console.log('   Required in .env:');
            console.log('   - MTA_API_KEY');
            console.log('   - TRAFFIC_511NY_API_KEY');
            return false;
        }

        console.log('✅ All API keys found\n');

        // Create pipeline
        this.pipeline = new DataIngestionService({
            messageQueue: { type: 'memory' },
            healthCheckInterval: 60000
        });

        // Create connectors
        const mtaConnector = new MTAConnector({
            apiKey: process.env.MTA_API_KEY,
            feedId: 1, // 1,2,3,4,5,6,S lines
            pollInterval: 30000 // 30 seconds
        });

        const trafficConnector = new TrafficConnector({
            apiKey: process.env.TRAFFIC_511NY_API_KEY,
            pollInterval: 60000 // 1 minute
        });

        // Register connectors
        this.pipeline.registerConnector('mta-subway', mtaConnector);
        this.pipeline.registerConnector('nyc-traffic', trafficConnector);

        // Set up data handlers
        this.setupDataHandlers();

        return true;
    }

    setupDataHandlers() {
        this.pipeline.on('dataIngested', (event) => {
            // Store latest data
            if (event.connector === 'mta-subway') {
                this.latestData.subway = event.data;
                this.processSubwayData(event.data);
            } else if (event.connector === 'nyc-traffic') {
                this.latestData.traffic = event.data;
                this.processTrafficData(event.data);
            }

            // Run correlation analysis when both data sources are available
            if (this.latestData.subway && this.latestData.traffic) {
                this.runCorrelationAnalysis();
            }
        });

        this.pipeline.on('error', (error) => {
            this.logger.error('Pipeline error:', error);
        });
    }

    processSubwayData(data) {
        console.log(`\n🚇 SUBWAY UPDATE - ${new Date().toLocaleTimeString()}`);
        console.log('─'.repeat(50));
        
        // Summary metrics
        console.log(`📊 Active Trains: ${data.vehicleUpdates?.length || 0}`);
        console.log(`⏱️  Delays Reported: ${data.tripUpdates?.length || 0}`);
        console.log(`🚨 Service Alerts: ${data.alerts?.length || 0}`);

        // Show delays by route
        const delaysByRoute = this.calculateDelaysByRoute(data);
        if (Object.keys(delaysByRoute).length > 0) {
            console.log('\n🚇 Delays by Line:');
            Object.entries(delaysByRoute)
                .sort(([,a], [,b]) => b.avgDelay - a.avgDelay)
                .slice(0, 5)
                .forEach(([route, stats]) => {
                    console.log(`   ${route} Line: ${Math.round(stats.avgDelay / 60)}min avg (${stats.count} trains)`);
                });
        }

        // Show major alerts
        if (data.alerts && data.alerts.length > 0) {
            console.log('\n🚨 Active Alerts:');
            data.alerts.slice(0, 3).forEach(alert => {
                console.log(`   • ${alert.headerText?.slice(0, 60)}...`);
            });
        }
    }

    processTrafficData(data) {
        console.log(`\n🚗 TRAFFIC UPDATE - ${new Date().toLocaleTimeString()}`);
        console.log('─'.repeat(50));

        // Summary metrics
        console.log(`📊 Traffic Events: ${data.events?.length || 0}`);
        console.log(`📹 Active Cameras: ${data.cameras?.filter(c => c.status === 'active').length || 0}`);
        console.log(`📢 Traffic Alerts: ${data.alerts?.length || 0}`);

        // Congestion summary
        if (data.metrics?.congestionLevels) {
            console.log('\n🚦 Borough Congestion:');
            Object.entries(data.metrics.congestionLevels).forEach(([borough, level]) => {
                const emoji = {
                    'free-flow': '🟢',
                    'light': '🟡',
                    'moderate': '🟠',
                    'heavy': '🔴',
                    'severe': '🟣'
                }[level] || '⚪';
                const speed = Math.round(data.metrics.averageSpeeds[borough] || 0);
                console.log(`   ${emoji} ${borough}: ${level} (${speed} mph)`);
            });
        }

        // Major incidents
        const majorIncidents = data.events?.filter(e => 
            ['major', 'severe'].includes(e.severity)
        ) || [];
        
        if (majorIncidents.length > 0) {
            console.log('\n🚨 Major Traffic Incidents:');
            majorIncidents.slice(0, 3).forEach(incident => {
                console.log(`   • ${incident.type} on ${incident.location.roadway}`);
                if (incident.impact.delay_minutes) {
                    console.log(`     ${incident.impact.delay_minutes} min delay`);
                }
            });
        }

        // Hotspots
        if (data.geoSummary?.eventHotspots?.length > 0) {
            console.log('\n🔥 Traffic Hotspots:');
            data.geoSummary.eventHotspots.slice(0, 3).forEach(hotspot => {
                console.log(`   • ${hotspot.eventCount} incidents clustered (${hotspot.severity})`);
            });
        }
    }

    runCorrelationAnalysis() {
        console.log(`\n🔗 CORRELATION ANALYSIS - ${new Date().toLocaleTimeString()}`);
        console.log('═'.repeat(50));

        const correlations = [];

        // 1. Check for traffic near major subway stations
        const trafficNearStations = this.findTrafficNearSubwayStations();
        if (trafficNearStations.length > 0) {
            console.log('\n🚇🚗 Traffic Affecting Subway Access:');
            trafficNearStations.forEach(correlation => {
                console.log(`   • ${correlation.station} station affected by ${correlation.trafficType}`);
                console.log(`     Lines: ${correlation.affectedLines.join(', ')}`);
                console.log(`     Traffic: ${correlation.severity} on ${correlation.roadway}`);
            });
            correlations.push(...trafficNearStations);
        }

        // 2. Borough-wide impact analysis
        const boroughImpacts = this.analyzeBoroughImpacts();
        if (boroughImpacts.length > 0) {
            console.log('\n🏙️ Borough-Wide Impacts:');
            boroughImpacts.forEach(impact => {
                console.log(`   • ${impact.borough}:`);
                console.log(`     Traffic: ${impact.trafficLevel}`);
                console.log(`     Subway delays: ${impact.subwayDelays} avg minutes`);
                console.log(`     Correlation: ${impact.correlationStrength}`);
            });
        }

        // 3. Cascading delay detection
        const cascadingDelays = this.detectCascadingDelays();
        if (cascadingDelays.length > 0) {
            console.log('\n⚠️ Potential Cascading Delays:');
            cascadingDelays.forEach(cascade => {
                console.log(`   • ${cascade.trigger} → ${cascade.impact}`);
                console.log(`     Risk level: ${cascade.risk}`);
            });
        }

        // Generate unified alerts
        this.generateUnifiedAlerts(correlations, boroughImpacts, cascadingDelays);

        // Calculate unified urban health score
        const healthScore = this.calculateUrbanHealthScore();
        console.log('\n💓 URBAN HEALTH SCORE');
        console.log('─'.repeat(30));
        console.log(`Overall Score: ${healthScore.overall}/100 (${healthScore.status})`);
        console.log('Components:');
        console.log(`   🚇 Subway: ${healthScore.components.subway}/100`);
        console.log(`   🚗 Traffic: ${healthScore.components.traffic}/100`);
        console.log(`   🔗 Integration: ${healthScore.components.integration}/100`);

        this.correlations = correlations;
    }

    findTrafficNearSubwayStations() {
        const correlations = [];
        const majorStations = {
            'Times Square': { lat: 40.7580, lon: -73.9855, lines: ['1','2','3','7','N','Q','R','W','S'] },
            'Grand Central': { lat: 40.7527, lon: -73.9772, lines: ['4','5','6','7','S'] },
            'Union Square': { lat: 40.7359, lon: -73.9911, lines: ['4','5','6','L','N','Q','R','W'] },
            'Atlantic Terminal': { lat: 40.6842, lon: -73.9766, lines: ['B','D','N','Q','R','2','3','4','5'] },
            'Penn Station': { lat: 40.7505, lon: -73.9934, lines: ['1','2','3','A','C','E'] }
        };

        // Check traffic events near stations
        for (const [stationName, station] of Object.entries(majorStations)) {
            const nearbyTraffic = this.latestData.traffic?.events?.filter(event => {
                if (!event.location.lat || !event.location.lon) return false;
                const distance = this.calculateDistance(
                    station.lat, station.lon,
                    event.location.lat, event.location.lon
                );
                return distance < 0.5; // Within 500 meters
            }) || [];

            if (nearbyTraffic.length > 0) {
                const severeTraffic = nearbyTraffic.find(e => 
                    ['major', 'severe'].includes(e.severity)
                );
                
                if (severeTraffic) {
                    correlations.push({
                        station: stationName,
                        affectedLines: station.lines,
                        trafficType: severeTraffic.type,
                        severity: severeTraffic.severity,
                        roadway: severeTraffic.location.roadway || 'nearby road',
                        distance: this.calculateDistance(
                            station.lat, station.lon,
                            severeTraffic.location.lat, severeTraffic.location.lon
                        )
                    });
                }
            }
        }

        return correlations;
    }

    analyzeBoroughImpacts() {
        const impacts = [];
        const boroughs = ['Manhattan', 'Brooklyn', 'Queens', 'Bronx'];

        for (const borough of boroughs) {
            // Get traffic data for borough
            const trafficLevel = this.latestData.traffic?.metrics?.congestionLevels?.[borough];
            const avgSpeed = this.latestData.traffic?.metrics?.averageSpeeds?.[borough];

            // Get subway delays for borough
            const subwayDelays = this.getSubwayDelaysForBorough(borough);

            if (trafficLevel && subwayDelays.count > 0) {
                // Calculate correlation strength
                let correlationStrength = 'weak';
                if (trafficLevel === 'severe' && subwayDelays.avgDelay > 180) {
                    correlationStrength = 'strong';
                } else if (['heavy', 'severe'].includes(trafficLevel) && subwayDelays.avgDelay > 120) {
                    correlationStrength = 'moderate';
                }

                impacts.push({
                    borough,
                    trafficLevel,
                    avgSpeed: Math.round(avgSpeed || 0),
                    subwayDelays: Math.round(subwayDelays.avgDelay / 60),
                    affectedLines: subwayDelays.lines,
                    correlationStrength
                });
            }
        }

        return impacts.filter(i => i.correlationStrength !== 'weak');
    }

    detectCascadingDelays() {
        const cascades = [];

        // Pattern 1: Heavy traffic + subway delays = extended impact
        const heavyTrafficBoroughs = Object.entries(
            this.latestData.traffic?.metrics?.congestionLevels || {}
        ).filter(([_, level]) => ['heavy', 'severe'].includes(level))
         .map(([borough, _]) => borough);

        for (const borough of heavyTrafficBoroughs) {
            const subwayDelays = this.getSubwayDelaysForBorough(borough);
            if (subwayDelays.avgDelay > 120) { // 2+ minutes average
                cascades.push({
                    trigger: `Heavy traffic in ${borough}`,
                    impact: `Extended subway delays on ${subwayDelays.lines.join(', ')}`,
                    risk: 'high',
                    type: 'traffic_to_subway'
                });
            }
        }

        // Pattern 2: Major incidents near transit hubs
        const majorIncidents = this.latestData.traffic?.events?.filter(e =>
            e.severity === 'severe' && e.impact?.delay_minutes > 30
        ) || [];

        majorIncidents.forEach(incident => {
            if (incident.location.borough && this.isMajorTransitHub(incident.location)) {
                cascades.push({
                    trigger: `Severe ${incident.type} on ${incident.location.roadway}`,
                    impact: 'Multi-modal transit disruption',
                    risk: 'critical',
                    type: 'incident_cascade'
                });
            }
        });

        return cascades;
    }

    generateUnifiedAlerts(correlations, boroughImpacts, cascadingDelays) {
        this.unifiedAlerts = [];

        // Alert for traffic affecting subway stations
        correlations.forEach(correlation => {
            this.unifiedAlerts.push({
                type: 'STATION_ACCESS_IMPACT',
                severity: 'HIGH',
                title: `${correlation.station} Station Access Impacted`,
                message: `${correlation.severity} ${correlation.trafficType} on ${correlation.roadway} affecting access to ${correlation.station}. Lines affected: ${correlation.affectedLines.join(', ')}`,
                timestamp: Date.now(),
                location: correlation.station,
                dataSource: ['traffic', 'subway']
            });
        });

        // Alert for borough-wide impacts
        boroughImpacts.filter(i => i.correlationStrength === 'strong').forEach(impact => {
            this.unifiedAlerts.push({
                type: 'BOROUGH_IMPACT',
                severity: 'MEDIUM',
                title: `${impact.borough} Multi-Modal Delays`,
                message: `${impact.borough} experiencing ${impact.trafficLevel} traffic (${impact.avgSpeed} mph) with ${impact.subwayDelays} min subway delays. Affected lines: ${impact.affectedLines.join(', ')}`,
                timestamp: Date.now(),
                location: impact.borough,
                dataSource: ['traffic', 'subway']
            });
        });

        // Alert for cascading delays
        cascadingDelays.filter(c => c.risk === 'critical').forEach(cascade => {
            this.unifiedAlerts.push({
                type: 'CASCADE_WARNING',
                severity: 'CRITICAL',
                title: 'Critical Multi-Modal Disruption',
                message: `${cascade.trigger} causing ${cascade.impact}. Expect significant delays across multiple transportation modes.`,
                timestamp: Date.now(),
                dataSource: ['traffic', 'subway']
            });
        });

        if (this.unifiedAlerts.length > 0) {
            console.log('\n🚨 UNIFIED ALERTS');
            console.log('─'.repeat(30));
            this.unifiedAlerts.forEach(alert => {
                const severityEmoji = {
                    'CRITICAL': '🔴',
                    'HIGH': '🟠',
                    'MEDIUM': '🟡',
                    'LOW': '🟢'
                }[alert.severity] || '⚪';
                
                console.log(`${severityEmoji} ${alert.title}`);
                console.log(`   ${alert.message}`);
            });
        }
    }

    calculateUrbanHealthScore() {
        // Subway health (40% weight)
        const subwayScore = this.calculateSubwayHealth();
        
        // Traffic health (40% weight)
        const trafficScore = this.calculateTrafficHealth();
        
        // Integration health (20% weight) - how well systems work together
        const integrationScore = this.calculateIntegrationHealth();
        
        const overall = Math.round(
            subwayScore * 0.4 +
            trafficScore * 0.4 +
            integrationScore * 0.2
        );
        
        let status = 'healthy';
        if (overall < 50) status = 'critical';
        else if (overall < 70) status = 'degraded';
        else if (overall < 85) status = 'fair';
        
        return {
            overall,
            status,
            components: {
                subway: Math.round(subwayScore),
                traffic: Math.round(trafficScore),
                integration: Math.round(integrationScore)
            }
        };
    }

    calculateSubwayHealth() {
        if (!this.latestData.subway) return 50;
        
        const alerts = this.latestData.subway.alerts?.length || 0;
        const delays = this.latestData.subway.tripUpdates?.filter(t => t.delay > 120).length || 0;
        const totalTrips = this.latestData.subway.tripUpdates?.length || 1;
        
        const alertPenalty = Math.min(alerts * 10, 40);
        const delayRate = (delays / totalTrips) * 100;
        const delayPenalty = Math.min(delayRate, 40);
        
        return Math.max(0, 100 - alertPenalty - delayPenalty);
    }

    calculateTrafficHealth() {
        if (!this.latestData.traffic) return 50;
        
        const metrics = this.latestData.traffic.metrics;
        if (!metrics) return 50;
        
        // Count congested boroughs
        const congestionLevels = Object.values(metrics.congestionLevels || {});
        const severeCount = congestionLevels.filter(l => l === 'severe').length;
        const heavyCount = congestionLevels.filter(l => l === 'heavy').length;
        
        // Count major incidents
        const majorIncidents = this.latestData.traffic.events?.filter(e =>
            ['major', 'severe'].includes(e.severity)
        ).length || 0;
        
        const congestionPenalty = (severeCount * 20) + (heavyCount * 10);
        const incidentPenalty = Math.min(majorIncidents * 5, 30);
        
        return Math.max(0, 100 - congestionPenalty - incidentPenalty);
    }

    calculateIntegrationHealth() {
        // How well are the systems working together?
        const hasCorrelations = this.correlations.length > 0;
        const hasUnifiedAlerts = this.unifiedAlerts.length > 0;
        const dataSyncScore = this.latestData.subway && this.latestData.traffic ? 100 : 50;
        
        // Penalize when there are many correlations (bad integration)
        const correlationPenalty = Math.min(this.correlations.length * 10, 40);
        const alertPenalty = Math.min(this.unifiedAlerts.filter(a => 
            a.severity === 'CRITICAL'
        ).length * 20, 40);
        
        return Math.max(0, dataSyncScore - correlationPenalty - alertPenalty);
    }

    // Helper methods
    calculateDelaysByRoute(subwayData) {
        const delaysByRoute = {};
        
        if (subwayData.tripUpdates) {
            subwayData.tripUpdates.forEach(trip => {
                const route = trip.trip?.routeId;
                if (route && trip.delay) {
                    if (!delaysByRoute[route]) {
                        delaysByRoute[route] = { totalDelay: 0, count: 0 };
                    }
                    delaysByRoute[route].totalDelay += trip.delay;
                    delaysByRoute[route].count++;
                }
            });
        }
        
        // Calculate averages
        Object.keys(delaysByRoute).forEach(route => {
            delaysByRoute[route].avgDelay = 
                delaysByRoute[route].totalDelay / delaysByRoute[route].count;
        });
        
        return delaysByRoute;
    }

    getSubwayDelaysForBorough(borough) {
        // This is simplified - in reality you'd map stations to boroughs
        const delaysByRoute = this.calculateDelaysByRoute(this.latestData.subway || {});
        const routes = Object.keys(delaysByRoute);
        
        if (routes.length === 0) return { avgDelay: 0, lines: [], count: 0 };
        
        const totalDelay = Object.values(delaysByRoute)
            .reduce((sum, r) => sum + r.avgDelay, 0);
        
        return {
            avgDelay: totalDelay / routes.length,
            lines: routes,
            count: routes.length
        };
    }

    calculateDistance(lat1, lon1, lat2, lon2) {
        // Haversine formula
        const R = 6371; // km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    isMajorTransitHub(location) {
        // Check if location is near major transit hubs
        const hubs = ['Penn Station', 'Grand Central', 'Times Square', 'Atlantic', 'Union Square'];
        return hubs.some(hub => 
            location.roadway?.toLowerCase().includes(hub.toLowerCase())
        );
    }

    async start() {
        console.log('🚀 Starting multi-modal intelligence system...\n');
        await this.pipeline.start();
        
        // Show status every minute
        setInterval(() => this.showSystemStatus(), 60000);
    }

    showSystemStatus() {
        const status = this.pipeline.getStatus();
        console.log('\n📊 SYSTEM STATUS');
        console.log('─'.repeat(30));
        console.log(`Uptime: ${Math.round(status.uptime / 1000 / 60)} minutes`);
        console.log(`Data batches: ${status.metrics.totalDataReceived}`);
        console.log(`Unified alerts generated: ${this.unifiedAlerts.length}`);
    }
}

// Run the system
async function main() {
    const system = new MultiModalIntelligence();
    
    const initialized = await system.initialize();
    if (!initialized) {
        process.exit(1);
    }
    
    await system.start();
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n👋 Shutting down multi-modal intelligence system...');
    process.exit(0);
});

main().catch(error => {
    console.error('💥 System error:', error);
    process.exit(1);
});