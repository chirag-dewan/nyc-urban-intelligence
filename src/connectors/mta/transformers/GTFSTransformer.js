// src/connectors/mta/transformers/GTFSTransformer.js
const { Logger } = require('../../../utils/Logger');

/**
 * Transforms raw GTFS-realtime protobuf data into standardized format
 */
class GTFSTransformer {
    constructor() {
        this.logger = new Logger('GTFSTransformer');
    }

    /**
     * Transform raw GTFS feed data into standardized format
     * @param {Object} rawData - Raw protobuf data from MTA
     * @param {Object} metadata - Additional metadata (feedId, source, etc.)
     * @returns {Object} Transformed data
     */
    transform(rawData, metadata = {}) {
        const timestamp = Date.now();
        const entities = rawData.entity || [];
        
        const transformedData = {
            source: metadata.source || 'mta',
            feedId: metadata.feedId,
            timestamp: timestamp,
            header: this.transformHeader(rawData.header),
            vehicleUpdates: [],
            tripUpdates: [],
            alerts: [],
            summary: {
                totalEntities: entities.length,
                vehicleCount: 0,
                tripCount: 0,
                alertCount: 0
            }
        };

        // Process each entity in the feed
        entities.forEach(entity => {
            try {
                if (entity.vehicle) {
                    const vehicle = this.transformVehicleUpdate(entity.vehicle, entity.id);
                    if (vehicle) {
                        transformedData.vehicleUpdates.push(vehicle);
                        transformedData.summary.vehicleCount++;
                    }
                }

                if (entity.tripUpdate) {
                    const trip = this.transformTripUpdate(entity.tripUpdate, entity.id);
                    if (trip) {
                        transformedData.tripUpdates.push(trip);
                        transformedData.summary.tripCount++;
                    }
                }

                if (entity.alert) {
                    const alert = this.transformAlert(entity.alert, entity.id);
                    if (alert) {
                        transformedData.alerts.push(alert);
                        transformedData.summary.alertCount++;
                    }
                }
            } catch (error) {
                this.logger.warn('Failed to transform entity', {
                    entityId: entity.id,
                    error: error.message
                });
            }
        });

        this.logger.debug('Data transformation completed', {
            totalEntities: transformedData.summary.totalEntities,
            vehicles: transformedData.summary.vehicleCount,
            trips: transformedData.summary.tripCount,
            alerts: transformedData.summary.alertCount
        });

        return transformedData;
    }

    /**
     * Transform feed header information
     */
    transformHeader(header) {
        if (!header) return null;

        return {
            gtfsRealtimeVersion: header.gtfsRealtimeVersion,
            incrementality: header.incrementality,
            timestamp: header.timestamp ? parseInt(header.timestamp) * 1000 : null
        };
    }

    /**
     * Transform vehicle position update
     */
    transformVehicleUpdate(vehicle, entityId) {
        if (!vehicle) return null;

        return {
            id: entityId,
            vehicle: {
                id: vehicle.vehicle?.id,
                label: vehicle.vehicle?.label,
                licensePlate: vehicle.vehicle?.licensePlate
            },
            trip: vehicle.trip ? {
                tripId: vehicle.trip.tripId,
                routeId: vehicle.trip.routeId,
                directionId: vehicle.trip.directionId,
                startTime: vehicle.trip.startTime,
                startDate: vehicle.trip.startDate
            } : null,
            position: vehicle.position ? {
                latitude: vehicle.position.latitude,
                longitude: vehicle.position.longitude,
                bearing: vehicle.position.bearing,
                speed: vehicle.position.speed
            } : null,
            currentStopSequence: vehicle.currentStopSequence,
            currentStatus: this.mapVehicleStatus(vehicle.currentStatus),
            timestamp: vehicle.timestamp ? parseInt(vehicle.timestamp) * 1000 : null,
            stopId: vehicle.stopId,
            congestionLevel: this.mapCongestionLevel(vehicle.congestionLevel),
            occupancyStatus: this.mapOccupancyStatus(vehicle.occupancyStatus)
        };
    }

    /**
     * Transform trip update
     */
    transformTripUpdate(tripUpdate, entityId) {
        if (!tripUpdate) return null;

        return {
            id: entityId,
            trip: tripUpdate.trip ? {
                tripId: tripUpdate.trip.tripId,
                routeId: tripUpdate.trip.routeId,
                directionId: tripUpdate.trip.directionId,
                startTime: tripUpdate.trip.startTime,
                startDate: tripUpdate.trip.startDate
            } : null,
            vehicle: tripUpdate.vehicle ? {
                id: tripUpdate.vehicle.id,
                label: tripUpdate.vehicle.label
            } : null,
            stopTimeUpdates: (tripUpdate.stopTimeUpdate || []).map(stu => 
                this.transformStopTimeUpdate(stu)
            ),
            timestamp: tripUpdate.timestamp ? parseInt(tripUpdate.timestamp) * 1000 : null,
            delay: tripUpdate.delay || 0
        };
    }

    /**
     * Transform stop time update
     */
    transformStopTimeUpdate(stopTimeUpdate) {
        if (!stopTimeUpdate) return null;

        return {
            stopSequence: stopTimeUpdate.stopSequence,
            stopId: stopTimeUpdate.stopId,
            arrival: stopTimeUpdate.arrival ? {
                delay: stopTimeUpdate.arrival.delay || 0,
                time: stopTimeUpdate.arrival.time ? 
                    parseInt(stopTimeUpdate.arrival.time) * 1000 : null,
                uncertainty: stopTimeUpdate.arrival.uncertainty
            } : null,
            departure: stopTimeUpdate.departure ? {
                delay: stopTimeUpdate.departure.delay || 0,
                time: stopTimeUpdate.departure.time ? 
                    parseInt(stopTimeUpdate.departure.time) * 1000 : null,
                uncertainty: stopTimeUpdate.departure.uncertainty
            } : null,
            scheduleRelationship: this.mapScheduleRelationship(
                stopTimeUpdate.scheduleRelationship
            )
        };
    }

    /**
     * Transform service alert
     */
    transformAlert(alert, entityId) {
        if (!alert) return null;

        return {
            id: entityId,
            activePeriods: (alert.activePeriod || []).map(period => ({
                start: period.start ? parseInt(period.start) * 1000 : null,
                end: period.end ? parseInt(period.end) * 1000 : null
            })),
            informedEntities: (alert.informedEntity || []).map(entity => ({
                agencyId: entity.agencyId,
                routeId: entity.routeId,
                routeType: entity.routeType,
                trip: entity.trip ? {
                    tripId: entity.trip.tripId,
                    routeId: entity.trip.routeId,
                    directionId: entity.trip.directionId
                } : null,
                stopId: entity.stopId
            })),
            cause: this.mapAlertCause(alert.cause),
            effect: this.mapAlertEffect(alert.effect),
            url: this.extractTranslatedText(alert.url),
            headerText: this.extractTranslatedText(alert.headerText),
            descriptionText: this.extractTranslatedText(alert.descriptionText),
            severityLevel: this.mapSeverityLevel(alert.severityLevel)
        };
    }

    /**
     * Extract text from translated text object
     */
    extractTranslatedText(translatedText) {
        if (!translatedText || !translatedText.translation) return null;
        
        // Return first available translation (usually English)
        const firstTranslation = translatedText.translation[0];
        return firstTranslation ? firstTranslation.text : null;
    }

    /**
     * Map vehicle status enum to readable string
     */
    mapVehicleStatus(status) {
        const statusMap = {
            0: 'incoming_at',
            1: 'stopped_at',
            2: 'in_transit_to'
        };
        return statusMap[status] || 'unknown';
    }

    /**
     * Map congestion level enum to readable string
     */
    mapCongestionLevel(level) {
        const levelMap = {
            0: 'unknown',
            1: 'running_smoothly',
            2: 'stop_and_go',
            3: 'congestion',
            4: 'severe_congestion'
        };
        return levelMap[level] || 'unknown';
    }

    /**
     * Map occupancy status enum to readable string
     */
    mapOccupancyStatus(status) {
        const statusMap = {
            0: 'empty',
            1: 'many_seats_available',
            2: 'few_seats_available',
            3: 'standing_room_only',
            4: 'crushed_standing_room_only',
            5: 'full',
            6: 'not_accepting_passengers'
        };
        return statusMap[status] || 'unknown';
    }

    /**
     * Map schedule relationship enum to readable string
     */
    mapScheduleRelationship(relationship) {
        const relationshipMap = {
            0: 'scheduled',
            1: 'skipped',
            2: 'no_data',
            3: 'unscheduled'
        };
        return relationshipMap[relationship] || 'scheduled';
    }

    /**
     * Map alert cause enum to readable string
     */
    mapAlertCause(cause) {
        const causeMap = {
            1: 'unknown_cause',
            2: 'other_cause',
            3: 'technical_problem',
            4: 'strike',
            5: 'demonstration',
            6: 'accident',
            7: 'holiday',
            8: 'weather',
            9: 'maintenance',
            10: 'construction',
            11: 'police_activity',
            12: 'medical_emergency'
        };
        return causeMap[cause] || 'unknown_cause';
    }

    /**
     * Map alert effect enum to readable string
     */
    mapAlertEffect(effect) {
        const effectMap = {
            1: 'no_service',
            2: 'reduced_service',
            3: 'significant_delays',
            4: 'detour',
            5: 'additional_service',
            6: 'modified_service',
            7: 'other_effect',
            8: 'unknown_effect',
            9: 'stop_moved',
            10: 'no_effect',
            11: 'accessibility_issue'
        };
        return effectMap[effect] || 'unknown_effect';
    }

    /**
     * Map severity level enum to readable string
     */
    mapSeverityLevel(level) {
        const levelMap = {
            1: 'info',
            2: 'warning',
            3: 'severe'
        };
        return levelMap[level] || 'info';
    }
}

module.exports = GTFSTransformer;