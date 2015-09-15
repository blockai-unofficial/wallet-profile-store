var test = require("tape");
var request = require('request');
var env = require('node-env-file');
env('./.env', { raise: false });

var openpublishState = require('openpublish-state')({
  network: "testnet"
});

var __nonces = {};
var commonWalletNonceStore = {
  get: function(address, callback) {
    callback(false, __nonces[address]);
  },
  set: function(address, nonce, callback) {
    __nonces[address] = nonce;
    callback(false, true);
  }
}

var __profiles = {};
var profilesStore = {
  get: function(address, callback) {
    var profile = __profiles[address] || {};
    callback(false, profile);
  },
  getBatch: function(addresses, callback) {
    var profiles = [];
    addresses.forEach(function(address) {
      var profile = __profiles[address] || {};
      profiles.push(profile);
    });
    callback(false, profiles);
  },
  set: function(address, profile, callback) {
    __profiles[address] = profile;
    callback(false, true);
  }
}
var resetProfilesStore = function() {
  __profiles = {};
}

var commonBlockchain = require('mem-common-blockchain');

var app = require("../../src/js/app")({
  commonBlockchain: commonBlockchain,
  commonWalletNonceStore: commonWalletNonceStore,
  profilesStore: profilesStore,
  network: "testnet"
});
var port = 3636;
var serverRootUrl = "http://localhost:" + port;

var testCommonWallet = require('test-common-wallet');

var aliceWallet = testCommonWallet({
  seed: "test",
  network: "testnet",
  commonBlockchain: commonBlockchain
});

var bobWallet = testCommonWallet({
  seed: "test1",
  network: "testnet",
  commonBlockchain: commonBlockchain
});

var walletProfileAlice = require("./wallet-profile")({
  serverRootUrl: serverRootUrl,
  commonWallet: aliceWallet
});
var walletProfileBob = require("./wallet-profile")({
  serverRootUrl: serverRootUrl,
  commonWallet: bobWallet
});

test("should get empty profiles for address", function(t) {
  var address = aliceWallet.address;
  var server = app.listen(port, function() {
    aliceWallet.login(serverRootUrl, function(err, res, body) {
      aliceWallet.request({host: serverRootUrl, path: "/profile/" + address }, function(err, res, body) {
        t.equal(res.statusCode, 200, "GET /profile/" + address + ": 200 statusCode");
        t.equal(body, "{}", "returned empty profile");
        server.close();
        t.end();
      });
    })
  });
});

test("should post a new profile for address", function(t) {
  var address = aliceWallet.address;
  var profile = {
    name: "Alice",
    avatarUrl: "https://alice.com/avatar.jpg"
  }
  var profileJSON = JSON.stringify(profile);
  aliceWallet.signMessage(profileJSON, function(err, signedProfileJSON) {
    var server = app.listen(port, function() {
      aliceWallet.login(serverRootUrl, function(err, res, body) {
        aliceWallet.request({host: serverRootUrl, path: "/profile/" + address, method:"POST", form: {"profileJSON": profileJSON, "signedProfileJSON": signedProfileJSON} }, function(err, res, body) {
          t.equal(res.statusCode, 200, "POST /profile/" + address + ": 200 statusCode");
          t.equal(body, "ok", "response as expected: ok");
          aliceWallet.request({host: serverRootUrl, path: "/profile/" + address }, function(err, res, body) {
            t.equal(res.statusCode, 200, "GET /profile/" + address + ": 200 statusCode");
            var _profile = JSON.parse(body);
            t.equal(_profile.name, profile.name, "returned matching profile name");
            t.equal(_profile.avatarUrl, profile.avatarUrl, "returned matching profile avatarUrl");
            profilesStore.get(address, function(err, _profile) {
              t.equal(_profile.name, profile.name, "updated store with proper profile name");
              t.equal(_profile.avatarUrl, profile.avatarUrl, "updated store with proper profile avatarUrl");
              resetProfilesStore();
              server.close();
              t.end();
            });
          });
        });
      });
    });
  });
});

test("should not post a new profile without a signature by address", function(t) {
  var address = aliceWallet.address;
  var profile = {
    name: "Alice",
    avatarUrl: "https://alice.com/avatar.jpg"
  }
  var profileJSON = JSON.stringify(profile);
  var signedProfileJSON = "bunk";
  var server = app.listen(port, function() {
    aliceWallet.login(serverRootUrl, function(err, res, body) {
      aliceWallet.request({host: serverRootUrl, path: "/profile/" + address, method:"POST", form: {"profileJSON": profileJSON, "signedProfileJSON": signedProfileJSON} }, function(err, res, body) {
        t.equal(res.statusCode, 401, "POST /profile/" + address + ": 401 statusCode");
        t.notEqual(body, "ok", "response as expected: anything but 'ok'");
        profilesStore.get(address, function(err, _profile) {
          t.notEqual(JSON.stringify(_profile), profile, "did not update store");
          resetProfilesStore();
          server.close();
          t.end();
        });
      });
    });
  });
});

test("should batch get profiles by a list of comma seperated addresses", function(t) {
  var aliceProfile = { name: "Alice" };
  var bobProfile = { name: "Bob" };
  var addresses = [aliceWallet.address, bobWallet.address].join(",");
  var server = app.listen(port, function() {
    walletProfileAlice.post(aliceProfile, function(err, receipt) {
      walletProfileBob.post(bobProfile, function(err, receipt) {
        aliceWallet.request({host: serverRootUrl, path: "/profiles/" + addresses }, function(err, res, body) {
          t.equal(res.statusCode, 200, "GET /profiles/" + addresses + ": 200 statusCode");
          var profiles = JSON.parse(body);
          t.equal(profiles[0].name, aliceProfile.name, "should be aliceProfile");
          t.equal(profiles[1].name, bobProfile.name, "should be bobProfile");
          resetProfilesStore();
          server.close();
          t.end();
        });
      });
    });
  });
});