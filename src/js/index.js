/*

  Environment Variables

*/

var AWS_ACCESS_KEY_ID =  process.env.AWS_ACCESS_KEY_ID;
var AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
var NONCE_TABLE_NAME = process.env.NONCE_TABLE_NAME;
var PROFILES_TABLE_NAME = process.env.COMMENTS_TABLE_NAME;
var PORT = process.env.PORT || 3434;
var BLOCKCHAIN_NETWORK = process.env.BLOCKCHAIN_NETWORK;
var BLOCKCYPHER_TOKEN = process.env.BLOCKCYPHER_TOKEN;

var commonBlockchain = require('blockcypher-unofficial')({
  key: BLOCKCYPHER_TOKEN,
  network: BLOCKCHAIN_NETWORK
});

/*

  commonWalletNonceStore
  ----------------------
  dynamodb

*/

var dynamodb =  require('dynamodb');
var ddb = dynamodb.ddb({ accessKeyId: AWS_ACCESS_KEY_ID, secretAccessKey: AWS_SECRET_ACCESS_KEY });

ddb.createTable(NONCE_TABLE_NAME, { hash: ['address', ddb.schemaTypes().string] }, { read: 10, write: 10 }, function() {});
var commonWalletNonceStore = {
  get: function(address, callback) {
    ddb.getItem(NONCE_TABLE_NAME, address, null, {}, function(err, resp, cap) {
      var nonce = resp.nonce;
      callback(err, nonce);
    });
  },
  set: function(address, nonce, callback) {
    ddb.putItem(NONCE_TABLE_NAME, {address:address, nonce:nonce}, {}, function(err, resp, cap) {
      callback(err, resp);
    });
  }
};

/*

  profilesStore
  -----------------
  dynamodb

*/

ddb.createTable(PROFILES_TABLE_NAME, { hash: ['address', ddb.schemaTypes().string] }, { read: 10, write: 10 }, function() {});
var profilesStore = {
  get: function(address, callback) {
    ddb.getItem(PROFILES_TABLE_NAME, address, null, {}, function(err, resp, cap) {
      var profile = resp.profile;
      callback(err, profile);
    });
  },
  getBatch: function(addresses, callback) {
    var request = {};
    request[PROFILES_TABLE_NAME] = { 
      keys: addresses, 
      attributesToGet: ['profile'] 
    };
    ddb.batchGetItem(request, function(err, resp, cap) {
      var profiles = resp.items;
      callback(err, profiles);
    });
  },
  set: function(address, profile, callback) {
    ddb.putItem(PROFILES_TABLE_NAME, {address:address, profile:profile}, {}, function(err, resp, cap) {
      callback(err, resp);
    });
  }
};

/*

  app

*/

var app = require("./app")({
  commonBlockchain: commonBlockchain,
  commonWalletNonceStore: commonWalletNonceStore,
  profilesStore: profilesStore
});

var server = app.listen(PORT, function() {

});