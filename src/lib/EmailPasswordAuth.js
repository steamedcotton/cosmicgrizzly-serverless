const AWS = require('aws-sdk'); // eslint-disable-line const/no-extraneous-dependencies
const Promise = require('bluebird');
const _ = require('lodash');
const bcrypt = require('bcrypt-nodejs');
const Joi = require('joi');
const moment = require('moment');

const Response = require('./Response');
const Account = require('./Account');
const Email = require('./Email');
const Cache = require('./Cache');
const { getLogger } = require('./logger');
const { emailAndPassword } = require('./schemas');

const awsConfig = {
    region: process.env.REGION || AWS.config.region || 'us-east-1',
};

const dynamodb = new AWS.DynamoDB.DocumentClient(awsConfig);

let instance = null;
let logger = null;

class EmailPasswordAuth {
    constructor(config) {
        const { emailPasswordTable } = config;
        this.time = new Date();

        if (!instance) {
            instance = this;
            this.emailPasswordTable = emailPasswordTable || process.env.TBL_EMAIL_PASSWORD;
            this.email = new Email(config);
            this.cache = new Cache(config);
            logger = getLogger(config);
            logger.debug('EmailPassword initialized');
        }

        return instance;
    }

    // API Methods (used by rest endpoints)
    createEmailPasswordEntry(email, password, isVerified = false) {
        const params = { email, password };
        const joiResult = Joi.validate(params, emailAndPassword);
        if (joiResult.error) {
            console.log('JOI ERROR');
            return Promise.reject(Response.validationError('You must provide a valid email and password'));
        }

        return this.getEmailPasswordEntry(email)
            .then((entry) => {
                console.log('HERE 1');
                // Reject if there an entry already exists
                if (!_.isEmpty(entry)) {
                    return Promise.reject(Response.validationError('You must provide a valid email and password'));
                }
                const newAccountId = Account.createNewAccountId();
                return this.addNewEmailPasswordToDB(newAccountId, email, password, isVerified);
            })
            .then((result) => {
                console.log('HERE 2');
                if (isVerified) {
                    return Promise.resolve(result);
                }
                return this.sendVerificationEmail(result.accountId, email)
                    .then(() => result);
            });
    }

    sendVerificationEmail(accountId, email) {
        logger.debug(`Sending email verification to ${email} for ${accountId}`, { accountId, email });
        let token;
        return this.cache.generateToken()
            .then((_token) => {
                logger.debug(`Token created ${_token}`);
                token = _token;
                return this.cache.insertToken(token, Cache.TYPE_VERIFY_EMAIL, accountId, { email });
            })
            .then(() => this.email.sendVerificationEmail(email, token));
    }

    checkPassword(email, password) {
        logger.debug(`Checking password for ${email}`, { email });
        return this.getEmailPasswordEntry(email)
            .then((entry) => {
                if (_.isEmpty(entry)) {
                    return Promise.reject(Response.unauthorizedError());
                }
                return entry;
            })
            .then((entry) => this.comparePassword(entry, password))
            .then((entry) => {
                logger.debug(`Password match for ${email}: ${entry.passwordMatch}`, { email, accountId: entry.accountId });
                if (!entry.passwordMatch) {
                    return Promise.reject(Response.unauthorizedError('Incorrect password'));
                }
                return entry.accountId;
            });
    }

    getEmailPasswordEntry(email) {
        return new Promise((resolve, reject) => {
            const params = {
                TableName: this.emailPasswordTable,
                Key: { email }
            };

            dynamodb.get(params, (err, data) => {
                if (err) {
                    return reject(Response.catchError(err));
                }
                resolve(_.get(data, 'Item', {}));
            });
        });
    }

    addNewEmailPasswordToDB(accountId, email, password, isVerified = false) {
        return this.hashPassword(password)
            .then((hashedPassword) => {
                const params = {
                    TableName: this.emailPasswordTable,
                    Item: {
                        email,
                        accountId,
                        isVerified,
                        password: hashedPassword,
                        createDate: moment().format()
                    }
                };
                return new Promise((resolve, reject) => {
                    dynamodb.put(params, (err) => {
                        if (err) {
                            reject(Response.catchError(err));
                            return;
                        }
                        resolve({
                            accountId,
                            profileId: email
                        });
                    });
                });
            });
    }

    comparePassword(entry, candidatePassword) {
        return new Promise((resolve, reject) => {
            bcrypt.compare(candidatePassword, entry.password, (err, isMatch) => {
                if (err) {
                    reject(Response.catchError(err));
                    return;
                }
                const tempEntry = _.clone(entry);
                tempEntry.passwordMatch = isMatch;
                resolve(tempEntry);
            });
        });
    }

    hashPassword(password) {
        return new Promise((resolve, reject) => {
            bcrypt.genSalt(10, (saltErr, salt) => {
                if (saltErr) {
                    reject(Response.catchError(saltErr));
                    return;
                }
                bcrypt.hash(password, salt, null, (hashErr, hash) => {
                    if (hashErr) {
                        reject(Response.catchError(hashErr));
                        return;
                    }
                    resolve(hash);
                });
            });
        });
    }

    verifyEmailAccount(email) {
        logger.debug(`Setting verification flag for ${email} to true`, { email });
        const params = {
            TableName: this.emailPasswordTable,
            Key: { email },
            AttributeUpdates: {
                isVerified: {
                    Action: 'PUT',
                    Value: true
                },
                verifiedDate: {
                    Action: 'PUT',
                    Value: moment().format()
                }
            }
        };
        return new Promise((resolve, reject) => {
            dynamodb.update(params, (err) => {
                if (err) {
                    reject(Response.catchError(err));
                    return;
                }
                resolve({ email });
            });
        });
    }

    activateAccountWithToken(token) {
        logger.debug(`Activating email account with token`, { token });
        return this.cache.getToken(token, Cache.TYPE_VERIFY_EMAIL)
            .then((token) => {
                console.log('token', token);
                if (!_.has(token, 'email')) {
                    throw new Error('No email address found for provided token');
                }
                return this.verifyEmailAccount(token.email);
            });
    }
}

module.exports = EmailPasswordAuth;
