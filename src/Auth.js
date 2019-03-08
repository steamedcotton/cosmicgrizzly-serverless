const { parsePayload, getHeaderFromEvent } = require('./utils');
const { getLogger } = require('./lib/logger');

const EmailPasswordAuth = require('./lib/EmailPasswordAuth');
const Account = require('./lib/Account');
const Response = require('./lib/Response');
const Email = require('./lib/Email');
const Token = require('./lib/Token');

let instance = null;
let logger = null;

class Auth {
    constructor(config) {
        if (!instance) {
            instance = this;
            this.emailPasswordAuth = new EmailPasswordAuth(config);
            this.account = new Account(config);
            this.email = new Email(config);
            this.token = new Token(config);

            logger = getLogger(config);
            logger.debug('Finished initiation of CGAuth');
        }

        return instance;
    }

    async signupWithEmailAndPassword(email, password) {
        try {
            logger.debug('Creating email/password entry', { email });
            const passwordEntry = await this.emailPasswordAuth.createEmailPasswordEntry(email, password);

            const { profileId, accountId } = passwordEntry;
            logger.debug('Adding account', { email, profileId, accountId });
            const newAccount = this.account.addAccount(accountId, profileId);

            return Response.success('Account successfully created', newAccount);
        } catch (e) {
            logger.error('Error creating email/password', { error: e });
            return e;
        }
    }

    getLogger() {
        return logger;
    }

    encodeToken(token) {
        return this.token.encode(token);
    }

    decodeToken(jwtToken) {
        return this.token.decode(jwtToken);
    }
}

module.exports = Auth;
