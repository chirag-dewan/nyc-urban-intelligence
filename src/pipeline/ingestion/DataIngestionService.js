// src/pipeline/ingestion/DataIngestionService.js
const EventEmitter = require('events');
const MessageQueue = require('./MessageQueue');
const { getLogger } = require('../../utils/Logger');

/**
 * Central data ingestion service that coordinates all connectors
 * and manages the flow of data into the processing pipeline
 */
class DataIngestionService extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            maxConcurrentConnectors: 10,
            healthCheckInterval: 60000, // 1 minute
            restartUnhealthyConnectors: true,
            deadLetterQueueEnabled: true,
            ...config
        };
        
        this.logger = getLogger('DataIngestionService');
        this.messageQueue = new MessageQueue(config.messageQueue);
        this.connectors = new Map();
        this.isRunning = false;
        this.healthCheckTimer = null;
        
        this.metrics = {
            connectorsRegistered: 0,
            connectorsRunning: 0,
            totalDataReceived: 0,
            totalErrorsHandled: 0,
            lastHealthCheck: null,
            startTime: null
        };

        this.setupMessageQueue();
    }

    /**
     * Setup message queue event handlers
     */
    setupMessageQueue() {
        this.messageQueue.on('published', ({ topic, messageId }) => {
            this.logger.debug('Data published to queue', { topic, messageId });
        });

        this.messageQueue.on('error', (error) => {
            this.logger.error('Message queue error', { error: error.message });
            this.emit('error', error);
        });
    }

    /**
     * Register a data connector
     */
    registerConnector(name, connector) {
        if (this.connectors.has(name)) {
            throw new Error(`Connector ${name} is already registered`);
        }

        // Setup connector event handlers
        connector.on('data', (data) => {
            this.handleConnectorData(name, data);
        });

        connector.on('error', (error) => {
            this.handleConnectorError(name, error);
        });

        connector.on('start', () => {
            this.logger.info('Connector started', { connector: name });
            this.metrics.connectorsRunning++;
            this.emit('connectorStarted', name);
        });

        connector.on('stop', () => {
            this.logger.info('Connector stopped', { connector: name });
            this.metrics.connectorsRunning = Math.max(0, this.metrics.connectorsRunning - 1);
            this.emit('connectorStopped', name);
        });

        this.connectors.set(name, {
            connector,
            name,
            registeredAt: Date.now(),
            lastDataReceived: null,
            errorCount: 0,
            dataCount: 0,
            isHealthy: true
        });

        this.metrics.connectorsRegistered++;
        
        this.logger.info('Connector registered', { 
            connector: name,
            type: connector.constructor.name
        });

        this.emit('connectorRegistered', name);
    }

    /**
     * Unregister a connector
     */
    unregisterConnector(name) {
        const connectorInfo = this.connectors.get(name);
        if (!connectorInfo) {
            this.logger.warn('Attempted to unregister unknown connector', { connector: name });
            return false;
        }

        // Stop connector if running
        if (connectorInfo.connector.isRunning) {
            connectorInfo.connector.stop();
        }

        this.connectors.delete(name);
        this.metrics.connectorsRegistered--;
        
        this.logger.info('Connector unregistered', { connector: name });
        this.emit('connectorUnregistered', name);
        
        return true;
    }

    /**
     * Start the ingestion service and all registered connectors
     */
    async start() {
        if (this.isRunning) {
            this.logger.warn('Data ingestion service is already running');
            return;
        }

        this.logger.info('Starting data ingestion service');
        this.isRunning = true;
        this.metrics.startTime = Date.now();

        // Start all registered connectors
        const startPromises = [];
        for (const [name, connectorInfo] of this.connectors) {
            try {
                connectorInfo.connector.start();
                this.logger.info('Started connector', { connector: name });
            } catch (error) {
                this.logger.error('Failed to start connector', {
                    connector: name,
                    error: error.message
                });
                connectorInfo.isHealthy = false;
            }
        }

        // Start health checking
        this.startHealthChecking();

        this.logger.info('Data ingestion service started', {
            connectorsRegistered: this.metrics.connectorsRegistered
        });
        
        this.emit('started');
    }

    /**
     * Stop the ingestion service and all connectors
     */
    async stop() {
        if (!this.isRunning) {
            this.logger.warn('Data ingestion service is not running');
            return;
        }

        this.logger.info('Stopping data ingestion service');
        this.isRunning = false;

        // Stop health checking
        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
            this.healthCheckTimer = null;
        }

        // Stop all connectors
        const stopPromises = [];
        for (const [name, connectorInfo] of this.connectors) {
            try {
                connectorInfo.connector.stop();
                this.logger.info('Stopped connector', { connector: name });
            } catch (error) {
                this.logger.error('Failed to stop connector', {
                    connector: name,
                    error: error.message
                });
            }
        }

        // Close message queue
        await this.messageQueue.close();

        this.logger.info('Data ingestion service stopped');
        this.emit('stopped');
    }

    /**
     * Handle data received from a connector
     */
    async handleConnectorData(connectorName, data) {
        const connectorInfo = this.connectors.get(connectorName);
        if (!connectorInfo) {
            this.logger.warn('Received data from unknown connector', { connector: connectorName });
            return;
        }

        try {
            // Update connector metrics
            connectorInfo.lastDataReceived = Date.now();
            connectorInfo.dataCount++;
            connectorInfo.isHealthy = true;
            this.metrics.totalDataReceived++;

            // Enrich data with ingestion metadata
            const enrichedData = {
                ...data,
                ingestion: {
                    connector: connectorName,
                    receivedAt: Date.now(),
                    serviceVersion: '1.0.0',
                    messageId: this.generateMessageId()
                }
            };

            // Validate data before publishing
            if (this.validateData(enrichedData)) {
                await this.messageQueue.publishRawData(enrichedData, connectorName);
                
                this.logger.debug('Data ingested successfully', {
                    connector: connectorName,
                    dataSize: JSON.stringify(enrichedData).length,
                    messageId: enrichedData.ingestion.messageId
                });

                this.emit('dataIngested', {
                    connector: connectorName,
                    data: enrichedData,
                    timestamp: Date.now()
                });
            } else {
                throw new Error('Data validation failed');
            }

        } catch (error) {
            this.handleConnectorError(connectorName, error, data);
        }
    }

    /**
     * Handle errors from connectors
     */
    handleConnectorError(connectorName, error, data = null) {
        const connectorInfo = this.connectors.get(connectorName);
        if (connectorInfo) {
            connectorInfo.errorCount++;
            
            // Mark as unhealthy if too many errors
            if (connectorInfo.errorCount > 5) {
                connectorInfo.isHealthy = false;
            }
        }

        this.metrics.totalErrorsHandled++;

        this.logger.error('Connector error handled', {
            connector: connectorName,
            error: error.message,
            hasData: !!data
        });

        // Send to dead letter queue if enabled
        if (this.config.deadLetterQueueEnabled && data) {
            this.sendToDeadLetterQueue(connectorName, error, data);
        }

        this.emit('connectorError', {
            connector: connectorName,
            error,
            data,
            timestamp: Date.now()
        });
    }

    /**
     * Validate incoming data
     */
    validateData(data) {
        // Basic validation - extend as needed
        if (!data || typeof data !== 'object') {
            this.logger.warn('Invalid data format - not an object');
            return false;
        }

        if (!data.timestamp || !data.source) {
            this.logger.warn('Missing required fields in data', {
                hasTimestamp: !!data.timestamp,
                hasSource: !!data.source
            });
            return false;
        }

        // Check timestamp is reasonable (within last hour to 1 minute in future)
        const now = Date.now();
        const oneHourAgo = now - (60 * 60 * 1000);
        const oneMinuteFromNow = now + (60 * 1000);
        
        if (data.timestamp < oneHourAgo || data.timestamp > oneMinuteFromNow) {
            this.logger.warn('Data timestamp is outside acceptable range', {
                timestamp: data.timestamp,
                now,
                timeDiff: data.timestamp - now
            });
            return false;
        }

        return true;
    }

    /**
     * Send failed data to dead letter queue
     */
    async sendToDeadLetterQueue(connectorName, error, data) {
        try {
            const deadLetterData = {
                originalData: data,
                error: {
                    message: error.message,
                    stack: error.stack,
                    timestamp: Date.now()
                },
                connector: connectorName,
                failureTime: Date.now()
            };

            await this.messageQueue.publish('dead-letter-queue', deadLetterData, {
                source: 'data-ingestion-service',
                errorType: 'ingestion-failure'
            });

            this.logger.info('Data sent to dead letter queue', {
                connector: connectorName,
                errorMessage: error.message
            });

        } catch (dlqError) {
            this.logger.error('Failed to send data to dead letter queue', {
                connector: connectorName,
                originalError: error.message,
                dlqError: dlqError.message
            });
        }
    }

    /**
     * Start periodic health checking
     */
    startHealthChecking() {
        this.healthCheckTimer = setInterval(() => {
            this.performHealthCheck();
        }, this.config.healthCheckInterval);
    }

    /**
     * Perform health check on all connectors
     */
    async performHealthCheck() {
        this.metrics.lastHealthCheck = Date.now();
        
        for (const [name, connectorInfo] of this.connectors) {
            try {
                const health = connectorInfo.connector.getHealth();
                const timeSinceLastData = connectorInfo.lastDataReceived ? 
                    Date.now() - connectorInfo.lastDataReceived : null;

                // Check if connector should be considered unhealthy
                const isUnhealthy = 
                    health.status === 'unhealthy' ||
                    health.status === 'circuit_breaker_open' ||
                    (timeSinceLastData && timeSinceLastData > 300000); // 5 minutes

                if (isUnhealthy && connectorInfo.isHealthy) {
                    connectorInfo.isHealthy = false;
                    this.logger.warn('Connector marked as unhealthy', {
                        connector: name,
                        healthStatus: health.status,
                        timeSinceLastData
                    });

                    // Restart if configured to do so
                    if (this.config.restartUnhealthyConnectors) {
                        this.restartConnector(name);
                    }
                }

                // Mark as healthy if it's recovered
                if (!isUnhealthy && !connectorInfo.isHealthy) {
                    connectorInfo.isHealthy = true;
                    this.logger.info('Connector recovered', { connector: name });
                }

            } catch (error) {
                this.logger.error('Health check failed for connector', {
                    connector: name,
                    error: error.message
                });
            }
        }
    }

    /**
     * Restart an unhealthy connector
     */
    async restartConnector(name) {
        const connectorInfo = this.connectors.get(name);
        if (!connectorInfo) return;

        try {
            this.logger.info('Restarting unhealthy connector', { connector: name });
            
            connectorInfo.connector.stop();
            
            // Wait a bit before restarting
            setTimeout(() => {
                try {
                    connectorInfo.connector.start();
                    connectorInfo.errorCount = 0; // Reset error count
                    this.logger.info('Connector restarted successfully', { connector: name });
                } catch (error) {
                    this.logger.error('Failed to restart connector', {
                        connector: name,
                        error: error.message
                    });
                }
            }, 5000); // 5 second delay

        } catch (error) {
            this.logger.error('Failed to restart connector', {
                connector: name,
                error: error.message
            });
        }
    }

    /**
     * Get comprehensive service status
     */
    getStatus() {
        const connectorStatuses = {};
        
        for (const [name, connectorInfo] of this.connectors) {
            connectorStatuses[name] = {
                isHealthy: connectorInfo.isHealthy,
                dataCount: connectorInfo.dataCount,
                errorCount: connectorInfo.errorCount,
                lastDataReceived: connectorInfo.lastDataReceived,
                registeredAt: connectorInfo.registeredAt,
                connectorStatus: connectorInfo.connector.getStatus()
            };
        }

        return {
            isRunning: this.isRunning,
            metrics: { ...this.metrics },
            connectors: connectorStatuses,
            messageQueue: this.messageQueue.getStats(),
            uptime: this.metrics.startTime ? Date.now() - this.metrics.startTime : 0
        };
    }

    /**
     * Get service health
     */
    async getHealth() {
        const unhealthyConnectors = [];
        let totalConnectors = 0;
        let healthyConnectors = 0;

        for (const [name, connectorInfo] of this.connectors) {
            totalConnectors++;
            if (connectorInfo.isHealthy) {
                healthyConnectors++;
            } else {
                unhealthyConnectors.push(name);
            }
        }

        const messageQueueHealth = await this.messageQueue.healthCheck();
        
        let overallStatus = 'healthy';
        if (!this.isRunning || !messageQueueHealth.connected) {
            overallStatus = 'critical';
        } else if (unhealthyConnectors.length > totalConnectors / 2) {
            overallStatus = 'degraded';
        } else if (unhealthyConnectors.length > 0) {
            overallStatus = 'warning';
        }

        return {
            status: overallStatus,
            isRunning: this.isRunning,
            totalConnectors,
            healthyConnectors,
            unhealthyConnectors,
            messageQueue: messageQueueHealth,
            lastHealthCheck: this.metrics.lastHealthCheck
        };
    }

    /**
     * Generate unique message ID
     */
    generateMessageId() {
        return `ing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

module.exports = DataIngestionService;