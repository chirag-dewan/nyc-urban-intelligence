// src/utils/Logger.js
const winston = require('winston');
const path = require('path');

/**
 * Centralized logging utility for the urban intelligence platform
 */
class Logger {
    constructor(component = 'app') {
        this.component = component;
        this.logger = this.createLogger();
    }

    createLogger() {
        const logFormat = winston.format.combine(
            winston.format.timestamp(),
            winston.format.errors({ stack: true }),
            winston.format.json(),
            winston.format.printf(({ timestamp, level, message, component, ...meta }) => {
                const logObj = {
                    timestamp,
                    level,
                    component: component || this.component,
                    message,
                    ...meta
                };
                return JSON.stringify(logObj);
            })
        );

        const consoleFormat = winston.format.combine(
            winston.format.colorize(),
            winston.format.timestamp({ format: 'HH:mm:ss' }),
            winston.format.printf(({ timestamp, level, message, component, ...meta }) => {
                const comp = component || this.component;
                const metaStr = Object.keys(meta).length > 0 ? 
                    `\n${JSON.stringify(meta, null, 2)}` : '';
                return `${timestamp} [${comp}] ${level}: ${message}${metaStr}`;
            })
        );

        const transports = [
            // Console output
            new winston.transports.Console({
                format: consoleFormat,
                level: process.env.LOG_LEVEL || 'info'
            })
        ];

        // Add file transports in production
        if (process.env.NODE_ENV === 'production') {
            transports.push(
                // Error logs
                new winston.transports.File({
                    filename: path.join('data', 'logs', 'error.log'),
                    level: 'error',
                    format: logFormat,
                    maxsize: 5242880, // 5MB
                    maxFiles: 5
                }),
                // Combined logs
                new winston.transports.File({
                    filename: path.join('data', 'logs', 'combined.log'),
                    format: logFormat,
                    maxsize: 5242880, // 5MB
                    maxFiles: 10
                })
            );
        }

        return winston.createLogger({
            transports,
            // Don't exit on handled exceptions
            exitOnError: false,
            // Default metadata
            defaultMeta: { component: this.component }
        });
    }

    debug(message, meta = {}) {
        this.logger.debug(message, meta);
    }

    info(message, meta = {}) {
        this.logger.info(message, meta);
    }

    warn(message, meta = {}) {
        this.logger.warn(message, meta);
    }

    error(message, meta = {}) {
        this.logger.error(message, meta);
    }

    // Structured logging methods for common patterns
    apiRequest(method, url, statusCode, responseTime, meta = {}) {
        this.info('API request', {
            type: 'api_request',
            method,
            url,
            statusCode,
            responseTime,
            ...meta
        });
    }

    dataFetch(source, recordCount, duration, meta = {}) {
        this.info('Data fetch completed', {
            type: 'data_fetch',
            source,
            recordCount,
            duration,
            ...meta
        });
    }

    prediction(modelName, inputSize, confidence, duration, meta = {}) {
        this.info('Prediction generated', {
            type: 'prediction',
            modelName,
            inputSize,
            confidence,
            duration,
            ...meta
        });
    }

    alert(alertType, severity, description, meta = {}) {
        this.warn('System alert', {
            type: 'system_alert',
            alertType,
            severity,
            description,
            ...meta
        });
    }

    performance(operation, duration, success, meta = {}) {
        const level = success ? 'info' : 'warn';
        this.logger[level]('Performance metric', {
            type: 'performance',
            operation,
            duration,
            success,
            ...meta
        });
    }
}

// Singleton pattern for application-wide logger
class LoggerFactory {
    constructor() {
        this.loggers = new Map();
    }

    getLogger(component = 'app') {
        if (!this.loggers.has(component)) {
            this.loggers.set(component, new Logger(component));
        }
        return this.loggers.get(component);
    }

    // Create a logger for a specific request/session
    createRequestLogger(requestId, component = 'app') {
        const logger = new Logger(component);
        // Add request ID to all log entries
        const originalLog = logger.logger.log;
        logger.logger.log = function(level, message, meta = {}) {
            return originalLog.call(this, level, message, { 
                requestId, 
                ...meta 
            });
        };
        return logger;
    }
}

const loggerFactory = new LoggerFactory();

module.exports = {
    Logger,
    LoggerFactory,
    getLogger: (component) => loggerFactory.getLogger(component),
    createRequestLogger: (requestId, component) => 
        loggerFactory.createRequestLogger(requestId, component)
};