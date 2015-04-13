var response           = require('../responsehandler');
var EncryptionManager  = require('../encryptionmanager');
var express            = require('express');
var async              = require('async');
var router             = express.Router();

router.route('/')
  .put(function(req, res) {

      async.waterfall([

        // Authenticate the User
        function(callback) { authenticate(req, res, callback); },

        // Check that the User has provided a valid password
        function(user, callback) { checkPassword(req, res, user, callback); },

        // Generate the keys
        function(user, callback) { replaceKeys(req, res, user, callback); },

      ],
      function(err, done) {
        sendResponse(err, res, done);
      });
    });

/**
 * Authenticates the User
 * @param {Object} res The response to send
 * @param {Object} req The request sent
 * @param {function} callback to call on completion
 *
 * This function may fail for one of the following reasons:
 *
 * BADREQUEST     Invalid token syntax
 *
 * UNAUTHORIZED   Invalid token
 */
function authenticate(req, res, callback) {

  var bearerHeader  = req.headers["authorization"];

  req.instance.silomanager.authenticate(bearerHeader, function(err, user) {
            
    if (err) {  

      if ( (err.name === 'Illegal Argument' || 
            err.name === 'JsonWebTokenError')) {
        
        var error = new Error('The token provided is not valid.')
        error.http_code = response.STATUS.BADREQUEST;
        return response.error(error, res);
      }

      return callback(err, null);
    }

    if  (user.type !== 'user') {
      var error = new Error('The token provided is not valid.')
      error.http_code = response.STATUS.UNAUTHORIZED;
      return response.error(error, res);
    }

    return callback(null, user);
  });
}

/**
 * Checks whether a password has been provided.
 * @param {Object} res The response to send
 * @param {Object} req The request sent
 * @param {Object} user to check password
 * @param {function} callback to call on completion
 *
 * This function may fail for one of the following reasons:
 *
 * BADREQUEST     No password provided.
 *
 * UNAUTHORIZED   Password is invalid.
 */
 function checkPassword(req, res, user, callback) {

  var encryptionManager = new EncryptionManager();
  var password = req.body.password;

  if (!password) {
    var error = new Error('No password provided');
    error.http_code = response.STATUS.BADREQUEST;
    return response.error(error, res);
  }

  encryptionManager.validPass(password, user.password, function(err, isMatch) {

    if (err) 
      return callback(err, null);

    if (!isMatch) {
      var error = new Error('The password provided is not valid.')
      error.http_code = response.STATUS.UNAUTHORIZED;
      return response.error(error, res);
    }

    return callback(null, user);
  });
}

/**
 * Creates a public/private key pair and saves them in the root folder.
 * @param {Object} res The response to send
 * @param {Object} req The request sent
 * @param {Object} user
 * @param {function} callback to call on completion
 *
 * This function may fail for one of the following reasons:
 *
 * BADREQUEST     No password provided.
 *
 * UNAUTHORIZED   Password is invalid.
 */
function replaceKeys(req, res, user, callback) {

  var encryptionManager = new EncryptionManager();
  var password = req.body.password;

  encryptionManager.keygen(user.email, password, function(err) {

    if (err) 
      return callback(err, null);

    return callback(null, true)
  });
}

/**
 * Sends the final response
 * @param {Object} err The error that occured (if any)
 * @param {Object} req The request sent
 * @param {Object} results of the query
 *
 * This function may fail for one of the following reasons:
 *
 * INTERNALSERVERERROR   The DB or JWT encountered an error
 */
function sendResponse(err, res, results) {

  if (err) {

    if (err.http_code)
      return response.error(err, res);

    var error = new Error(err);
    error.http_code = response.STATUS.INTERNALSERVERERROR;
    return response.error(error, res);
  }

  var data = 'New public/private key pair generated';
  return response.data(data, res);
}

module.exports = router;