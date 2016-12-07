/**
 * Created by Strawmanbobi
 * 2016-11-27
 */

var Constants = require('../mini_poem/configuration/constants');

var Admin = require('../model/admin_dao.js');
var AdminAuth = require('../authority/admin_auth.js');
var MD5 = require('../mini_poem/crypto/md5.js');
var StringUtils = require('../mini_poem/utils/string_utils.js');
var RequestSender = require('../mini_poem/http/request.js');

var Enums = require('../constants/enums.js');
var ErrorCode = require('../constants/error_code.js');
var logger = require('../mini_poem/logging/logger4js').helper;

var enums = new Enums();
var errorCode = new ErrorCode();

var adminAuth = new AdminAuth(REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, null);

var signInService = "/irext/certificate/admin_login";
var changePwService = "/irext/certificate/change_pw";

exports.adminLoginWorkUnit = function (userName, password, callback) {
    var queryParams = new Map();

    var requestSender =
        new RequestSender(EXTERNAL_SERVER_ADDRESS,
            EXTERNAL_SERVER_PORT,
            signInService,
            queryParams);

    var signinInfo = {
        user_name : userName,
        password : password
    };
    requestSender.sendPostRequest(signinInfo,
        function(signInRequestErr, signInResponse) {
            if (signInRequestErr == errorCode.SUCCESS.code && null != signInResponse) {
                var admin = signInResponse;
                var userID,
                    token,
                    key,
                    ttl = 24 * 60 * 60 * 14,
                    timeStamp,
                    admin;
                timeStamp = new Date().getTime();
                token = MD5.MD5(password  + timeStamp);
                token += "," + admin.permissions;
                key = "admin_" + admin.id;
                adminAuth.setAuthInfo(key, token, ttl, function(setAdminAuthErr) {
                    admin.token = token;
                    callback(setAdminAuthErr, admin);
                });
            } else {
                logger.error("admin sign in failed");
                callback(errorCode.FAILED, null);
            }
        });
};

exports.verifyTokenWorkUnit = function (id, token, callback) {
    var key = "admin_" + id;
    adminAuth.validateAuthInfo(key, token, function(validateAdminAuthErr, result) {
        if (validateAdminAuthErr.code == errorCode.SUCCESS.code) {
            logger.info("token validation successfully");
        } else {
            logger.info("token validation failed");
        }
        callback(validateAdminAuthErr);
    });
};

exports.verifyTokenWithPermissionWorkUnit = function (id, token, permissions, callback) {
    var key = "admin_" + id;
    adminAuth.validateAuthInfo(key, token, function(validateAdminAuthErr, result) {
        if (validateAdminAuthErr.code == errorCode.SUCCESS.code) {
            logger.info("token validation successfully");
            if (undefined != result && null != result && "" != result) {
                if (result.indexOf(permissions) != -1) {
                    callback(errorCode.SUCCESS);
                } else {
                    logger.info("permission do not match");
                    callback(errorCode.AUTHENTICATION_FAILURE);
                }
            }
        } else {
            logger.info("token validation failed");
            callback(validateAdminAuthErr);
        }
    });
};

exports.sendChangePwMailWorkUnit = function (userName, callback) {
    var queryParams = new Map();

    var requestSender =
        new RequestSender(EXTERNAL_SERVER_ADDRESS,
            EXTERNAL_SERVER_PORT,
            changePwService,
            queryParams);

    var userInfo = {
        user_name : userName
    };
    requestSender.sendPostRequest(userInfo,
        function(changePwRequestErr, changePwResponse) {
            if (changePwRequestErr == errorCode.SUCCESS.code && null != changePwResponse) {
                callback(errorCode.SUCCESS);
            } else {
                callback(errorCode.FAILED);
            }
        });
};

exports.confirmPasswordWorkUnit = function(id, fetchKey, callback) {
    adminAuth.getAuthInfo(fetchKey, function(getAuthInfoErr, result) {
        if (errorCode.SUCCESS.code == getAuthInfoErr.code) {
            logger.info("succeeded to fetch ciphered password value " + result);
            Admin.updatePasswordByID(id, result, function(updateAdminErr, updatedAdmin) {
                callback(updateAdminErr);
            });
        } else {
            logger.info("failed to fetch ciphered password value");
            callback(errorCode.FAILED);
        }
    });
};