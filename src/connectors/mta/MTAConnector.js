// src/connectors/mta/MTAConnector.js
const axios = require('axios');
const protobuf = require('protobufjs');
const path = require('path');
const BaseConnector = require('../base/BaseConnector');
const GTFSTransformer = require('./transformers/GTFSTransformer');

/**
 * MTA Real-time Feed Connector
 * Connects to MTA's GTFS-realtime feeds and provides subway data
 */
class MTAConnector extends BaseConnector {
    constructor(config = {}) {
        const defaultConfig = {
            apiKey: process.env.MTA_API_KEY,
            feedId: 1, // Feed 1 = 1,2,3,4,5,6,S lines
            baseUrl: 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs',
            pollInterval: 30000, // 30 seconds
            timeout: 10000,
            ...config
        };

        super(defaultConfig);
        
        this.apiKey = this.config.apiKey;
        this.feedId = this.config.feedId;
        this.baseUrl = this.config.baseUrl;
        this.FeedMessage = null;
        this.transformer = new GTFSTransformer();
        
        this.loadProtobufSchema();
    }

    /**
     * Load the GTFS-realtime protobuf schema
     */
    async loadProtobufSchema() {
        try {
            const schemaPath = path.join(__dirname, 'schemas', 'gtfs-realtime.proto');
            const root = await protobuf.load(schemaPath);
            this.FeedMessage = root.lookupType('transit_realtime.FeedMessage');
            
            this.logger.info('Protobuf schema loaded successfully');
        } catch (error) {
            this.logger.error('Failed to load protobuf schema', { error: error.message });
            throw error;
        }
    }

    /**
     * Fetch data from MTA API
     * Implementation of abstract method from BaseConnector
     */
    async fetchData() {
        if (!this.apiKey) {
            throw new Error('MTA API key is required');
        }

        if (!this.FeedMessage) {
            throw new Error('Protobuf schema not loaded');
        }

        const response = await axios.get(this.baseUrl, {
            headers: {
                'x-api-key': this.apiKey,
                'User-Agent': 'NYC-Urban-Intelligence/1.0'
            },
            responseType: 'arraybuffer',
            timeout: this.config.timeout
        });

        // Decode protobuf data
        const buffer = Buffer.from(response.data);
        const message = this.FeedMessage.decode(buffer);
        const rawData = this.FeedMessage.toObject(message);

        // Transform data using our transformer
        const transformedData = this.transformer.transform(rawData, {
            feedId: this.feedId,
            source: 'mta'
        });

        return transformedData;
    }

    /**
     * Get connector-specific status
     * Implementation of abstract method from BaseConnector
     */
    getConnectorStatus() {
        return {
            feedId: this.feedId,
            apiKeyConfigured: !!this.apiKey,
            protobufSchemaLoaded: !!this.FeedMessage,
            baseUrl: this.baseUrl
        };
    }

    /**
     * Get feed-specific information
     */
    getFeedInfo() {
        const feedInfo = {
            1: { name: 'ACE lines', routes: ['1', '2', '3', '4', '5', '6', 'S'] },
            2: { name: 'BDFM lines', routes: ['B', 'D', 'F', 'M'] },
            11: { name: 'SIR', routes: ['SI'] },
            16: { name: 'NQRW lines', routes: ['N', 'Q', 'R', 'W'] },
            21: { name: 'G line', routes: ['G'] },
            26: { name: 'ACE lines', routes: ['A', 'C', 'E'] },
            31: { name: 'BDFM lines', routes: ['B', 'D', 'F', 'M'] },
            36: { name: 'JZ lines', routes: ['J', 'Z'] },
            51: { name: 'L line', routes: ['L'] }
        };

        return feedInfo[this.feedId] || { name: 'Unknown feed', routes: [] };
    }

    /**
     * Validate API key by making a test request
     */
    async validateApiKey() {
        try {
            await this.fetchData();
            return true;
        } catch (error) {
            if (error.response && error.response.status === 401) {
                this.logger.error('Invalid MTA API key');
                return false;
            }
            throw error;
        }
    }

    /**
     * Get real-time alerts for specific routes
     */
    getAlertsForRoutes(data, routes) {
        if (!data || !data.alerts) return [];

        return data.alerts.filter(alert => {
            if (!alert.informedEntities) return false;
            
            return alert.informedEntities.some(entity => 
                entity.routeId && routes.includes(entity.routeId)
            );
        });
    }

    /**
     * Get vehicle positions for specific routes
     */
    getVehiclesForRoutes(data, routes) {
        if (!data || !data.vehicleUpdates) return [];

        return data.vehicleUpdates.filter(vehicle => 
            vehicle.routeId && routes.includes(vehicle.routeId)
        );
    }

    /**
     * Calculate average delay for a route
     */
    calculateAverageDelay(data, routeId) {
        if (!data || !data.tripUpdates) return 0;

        const routeTrips = data.tripUpdates.filter(trip => 
            trip.routeId === routeId
        );

        if (routeTrips.length === 0) return 0;

        let totalDelay = 0;
        let delayCount = 0;

        routeTrips.forEach(trip => {
            if (trip.stopTimeUpdates) {
                trip.stopTimeUpdates.forEach(stopUpdate => {
                    if (stopUpdate.delay) {
                        totalDelay += stopUpdate.delay;
                        delayCount++;
                    }
                });
            }
        });

        return delayCount > 0 ? totalDelay / delayCount : 0;
    }
}

module.exports = MTAConnector;