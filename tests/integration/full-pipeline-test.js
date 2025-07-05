// test/integration/full-pipeline-test.js
const MTAConnector = require('../../src/connectors/mta/MTAConnector');
const DataIngestionService = require('../../src/pipeline/ingestion/DataIngestionService');
const { getLogger } = require('../../src/utils/Logger');

/**
 * Complete integration test showing the full data pipeline
 * MTA Connector -> Data Ingestion Service -> Message Queue
 */
class PipelineIntegrationTest {
    constructor() {
        this.logger = getLogger('PipelineTest');
        this.dataIngestionService = null;
        this.mtaConnector = null;
        this.testResults = {
            startTime: Date.now(),
            dataReceived: 0,
            errorsEncountered: 0,
            connectorEvents: [],
            pipelineEvents: []
        };
    }

    async runTest() {
        console.log('🧪 Starting Full Pipeline Integration Test\n');
        
        try {
            await this.setupPipeline();
            await this.setupConnectors();
            await this.startPipeline();
            await this.monitorPipeline();
            await this.generateReport();
        } catch (error) {
            console.error('❌ Test failed:', error.message);
            throw error;
        } finally {
            await this.cleanup();
        }
    }

    async setupPipeline() {
        console.log('🔧 Setting up data pipeline...');
        
        // Initialize Data Ingestion Service with memory queue for testing
        this.dataIngestionService = new DataIngestionService({
            messageQueue: {
                type: 'memory' // Use memory queue for testing
            },
            healthCheckInterval: 30000, // 30 seconds
            restartUnhealthyConnectors: true
        });

        // Set up pipeline event listeners
        this.dataIngestionService.on('started', () => {
            this.testResults.pipelineEvents.push({ event: 'service_started', timestamp: Date.now() });
            console.log('✅ Data ingestion service started');
        });

        this.dataIngestionService.on('dataIngested', (data) => {
            this.testResults.dataReceived++;
            this.testResults.pipelineEvents.push({ 
                event: 'data_ingested', 
                timestamp: Date.now(),
                connector: data.connector,
                messageId: data.data.ingestion.messageId
            });
            
            console.log(`📊 Data ingested from ${data.connector}:`, {
                vehicles: data.data.vehicleUpdates?.length || 0,
                trips: data.data.tripUpdates?.length || 0,
                alerts: data.data.alerts?.length || 0,
                messageId: data.data.ingestion.messageId
            });
        });

        this.dataIngestionService.on('connectorError', (data) => {
            this.testResults.errorsEncountered++;
            this.testResults.pipelineEvents.push({ 
                event: 'connector_error', 
                timestamp: Date.now(),
                connector: data.connector,
                error: data.error.message
            });
            
            console.log(`❌ Connector error from ${data.connector}: ${data.error.message}`);
        });

        this.dataIngestionService.on('connectorStarted', (name) => {
            this.testResults.pipelineEvents.push({ 
                event: 'connector_started', 
                timestamp: Date.now(),
                connector: name
            });
            console.log(`🚀 Connector started: ${name}`);
        });

        console.log('✅ Pipeline setup complete\n');
    }

    async setupConnectors() {
        console.log('🔌 Setting up connectors...');
        
        // Check for MTA API key
        const apiKey = process.env.MTA_API_KEY;
        if (!apiKey) {
            throw new Error('MTA_API_KEY environment variable is required');
        }

        // Create MTA connector
        this.mtaConnector = new MTAConnector({
            apiKey: apiKey,
            feedId: 1,
            pollInterval: 30000, // 30 seconds for testing
            maxRetries: 2,
            timeout: 10000
        });

        // Set up connector event listeners
        this.mtaConnector.on('data', (data) => {
            this.testResults.connectorEvents.push({
                event: 'data_fetched',
                timestamp: Date.now(),
                dataSize: JSON.stringify(data).length
            });
        });

        this.mtaConnector.on('error', (error) => {
            this.testResults.connectorEvents.push({
                event: 'error',
                timestamp: Date.now(),
                error: error.message
            });
        });

        // Validate API key
        console.log('🔑 Validating MTA API key...');
        const isValid = await this.mtaConnector.validateApiKey();
        if (!isValid) {
            throw new Error('Invalid MTA API key');
        }
        console.log('✅ MTA API key validated');

        // Register connector with ingestion service
        this.dataIngestionService.registerConnector('mta-subway', this.mtaConnector);
        console.log('✅ MTA connector registered with ingestion service\n');
    }

    async startPipeline() {
        console.log('🚀 Starting pipeline...');
        
        // Start the data ingestion service
        await this.dataIngestionService.start();
        
        // Wait a moment for everything to initialize
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log('✅ Pipeline started successfully\n');
    }

    async monitorPipeline() {
        console.log('👀 Monitoring pipeline for 3 minutes...\n');
        
        const monitoringDuration = 180000; // 3 minutes
        const statusInterval = 30000; // 30 seconds
        
        let statusTimer = setInterval(async () => {
            await this.printStatus();
        }, statusInterval);

        // Set up message queue subscriber to see data flow
        this.dataIngestionService.messageQueue.subscribeToRawData((message) => {
            console.log(`📨 Message received in queue:`, {
                source: message.metadata.source,
                timestamp: new Date(message.timestamp).toISOString(),
                dataPoints: this.countDataPoints(message.data)
            });
        });

        // Wait for monitoring period
        await new Promise(resolve => setTimeout(resolve, monitoringDuration));
        
        clearInterval(statusTimer);
        console.log('\n⏰ Monitoring period completed\n');
    }

    async printStatus() {
        const serviceStatus = this.dataIngestionService.getStatus();
        const serviceHealth = await this.dataIngestionService.getHealth();
        const queueStats = await this.dataIngestionService.messageQueue.getStats();

        console.log('📊 Pipeline Status:');
        console.log(`   Service: ${serviceHealth.status} (${serviceHealth.healthyConnectors}/${serviceHealth.totalConnectors} connectors healthy)`);
        console.log(`   Data Received: ${this.testResults.dataReceived} batches`);
        console.log(`   Errors: ${this.testResults.errorsEncountered}`);
        console.log(`   Queue: ${queueStats.type} (${JSON.stringify(queueStats.queueSizes || {})})`);
        console.log(`   Uptime: ${Math.round(serviceStatus.uptime / 1000)}s\n`);

        // Show connector-specific status
        Object.entries(serviceStatus.connectors).forEach(([name, status]) => {
            const health = status.connectorStatus;
            console.log(`🚇 ${name}:`, {
                healthy: status.isHealthy,
                running: health.isRunning,
                dataCount: status.dataCount,
                errorCount: status.errorCount,
                successRate: Math.round((health.metrics.successfulFetches / health.metrics.totalFetches) * 100) + '%',
                avgResponseTime: Math.round(health.metrics.avgResponseTime) + 'ms'
            });
        });
        console.log('');
    }

    countDataPoints(data) {
        let count = 0;
        if (data.vehicleUpdates) count += data.vehicleUpdates.length;
        if (data.tripUpdates) count += data.tripUpdates.length;
        if (data.alerts) count += data.alerts.length;
        return count;
    }

    async generateReport() {
        console.log('📋 Generating Test Report...\n');
        
        const testDuration = Date.now() - this.testResults.startTime;
        const serviceStatus = this.dataIngestionService.getStatus();
        const serviceHealth = await this.dataIngestionService.getHealth();

        // Calculate success metrics
        const successRate = this.testResults.errorsEncountered === 0 ? 100 : 
            Math.round(((this.testResults.dataReceived) / (this.testResults.dataReceived + this.testResults.errorsEncountered)) * 100);

        const avgDataBatchesPerMinute = this.testResults.dataReceived / (testDuration / 60000);

        console.log('🎯 TEST RESULTS:');
        console.log('================');
        console.log(`Test Duration: ${Math.round(testDuration / 1000)}s`);
        console.log(`Overall Status: ${serviceHealth.status.toUpperCase()}`);
        console.log(`Data Batches Received: ${this.testResults.dataReceived}`);
        console.log(`Errors Encountered: ${this.testResults.errorsEncountered}`);
        console.log(`Success Rate: ${successRate}%`);
        console.log(`Avg Batches/Minute: ${Math.round(avgDataBatchesPerMinute * 100) / 100}`);
        console.log(`Service Uptime: ${Math.round(serviceStatus.uptime / 1000)}s`);
        console.log('');

        console.log('🔌 CONNECTOR PERFORMANCE:');
        Object.entries(serviceStatus.connectors).forEach(([name, status]) => {
            const connectorMetrics = status.connectorStatus.metrics;
            console.log(`${name}:`);
            console.log(`  - Health: ${status.isHealthy ? '✅ Healthy' : '❌ Unhealthy'}`);
            console.log(`  - Data Fetches: ${connectorMetrics.totalFetches}`);
            console.log(`  - Success Rate: ${Math.round((connectorMetrics.successfulFetches / connectorMetrics.totalFetches) * 100)}%`);
            console.log(`  - Avg Response Time: ${Math.round(connectorMetrics.avgResponseTime)}ms`);
            console.log(`  - Data Batches Generated: ${status.dataCount}`);
            console.log(`  - Errors: ${status.errorCount}`);
        });
        console.log('');

        console.log('📊 PIPELINE EVENTS:');
        this.testResults.pipelineEvents.slice(-5).forEach(event => {
            const time = new Date(event.timestamp).toLocaleTimeString();
            console.log(`  ${time} - ${event.event} ${event.connector ? `(${event.connector})` : ''}`);
        });
        console.log('');

        // Determine test success
        const testPassed = 
            this.testResults.dataReceived > 0 &&
            serviceHealth.status !== 'critical' &&
            successRate >= 80;

        if (testPassed) {
            console.log('🎉 TEST PASSED! Pipeline is working correctly.');
        } else {
            console.log('❌ TEST FAILED! Issues detected in pipeline.');
        }

        console.log('\n' + '='.repeat(50));
        
        return {
            passed: testPassed,
            metrics: {
                testDuration,
                dataReceived: this.testResults.dataReceived,
                errorsEncountered: this.testResults.errorsEncountered,
                successRate,
                avgDataBatchesPerMinute
            }
        };
    }

    async cleanup() {
        console.log('\n🧹 Cleaning up...');
        
        try {
            if (this.dataIngestionService) {
                await this.dataIngestionService.stop();
                console.log('✅ Data ingestion service stopped');
            }
        } catch (error) {
            console.log('⚠️  Error during cleanup:', error.message);
        }
        
        console.log('✅ Cleanup completed');
    }
}

/**
 * Run the integration test
 */
async function runPipelineTest() {
    const test = new PipelineIntegrationTest();
    
    try {
        const results = await test.runTest();
        process.exit(results.passed ? 0 : 1);
    } catch (error) {
        console.error('💥 Test execution failed:', error);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Gracefully shutting down test...');
    process.exit(0);
});

process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled promise rejection:', error);
    process.exit(1);
});

// Export for testing or run directly
if (require.main === module) {
    runPipelineTest();
}

module.exports = PipelineIntegrationTest;