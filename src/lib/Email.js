const fs = require('fs');
const path = require('path');
const Promise = require('bluebird');
const _ = require('lodash');
const AWS = require('aws-sdk');
const Mustache = require('mustache');

const emailVerificationParams = require('./templates/verificationParams.json');

const { getLogger } = require('./logger');

const ses = new AWS.SES();

let instance = null;
let logger = null;

class Email {
    constructor(config) {
        const { emailSourceAddress, emailVerificationUrl } = config;

        this.time = new Date();

        if (!instance) {
            instance = this;
            this.sourceAddress = emailSourceAddress || process.env.EMAIL_SOURCE_ADDRESS;
            this.verificationUrl = emailVerificationUrl || process.env.EMAIL_VERIFICATION_URL;
            this.verficationTemplate = 'verificationTemplate01.html';
            logger = getLogger(config);
            logger.debug('Email initialized');
        }

        return instance;
    }

    sendVerificationEmail(emailAddress, validationCode) {
        const templateParams = _.merge(emailVerificationParams, {
            validationCode,
            verificationUrl: `${this.verificationUrl}?code=${validationCode}`,
            emailAddress
        });
        return this.generateVerificationEmailBody(templateParams)
            .then((bodyHtml) => {
                return {
                    Source: this.sourceAddress,
                    Destination: {
                        ToAddresses: ['steamedcotton@gmail.com']
                    },
                    Message: {
                        Subject: {
                            Charset: 'UTF-8',
                            Data: _.get(templateParams, 'subject', 'Email Verification')
                        },
                        Body: {
                            Html: {
                                Charset: 'UTF-8',
                                Data: bodyHtml
                            },
                            Text: {
                                Charset: 'UTF-8',
                                Data: `Browse to this link to verify your email address: ${templateParams.verificationUrl}`
                            }
                        },

                    }
                };
            })
            .then((params) => {
                return new Promise((resolve, reject) => {
                    ses.sendEmail(params, (err, data) => {
                        if (err) {
                            reject(err.stack);
                        } else {
                            resolve(data);
                        }
                    });
                });
            });
    }

    generateVerificationEmailBody(params) {
        const templatePath = path.join(__dirname, 'templates', this.verficationTemplate);
        return new Promise((resolve, reject) => {
            fs.readFile(templatePath, 'utf8', (err, data) => {
                if (err) {
                    return reject(err);
                }
                resolve(Mustache.render(data, params));
            });
        });
    }
}

module.exports = Email;
