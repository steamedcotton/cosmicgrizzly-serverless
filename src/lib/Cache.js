const AWS = require('aws-sdk'); // eslint-disable-line const/no-extraneous-dependencies
const _ = require('lodash');
const crypto = require('crypto');
const Promise = require('bluebird');
const moment = require('moment');

const { getLogger } = require('./logger');
const Response = require('./Response');

AWS.config.setPromisesDependency(Promise);

const TOKEN_SIZE = 48;

const TYPE_STATE = 'STATE';
const TYPE_REFRESH = 'REFRESH';
const TYPE_VERIFY_EMAIL = 'EMAIL_VERIFICATION';

const config = {
    region: AWS.config.region || process.env.REGION || 'us-east-1',
};

// TODO: Add support for other caching options
const dynamodb = new AWS.DynamoDB.DocumentClient(config);

let instance = null;
let logger = null;

class Cache {
    constructor(config) {
        const { cacheTable, cacheTableAccountIdIndex } = config;
        this.time = new Date();

        if (!instance) {
            instance = this;
            this.cacheTable = cacheTable || process.env.TBL_CACHE;
            this.cacheTableAccountIdIndex = cacheTableAccountIdIndex || process.env.TBL_CACHE_ACCOUNT_INDEX;
            logger = getLogger(config);
            logger.debug(`Initializing Cache Table: ${this.cacheTable} and AccountId Index: ${this.cacheTableAccountIdIndex}`);
        }

        return instance;
    }

    // Create a state token type (for redirect flow)
    createState() {
        let state = '';
        return this.generateToken()
            .then((token) => {
                state = token;
                const params = {
                    TableName: this.cacheTable,
                    Item: {
                        token,
                        type: TYPE_STATE,
                        expired: false,
                        createDate: moment().format()
                    }
                };

                return dynamodb.put(params).promise();
            })
            .then(() => state);
    }

    isValidToken(state, accountId = null, type = TYPE_STATE) {
        return this.getToken(state, type)
            .then((token) => {
                logger.debug(`Checking ${type} token`, { token });
                return accountId === token.accountId && !_.isEmpty(token) && !token.expired;
            });
    }

    generateAndSaveRefreshToken(accountId, oldRefreshToken = false) {
        return this.expireToken(oldRefreshToken, TYPE_REFRESH)
            .then(() => this.generateToken())
            .then((refreshToken) => this.insertToken(refreshToken, TYPE_REFRESH, accountId));
    }

    generateToken(size = TOKEN_SIZE) {
        return new Promise((resolve, reject) => {
            crypto.randomBytes(size, function (err, buffer) {
                if (err) {
                    reject(err);
                }
                resolve(buffer.toString('hex'));
            });
        });
    }

    insertToken(token, type, accountId, extra = {}) {
        logger.debug(`Adding token ${type} -- ${token}`, { type, token, cacheTable: this.cacheTable });
        const params = {
            TableName: this.cacheTable,
            Item: _.merge(extra, {
                token,
                type,
                accountId,
                expired: false,
                createDate: moment().format()
            })
        };
        return dynamodb.put(params).promise()
            .then(() => token)
            .catch((err) => Promise.reject(Response.catchError(err)));
    }

    getToken(token, type = TYPE_STATE) {
        const params = {
            TableName: this.cacheTable,
            // TODO: Use the type to better limit the projected fields
            // ProjectionExpression: '#token, #type, expired, accountId',
            KeyConditionExpression: '#token = :token and #type = :type',
            ExpressionAttributeNames: {
                '#token': 'token',
                '#type': 'type'
            },
            ExpressionAttributeValues: {
                ':token': token,
                ':type': type
            }
        };

        return dynamodb
            .query(params).promise()
            .then((data) => {
                logger.debug('Token retrieved', { token, type, data });
                return _.first(_.get(data, 'Items', []));
            })
            .catch((err) => Promise.reject(Response.catchError(err)));
    }

    expireToken(token, type = TYPE_STATE) {
        // TODO: Change to delete or update (to keep user id)
        if (!token) {
            logger.debug('No token to delete', { token, type });
            return Promise.resolve();
        }

        logger.debug(`Deleting token: ${token}`, { token });
        const deleteParams = {
            TableName: this.cacheTable,
            Key: {
                token,
                type
            }
        };
        return dynamodb.delete(deleteParams).promise()
            .catch((err) => Promise.reject(Response.catchError(err)));
    }

    expireAllTokensForAccountId(accountId) {
        if (!accountId) {
            return Promise.reject('Must provide a valid account ID');
        }

        const queryParams = {
            TableName: this.cacheTable,
            IndexName: this.cacheTableAccountIdIndex,
            KeyConditionExpression: 'accountId = :accountId',
            ExpressionAttributeValues: {
                ':accountId': accountId
            }
        };

        // TODO: Raise the number of concurrent updates when we increase the number of writes on an index
        return dynamodb.query(queryParams).promise()
            .then((results) => results.Items)
            .map((item) => this.expireToken(item.token, TYPE_REFRESH), { concurrency: 1 })
            .catch((err) => Promise.reject(Response.catchError(err)));
    }

}

Cache.TYPE_STATE = TYPE_STATE;
Cache.TYPE_REFRESH = TYPE_REFRESH;
Cache.TYPE_VERIFY_EMAIL = TYPE_VERIFY_EMAIL;

module.exports = Cache;
