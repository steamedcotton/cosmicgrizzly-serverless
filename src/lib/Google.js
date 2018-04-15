const axios = require('axios');
const querystring = require('querystring');
const Response = require('./Response');
const Cache = require('./Cache');
const cache = new Cache();

const logger = require('./logger');

// const { PROVIDER_GOOGLE_ID, PROVIDER_GOOGLE_REDIRECT_URI, PROVIDER_GOOGLE_SECRET } = process.env;
// const FB_SIGNIN_URL = 'https://www.facebook.com/dialog/oauth';
// const FB_TOKEN_URL = 'https://graph.facebook.com/v2.10/oauth/access_token';

const GOOGLE_VALIDATION_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

class Google {
    // OAuth redirect flow: Signin
    // static signin(context, cb) {
    //     cache.createState()
    //         .then((state) => {
    //             const params = {
    //                 state,
    //                 client_id: PROVIDER_GOOGLE_ID,
    //                 redirect_uri: PROVIDER_GOOGLE_REDIRECT_URI,
    //                 scope: 'email'
    //             };
    //             const redirectUrl = `${FB_SIGNIN_URL}?${querystring.stringify(params)}`;
    //             Response.redirect(context, redirectUrl);
    //         })
    //         .catch((err) => {
    //             console.log(err);
    //             cb(null, Response.catchError(err));
    //         });
    // }

    // OAuth redirect flow: Callback
    // static callback(code, state, cb) {
    //     cache.isValidToken(state)
    //         .then((valid) => {
    //             if (valid) {
    //                 const params = {
    //                     code,
    //                     client_id: PROVIDER_GOOGLE_ID,
    //                     client_secret: PROVIDER_GOOGLE_SECRET,
    //                     redirect_uri: PROVIDER_GOOGLE_REDIRECT_URI
    //                 };
    //
    //                 return axios.get(FB_TOKEN_URL, { params });
    //             }
    //             throw Response.catchError('State does not match');
    //         })
    //         .then((result) => {
    //             console.log('Result from google', result);
    //             if (result.status === 200) {
    //                 return cache.expireToken(state);
    //             }
    //             throw Response.badRequest('Invalid request to google');
    //         })
    //         .then(() => cb(null, Response.success({ message: 'All authed up' })))
    //         .catch((err) => {
    //             cb(null, Response.catchError(err));
    //         });
    // }

    static validate(accessToken) {
        const params = {
            access_token: accessToken
        };
        logger.debug('Validating access token with google', { accessToken, url: GOOGLE_VALIDATION_URL });
        return axios.get(GOOGLE_VALIDATION_URL, { params })
            .then((response) => {
                if (response.status === 200) {
                    return response.data;
                }
            });
    }
}

Google.providerType = 'google';

module.exports = Google;
