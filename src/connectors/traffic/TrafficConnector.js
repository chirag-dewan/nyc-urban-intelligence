// src/connectors/traffic/TrafficConnector.js
const axios = require('axios');
const BaseConnector = require('../base/BaseConnector');
const TrafficTransformer = require('./transformers/TrafficTransformer');
const { Logger } = require('../../utils/Logger');

/**
 * 511NY Traffic Data Connector
 * Collects real-time traffic events, camera feeds, alerts, and road conditions
 * from New York's 511 traffic information system
 */
class TrafficConnector extends BaseConnector {
    constructor(config = {}) {
        const defaultConfig = {
            apiKey: process.env.TRAFFIC_511NY_API_KEY,
            baseUrl: 'https://511ny.org/api',
            format: 'json',
            pollInterval: 60000, // 1 minute - traffic changes frequently
            timeout: 15000,
            endpoints: {
                events: '/getevents',
                cameras: '/getcameras',
                messageSigns: '/getmessagesigns',
                alerts: '/getalerts',
                winterConditions: '/getwinterroadconditions'
            },
            // NYC-specific bounds to filter data
            bounds: {
                north: 40.917577,
                south: 40.477399,
                east: -73.700009,
                west: -74.259090
            },
            ...config
        };

        super(defaultConfig);
        
        this.apiKey = this.config.apiKey;
        this.transformer = new TrafficTransformer();
        this.logger = new Logger('TrafficConnector');
        
        // Track which endpoints to poll based on conditions
        this.activeEndpoints = ['events', 'cameras', 'alerts', 'messageSigns'];
        
        // Add winter conditions endpoint during winter months
        const currentMonth = new Date().getMonth();
        if (currentMonth >= 10 || currentMonth <= 2) { // Nov-Feb
            this.activeEndpoints.push('winterConditions');
        }
    }

    /**
     * Fetch data from all 511NY endpoints
     * Implementation of abstract method from BaseConnector
     */
    async fetchData() {
        if (!this.apiKey) {
            throw new Error('511NY API key is required');
        }

        const fetchPromises = this.activeEndpoints.map(endpoint => 
            this.fetchEndpoint(endpoint).catch(error => {
                this.logger.warn(`Failed to fetch ${endpoint}`, { error: error.message });
                return null; // Continue even if one endpoint fails
            })
        );

        const results = await Promise.all(fetchPromises);
        
        // Combine all data sources
        const rawData = {
            events: results[0],
            cameras: results[1],
            alerts: results[2],
            messageSigns: results[3],
            winterConditions: results[4] || null,
            fetchTimestamp: Date.now()
        };

        // Transform to standardized format
        const transformedData = this.transformer.transform(rawData, {
            source: '511ny',
            bounds: this.config.bounds
        });

        return transformedData;
    }

    /**
     * Fetch data from a specific endpoint
     */
    async fetchEndpoint(endpointName) {
        const endpoint = this.config.endpoints[endpointName];
        const url = `${this.config.baseUrl}${endpoint}`;
        
        const params = {
            key: this.apiKey,
            format: this.config.format
        };

        const response = await axios.get(url, {
            params,
            timeout: this.config.timeout,
            headers: {
                'User-Agent': 'NYC-Urban-Intelligence/1.0',
                'Accept': 'application/json'
            }
        });

        this.logger.debug(`Fetched ${endpointName}`, {
            dataSize: JSON.stringify(response.data).length,
            recordCount: Array.isArray(response.data) ? response.data.length : 'N/A'
        });

        return response.data;
    }

    /**
     * Get connector-specific status
     * Implementation of abstract method from BaseConnector
     */
    getConnectorStatus() {
        return {
            apiKeyConfigured: !!this.apiKey,
            activeEndpoints: this.activeEndpoints,
            baseUrl: this.config.baseUrl,
            bounds: this.config.bounds
        };
    }

    /**
     * Filter events by severity
     */
    getHighSeverityEvents(data) {
        if (!data || !data.events) return [];
        
        return data.events.filter(event => 
            event.severity && ['major', 'severe'].includes(event.severity.toLowerCase())
        );
    }

    /**
     * Get traffic speed for a specific area
     */
    getAreaTrafficSpeed(data, borough) {
        if (!data || !data.events) return null;
        
        const boroughBounds = this.getBoroughBounds(borough);
        const relevantEvents = data.events.filter(event => 
            this.isInBounds(event, boroughBounds)
        );

        if (relevantEvents.length === 0) return null;

        // Calculate average speed from events
        const speeds = relevantEvents
            .filter(e => e.speed !== undefined)
            .map(e => e.speed);

        if (speeds.length === 0) return null;

        return {
            borough,
            averageSpeed: speeds.reduce((a, b) => a + b, 0) / speeds.length,
            sampleSize: speeds.length,
            congestionLevel: this.calculateCongestionLevel(speeds)
        };
    }

    /**
     * Get active cameras for an area
     */
    getActiveCameras(data, area = null) {
        if (!data || !data.cameras) return [];
        
        let cameras = data.cameras.filter(camera => camera.status === 'active');
        
        if (area) {
            const bounds = this.getBoroughBounds(area);
            cameras = cameras.filter(camera => this.isInBounds(camera, bounds));
        }
        
        return cameras.map(camera => ({
            id: camera.id,
            name: camera.name,
            location: {
                lat: camera.latitude,
                lon: camera.longitude
            },
            url: camera.url,
            lastUpdate: camera.lastUpdate
        }));
    }

    /**
     * Check if a point is within bounds
     */
    isInBounds(item, bounds) {
        if (!item.latitude || !item.longitude) return false;
        
        return item.latitude >= bounds.south && 
               item.latitude <= bounds.north &&
               item.longitude >= bounds.west && 
               item.longitude <= bounds.east;
    }

    /**
     * Get borough-specific bounds
     */
    getBoroughBounds(borough) {
        const boroughBounds = {
            'Manhattan': { north: 40.882, south: 40.680, east: -73.907, west: -74.047 },
            'Brooklyn': { north: 40.739, south: 40.551, east: -73.833, west: -74.056 },
            'Queens': { north: 40.812, south: 40.489, east: -73.700, west: -73.962 },
            'Bronx': { north: 40.917, south: 40.785, east: -73.765, west: -73.933 },
            'Staten Island': { north: 40.651, south: 40.477, east: -74.034, west: -74.259 }
        };
        
        return boroughBounds[borough] || this.config.bounds;
    }

    /**
     * Calculate congestion level from speed data
     */
    calculateCongestionLevel(speeds) {
        const avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;
        
        if (avgSpeed < 10) return 'severe';
        if (avgSpeed < 20) return 'heavy';
        if (avgSpeed < 30) return 'moderate';
        if (avgSpeed < 40) return 'light';
        return 'free-flow';
    }

    /**
     * Validate API key by making a test request
     */
    async validateApiKey() {
        try {
            await this.fetchEndpoint('events');
            return true;
        } catch (error) {
            if (error.response && error.response.status === 401) {
                this.logger.error('Invalid 511NY API key');
                return false;
            }
            throw error;
        }
    }

    /**
     * Get current incident summary
     */
    getIncidentSummary(data) {
        if (!data || !data.events) return null;
        
        const summary = {
            total: data.events.length,
            byType: {},
            bySeverity: {},
            byBorough: {}
        };

        data.events.forEach(event => {
            // Count by type
            const type = event.type || 'unknown';
            summary.byType[type] = (summary.byType[type] || 0) + 1;
            
            // Count by severity
            const severity = event.severity || 'unknown';
            summary.bySeverity[severity] = (summary.bySeverity[severity] || 0) + 1;
            
            // Count by borough
            const borough = this.getBorough(event);
            if (borough) {
                summary.byBorough[borough] = (summary.byBorough[borough] || 0) + 1;
            }
        });

        return summary;
    }

    /**
     * Determine which borough an event is in
     */
    getBorough(event) {
        if (!event.latitude || !event.longitude) return null;
        
        const boroughs = ['Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island'];
        
        for (const borough of boroughs) {
            const bounds = this.getBoroughBounds(borough);
            if (this.isInBounds(event, bounds)) {
                return borough;
            }
        }
        
        return null;
    }
}

module.exports = TrafficConnector;