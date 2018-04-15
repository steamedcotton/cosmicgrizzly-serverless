const _ = require('lodash');
const loggly = require('loggly');

const BaseLogger = require('./BaseLogger');

class LogglyLogger extends BaseLogger {
    constructor() {
        super();

        // Get Loggly Settings
        const token = _.get(process, 'env.LOGGLY_API_TOKEN', '');
        const tag = _.get(process, 'env.LOGGING_TAG', 'local');
        const subdomain = _.get(process, 'env.LOGGLY_API_SUBDOMAIN', '');

        this.client = this.setupLogglyClient(token, tag, subdomain);
    }

    setupLogglyClient(token, tag, subdomain) {
        if (this.logLevel === 'debug') {
            console.log(`Configuring Loggly with tag: ${tag} and token: ${token}`);
        }
        return loggly.createClient({
            token,
            subdomain,
            json: true,
            tags: [tag]
        });
    }

    log(level = 'debug', message, extra = {}) {
        this.client.log(_.merge({
            level,
            message
        }, extra));
    };
}

module.exports = LogglyLogger;
