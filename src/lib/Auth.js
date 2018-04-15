const jwt = require('jwt-simple');
const Promise = require('bluebird');
const { getLogger } = require('./logger');
const Response = require('./Response');

let instance = null;
let logger = null;

class Auth {
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

    resourceCheck(jwtToken, resource, principalId, methodArn) {
        return new Promise((resolve, reject) => {
            let decodedToken;
            try {
                decodedToken = jwt.decode(jwtToken, this.jwtSecret);
            } catch (err) {
                logger.debug('Unable to decode jwtToken', { jwtToken });
                return resolve(Auth.generatePolicy(principalId, Auth.EFFECT_DENY, methodArn));
                //return reject('Unable to decode jwtToken');
            }

            const currentDate = new Date().getTime();

            if (!decodedToken.exp || decodedToken.exp < currentDate) {
                logger.debug('Token expired', { decodedToken });
                return reject(Auth.generatePolicy(principalId, Auth.EFFECT_DENY, methodArn));
            }

            // this is where we would check to see if the token is valid for the given resource
            resolve(Auth.generatePolicy(principalId, Auth.EFFECT_ALLOW, methodArn));
        });
    }

    static generatePolicy(principalId, effect, resource) {
        if (effect !== Auth.EFFECT_ALLOW && effect !== Auth.EFFECT_DENY) {
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

Auth.EFFECT_ALLOW = 'Allow';
Auth.EFFECT_DENY = 'Deny';

module.exports = Auth;
