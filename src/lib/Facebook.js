const axios = require('axios');
const querystring = require('querystring');

const { getLogger } = require('./logger');
const Response = require('./Response');
const Cache = require('./Cache');
const cache = new Cache();

const { PROVIDER_FACEBOOK_ID, PROVIDER_FACEBOOK_REDIRECT_URI, PROVIDER_FACEBOOK_SECRET } = process.env;
const FB_SIGNIN_URL = 'https://www.facebook.com/dialog/oauth';
const FB_TOKEN_URL = 'https://graph.facebook.com/v2.10/oauth/access_token';
const FB_VALIDATION_URL = 'https://graph.facebook.com/me';

class Facebook {
    // static signin(context, cb) {
    //     cache.createState()
    //         .then((state) => {
    //             const params = {
    //                 state,
    //                 client_id: PROVIDER_FACEBOOK_ID,
    //                 redirect_uri: PROVIDER_FACEBOOK_REDIRECT_URI,
    //                 scope: 'email'
    //             };
    //             const redirectUrl = `${FB_SIGNIN_URL}?${querystring.stringify(params)}`;
    //             Response.redirect(context, redirectUrl);
    //         })
    //         .catch((err) => {
    //             logger.error(err);
    //             cb(null, Response.catchError(err));
    //         });
    // }
    //
    // static callback(code, state, cb) {
    //     cache.isValidToken(state, null, TYPE_STATE)
    //         .then((valid) => {
    //             if (valid) {
    //                 const params = {
    //                     code,
    //                     client_id: PROVIDER_FACEBOOK_ID,
    //                     client_secret: PROVIDER_FACEBOOK_SECRET,
    //                     redirect_uri: PROVIDER_FACEBOOK_REDIRECT_URI
    //                 };
    //
    //                 logger.debug('Checking token with facebook', { token: code, url: FB_TOKEN_URL });
    //                 return axios.get(FB_TOKEN_URL, { params });
    //             }
    //             throw Response.catchError('State does not match');
    //         })
    //         .then((result) => {
    //             logger.debug('Got result = require(facebook', { token: code, result });
    //             if (result.status === 200) {
    //                 return cache.expireToken(state);
    //             }
    //             throw Response.badRequest('Invalid request to facebook');
    //         })
    //         .then(() => cb(null, Response.success({ message: 'All authed up' })))
    //         .catch((err) => {
    //             logger.error('Error checking token with facebook', { token: code, error: err });
    //             cb(null, Response.catchError(err));
    //         });
    // }
    //
    // static validate(accessToken) {
    //     const params = {
    //         access_token: accessToken
    //     };
    //     logger.debug('Validating access token with facebook', { accessToken, url: FB_VALIDATION_URL });
    //     return axios.get(FB_VALIDATION_URL, { params })
    //         .then((response) => {
    //             if (response.status === 200) {
    //                 return response.data;
    //             }
    //         });
    // }
}

Facebook.providerType = 'facebook';

module.exports = Facebook;
