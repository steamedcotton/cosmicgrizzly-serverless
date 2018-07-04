const AWS = require('aws-sdk'); // eslint-disable-line const/no-extraneous-dependencies
const jwt = require('jwt-simple');
const uuidv4 = require('uuid/v4');
const _ = require('lodash');
const Promise = require('bluebird');
const moment = require('moment');

const { getLogger } = require('./logger');
const Response = require('./Response');
const Cache = require('./Cache');

const awsConfig = {
    region: process.env.REGION || AWS.config.region || 'us-east-1',
};

const dynamodb = new AWS.DynamoDB.DocumentClient(awsConfig);

let instance = null;
let logger = null;

class Account {
    constructor(config) {
        const { jwtSecret, accountTable, profileTable, tokenLifeSeconds, jwtPayloadHook } = config;

        this.time = new Date();

        if (!instance) {
            instance = this;
            this.jwtSecret = jwtSecret || process.env.JWT_SECRET;
            this.jwtPayloadHook = _.isFunction(jwtPayloadHook) ? jwtPayloadHook : (payload) => payload;
            this.accountTable = accountTable || process.env.TBL_ACCOUNT;
            this.profileTable = profileTable || process.env.TBL_PROFILE;
            this.cache = new Cache(config);
            this.tokenLifeSeconds = parseInt(tokenLifeSeconds || process.env.TOKEN_LIFESPAN_SECONDS);
            logger = getLogger(config);
            logger.debug('Account initialized');
        }

        return instance;
    }

    static createNewAccountId() {
        const newAccountId = uuidv4();
        logger.info(`New accountId created: ${newAccountId}`, { accountId: newAccountId });
        return newAccountId;
    }

    static normalizeProfile(profileFromProvider) {
        const profile = _.clone(profileFromProvider);

        // Facebook
        if (_.has(profile, 'name') && !_.has(profile, 'given_name') && !_.has(profile, 'family_name')) {
            const nameParts = profile.name.split(' ');
            if (!_.isEmpty(_.first(nameParts))) {
                profile.firstName = _.first(nameParts);
            }
            if (nameParts.length >= 2 && !_.isEmpty(_.last(nameParts))) {
                profile.lastName = _.last(nameParts);
            }
        }
        if (profile.id) {
            profile.profileId = profile.id;
        }

        // Google
        if (profile.sub && !profile.profileId) {
            profile.profileId = profile.sub;
        }
        if (_.has(profile, 'given_name')) {
            profile.firstName = profile.given_name;
        }
        if (_.has(profile, 'family_name')) {
            profile.lastName = profile.family_name;
        }

        return profile;
    }

    returnJwt({ accessToken, refreshToken }) {
        return {
            token_type: 'bearer',
            access_token: accessToken,
            expires_in: this.tokenLifeSeconds,
            refresh_token: refreshToken
        };
    }

    // Used for exchanging a social service (facebook) id for access tokens
    getTokensByProfile(profileFromProvider) {
        const normalizedProfileData = Account.normalizeProfile(profileFromProvider);
        const { profileType, profileId } = normalizedProfileData;
        logger.debug(`[getTokensByProfile] Getting tokens for ${profileType}:${profileId}`, { profileType, profileId });
        return this.getProfile(profileId, profileType)
            .then((storedProfile) => {
                if (_.isEmpty(storedProfile) || !storedProfile.accountId) {
                    return this.addAccountAndProfile(profileId, profileType, normalizedProfileData);
                }
                return this.getAccount(storedProfile.accountId);
            })
            .then((account) => this.getTokensByAccount(account))
            .then((tokens) => this.returnJwt(tokens));
    }

    // Used for generating tokens for a given account ID
    getTokensByAccountId(accountId, oldRefreshToken) {
        logger.debug(`[getTokensByAccountId] Getting tokens for account: ${accountId}`, { accountId });
        return this.getAccount(accountId)
            .then((account) => this.getTokensByAccount(account, oldRefreshToken))
            .then((tokens) => this.returnJwt(tokens));
    }

    // Used for generating a new set of tokens from a refresh token
    getTokensByRefreshToken(refreshToken) {
        return this.cache.getToken(refreshToken, 'REFRESH')
            .then((tokenEntry) => {
                if (_.isEmpty(tokenEntry)) {
                    return Promise.reject(Response.unauthorizedError('Invalid refresh token'));
                }
                return this.getTokensByAccountId(tokenEntry.accountId, refreshToken);
            });
    }

    getTokensByAccount(account, oldRefreshToken = false) {
        logger.debug(`Retrieving tokens for accountId ${account.accountId}`, { accountId: account.accountId });
        const payload = {
            iat: new Date().getTime(),
            sub: account.accountId,
            exp: new Date().getTime() + (this.tokenLifeSeconds * 1000)
        };

        // Allow the extension of the JWT token payload
        const accessTokenPayload = this.jwtPayloadHook(payload, account);

        return this.cache.generateAndSaveRefreshToken(account.accountId, oldRefreshToken)
            .then((refreshToken) => ({
                    refreshToken,
                    accessToken: jwt.encode(accessTokenPayload, this.jwtSecret)
                }));
    }

    getAccount(accountId) {
        logger.debug(`Retrieving Account: ${accountId}`, { accountId });
        const params = {
            TableName: this.accountTable,
            Key: { accountId }
        };

        return dynamodb.get(params).promise()
                .then((data) => _.get(data, 'Item', {}))
                .catch((err) => Promise.reject(Response.catchError(err)));
    }

    addAccount(accountId, profile, data = {}, isAdmin = false) {
        const { profileType, profileId } = profile;
        logger.debug(`Adding account: ${accountId} with profile ${profileType}:${profileId}`, { accountId, profileType, profileId });
        const params = {
            TableName: this.accountTable,
            Item: {
                accountId,
                createDate: moment().format(),
                isAdmin,
                profiles: [profile]
            }
        };

        // Check for additional data from provider and add if exists
        if (data.firstName) {
            params.Item.firstName = data.firstName;
        }
        if (data.lastName) {
            params.Item.lastName = data.lastName;
        }
        if (data.name) {
            params.Item.name = data.name;
        }

        return dynamodb.put(params).promise()
            .catch((err) => Promise.reject(Response.catchError(err)));
    }

    addAccountAndProfile(profileId, profileType, profileData) {
        const newAccountId = Account.createNewAccountId();
        return this.addAccount(newAccountId, { profileId, profileType }, profileData)
            .then(() => this.addProfile(profileId, profileType, newAccountId));
    }

    getProfile(profileId, profileType) {
        logger.debug(`[getProfile] Getting profile ${profileType}:${profileId}`, { profileType, profileId });
        const params = {
            TableName: this.profileTable,
            ProjectionExpression: '#profileId, #profileType, accountId',
            KeyConditionExpression: '#profileId = :profileId and #profileType = :profileType',
            ExpressionAttributeNames: {
                '#profileId': 'profileId',
                '#profileType': 'profileType'
            },
            ExpressionAttributeValues: {
                ':profileId': profileId,
                ':profileType': profileType
            }
        };

        return dynamodb.query(params).promise()
            .then((data) => _.first(_.get(data, 'Items', [])))
            .catch((err) => Promise.reject(Response.catchError(err)));
    }

    addProfile(profileId, profileType, accountId) {
        logger.debug(`Adding profile ${profileType}:${profileId} for account ${accountId}`, { accountId, profileType, profileId });
        const newAccountEntry = {
            profileId,
            profileType,
            accountId,
            createDate: moment().format()
        };
        const params = {
            TableName: this.profileTable,
            Item: newAccountEntry
        };
        return dynamodb.put(params).promise()
            .then(() => newAccountEntry)
            .catch((err) => Promise.reject(Response.catchError(err)));
    }

    logoutWithToken(jwtToken) {
        let decodedToken;
        try {
            decodedToken = jwt.decode(jwtToken, this.jwtSecret);
        } catch (err) {
            logger.debug('Unable to decode jwtToken', { jwtToken });
            return Promise.reject('Unable to decode token');
        }
        logger.debug('Decoded JWT', { decodedToken });
        const accountId = _.get(decodedToken, 'sub', '');
        if (_.isEmpty(accountId)) {
            return Promise.reject('Token does not contain valid account ID');
        }

        return this.logoutWithAccountId(accountId);
    }

    logoutWithAccountId(accountId) {
        return this.cache.expireAllTokensForAccountId(accountId);
    }
}

module.exports = Account;
