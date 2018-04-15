const _ = require('lodash');

const EmailPasswordAuth = require('../lib/EmailPasswordAuth');
const Account = require('../lib/Account');
const utils = require('../lib/helpers/utils');
const Response = require('../lib/Response');
const Email = require('../lib/Email');

const { getLogger } = require('../lib/logger');

const emailPasswordAuth = new EmailPasswordAuth({});
const account = new Account({});

const logger = getLogger({});

module.exports.emailPasswordAccountSignup = (event, context, callback) => {
    let createParams = {};
    let accountId;
    let params;
    utils.parsePayload(event.body)
        .then((_params) => {
            params = _params;
            logger.debug('Starting create email/password entry', { email: params.email });
            createParams = params;
            return emailPasswordAuth.createEmailPasswordEntry(params.email, params.password);
        })
        .then((results) => {
            accountId = results.accountId;
            return account.addAccount(accountId, results.profileId, { name: createParams.name });
        })
        .then(() => {
            logger.info('Successful creation of email/password entry', { type: 'createEmailPassword', email: params.email, accountId });
            callback(null, Response.success('Account successfully created'));
        })
        .catch((err) => {
            logger.error('Error creating email/password', { error: err });
            callback(null, Response.catchError(err));
        });
};

module.exports.loginWithEmailPassword = (event, context, callback) => {
    logger.debug('Logging in user');
    let accountId;
    let params;
    utils.parsePayload(event.body)
        .then((_params) => {
            params = _params;
            logger.debug('Starting login with email/password', { email: params.email });
            return emailPasswordAuth.checkPassword(params.email, params.password);
        })
        .then((_accountId) => {
            accountId = _accountId;
            return account.getTokensByAccountId(accountId);
        })
        .then((payload) => {
            logger.info('Successful login with email/password', { type: 'loginWithEmailPassword', email: params.email, accountId });
            callback(null, Response.success(payload));
        })
        .catch((err) => {
            callback(null, Response.catchError(err));
        });
};

module.exports.refresh = (event, context, callback) => {
    logger.debug('Starting refresh');
    utils.parsePayload(event.body)
        .then((params) => account.getTokensByRefreshToken(params.refreshToken))
        .then((payload) => {
            logger.info('Successful refresh of token', { type: 'refresh' });
            callback(null, Response.success(payload));
        })
        .catch((err) => {
            callback(null, Response.catchError(err));
        });
};

module.exports.logoutWithToken = (event, context, callback) => {
    logger.debug('Starting logout');
    const authorization = _.get(event, 'headers.Authorization', _.get(event, 'headers.authorization', ''));
    if (_.isEmpty(authorization)) {
        return callback(null, Response.unauthorizedError('Request must have authorization'));
    }
    const token = authorization.replace(/[Bb]earer /, '');
    logger.debug(`Logout with token: ${token}`, { token });
    account.logoutWithToken(token)
        .then((payload) => {
            logger.info('Successful logout with token', { type: 'logoutWithToken' });
            callback(null, Response.success({ message: 'User successfully logged out' }));
        })
        .catch((err) => {
            callback(null, Response.catchError(err));
        });
};

module.exports.sendEmail = (event, context, callback) => {
    const email = new Email();

    email.sendVerificationEmail();
    callback(null, Response.success('boom'));
};
