/**
 * Logging Service for Pantheon Electron App
 * Provides file-based and in-memory logging with debug capabilities
 */

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class LoggingService {
  constructor() {
    this.logs = [];
    this.maxLogs = 10000; // Keep last 10k log entries in memory
    this.logFile = null;
    this.logStream = null;
    this.isInitialized = false;
    this.logLevel = process.env.LOG_LEVEL || 'info';
    this.logLevels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };
  }

  initialize() {
    if (this.isInitialized) return;

    try {
      // Create logs directory
      const logsDir = path.join(app.getPath('userData'), 'logs');
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }

      // Create log file with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      this.logFile = path.join(logsDir, `pantheon-${timestamp}.log`);
      
      // Create write stream
      this.logStream = fs.createWriteStream(this.logFile, { flags: 'a' });
      
      // Clean up old log files (keep last 5)
      this.cleanupOldLogs(logsDir);
      
      this.isInitialized = true;
      this.log('info', 'Logging service initialized', { logFile: this.logFile });

      // Override console methods
      this.overrideConsole();
    } catch (error) {
      console.error('Failed to initialize logging service:', error);
    }
  }

  overrideConsole() {
    const originalConsole = {
      log: console.log.bind(console),
      error: console.error.bind(console),
      warn: console.warn.bind(console),
      debug: console.debug.bind(console)
    };

    console.log = (...args) => {
      originalConsole.log(...args);
      this.log('info', args.join(' '));
    };

    console.error = (...args) => {
      originalConsole.error(...args);
      this.log('error', args.join(' '));
    };

    console.warn = (...args) => {
      originalConsole.warn(...args);
      this.log('warn', args.join(' '));
    };

    console.debug = (...args) => {
      originalConsole.debug(...args);
      this.log('debug', args.join(' '));
    };
  }

  log(level, message, data = null) {
    if (!this.shouldLog(level)) return;

    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      data
    };

    // Add to in-memory logs
    this.logs.push(logEntry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Write to file if initialized
    if (this.logStream && !this.logStream.destroyed) {
      const logLine = `[${timestamp}] [${level.toUpperCase()}] ${message}${data ? ' ' + JSON.stringify(data) : ''}\n`;
      this.logStream.write(logLine);
    }
  }

  shouldLog(level) {
    const levelValue = this.logLevels[level] || 2;
    const currentLevelValue = this.logLevels[this.logLevel] || 2;
    return levelValue <= currentLevelValue;
  }

  cleanupOldLogs(logsDir) {
    try {
      const files = fs.readdirSync(logsDir)
        .filter(f => f.startsWith('pantheon-') && f.endsWith('.log'))
        .map(f => ({
          name: f,
          path: path.join(logsDir, f),
          time: fs.statSync(path.join(logsDir, f)).mtime
        }))
        .sort((a, b) => b.time - a.time);

      // Keep only the 5 most recent log files
      if (files.length > 5) {
        files.slice(5).forEach(file => {
          try {
            fs.unlinkSync(file.path);
            this.log('debug', `Deleted old log file: ${file.name}`);
          } catch (err) {
            this.log('error', `Failed to delete old log file: ${file.name}`, { error: err.message });
          }
        });
      }
    } catch (error) {
      this.log('error', 'Failed to cleanup old logs', { error: error.message });
    }
  }

  getLogs(level = null, limit = 1000) {
    let filteredLogs = this.logs;
    
    if (level) {
      filteredLogs = this.logs.filter(log => log.level === level);
    }
    
    return filteredLogs.slice(-limit);
  }

  getLogFile() {
    return this.logFile;
  }

  getLogsDirectory() {
    return path.join(app.getPath('userData'), 'logs');
  }

  clearLogs() {
    this.logs = [];
    this.log('info', 'In-memory logs cleared');
  }

  setLogLevel(level) {
    if (this.logLevels[level] !== undefined) {
      this.logLevel = level;
      this.log('info', `Log level set to: ${level}`);
    }
  }

  close() {
    if (this.logStream) {
      this.logStream.end();
      this.logStream = null;
    }
  }
}

module.exports = new LoggingService();