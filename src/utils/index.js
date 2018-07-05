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


module.exports.getHeaderFromEvent = function(event, header) {
    return new Promise((resolve, reject) => {
        let headerValue;
        if (header.toLowerCase() === 'authorization') {
            headerValue = _.get(event, `headers.Authorization`, _.get(event, `headers.authorization`, ''));
            headerValue = headerValue.replace(/[Bb]earer /, '');
        } else {
            headerValue = _.get(event, `headers.${header}`, '');
        }
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

module.exports.parseJson = (jsonText) => {
    return new Promise((resolve, reject) => {
        try {
            const data = JSON.parse(jsonText);
            resolve(data);
        } catch (e) {
            console.log('Body Text', jsonText);
            reject({ statusCode: 400,
                body: {
                    status: 'JSON_PARSE',
                    error: 'Request must be in valid JSON format'
                }
            });
        }
    });
};

module.exports.getHeaderFromEvent = (event, header) => {
    return new Promise((resolve, reject) => {
        let headerValue;
        if (header.toLowerCase() === 'authorization') {
            console.log('Getting auth header from:', event.headers);
            headerValue = _.get(event, `headers.Authorization`, _.get(event, `headers.authorization`, ''));
            headerValue = headerValue.replace(/[Bb]earer /, '');
            console.log('Token value', headerValue);
        } else {
            headerValue = _.get(event, `headers.${header}`, '');
        }
        return resolve(headerValue);
    });
};