const _ = require('lodash');
const LogglyLogger = require('./LogglyLogger');
const BaseLogger = require('./BaseLogger');

// TODO: Add support for other logging providers
let logger;

module.exports.getLogger = (config = {}) => {
    if (logger) {
        return logger;
    }

    if (_.has(config, 'logglyApiToken')) {
        logger = new LogglyLogger(config);
    } else {
        logger = new BaseLogger(config);
    }

    return logger;
};
