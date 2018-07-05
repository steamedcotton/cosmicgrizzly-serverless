const { createConfigFromEnv, parsePayload, parseJson, getHeaderFromEvent } = require('./utils');
const Auth = require('./Auth');
const Response = require('./lib/Response');
const { getLogger } = require('./lib/logger');

module.exports = {
    // Classes
    Auth,
    Response,

    // Utils
    parsePayload,
    createConfigFromEnv,
    getLogger,
    parseJson,
    getHeaderFromEvent
};
