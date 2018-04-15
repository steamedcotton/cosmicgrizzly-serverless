const _ = require('lodash');

class BaseLogger {
    constructor() {
        this.logLevels = {
            silly: 0,
            debug: 1,
            verbose: 2,
            info: 3,
            warn: 4,
            error: 5
        };

        this.logLevel = _.get(process, 'env.LOG_LEVEL', 'debug');
        this.logLevelNumber = _.get(this.logLevels, this.logLevel, 3);

        console.log(`Log level: ${this.logLevel}`);
    }

    log(logLevel, message) {
        // Default logging is console only
    }

    debug(message, extra = {}) {
        if (this.logLevelNumber <= this.logLevels.debug) {
            if (_.isEmpty(extra)) {
                console.log('[DEBUG]', message);
            } else {
                console.log('[DEBUG]', message, extra);
            }
            this.log('debug', message, extra);
        }
    };

    error(message, extra = {}) {
        if (this.logLevelNumber <= this.logLevels.debug) {
            console.log('[ERROR]', message);
        }
        if (this.logLevelNumber <= this.logLevels.error) {
            this.log('error', message, extra);
        }
    };

    warn(message, extra = {}) {
        if (this.logLevelNumber <= this.logLevels.warn) {
            console.log('[WARN]', message);
        }
        if (this.logLevelNumber <= this.logLevels.warn) {
            this.log('warn', message, extra);
        }
    };

    info(message, extra = {}) {
        if (this.logLevelNumber <= this.logLevels.warn) {
            console.log('[INFO]', message);
        }
        if (this.logLevelNumber <= this.logLevels.info) {
            this.log('info', message, extra);
        }
    }
}

module.exports = BaseLogger;