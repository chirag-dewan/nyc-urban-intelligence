// src/connectors/traffic/transformers/TrafficTransformer.js
const { Logger } = require('../../../utils/Logger');

/**
 * Transforms raw 511NY traffic data into standardized format
 * for the Urban Intelligence Platform
 */
class TrafficTransformer {
    constructor() {
        this.logger = new Logger('TrafficTransformer');
    }

    /**
     * Transform raw 511NY data into standardized format
     */
    transform(rawData, metadata = {}) {
        const timestamp = Date.now();
        
        const transformedData = {
            source: metadata.source || '511ny',
            timestamp: timestamp,
            bounds: metadata.bounds,
            
            // Traffic events (accidents, construction, etc.)
            events: this.transformEvents(rawData.events || []),
            
            // Camera information
            cameras: this.transformCameras(rawData.cameras || []),
            
            // Traffic alerts
            alerts: this.transformAlerts(rawData.alerts || []),
            
            // Digital message signs
            messageSigns: this.transformMessageSigns(rawData.messageSigns || []),
            
            // Winter road conditions (seasonal)
            winterConditions: this.transformWinterConditions(rawData.winterConditions),
            
            // Aggregated metrics
            metrics: {
                totalEvents: 0,
                totalCameras: 0,
                totalAlerts: 0,
                activeSigns: 0,
                averageSpeeds: {},
                congestionLevels: {},
                severityBreakdown: {}
            },
            
            // Geographic summary
            geoSummary: {
                eventHotspots: [],
                congestedAreas: [],
                clearedRoutes: []
            }
        };

        // Calculate metrics after transformation
        this.calculateMetrics(transformedData);
        this.identifyHotspots(transformedData);

        this.logger.debug('Traffic data transformation completed', {
            events: transformedData.events.length,
            cameras: transformedData.cameras.length,
            alerts: transformedData.alerts.length,
            signs: transformedData.messageSigns.length
        });

        return transformedData;
    }

    /**
     * Transform traffic events (incidents, construction, etc.)
     */
    transformEvents(events) {
        if (!Array.isArray(events)) return [];

        return events.map(event => {
            try {
                return {
                    id: event.id || this.generateId('event'),
                    type: this.normalizeEventType(event.type || event.eventType),
                    subtype: event.subtype || event.eventSubtype,
                    severity: this.normalizeSeverity(event.severity),
                    status: event.status || 'active',
                    
                    location: {
                        lat: parseFloat(event.latitude || event.lat),
                        lon: parseFloat(event.longitude || event.lng || event.lon),
                        direction: event.direction,
                        roadway: event.roadway || event.road,
                        from: event.fromLocation || event.from,
                        to: event.toLocation || event.to,
                        borough: this.detectBorough(event.latitude, event.longitude)
                    },
                    
                    timing: {
                        reported: this.parseTimestamp(event.reportedTime || event.created),
                        started: this.parseTimestamp(event.startTime),
                        estimated_end: this.parseTimestamp(event.estimatedEndTime),
                        last_updated: this.parseTimestamp(event.lastUpdated)
                    },
                    
                    impact: {
                        lanes_blocked: event.lanesBlocked || 0,
                        lanes_total: event.totalLanes,
                        speed: event.speed,
                        delay_minutes: event.delay,
                        length_miles: event.length
                    },
                    
                    description: event.description || event.details,
                    
                    // For ML features
                    features: {
                        is_rush_hour: this.isRushHour(new Date()),
                        weather_related: this.isWeatherRelated(event),
                        involves_truck: this.involvesTruck(event),
                        is_major_route: this.isMajorRoute(event.roadway)
                    }
                };
            } catch (error) {
                this.logger.warn('Failed to transform event', {
                    eventId: event.id,
                    error: error.message
                });
                return null;
            }
        }).filter(event => event !== null);
    }

    /**
     * Transform camera data
     */
    transformCameras(cameras) {
        if (!Array.isArray(cameras)) return [];

        return cameras.map(camera => {
            try {
                return {
                    id: camera.id || camera.cameraId,
                    name: camera.name || camera.description,
                    status: camera.status || (camera.enabled ? 'active' : 'inactive'),
                    
                    location: {
                        lat: parseFloat(camera.latitude || camera.lat),
                        lon: parseFloat(camera.longitude || camera.lng || camera.lon),
                        roadway: camera.roadway,
                        direction: camera.direction,
                        borough: this.detectBorough(camera.latitude, camera.longitude)
                    },
                    
                    urls: {
                        snapshot: camera.url || camera.snapshotUrl,
                        stream: camera.streamUrl,
                        mobile: camera.mobileUrl
                    },
                    
                    metadata: {
                        owner: camera.owner || '511NY',
                        last_update: this.parseTimestamp(camera.lastUpdate),
                        resolution: camera.resolution,
                        has_video: camera.hasVideo || false
                    }
                };
            } catch (error) {
                this.logger.warn('Failed to transform camera', {
                    cameraId: camera.id,
                    error: error.message
                });
                return null;
            }
        }).filter(camera => camera !== null);
    }

    /**
     * Transform traffic alerts
     */
    transformAlerts(alerts) {
        if (!Array.isArray(alerts)) return [];

        return alerts.map(alert => {
            try {
                return {
                    id: alert.id || this.generateId('alert'),
                    type: alert.type || 'traffic_alert',
                    priority: this.normalizePriority(alert.priority),
                    
                    affected_routes: alert.routes || [],
                    affected_area: {
                        description: alert.area,
                        bounds: alert.bounds,
                        boroughs: this.extractBoroughs(alert.area)
                    },
                    
                    timing: {
                        issued: this.parseTimestamp(alert.issuedTime),
                        effective: this.parseTimestamp(alert.effectiveTime),
                        expires: this.parseTimestamp(alert.expiryTime)
                    },
                    
                    message: {
                        headline: alert.headline || alert.title,
                        description: alert.description,
                        instruction: alert.instruction
                    },
                    
                    source: alert.source || '511NY',
                    url: alert.url
                };
            } catch (error) {
                this.logger.warn('Failed to transform alert', {
                    alertId: alert.id,
                    error: error.message
                });
                return null;
            }
        }).filter(alert => alert !== null);
    }

    /**
     * Transform message sign data
     */
    transformMessageSigns(signs) {
        if (!Array.isArray(signs)) return [];

        return signs.map(sign => {
            try {
                return {
                    id: sign.id || sign.signId,
                    name: sign.name || sign.location,
                    status: sign.status || 'unknown',
                    
                    location: {
                        lat: parseFloat(sign.latitude || sign.lat),
                        lon: parseFloat(sign.longitude || sign.lng || sign.lon),
                        roadway: sign.roadway,
                        direction: sign.direction,
                        borough: this.detectBorough(sign.latitude, sign.longitude)
                    },
                    
                    message: {
                        current: sign.message || sign.currentMessage,
                        lines: sign.messageLines || [],
                        type: sign.messageType,
                        priority: sign.messagePriority
                    },
                    
                    metadata: {
                        last_update: this.parseTimestamp(sign.lastUpdate),
                        owner: sign.owner,
                        type: sign.signType
                    }
                };
            } catch (error) {
                this.logger.warn('Failed to transform message sign', {
                    signId: sign.id,
                    error: error.message
                });
                return null;
            }
        }).filter(sign => sign !== null);
    }

    /**
     * Transform winter road conditions
     */
    transformWinterConditions(conditions) {
        if (!conditions || !Array.isArray(conditions)) return null;

        return conditions.map(condition => {
            try {
                return {
                    id: condition.id || this.generateId('winter'),
                    roadway: condition.roadway,
                    
                    conditions: {
                        surface: condition.surfaceCondition,
                        visibility: condition.visibility,
                        temperature: condition.temperature,
                        precipitation: condition.precipitation
                    },
                    
                    treatment: {
                        status: condition.treatmentStatus,
                        type: condition.treatmentType,
                        last_treated: this.parseTimestamp(condition.lastTreated)
                    },
                    
                    location: {
                        from: condition.from,
                        to: condition.to,
                        borough: this.detectBoroughFromRoad(condition.roadway)
                    },
                    
                    reported: this.parseTimestamp(condition.reportedTime)
                };
            } catch (error) {
                this.logger.warn('Failed to transform winter condition', {
                    error: error.message
                });
                return null;
            }
        }).filter(condition => condition !== null);
    }

    /**
     * Calculate aggregated metrics
     */
    calculateMetrics(data) {
        // Count totals
        data.metrics.totalEvents = data.events.length;
        data.metrics.totalCameras = data.cameras.length;
        data.metrics.totalAlerts = data.alerts.length;
        data.metrics.activeSigns = data.messageSigns.filter(s => s.status === 'active').length;

        // Severity breakdown
        data.metrics.severityBreakdown = data.events.reduce((acc, event) => {
            acc[event.severity] = (acc[event.severity] || 0) + 1;
            return acc;
        }, {});

        // Average speeds by borough
        const speedsByBorough = {};
        data.events.forEach(event => {
            if (event.impact.speed && event.location.borough) {
                if (!speedsByBorough[event.location.borough]) {
                    speedsByBorough[event.location.borough] = [];
                }
                speedsByBorough[event.location.borough].push(event.impact.speed);
            }
        });

        data.metrics.averageSpeeds = Object.entries(speedsByBorough).reduce((acc, [borough, speeds]) => {
            acc[borough] = speeds.reduce((sum, speed) => sum + speed, 0) / speeds.length;
            return acc;
        }, {});

        // Congestion levels
        data.metrics.congestionLevels = Object.entries(data.metrics.averageSpeeds).reduce((acc, [borough, avgSpeed]) => {
            acc[borough] = this.calculateCongestionLevel(avgSpeed);
            return acc;
        }, {});
    }

    /**
     * Identify traffic hotspots
     */
    identifyHotspots(data) {
        // Group events by proximity
        const hotspots = [];
        const radius = 0.5; // km

        data.events.forEach(event => {
            if (!event.location.lat || !event.location.lon) return;

            let added = false;
            for (const hotspot of hotspots) {
                const distance = this.calculateDistance(
                    event.location.lat, event.location.lon,
                    hotspot.center.lat, hotspot.center.lon
                );

                if (distance <= radius) {
                    hotspot.events.push(event);
                    added = true;
                    break;
                }
            }

            if (!added) {
                hotspots.push({
                    center: { lat: event.location.lat, lon: event.location.lon },
                    events: [event],
                    severity: event.severity
                });
            }
        });

        // Update hotspot severity based on event count
        data.geoSummary.eventHotspots = hotspots
            .filter(h => h.events.length >= 2)
            .map(hotspot => ({
                center: hotspot.center,
                eventCount: hotspot.events.length,
                severity: this.calculateHotspotSeverity(hotspot.events),
                types: [...new Set(hotspot.events.map(e => e.type))]
            }))
            .sort((a, b) => b.eventCount - a.eventCount);

        // Identify congested areas
        data.geoSummary.congestedAreas = Object.entries(data.metrics.congestionLevels)
            .filter(([_, level]) => ['heavy', 'severe'].includes(level))
            .map(([borough, level]) => ({ borough, level }));
    }

    // Helper methods

    normalizeEventType(type) {
        const typeMap = {
            'accident': 'accident',
            'incident': 'accident',
            'construction': 'construction',
            'roadwork': 'construction',
            'special_event': 'special_event',
            'weather': 'weather',
            'congestion': 'congestion'
        };
        
        return typeMap[type?.toLowerCase()] || 'other';
    }

    normalizeSeverity(severity) {
        const severityMap = {
            'major': 'major',
            'moderate': 'moderate',
            'minor': 'minor',
            'severe': 'severe',
            'high': 'major',
            'medium': 'moderate',
            'low': 'minor'
        };
        
        return severityMap[severity?.toLowerCase()] || 'unknown';
    }

    normalizePriority(priority) {
        const priorityMap = {
            'high': 'high',
            'medium': 'medium',
            'low': 'low',
            'urgent': 'high',
            'normal': 'medium'
        };
        
        return priorityMap[priority?.toLowerCase()] || 'medium';
    }

    parseTimestamp(timestamp) {
        if (!timestamp) return null;
        
        try {
            const date = new Date(timestamp);
            return isNaN(date.getTime()) ? null : date.getTime();
        } catch {
            return null;
        }
    }

    detectBorough(lat, lon) {
        if (!lat || !lon) return null;
        
        const boroughBounds = {
            'Manhattan': { north: 40.882, south: 40.680, east: -73.907, west: -74.047 },
            'Brooklyn': { north: 40.739, south: 40.551, east: -73.833, west: -74.056 },
            'Queens': { north: 40.812, south: 40.489, east: -73.700, west: -73.962 },
            'Bronx': { north: 40.917, south: 40.785, east: -73.765, west: -73.933 },
            'Staten Island': { north: 40.651, south: 40.477, east: -74.034, west: -74.259 }
        };

        for (const [borough, bounds] of Object.entries(boroughBounds)) {
            if (lat >= bounds.south && lat <= bounds.north &&
                lon >= bounds.west && lon <= bounds.east) {
                return borough;
            }
        }
        
        return null;
    }

    detectBoroughFromRoad(roadway) {
        if (!roadway) return null;
        
        const roadLower = roadway.toLowerCase();
        
        if (roadLower.includes('fdr') || roadLower.includes('harlem river')) return 'Manhattan';
        if (roadLower.includes('belt') || roadLower.includes('bqe')) return 'Brooklyn';
        if (roadLower.includes('grand central') || roadLower.includes('lirr')) return 'Queens';
        if (roadLower.includes('major deegan') || roadLower.includes('bronx river')) return 'Bronx';
        if (roadLower.includes('staten island') || roadLower.includes('si ')) return 'Staten Island';
        
        return null;
    }

    extractBoroughs(areaDescription) {
        if (!areaDescription) return [];
        
        const boroughs = ['Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island'];
        const found = [];
        
        boroughs.forEach(borough => {
            if (areaDescription.toLowerCase().includes(borough.toLowerCase())) {
                found.push(borough);
            }
        });
        
        return found;
    }

    isRushHour(date) {
        const hour = date.getHours();
        const isWeekday = date.getDay() >= 1 && date.getDay() <= 5;
        
        return isWeekday && ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19));
    }

    isWeatherRelated(event) {
        if (!event) return false;
        
        const weatherKeywords = ['rain', 'snow', 'ice', 'fog', 'wind', 'storm', 'weather'];
        const text = `${event.type} ${event.description} ${event.details}`.toLowerCase();
        
        return weatherKeywords.some(keyword => text.includes(keyword));
    }

    involvesTruck(event) {
        if (!event) return false;
        
        const truckKeywords = ['truck', 'tractor', 'trailer', 'semi', 'commercial'];
        const text = `${event.description} ${event.details}`.toLowerCase();
        
        return truckKeywords.some(keyword => text.includes(keyword));
    }

    isMajorRoute(roadway) {
        if (!roadway) return false;
        
        const majorRoutes = ['I-95', 'I-278', 'I-495', 'I-678', 'FDR', 'Belt', 'BQE', 
                           'Grand Central', 'Cross Bronx', 'Staten Island Expressway'];
        
        return majorRoutes.some(route => roadway.toUpperCase().includes(route.toUpperCase()));
    }

    calculateCongestionLevel(avgSpeed) {
        if (avgSpeed < 10) return 'severe';
        if (avgSpeed < 20) return 'heavy';
        if (avgSpeed < 30) return 'moderate';
        if (avgSpeed < 40) return 'light';
        return 'free-flow';
    }

    calculateHotspotSeverity(events) {
        const severityScores = {
            'severe': 4,
            'major': 3,
            'moderate': 2,
            'minor': 1,
            'unknown': 0
        };
        
        const totalScore = events.reduce((sum, event) => 
            sum + (severityScores[event.severity] || 0), 0
        );
        
        const avgScore = totalScore / events.length;
        
        if (avgScore >= 3.5) return 'severe';
        if (avgScore >= 2.5) return 'major';
        if (avgScore >= 1.5) return 'moderate';
        return 'minor';
    }

    calculateDistance(lat1, lon1, lat2, lon2) {
        // Haversine formula for distance between two points
        const R = 6371; // Earth's radius in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const d = R * c;
        return d;
    }

    generateId(prefix) {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

module.exports = TrafficTransformer;