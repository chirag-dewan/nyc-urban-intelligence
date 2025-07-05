// src/connectors/base/BaseConnector.js
const EventEmitter = require('events');
const { Logger } = require('../../utils/Logger');

/**
 * Base connector class that all data source connectors must extend
 * Provides common functionality for error handling, circuit breakers, and monitoring
 */
class BaseConnector extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            pollInterval: 30000,        // 30 seconds default
            maxRetries: 3,              // Max retry attempts
            retryDelay: 5000,           // Delay between retries
            circuitBreakerTimeout: 60000, // 1 minute circuit breaker timeout
            timeout: 10000,             // 10 second request timeout
            ...config
        };
        
        this.isRunning = false;
        this.retryCount = 0;
        this.circuitBreakerOpen = false;
        this.lastPollTime = null;
        this.lastSuccessTime = null;
        this.pollTimer = null;
        this.circuitBreakerTimer = null;
        
        this.logger = new Logger(`connector:${this.constructor.name}`);
        this.metrics = {
            totalFetches: 0,
            successfulFetches: 0,
            failedFetches: 0,
            avgResponseTime: 0,
            lastFetchTime: null
        };
    }

    /**
     * Abstract method - must be implemented by subclasses
     * Should return transformed data or null on failure
     */
    async fetchData() {
        throw new Error('fetchData() must be implemented by subclass');
    }

    /**
     * Abstract method - must be implemented by subclasses
     * Should return connector-specific status information
     */
    getConnectorStatus() {
        throw new Error('getConnectorStatus() must be implemented by subclass');
    }

    /**
     * Start the connector polling loop
     */
    start() {
        if (this.isRunning) {
            this.logger.warn('Connector is already running');
            return;
        }

        this.isRunning = true;
        this.logger.info('Starting connector');
        this.emit('start');
        
        this.pollData();
    }

    /**
     * Stop the connector
     */
    stop() {
        if (!this.isRunning) {
            this.logger.warn('Connector is not running');
            return;
        }

        this.isRunning = false;
        
        if (this.pollTimer) {
            clearTimeout(this.pollTimer);
            this.pollTimer = null;
        }
        
        if (this.circuitBreakerTimer) {
            clearTimeout(this.circuitBreakerTimer);
            this.circuitBreakerTimer = null;
        }
        
        this.logger.info('Connector stopped');
        this.emit('stop');
    }

    /**
     * Main polling loop
     */
    async pollData() {
        if (!this.isRunning) return;

        const startTime = Date.now();
        this.lastPollTime = startTime;
        this.metrics.totalFetches++;

        try {
            if (this.circuitBreakerOpen) {
                this.logger.debug('Circuit breaker is open, skipping fetch');
                this.schedulNextPoll();
                return;
            }

            const data = await this.fetchData();
            const responseTime = Date.now() - startTime;
            
            this.handleSuccessfulFetch(data, responseTime);
            
        } catch (error) {
            const responseTime = Date.now() - startTime;
            this.handleFailedFetch(error, responseTime);
        }

        this.schedulNextPoll();
    }

    /**
     * Handle successful data fetch
     */
    handleSuccessfulFetch(data, responseTime) {
        this.metrics.successfulFetches++;
        this.metrics.avgResponseTime = this.updateAvgResponseTime(responseTime);
        this.metrics.lastFetchTime = Date.now();
        
        this.lastSuccessTime = Date.now();
        this.retryCount = 0;
        
        if (this.circuitBreakerOpen) {
            this.closeCircuitBreaker();
        }
        
        if (data) {
            this.logger.debug('Data fetched successfully', { 
                responseTime, 
                dataSize: JSON.stringify(data).length 
            });
            this.emit('data', data);
        }
    }

    /**
     * Handle failed data fetch
     */
    handleFailedFetch(error, responseTime) {
        this.metrics.failedFetches++;
        this.retryCount++;
        
        this.logger.error('Failed to fetch data', {
            error: error.message,
            responseTime,
            retryCount: this.retryCount
        });
        
        if (this.retryCount >= this.config.maxRetries) {
            this.openCircuitBreaker();
        }
        
        this.emit('error', error);
    }

    /**
     * Open circuit breaker
     */
    openCircuitBreaker() {
        if (this.circuitBreakerOpen) return;
        
        this.circuitBreakerOpen = true;
        this.logger.warn('Circuit breaker opened due to repeated failures');
        
        this.circuitBreakerTimer = setTimeout(() => {
            this.closeCircuitBreaker();
        }, this.config.circuitBreakerTimeout);
        
        this.emit('circuitBreakerOpen');
    }

    /**
     * Close circuit breaker
     */
    closeCircuitBreaker() {
        if (!this.circuitBreakerOpen) return;
        
        this.circuitBreakerOpen = false;
        this.retryCount = 0;
        
        if (this.circuitBreakerTimer) {
            clearTimeout(this.circuitBreakerTimer);
            this.circuitBreakerTimer = null;
        }
        
        this.logger.info('Circuit breaker closed, resuming normal operation');
        this.emit('circuitBreakerClosed');
    }

    /**
     * Schedule next poll
     */
    schedulNextPoll() {
        if (!this.isRunning) return;
        
        const delay = this.circuitBreakerOpen ? 
            this.config.circuitBreakerTimeout : 
            this.config.pollInterval;
            
        this.pollTimer = setTimeout(() => {
            this.pollData();
        }, delay);
    }

    /**
     * Update average response time
     */
    updateAvgResponseTime(newTime) {
        const totalFetches = this.metrics.successfulFetches;
        const currentAvg = this.metrics.avgResponseTime;
        
        return ((currentAvg * (totalFetches - 1)) + newTime) / totalFetches;
    }

    /**
     * Get comprehensive connector status
     */
    getStatus() {
        return {
            name: this.constructor.name,
            isRunning: this.isRunning,
            circuitBreakerOpen: this.circuitBreakerOpen,
            retryCount: this.retryCount,
            lastPollTime: this.lastPollTime,
            lastSuccessTime: this.lastSuccessTime,
            metrics: { ...this.metrics },
            config: {
                pollInterval: this.config.pollInterval,
                maxRetries: this.config.maxRetries,
                timeout: this.config.timeout
            },
            ...this.getConnectorStatus()
        };
    }

    /**
     * Get health status
     */
    getHealth() {
        const now = Date.now();
        const timeSinceLastSuccess = this.lastSuccessTime ? 
            now - this.lastSuccessTime : null;
        
        let status = 'healthy';
        
        if (this.circuitBreakerOpen) {
            status = 'circuit_breaker_open';
        } else if (timeSinceLastSuccess && timeSinceLastSuccess > this.config.pollInterval * 3) {
            status = 'unhealthy';
        } else if (this.retryCount > 0) {
            status = 'degraded';
        }
        
        return {
            status,
            isRunning: this.isRunning,
            circuitBreakerOpen: this.circuitBreakerOpen,
            timeSinceLastSuccess,
            successRate: this.metrics.totalFetches > 0 ? 
                (this.metrics.successfulFetches / this.metrics.totalFetches) : 0
        };
    }
}

module.exports = BaseConnector;