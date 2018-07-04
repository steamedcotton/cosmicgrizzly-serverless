const _ = require('lodash');

const SUCCESS = 'SUCCESS';
const VALIDATION = 'VALIDATION';
const INCORRECT_TOKEN_PAYLOAD = 'INCORRECT_TOKEN_PAYLOAD';
const SERVER_ERR = 'SERVER_ERR';
const BAD_REQUEST = 'BAD_REQUEST';
const UNAUTHORIZED = 'UNAUTHORIZED';
const PAYLOAD_PARSE_ERROR = 'PAYLOAD_PARSE_ERROR';
const CONFLICT = 'CONFLICT';

const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Credentials': true
};

class Response {
    static success(content) {
        let responseBody;
        if (_.isString(content)) {
            responseBody = { message: content, status: SUCCESS };
        } else {
            responseBody = _.merge({ status: SUCCESS }, content);
        }

        return {
            statusCode: 200,
            body: JSON.stringify(responseBody),
            headers
        };
    }

    static validationError(error) {
        const responseBody = { status: VALIDATION, error: _.get(error, 'details', error) };
        return {
            statusCode: 422,
            body: JSON.stringify(responseBody),
            headers
        };
    }

    static tokenPayload(error) {
        const responseBody = { status: INCORRECT_TOKEN_PAYLOAD, error: _.get(error, 'details', error) };
        return {
            statusCode: 422,
            body: JSON.stringify(responseBody),
            headers
        };
    }

    static badRequest(error) {
        const responseBody = { status: BAD_REQUEST, error: _.get(error, 'details', error) };
        return {
            statusCode: 400,
            body: JSON.stringify(responseBody),
            headers
        };
    }

    static payloadParseError() {
        const responseBody = { status: PAYLOAD_PARSE_ERROR, error: 'Request not in a valid format (JSON)' };
        return {
            statusCode: 400,
            body: JSON.stringify(responseBody),
            headers
        };
    }

    static unauthorizedError(error = 'Request does not have the necessary credentials') {
        const responseBody = { status: UNAUTHORIZED, error };
        return {
            statusCode: 401,
            body: JSON.stringify(responseBody),
            headers
        };
    }

    static conflictError(error = 'Resource already exists') {
        const responseBody = { status: CONFLICT, error };
        return {
            statusCode: 409,
            body: JSON.stringify(responseBody),
            headers
        };
    }

    static catchError(error) {
        // Check if the error is in the response format, if so return
        if (_.has(error, 'body') && _.has(error, 'statusCode')) {
            if (_.isObject(error.body)) {
                error.body = JSON.stringify(error.body);
            }

            return error;
        }

        // The error is thrown = require(the server, handle as a 500
        console.error('Server Error:', error);

        const responseBody = {
            status: SERVER_ERR,
            error: 'Request Failed'
        };

        return {
            statusCode: 500,
            body: JSON.stringify(responseBody),
            headers
        };
    }

    static redirect(context, redirectUrl) {
        context.succeed({
            statusCode: 302,
            headers: {
                Location: redirectUrl
            }
        });
    }
}

module.exports = Response;