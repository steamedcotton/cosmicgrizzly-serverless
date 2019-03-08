const { getHeaderFromEvent, parsePayload } = require('./utils');
const Response = require('./lib/Response');
const EmailPasswordAuth = require('./lib/EmailPasswordAuth');
const Account = require('./lib/Account');
const Email = require('./lib/Email');
const Token = require('./lib/Token');
const Auth = require('./Auth');
const { getLogger } = require('./lib/logger');

let instance = null;
let logger = null;

class EventHandler {
    constructor(config) {
        if (!instance) {
            instance = this;
            this.emailPasswordAuth = new EmailPasswordAuth(config);
            this.account = new Account(config);
            this.email = new Email(config);
            this.token = new Token(config);
            this.auth = new Auth(config);

            logger = getLogger(config);
            logger.debug('Finished initiation of CGAuth');
        }

        return instance;
    }

    emailPasswordAccountSignup(event, context, callback) {
        logger.debug('Email password signup');
        parsePayload(event.body)
            .then(({ email = '', password = '' }) => {
                return this.auth.signupWithEmailAndPassword(email, password);
            })
            .catch((err) => {
                callback(null, Response.catchError(err));
            });
    }

    emailPasswordAccountLogin(event, context, callback) {
        logger.debug('Logging in user');
        let accountId;
        let params;
        parsePayload(event.body)
            .then((_params) => {
                params = _params;
                logger.debug('Starting login with email/password', { email: params.email });
                return this.emailPasswordAuth.checkPassword(params.email, params.password);
            })
            .then((_accountId) => {
                accountId = _accountId;
                return this.account.getTokensByAccountId(accountId);
            })
            .then((payload) => {
                logger.info('Successful login with email/password', { type: 'loginWithEmailPassword', email: params.email, accountId });
                callback(null, Response.success(payload));
            })
            .catch((err) => {
                callback(null, Response.catchError(err));
            });
    }

    emailPasswordAccountActivation(event, context, callback) {
        logger.debug('Verifying provided email token');
        let params;
        console.log(event);
        parsePayload(event.body)
            .then((_params) => {
                params = _params;
                logger.debug('Activating account using token', { code: params.code });
                return this.emailPasswordAuth.activateAccountWithToken(params.code);
            })
            .then(() => {
                callback(null, Response.success('Account activated'));
            })
            .catch((err) => {
                logger.error('Error validating email account', { error: err });
                callback(null, Response.catchError(err));
            });
    }

    refresh(event, context, callback) {
        logger.debug('Starting JWT refresh');
        parsePayload(event.body)
            .then((params) => this.account.getTokensByRefreshToken(params.refreshToken))
            .then((payload) => {
                logger.info('Successful refresh of token', { type: 'refresh' });
                callback(null, Response.success(payload));
            })
            .catch((err) => {
                callback(null, Response.catchError(err));
            });
    }

    hasRole(event, role, customerId) {
        return getHeaderFromEvent(event, 'authorization')
            .then((jwtToken) => this.token.hasRole(jwtToken, role, customerId))
    }

    getJwtProp(event, propName) {
        return getHeaderFromEvent(event, 'authorization')
            .then((jwtToken) => this.token.getJwtProp(jwtToken, propName))
    }
}

module.exports = EventHandler;
