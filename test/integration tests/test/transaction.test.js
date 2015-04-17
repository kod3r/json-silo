/**
 * Copyright reelyActive 2015
 * We believe in an open Internet of Things
 */
 
var EncryptionManager  = require('json-silo/lib/encryptionmanager');

var encryptionManager = new EncryptionManager();
var pubKey;
var reelyActiveToken;

describe("DATA TRANSACTION", function() {

  before(function(done) {

    this.timeout(30000);

    async.series([

      // Login the User
      function(callback) {

        request(url)
          .put('login')
          .send(testUser)

          .end(function(err, res) {
            if (err) {
              throw err;
            }

            testUser.token = res.body.data;
            callback();
          });
      },

      // Register reelyActive
      function(callback) {

        request(url)
          .put('reelyActive')
          .set('Authorization', 'Bearer ' + testUser.token)
          .send()

          .end(function(err, res) {
            if (err) {
              throw err;
            }

            reelyActiveToken = res.body.data.token;
            callback();
          });
      },

      // Save some dummy data
      function(callback) {
        request(url)
          .put('data')
          .set('Authorization', 'Bearer ' + testUser.token)
          .send(testData)

          .end(function(err, res) {
            if (err) {
              throw err;
            }
            callback();
          });
      },

      // Generate a private / public pair
      function(callback) {
        request(url)
          .put('keygen')
          .set('Authorization', 'Bearer ' + testUser.token)
          .send( { "password" : testUser.password } )

          .end(function(err, res) {
            if (err) {
              throw err;
            }
            callback();
          });
      },

      // Read the public Key
      function(callback) {
        fs.readFile('public_key.asc', 'ascii', function (err, key) {
          if (err)
            console.log(err);
          else {
           pubKey = key;
           done();
          }
        });
      },
    ]);
  });

  describe("GET ENCRYPTED INFO", function() {

    it("should return a BADREQUEST because no key was provided", function(done) {

      var requestData = {
        "fields" : ['@type']
      };

      request(url)
        .post('transaction')
        .set('Authorization', 'Bearer ' + reelyActiveToken)
        .send(requestData)

        .end(function(err, res) {
          if (err) {
            throw err;
          }
          
          expect(res.status).to.equal(responseHandler.BADREQUEST);
          done();
        });
    });

    it("should return a BADREQUEST because no fields were provided", function(done) {

      var requestData = {
        "pubkey" : pubKey
      };

      request(url)
        .post('transaction')
        .set('Authorization', 'Bearer ' + reelyActiveToken)
        .send(requestData)

        .end(function(err, res) {
          if (err) {
            throw err;
          }
          
          expect(res.status).to.equal(responseHandler.BADREQUEST);
          done();
        });
    });

    it("should return a BADREQUEST because the key was malformed", function(done) {

      var requestData = {
        "pubkey" : "malformedKey"
      };

      request(url)
        .post('transaction')
        .set('Authorization', 'Bearer ' + reelyActiveToken)
        .send(requestData)

        .end(function(err, res) {
          if (err) {
            throw err;
          }
          
          expect(res.status).to.equal(responseHandler.BADREQUEST);
          done();
        });
    });

    it("should encrypt the data", function(done) {

      var requestData = {
        "pubkey" : pubKey,
        "fields" : ['@type', '@id'],
        "transactionId" : "someId",
        "requestorURI" : "http://stalker.com"
      };

      request(url)
        .post('transaction')
        .set('Authorization', 'Bearer ' + reelyActiveToken)
        .send(requestData)

        .end(function(err, res) {
          if (err) {
            throw err;
          }
          
          expect(res.status).to.equal(responseHandler.OK);
          expect(res.body.data).not.equal(null);
          expect(res.body.data).not.equal(undefined);

          var encryptedData = res.body.data;

          // Decrypt the data
          encryptionManager.decryptData(testUser.password, encryptedData, function(err, decryptedData) {
            if (err)
              console.log(err);
            else {
              expect(decryptedData["@type"]).to.equal(testData.jsonLD["@type"]);
              expect(decryptedData["@id"]).to.equal(testData.jsonLD["@id"]);
              expect(decryptedData["schema:image"]).to.equal(undefined);
              done();
            }
          });
        });
    });

    it("should retreve the transaction log", function(done) {

      request(url)
        .get('transaction')
        .set('Authorization', 'Bearer ' + testUser.token)
        .send()

        .end(function(err, res) {
          if (err) {
            throw err;
          }
          
          expect(res.status).to.equal(responseHandler.OK);
          expect(res.body.data[0]["transactionId"]).to.equal("someId");
          done();
        });
    });
  });
});