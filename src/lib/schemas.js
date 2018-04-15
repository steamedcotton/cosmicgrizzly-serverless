const Joi = require('joi');

// Schema for email and password login
module.exports.emailAndPassword = Joi.object().keys({
    email: Joi.string().required(),
    password: Joi.string().required()
});
