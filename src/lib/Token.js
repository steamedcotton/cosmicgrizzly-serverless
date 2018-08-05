const jwt = require('jwt-simple');
const Promise = require('bluebird');
const _ = require('lodash');
const { getLogger } = require('./logger');
const Response = require('./Response');

let instance = null;
let logger = null;

class Token {
    constructor(config) {
        const { jwtSecret } = config;

        this.time = new Date();

        if (!instance) {
            instance = this;
            this.jwtSecret = jwtSecret || process.env.JWT_SECRET;
            logger = getLogger(config);
            logger.debug('Auth initialized');
        }

        return instance;
    }

    encode(token) {
        return jwt.encode(token, this.jwtSecret);
    }

    hasRole(jwtToken, role, customerId = '') {
        return new Promise((resolve, reject) => {
            let decodedToken;
            try {
                decodedToken = jwt.decode(jwtToken, this.jwtSecret);
            } catch (err) {
                logger.debug('Unable to decode jwtToken', { jwtToken });
                return reject(Response.unauthorizedError('Invalid token'));
            }

            const currentDate = new Date().getTime();

            if (!decodedToken.exp || decodedToken.exp < currentDate) {
                logger.debug('Token expired', { decodedToken });
                return reject(Response.unauthorizedError('Token expired'));
            }

            const hasCorrectCID = _.isEmpty(customerId) || decodedToken.cid === customerId || decodedToken.cid === 'FANOSITY';
            const hasCorrectRole = _.has(decodedToken, 'roles') && (decodedToken.roles.includes(role) || decodedToken.roles.includes('admin'));
            logger.debug(`hasCorrectCID: ${hasCorrectCID}  hasCorrectRole: ${hasCorrectRole}`);
            if (!hasCorrectCID || !hasCorrectRole) {
                return reject(Response.unauthorizedError('Token does not contain the proper role to access resource'));
            }

            return resolve();
        });
    }

    getJwtProp(jwtToken, propName) {
        return new Promise((resolve, reject) => {
            let decodedToken;
            try {
                decodedToken = jwt.decode(jwtToken, this.jwtSecret);
            } catch (err) {
                logger.debug('Unable to decode jwtToken', { jwtToken });
                return reject(Response.unauthorizedError('Invalid token'));
            }

            return resolve(_.get(decodedToken, propName, ''));
        });
    }


    resourceCheck(jwtToken, resource, principalId, methodArn) {
        return new Promise((resolve, reject) => {
            let decodedToken;
            try {
                decodedToken = jwt.decode(jwtToken, this.jwtSecret);
            } catch (err) {
                logger.debug('Unable to decode jwtToken', { jwtToken });
                return resolve(Token.generatePolicy(principalId, Token.EFFECT_DENY, methodArn));
                //return reject('Unable to decode jwtToken');
            }

            const currentDate = new Date().getTime();

            if (!decodedToken.exp || decodedToken.exp < currentDate) {
                logger.debug('Token expired', { decodedToken });
                return reject(Token.generatePolicy(principalId, Token.EFFECT_DENY, methodArn));
            }

            // this is where we would check to see if the token is valid for the given resource
            resolve(Token.generatePolicy(principalId, Token.EFFECT_ALLOW, methodArn));
        });
    }

    static generatePolicy(principalId, effect, resource) {
        if (effect !== Token.EFFECT_ALLOW && effect !== Token.EFFECT_DENY) {
            return Response.unauthorizedError(`Effect ${effect} not recognized`);
        }

        const authResponse = {};
        authResponse.principalId = principalId;
        if (effect && resource) {
            const policyDocument = {};
            policyDocument.Version = '2012-10-17';
            policyDocument.Statement = [];
            const statementOne = {};
            statementOne.Action = 'execute-api:Invoke';
            statementOne.Effect = effect;
            statementOne.Resource = resource;
            policyDocument.Statement[0] = statementOne;
            authResponse.policyDocument = policyDocument;
        }
        logger.debug(JSON.stringify(authResponse));
        return authResponse;
    }
}

Token.EFFECT_ALLOW = 'Allow';
Token.EFFECT_DENY = 'Deny';

module.exports = Token;
