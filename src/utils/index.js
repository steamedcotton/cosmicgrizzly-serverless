const _ = require('lodash');
const Promise = require('bluebird');
const queryString = require('query-string');

const Response = require('../lib/Response');

const isQueryString = function (str) {
    return /=/.test(str);
};

module.exports.parsePayload = (payload) => {
    return new Promise((resolve, reject) => {
        if (_.isObject(payload)) {
            resolve(payload);
        } else if (_.isString(payload)) {
            try {
                const data = JSON.parse(payload);
                resolve(data);
            } catch (e) {
                // If this is not JSON, try to parse as query string
                if (isQueryString(payload)) {
                    resolve(queryString.parse(payload));
                } else {
                    reject(Response.payloadParseError());
                }
            }
        }
    });
};


module.exports.getHeaderFromEvent = (event, header) => {
    return new Promise((resolve) => {
        const headerValue = _.get(event, `headers.${header}`, '');
        return resolve(headerValue);
    });
};


module.exports.createConfigFromEnv = (configMap) => {
    const config = {};
    _.forOwn(configMap, function(value, key) {
        config[key] = _.get(process, `env.${value}`);
    });
    return config;
};