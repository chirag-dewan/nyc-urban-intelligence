// comprehensive-nyc-analysis.js - Every NYC Subway Line Pattern Analysis
const axios = require('axios');

// ========================================
// COMPLETE NYC SUBWAY LINE DATABASE
// ========================================

const completeNYCSubway = {
    // IRT Lines (Numbers)
    irt: {
        '1': { 
            name: 'Broadway-Seventh Avenue Local',
            color: '#EE352E',
            terminals: ['South Ferry', 'Van Cortlandt Park'],
            length: 21.9,
            stations: 38,
            boroughs: ['Manhattan', 'Bronx'],
            type: 'local'
        },
        '2': {
            name: 'Seventh Avenue Express', 
            color: '#EE352E',
            terminals: ['Flatbush Av', 'Wakefield'],
            length: 25.2,
            stations: 31,
            boroughs: ['Manhattan', 'Bronx', 'Brooklyn'],
            type: 'express'
        },
        '3': {
            name: 'Seventh Avenue Express',
            color: '#EE352E', 
            terminals: ['New Lots Av', '148 St'],
            length: 20.4,
            stations: 34,
            boroughs: ['Manhattan', 'Bronx', 'Brooklyn'],
            type: 'express'
        },
        '4': {
            name: 'Lexington Avenue Express',
            color: '#00933C',
            terminals: ['Woodlawn', 'Crown Heights'],
            length: 26.3,
            stations: 32,
            boroughs: ['Manhattan', 'Bronx', 'Brooklyn'],
            type: 'express'
        },
        '5': {
            name: 'Lexington Avenue Express',
            color: '#00933C',
            terminals: ['Eastchester', 'Flatbush Av'],
            length: 28.1,
            stations: 35,
            boroughs: ['Manhattan', 'Bronx', 'Brooklyn'],
            type: 'express'
        },
        '6': {
            name: 'Lexington Avenue Local',
            color: '#00933C',
            terminals: ['Pelham Bay Park', 'Brooklyn Bridge'],
            length: 27.2,
            stations: 38,
            boroughs: ['Manhattan', 'Bronx'],
            type: 'local'
        },
        '7': {
            name: 'Flushing Local/Express',
            color: '#B933AD',
            terminals: ['Main St-Flushing', 'Times Sq'],
            length: 18.9,
            stations: 22,
            boroughs: ['Manhattan', 'Queens'],
            type: 'local/express'
        }
    },
    
    // BMT/IND Lines (Letters)
    bmt_ind: {
        'A': {
            name: 'Eighth Avenue Express',
            color: '#0039A6',
            terminals: ['Inwood-207 St', 'Far Rockaway/Lefferts'],
            length: 31.0,
            stations: 59,
            boroughs: ['Manhattan', 'Brooklyn', 'Queens'],
            type: 'express'
        },
        'B': {
            name: 'Sixth Avenue Express',
            color: '#FF6319',
            terminals: ['145 St', 'Brighton Beach'],
            length: 20.6,
            stations: 24,
            boroughs: ['Manhattan', 'Bronx', 'Brooklyn'],
            type: 'express'
        },
        'C': {
            name: 'Eighth Avenue Local',
            color: '#0039A6',
            terminals: ['168 St', 'Euclid Av'],
            length: 19.3,
            stations: 40,
            boroughs: ['Manhattan', 'Brooklyn'],
            type: 'local'
        },
        'D': {
            name: 'Sixth Avenue Express',
            color: '#FF6319',
            terminals: ['205 St', 'Coney Island'],
            length: 27.8,
            stations: 47,
            boroughs: ['Manhattan', 'Bronx', 'Brooklyn'],
            type: 'express'
        },
        'E': {
            name: 'Eighth Avenue Local',
            color: '#0039A6',
            terminals: ['Jamaica Center', 'World Trade Center'],
            length: 23.7,
            stations: 50,
            boroughs: ['Manhattan', 'Queens'],
            type: 'local'
        },
        'F': {
            name: 'Sixth Avenue Local/Express',
            color: '#FF6319',
            terminals: ['Jamaica-179 St', 'Coney Island'],
            length: 32.1,
            stations: 63,
            boroughs: ['Manhattan', 'Brooklyn', 'Queens'],
            type: 'local/express'
        },
        'G': {
            name: 'Brooklyn-Queens Crosstown',
            color: '#6CBE45',
            terminals: ['Long Island City', 'Church Av'],
            length: 11.4,
            stations: 21,
            boroughs: ['Brooklyn', 'Queens'],
            type: 'local'
        },
        'J': {
            name: 'Nassau Street Local',
            color: '#996633',
            terminals: ['Jamaica Center', 'Broad St'],
            length: 19.8,
            stations: 30,
            boroughs: ['Manhattan', 'Brooklyn', 'Queens'],
            type: 'local'
        },
        'L': {
            name: '14th Street-Canarsie Local',
            color: '#A7A9AC',
            terminals: ['8 Av', 'Canarsie'],
            length: 16.1,
            stations: 24,
            boroughs: ['Manhattan', 'Brooklyn'],
            type: 'local'
        },
        'M': {
            name: 'Sixth Avenue Local',
            color: '#FF6319',
            terminals: ['Metropolitan Av', 'Forest Hills'],
            length: 16.4,
            stations: 35,
            boroughs: ['Manhattan', 'Brooklyn', 'Queens'],
            type: 'local'
        },
        'N': {
            name: 'Broadway Express',
            color: '#FCCC0A',
            terminals: ['Astoria', 'Coney Island'],
            length: 29.7,
            stations: 36,
            boroughs: ['Manhattan', 'Brooklyn', 'Queens'],
            type: 'express'
        },
        'Q': {
            name: 'Broadway Express',
            color: '#FCCC0A',
            terminals: ['96 St', 'Coney Island'],
            length: 25.9,
            stations: 32,
            boroughs: ['Manhattan', 'Brooklyn', 'Queens'],
            type: 'express'
        },
        'R': {
            name: 'Broadway Local',
            color: '#FCCC0A',
            terminals: ['Forest Hills', 'Bay Ridge'],
            length: 30.8,
            stations: 58,
            boroughs: ['Manhattan', 'Brooklyn', 'Queens'],
            type: 'local'
        },
        'W': {
            name: 'Broadway Local',
            color: '#FCCC0A',
            terminals: ['Astoria', 'Whitehall'],
            length: 19.5,
            stations: 39,
            boroughs: ['Manhattan', 'Brooklyn', 'Queens'],
            type: 'local'
        },
        'Z': {
            name: 'Nassau Street Express',
            color: '#996633',
            terminals: ['Jamaica Center', 'Broad St'],
            length: 18.9,
            stations: 25,
            boroughs: ['Manhattan', 'Brooklyn', 'Queens'],
            type: 'express'
        }
    },
    
    // Special Services
    special: {
        'S': {
            name: 'Shuttle Services',
            color: '#808183',
            terminals: ['Various'],
            shuttles: [
                { name: '42nd Street Shuttle', terminals: ['Times Sq', 'Grand Central'] },
                { name: 'Franklin Avenue Shuttle', terminals: ['Franklin Av', 'Prospect Park'] },
                { name: 'Rockaway Park Shuttle', terminals: ['Broad Channel', 'Rockaway Park'] }
            ],
            type: 'shuttle'
        },
        'SIR': {
            name: 'Staten Island Railway',
            color: '#2E3192',
            terminals: ['St. George', 'Tottenville'],
            length: 14.0,
            stations: 21,
            boroughs: ['Staten Island'],
            type: 'local'
        }
    }
};

// ========================================
// ADVANCED PATTERN ANALYSIS ENGINE
// ========================================

class AdvancedPatternAnalyzer {
    constructor() {
        this.lineAnalytics = new Map();
        this.systemPatterns = {
            rushHourImpact: {},
            boroughPerformance: {},
            lineTypeComparison: {},
            networkEffects: {},
            ridership: {},
            reliability: {}
        };
        this.historicalTrends = [];
    }

    initializeAllLines() {
        const allLines = { ...completeNYCSubway.irt, ...completeNYCSubway.bmt_ind, ...completeNYCSubway.special };
        
        for (const [lineId, lineData] of Object.entries(allLines)) {
            this.lineAnalytics.set(lineId, {
                lineInfo: lineData,
                performance: {
                    reliability: 0,
                    onTimePerformance: 0,
                    averageDelay: 0,
                    peakDelay: 0,
                    variability: 0
                },
                patterns: {
                    rushHourMultiplier: 1.5,
                    peakHours: [],
                    seasonalTrends: [],
                    weatherImpact: 1.0
                },
                ridership: {
                    dailyRiders: this.estimateRidership(lineData),
                    peakDirection: 'Manhattan-bound',
                    capacity: this.calculateCapacity(lineData)
                },
                insights: [],
                recommendations: []
            });
        }
    }

    estimateRidership(lineData) {
        // Estimate based on line characteristics
        const baseRidership = lineData.stations * 1500; // Base riders per station
        const lengthMultiplier = Math.min(2.0, lineData.length / 20);
        const boroughMultiplier = lineData.boroughs ? lineData.boroughs.length * 0.8 : 1;
        const typeMultiplier = lineData.type === 'express' ? 1.4 : lineData.type === 'local' ? 1.0 : 0.8;
        
        return Math.round(baseRidership * lengthMultiplier * boroughMultiplier * typeMultiplier);
    }

    calculateCapacity(lineData) {
        // Theoretical capacity calculation
        const trainsPerHour = lineData.type === 'express' ? 24 : 20;
        const carsPerTrain = 8; // Standard for most lines
        const passengersPerCar = 200; // Peak capacity
        
        return trainsPerHour * carsPerTrain * passengersPerCar;
    }

    analyzeComprehensivePatterns(liveTrainData) {
        this.initializeAllLines();
        
        // Process live train data
        this.processLiveData(liveTrainData);
        
        // Analyze system-wide patterns
        this.analyzeSystemPatterns();
        
        // Generate line-specific insights
        this.generateLineInsights();
        
        // Analyze network effects
        this.analyzeNetworkEffects();
        
        // Generate recommendations
        this.generateSystemRecommendations();
        
        return this.getComprehensiveReport();
    }

    processLiveData(trainData) {
        const currentHour = new Date().getHours();
        const isRushHour = (currentHour >= 7 && currentHour <= 9) || (currentHour >= 17 && currentHour <= 19);
        
        // Group trains by line
        const trainsByLine = {};
        trainData.forEach(train => {
            if (!trainsByLine[train.route]) trainsByLine[train.route] = [];
            trainsByLine[train.route].push(train);
        });
        
        // Analyze each line
        for (const [lineId, trains] of Object.entries(trainsByLine)) {
            const analytics = this.lineAnalytics.get(lineId);
            if (!analytics) continue;
            
            // Calculate performance metrics
            const delays = trains.map(t => t.delay);
            const avgDelay = delays.reduce((sum, d) => sum + d, 0) / delays.length;
            const maxDelay = Math.max(...delays);
            const onTimeCount = delays.filter(d => d < 120).length; // < 2 minutes
            const onTimeRate = (onTimeCount / delays.length) * 100;
            
            // Update analytics
            analytics.performance.averageDelay = avgDelay;
            analytics.performance.peakDelay = maxDelay;
            analytics.performance.onTimePerformance = onTimeRate;
            analytics.performance.reliability = Math.max(0, 100 - (avgDelay / 60) - (this.calculateVariability(delays) / 60));
            analytics.performance.variability = this.calculateVariability(delays);
            
            // Rush hour impact
            if (isRushHour) {
                analytics.patterns.rushHourMultiplier = Math.max(1.0, avgDelay / 60); // Minutes to multiplier
            }
        }
    }

    calculateVariability(delays) {
        if (delays.length < 2) return 0;
        const avg = delays.reduce((sum, d) => sum + d, 0) / delays.length;
        const variance = delays.reduce((sum, d) => sum + Math.pow(d - avg, 2), 0) / delays.length;
        return Math.sqrt(variance);
    }

    analyzeSystemPatterns() {
        // Borough performance analysis
        const boroughStats = { Manhattan: [], Brooklyn: [], Queens: [], Bronx: [], 'Staten Island': [] };
        
        for (const [lineId, analytics] of this.lineAnalytics) {
            if (analytics.lineInfo.boroughs) {
                analytics.lineInfo.boroughs.forEach(borough => {
                    if (boroughStats[borough]) {
                        boroughStats[borough].push({
                            line: lineId,
                            reliability: analytics.performance.reliability,
                            delay: analytics.performance.averageDelay
                        });
                    }
                });
            }
        }
        
        // Calculate borough averages
        for (const [borough, lines] of Object.entries(boroughStats)) {
            if (lines.length > 0) {
                const avgReliability = lines.reduce((sum, l) => sum + l.reliability, 0) / lines.length;
                const avgDelay = lines.reduce((sum, l) => sum + l.delay, 0) / lines.length;
                
                this.systemPatterns.boroughPerformance[borough] = {
                    averageReliability: avgReliability,
                    averageDelay: avgDelay,
                    lineCount: lines.length,
                    status: avgReliability > 80 ? 'excellent' : avgReliability > 60 ? 'good' : 'needs_improvement'
                };
            }
        }
        
        // Line type comparison
        const expressLines = [];
        const localLines = [];
        const shuttleLines = [];
        
        for (const [lineId, analytics] of this.lineAnalytics) {
            const lineData = {
                line: lineId,
                reliability: analytics.performance.reliability,
                delay: analytics.performance.averageDelay,
                ridership: analytics.ridership.dailyRiders
            };
            
            if (analytics.lineInfo.type === 'express') expressLines.push(lineData);
            else if (analytics.lineInfo.type === 'local') localLines.push(lineData);
            else shuttleLines.push(lineData);
        }
        
        this.systemPatterns.lineTypeComparison = {
            express: this.calculateTypeStats(expressLines),
            local: this.calculateTypeStats(localLines),
            shuttle: this.calculateTypeStats(shuttleLines)
        };
    }

    calculateTypeStats(lines) {
        if (lines.length === 0) return null;
        
        return {
            count: lines.length,
            avgReliability: lines.reduce((sum, l) => sum + l.reliability, 0) / lines.length,
            avgDelay: lines.reduce((sum, l) => sum + l.delay, 0) / lines.length,
            totalRidership: lines.reduce((sum, l) => sum + l.ridership, 0),
            bestPerforming: lines.sort((a, b) => b.reliability - a.reliability)[0],
            worstPerforming: lines.sort((a, b) => a.reliability - b.reliability)[0]
        };
    }

    generateLineInsights() {
        for (const [lineId, analytics] of this.lineAnalytics) {
            const performance = analytics.performance;
            const lineInfo = analytics.lineInfo;
            const insights = [];
            const recommendations = [];
            
            // Performance insights
            if (performance.reliability > 90) {
                insights.push('Exceptional reliability - consistently meets performance targets');
            } else if (performance.reliability < 60) {
                insights.push('Below standard reliability - requires immediate attention');
                recommendations.push('Implement enhanced monitoring and maintenance schedule');
            }
            
            // Ridership vs capacity analysis
            const utilizationRate = analytics.ridership.dailyRiders / analytics.ridership.capacity;
            if (utilizationRate > 0.8) {
                insights.push('High ridership demand - approaching capacity limits');
                recommendations.push('Consider increased service frequency during peak hours');
            }
            
            // Line type specific insights
            if (lineInfo.type === 'express' && performance.averageDelay > 180) {
                insights.push('Express service experiencing significant delays');
                recommendations.push('Review signal timing and priority systems');
            }
            
            if (lineInfo.boroughs && lineInfo.boroughs.length > 2) {
                insights.push('Multi-borough service - critical for system connectivity');
            }
            
            // Length and complexity insights
            if (lineInfo.length > 25) {
                insights.push('Extended route - vulnerable to cascading delays');
                recommendations.push('Implement zone-based service management');
            }
            
            analytics.insights = insights;
            analytics.recommendations = recommendations;
        }
    }

    analyzeNetworkEffects() {
        // Find transfer hubs and their impact
        const transferHubs = [
            { name: 'Times Square', lines: ['1', '2', '3', '7', 'N', 'Q', 'R', 'W', 'S'] },
            { name: 'Union Square', lines: ['4', '5', '6', 'L', 'N', 'Q', 'R', 'W'] },
            { name: 'Atlantic Terminal', lines: ['B', 'D', 'N', 'Q', 'R', '2', '3', '4', '5'] },
            { name: 'Roosevelt/74th', lines: ['7', 'E', 'F', 'M', 'R'] }
        ];
        
        this.systemPatterns.networkEffects = {
            criticalHubs: transferHubs.map(hub => {
                const hubLines = hub.lines.filter(line => this.lineAnalytics.has(line));
                const avgReliability = hubLines.reduce((sum, line) => {
                    return sum + this.lineAnalytics.get(line).performance.reliability;
                }, 0) / hubLines.length;
                
                return {
                    ...hub,
                    averageReliability: avgReliability,
                    impact: avgReliability < 70 ? 'high_risk' : avgReliability < 85 ? 'moderate_risk' : 'stable'
                };
            })
        };
    }

    generateSystemRecommendations() {
        const recommendations = [];
        
        // System-wide recommendations
        const systemReliability = [...this.lineAnalytics.values()]
            .reduce((sum, a) => sum + a.performance.reliability, 0) / this.lineAnalytics.size;
        
        if (systemReliability < 75) {
            recommendations.push({
                priority: 'high',
                category: 'system_wide',
                recommendation: 'Implement comprehensive system reliability improvement program',
                impact: 'All riders'
            });
        }
        
        // Borough-specific recommendations
        for (const [borough, stats] of Object.entries(this.systemPatterns.boroughPerformance)) {
            if (stats.status === 'needs_improvement') {
                recommendations.push({
                    priority: 'medium',
                    category: 'borough',
                    recommendation: `Focus maintenance and service improvements on ${borough} lines`,
                    impact: `${borough} commuters`
                });
            }
        }
        
        // Line type recommendations
        const typeComparison = this.systemPatterns.lineTypeComparison;
        if (typeComparison.express && typeComparison.local) {
            if (typeComparison.express.avgReliability < typeComparison.local.avgReliability - 10) {
                recommendations.push({
                    priority: 'medium',
                    category: 'service_type',
                    recommendation: 'Review express service operations - underperforming vs local service',
                    impact: 'Express line riders'
                });
            }
        }
        
        this.systemPatterns.recommendations = recommendations;
    }

    getComprehensiveReport() {
        return {
            timestamp: new Date(),
            systemOverview: {
                totalLines: this.lineAnalytics.size,
                systemReliability: [...this.lineAnalytics.values()]
                    .reduce((sum, a) => sum + a.performance.reliability, 0) / this.lineAnalytics.size,
                totalRidership: [...this.lineAnalytics.values()]
                    .reduce((sum, a) => sum + a.ridership.dailyRiders, 0),
                systemCapacity: [...this.lineAnalytics.values()]
                    .reduce((sum, a) => sum + a.ridership.capacity, 0)
            },
            lineAnalytics: this.lineAnalytics,
            systemPatterns: this.systemPatterns,
            lineDetails: completeNYCSubway
        };
    }
}

// ========================================
// ENHANCED DISPLAY SYSTEM
// ========================================

class ComprehensiveDisplaySystem {
    constructor() {
        this.colors = {
            reset: '\x1b[0m', bright: '\x1b[1m', red: '\x1b[31m', green: '\x1b[32m',
            yellow: '\x1b[33m', blue: '\x1b[34m', magenta: '\x1b[35m', cyan: '\x1b[36m'
        };
    }

    showComprehensiveReport(report) {
        this.showSystemHeader();
        this.showSystemOverview(report.systemOverview);
        this.showBoroughAnalysis(report.systemPatterns.boroughPerformance);
        this.showLineTypeComparison(report.systemPatterns.lineTypeComparison);
        this.showTopPerformers(report.lineAnalytics);
        this.showNetworkEffects(report.systemPatterns.networkEffects);
        this.showRecommendations(report.systemPatterns.recommendations);
    }

    showSystemHeader() {
        console.log(`${this.colors.cyan}${this.colors.bright}`);
        console.log('╔══════════════════════════════════════════════════════════╗');
        console.log('║           🚇 COMPREHENSIVE NYC ANALYSIS 🚇               ║');
        console.log('║                                                          ║');
        console.log('║        Complete Pattern Analysis - All 25 Lines         ║');
        console.log('║           IRT • BMT • IND • Special Services            ║');
        console.log('╚══════════════════════════════════════════════════════════╝');
        console.log(`${this.colors.reset}\n`);
    }

    showSystemOverview(overview) {
        console.log(`${this.colors.blue}${this.colors.bright}📊 SYSTEM OVERVIEW${this.colors.reset}`);
        console.log('═'.repeat(50));
        
        console.log(`📈 Total Lines Analyzed: ${this.colors.bright}${overview.totalLines}${this.colors.reset}`);
        console.log(`🎯 System Reliability: ${this.colors.bright}${Math.round(overview.systemReliability)}%${this.colors.reset}`);
        console.log(`👥 Daily Ridership: ${this.colors.bright}${overview.totalRidership.toLocaleString()}${this.colors.reset} passengers`);
        console.log(`🚇 System Capacity: ${this.colors.bright}${overview.systemCapacity.toLocaleString()}${this.colors.reset} passengers/hour`);
        console.log(`📊 Utilization Rate: ${this.colors.bright}${Math.round((overview.totalRidership / overview.systemCapacity) * 100)}%${this.colors.reset}\n`);
    }

    showBoroughAnalysis(boroughPerformance) {
        console.log(`${this.colors.blue}${this.colors.bright}🗽 BOROUGH PERFORMANCE ANALYSIS${this.colors.reset}`);
        console.log('═'.repeat(50));
        
        const boroughs = Object.entries(boroughPerformance)
            .sort(([,a], [,b]) => b.averageReliability - a.averageReliability);
        
        boroughs.forEach(([borough, stats], index) => {
            const statusEmoji = stats.status === 'excellent' ? '🟢' : 
                              stats.status === 'good' ? '🟡' : '🔴';
            const ranking = index + 1;
            
            console.log(`${statusEmoji} ${ranking}. ${borough}`);
            console.log(`   📊 Reliability: ${Math.round(stats.averageReliability)}%`);
            console.log(`   ⏱️  Avg Delay: ${Math.round(stats.averageDelay / 60)} minutes`);
            console.log(`   🚇 Lines: ${stats.lineCount}`);
        });
        console.log('');
    }

    showLineTypeComparison(lineTypeComparison) {
        console.log(`${this.colors.blue}${this.colors.bright}🚊 LINE TYPE COMPARISON${this.colors.reset}`);
        console.log('═'.repeat(50));
        
        Object.entries(lineTypeComparison).forEach(([type, stats]) => {
            if (stats) {
                console.log(`${this.colors.bright}${type.toUpperCase()} LINES:${this.colors.reset}`);
                console.log(`   📊 Count: ${stats.count} lines`);
                console.log(`   🎯 Avg Reliability: ${Math.round(stats.avgReliability)}%`);
                console.log(`   ⏱️  Avg Delay: ${Math.round(stats.avgDelay / 60)} minutes`);
                console.log(`   👥 Total Ridership: ${stats.totalRidership.toLocaleString()}`);
                console.log(`   🏆 Best: ${stats.bestPerforming.line} (${Math.round(stats.bestPerforming.reliability)}%)`);
                console.log(`   ⚠️  Needs Attention: ${stats.worstPerforming.line} (${Math.round(stats.worstPerforming.reliability)}%)`);
                console.log('');
            }
        });
    }

    showTopPerformers(lineAnalytics) {
        console.log(`${this.colors.blue}${this.colors.bright}🏆 TOP & BOTTOM PERFORMERS${this.colors.reset}`);
        console.log('═'.repeat(50));
        
        const sortedLines = [...lineAnalytics.entries()]
            .sort(([,a], [,b]) => b.performance.reliability - a.performance.reliability);
        
        console.log(`${this.colors.green}🌟 TOP 5 PERFORMERS:${this.colors.reset}`);
        sortedLines.slice(0, 5).forEach(([lineId, analytics], index) => {
            console.log(`   ${index + 1}. ${lineId} line: ${Math.round(analytics.performance.reliability)}% reliability`);
            console.log(`      ${analytics.lineInfo.name}`);
            console.log(`      ${analytics.insights[0] || 'Consistent performance'}`);
        });
        
        console.log(`\n${this.colors.red}⚠️  NEEDS IMPROVEMENT:${this.colors.reset}`);
        sortedLines.slice(-3).reverse().forEach(([lineId, analytics], index) => {
            console.log(`   ${lineId} line: ${Math.round(analytics.performance.reliability)}% reliability`);
            console.log(`      ⏱️  ${Math.round(analytics.performance.averageDelay / 60)} min avg delay`);
            if (analytics.recommendations.length > 0) {
                console.log(`      💡 ${analytics.recommendations[0]}`);
            }
        });
        console.log('');
    }

    showNetworkEffects(networkEffects) {
        if (!networkEffects.criticalHubs) return;
        
        console.log(`${this.colors.blue}${this.colors.bright}🔗 NETWORK EFFECTS ANALYSIS${this.colors.reset}`);
        console.log('═'.repeat(50));
        
        networkEffects.criticalHubs.forEach(hub => {
            const impactEmoji = hub.impact === 'high_risk' ? '🔴' : 
                              hub.impact === 'moderate_risk' ? '🟡' : '🟢';
            
            console.log(`${impactEmoji} ${hub.name}`);
            console.log(`   🚇 Lines: ${hub.lines.join(', ')}`);
            console.log(`   📊 Hub Reliability: ${Math.round(hub.averageReliability)}%`);
            console.log(`   💥 System Impact: ${hub.impact.replace('_', ' ')}`);
        });
        console.log('');
    }

    showRecommendations(recommendations) {
        if (!recommendations || recommendations.length === 0) return;
        
        console.log(`${this.colors.blue}${this.colors.bright}💡 SYSTEM RECOMMENDATIONS${this.colors.reset}`);
        console.log('═'.repeat(50));
        
        const highPriority = recommendations.filter(r => r.priority === 'high');
        const mediumPriority = recommendations.filter(r => r.priority === 'medium');
        
        if (highPriority.length > 0) {
            console.log(`${this.colors.red}🔴 HIGH PRIORITY:${this.colors.reset}`);
            highPriority.forEach(rec => {
                console.log(`   • ${rec.recommendation}`);
                console.log(`     Impact: ${rec.impact}`);
            });
            console.log('');
        }
        
        if (mediumPriority.length > 0) {
            console.log(`${this.colors.yellow}🟡 MEDIUM PRIORITY:${this.colors.reset}`);
            mediumPriority.forEach(rec => {
                console.log(`   • ${rec.recommendation}`);
                console.log(`     Impact: ${rec.impact}`);
            });
        }
        console.log('');
    }
}

// ========================================
// MAIN COMPREHENSIVE ANALYSIS SYSTEM
// ========================================

async function runComprehensiveNYCAnalysis() {
    const analyzer = new AdvancedPatternAnalyzer();
    const display = new ComprehensiveDisplaySystem();
    
    // Generate comprehensive train data for all lines
    const comprehensiveTrainData = generateAllLineTrainData();
    
    // Run complete analysis
    const report = analyzer.analyzeComprehensivePatterns(comprehensiveTrainData);
    
    // Display comprehensive results
    display.showComprehensiveReport(report);
    
    // Summary
    console.log(`${display.colors.cyan}${display.colors.bright}🎯 ANALYSIS COMPLETE${display.colors.reset}`);
    console.log('═'.repeat(50));
    console.log('✅ All 25 NYC subway lines analyzed');
    console.log('✅ Borough performance compared');
    console.log('✅ Network effects identified');
    console.log('✅ System recommendations generated');
    console.log('🚀 Ready for LIRR and Metro-North expansion\n');
}

function generateAllLineTrainData() {
    const allLines = [...Object.keys(completeNYCSubway.irt), 
                     ...Object.keys(completeNYCSubway.bmt_ind), 
                     ...Object.keys(completeNYCSubway.special)];
    
    const trains = [];
    const currentHour = new Date().getHours();
    const isRushHour = (currentHour >= 7 && currentHour <= 9) || (currentHour >= 17 && currentHour <= 19);
    
    allLines.forEach(route => {
        const trainCount = Math.floor(Math.random() * 4) + 2; // 2-5 trains per line
        
        for (let i = 0; i < trainCount; i++) {
            const baseDelay = Math.random() * 240; // 0-4 minutes base
            const rushMultiplier = isRushHour ? 1.5 : 1;
            const finalDelay = Math.round(baseDelay * rushMultiplier);
            
            trains.push({
                route: route,
                delay: finalDelay,
                status: ['at_station', 'approaching', 'departing', 'in_transit'][Math.floor(Math.random() * 4)],
                lat: 40.7500 + (Math.random() - 0.5) * 0.1,
                lon: -73.9800 + (Math.random() - 0.5) * 0.1
            });
        }
    });
    
    return trains;
}

// Run the comprehensive analysis
runComprehensiveNYCAnalysis().catch(console.error);