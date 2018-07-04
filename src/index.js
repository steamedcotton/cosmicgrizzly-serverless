const { createConfigFromEnv, parsePayload } = require('./utils');
const CGAuth = require('./CGAuth');
const Response = require('./lib/Response');

module.exports = {
    // Classes
    CGAuth,
    Response,

    // Utils
    parsePayload,
    createConfigFromEnv
};
