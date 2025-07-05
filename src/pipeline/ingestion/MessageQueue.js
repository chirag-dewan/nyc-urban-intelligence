// src/pipeline/ingestion/MessageQueue.js
const kafka = require('kafka-node');
const EventEmitter = require('events');
const { getLogger } = require('../../utils/Logger');

/**
 * Message Queue abstraction layer for data pipeline
 * Supports Kafka with fallback options
 */
class MessageQueue extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            type: 'kafka', // kafka, redis, memory
            brokers: process.env.KAFKA_BROKERS || 'localhost:9092',
            clientId: process.env.KAFKA_CLIENT_ID || 'nyc-urban-intelligence',
            groupId: 'urban-intelligence-consumers',
            topics: {
                rawData: 'raw-data',
                processedData: 'processed-data',
                predictions: 'predictions',
                alerts: 'alerts'
            },
            ...config
        };
        
        this.logger = getLogger('MessageQueue');
        this.producer = null;
        this.consumer = null;
        this.isConnected = false;
        this.messageBuffer = new Map(); // For memory fallback
        
        this.setupQueue();
    }

    /**
     * Initialize the message queue system
     */
    async setupQueue() {
        try {
            switch (this.config.type) {
                case 'kafka':
                    await this.setupKafka();
                    break;
                case 'redis':
                    await this.setupRedis();
                    break;
                case 'memory':
                    await this.setupMemory();
                    break;
                default:
                    throw new Error(`Unsupported queue type: ${this.config.type}`);
            }
            
            this.isConnected = true;
            this.logger.info('Message queue initialized', { 
                type: this.config.type,
                topics: Object.keys(this.config.topics)
            });
            
        } catch (error) {
            this.logger.error('Failed to setup message queue', { error: error.message });
            // Fallback to memory queue
            if (this.config.type !== 'memory') {
                this.logger.warn('Falling back to memory queue');
                this.config.type = 'memory';
                await this.setupMemory();
            }
        }
    }

    /**
     * Setup Kafka message queue
     */
    async setupKafka() {
        return new Promise((resolve, reject) => {
            const client = new kafka.KafkaClient({
                kafkaHost: this.config.brokers,
                clientId: this.config.clientId
            });

            // Create producer
            this.producer = new kafka.Producer(client);
            
            this.producer.on('ready', () => {
                this.logger.info('Kafka producer ready');
                
                // Create consumer
                this.consumer = new kafka.Consumer(client, [
                    { topic: this.config.topics.rawData, partition: 0 },
                    { topic: this.config.topics.processedData, partition: 0 },
                    { topic: this.config.topics.predictions, partition: 0 },
                    { topic: this.config.topics.alerts, partition: 0 }
                ], {
                    groupId: this.config.groupId,
                    autoCommit: true
                });

                this.consumer.on('message', (message) => {
                    this.handleMessage(message);
                });

                this.consumer.on('error', (error) => {
                    this.logger.error('Kafka consumer error', { error: error.message });
                    this.emit('error', error);
                });

                resolve();
            });

            this.producer.on('error', (error) => {
                this.logger.error('Kafka producer error', { error: error.message });
                reject(error);
            });

            client.on('error', (error) => {
                this.logger.error('Kafka client error', { error: error.message });
                reject(error);
            });
        });
    }

    /**
     * Setup Redis message queue (as alternative to Kafka)
     */
    async setupRedis() {
        const redis = require('redis');
        
        this.redisClient = redis.createClient({
            url: process.env.REDIS_URL || 'redis://localhost:6379'
        });

        await this.redisClient.connect();
        
        this.logger.info('Redis message queue initialized');
    }

    /**
     * Setup in-memory message queue (for development/testing)
     */
    async setupMemory() {
        this.messageBuffer = new Map();
        Object.values(this.config.topics).forEach(topic => {
            this.messageBuffer.set(topic, []);
        });
        
        this.logger.info('In-memory message queue initialized');
    }

    /**
     * Publish message to a topic
     */
    async publish(topic, message, metadata = {}) {
        const messageData = {
            id: this.generateMessageId(),
            timestamp: Date.now(),
            topic,
            data: message,
            metadata: {
                source: metadata.source || 'unknown',
                version: metadata.version || '1.0',
                ...metadata
            }
        };

        try {
            switch (this.config.type) {
                case 'kafka':
                    await this.publishToKafka(topic, messageData);
                    break;
                case 'redis':
                    await this.publishToRedis(topic, messageData);
                    break;
                case 'memory':
                    await this.publishToMemory(topic, messageData);
                    break;
            }

            this.logger.debug('Message published', {
                topic,
                messageId: messageData.id,
                dataSize: JSON.stringify(messageData.data).length
            });

            this.emit('published', { topic, messageId: messageData.id });
            
        } catch (error) {
            this.logger.error('Failed to publish message', {
                topic,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Subscribe to messages from a topic
     */
    subscribe(topic, callback) {
        this.on(`message:${topic}`, callback);
        
        this.logger.info('Subscribed to topic', { topic });
    }

    /**
     * Unsubscribe from a topic
     */
    unsubscribe(topic) {
        this.removeAllListeners(`message:${topic}`);
        
        this.logger.info('Unsubscribed from topic', { topic });
    }

    /**
     * Publish to Kafka
     */
    async publishToKafka(topic, messageData) {
        return new Promise((resolve, reject) => {
            const payload = [{
                topic,
                messages: JSON.stringify(messageData),
                partition: 0
            }];

            this.producer.send(payload, (error, result) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(result);
                }
            });
        });
    }

    /**
     * Publish to Redis
     */
    async publishToRedis(topic, messageData) {
        await this.redisClient.lPush(topic, JSON.stringify(messageData));
    }

    /**
     * Publish to memory
     */
    async publishToMemory(topic, messageData) {
        if (!this.messageBuffer.has(topic)) {
            this.messageBuffer.set(topic, []);
        }
        
        this.messageBuffer.get(topic).push(messageData);
        
        // Emit immediately for in-memory processing
        setImmediate(() => {
            this.emit(`message:${topic}`, messageData);
        });
    }

    /**
     * Handle incoming messages
     */
    handleMessage(message) {
        try {
            const parsedMessage = JSON.parse(message.value);
            
            this.logger.debug('Message received', {
                topic: message.topic,
                messageId: parsedMessage.id,
                partition: message.partition,
                offset: message.offset
            });

            this.emit(`message:${message.topic}`, parsedMessage);
            this.emit('message', parsedMessage);
            
        } catch (error) {
            this.logger.error('Failed to parse message', {
                topic: message.topic,
                error: error.message,
                rawMessage: message.value
            });
        }
    }

    /**
     * Get queue statistics
     */
    async getStats() {
        const stats = {
            type: this.config.type,
            connected: this.isConnected,
            topics: Object.keys(this.config.topics)
        };

        switch (this.config.type) {
            case 'memory':
                stats.queueSizes = {};
                this.messageBuffer.forEach((messages, topic) => {
                    stats.queueSizes[topic] = messages.length;
                });
                break;
            case 'redis':
                stats.queueSizes = {};
                for (const topic of Object.values(this.config.topics)) {
                    try {
                        stats.queueSizes[topic] = await this.redisClient.lLen(topic);
                    } catch (error) {
                        stats.queueSizes[topic] = 'error';
                    }
                }
                break;
            case 'kafka':
                // Kafka stats would require additional admin client setup
                stats.note = 'Kafka stats require admin client';
                break;
        }

        return stats;
    }

    /**
     * Health check
     */
    async healthCheck() {
        try {
            switch (this.config.type) {
                case 'kafka':
                    // Try to send a test message
                    await this.publish('health-check', { test: true }, { source: 'health-check' });
                    break;
                case 'redis':
                    await this.redisClient.ping();
                    break;
                case 'memory':
                    // Always healthy for memory queue
                    break;
            }
            
            return { status: 'healthy', connected: this.isConnected };
        } catch (error) {
            return { 
                status: 'unhealthy', 
                connected: false, 
                error: error.message 
            };
        }
    }

    /**
     * Close connections and cleanup
     */
    async close() {
        try {
            if (this.producer) {
                this.producer.close();
            }
            
            if (this.consumer) {
                this.consumer.close();
            }
            
            if (this.redisClient) {
                await this.redisClient.quit();
            }
            
            this.isConnected = false;
            this.logger.info('Message queue closed');
            
        } catch (error) {
            this.logger.error('Error closing message queue', { error: error.message });
        }
    }

    /**
     * Generate unique message ID
     */
    generateMessageId() {
        return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Convenience methods for common topics
    
    async publishRawData(data, source) {
        return this.publish(this.config.topics.rawData, data, { source });
    }

    async publishProcessedData(data, processor) {
        return this.publish(this.config.topics.processedData, data, { processor });
    }

    async publishPrediction(data, model) {
        return this.publish(this.config.topics.predictions, data, { model });
    }

    async publishAlert(data, alertType) {
        return this.publish(this.config.topics.alerts, data, { alertType });
    }

    subscribeToRawData(callback) {
        return this.subscribe(this.config.topics.rawData, callback);
    }

    subscribeToProcessedData(callback) {
        return this.subscribe(this.config.topics.processedData, callback);
    }

    subscribeToPredictions(callback) {
        return this.subscribe(this.config.topics.predictions, callback);
    }

    subscribeToAlerts(callback) {
        return this.subscribe(this.config.topics.alerts, callback);
    }
}

module.exports = MessageQueue;