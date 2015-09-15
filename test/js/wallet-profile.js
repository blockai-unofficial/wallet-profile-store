module.exports = function(options) {

  var commonWallet = options.commonWallet;
  var serverRootUrl = options.serverRootUrl;

  return {
    get: function(address, callback) {
      commonWallet.login(serverRootUrl, function(err, res, body) {
        commonWallet.request({host: serverRootUrl, path: "/profile/" + address }, function(err, res, body) {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            return callback(false, JSON.parse(body));
          }
          else if (res.statusCode >= 400) {
            return callback(res.statusCode, {});
          }
        });
      });
    },
    getBatch: function(addressesArr, callback) {
      var addresses = addressesArr.join(",");
      commonWallet.login(serverRootUrl, function(err, res, body) {
        commonWallet.request({host: serverRootUrl, path: "/profiles/" + addresses }, function(err, res, body) {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            return callback(false, JSON.parse(body));
          }
          else if (res.statusCode >= 400) {
            return callback(res.statusCode, {});
          }
        });
      });
    },
    post: function(profileObj, callback) {
      var address = commonWallet.address;
      var profileJSON = JSON.stringify(profileObj);
      commonWallet.signMessage(profileJSON, function(err, signedProfileJSON) {
        commonWallet.login(serverRootUrl, function(err, res, body) {
          commonWallet.request({host: serverRootUrl, path: "/profile/" + address, method:"POST", form: {"profileJSON": profileJSON, "signedProfileJSON": signedProfileJSON} }, function(err, res, body) {
            var receipt = {
              statusMessage: body,
              statusCode: res.statusCode
            }
            if (res.statusCode >= 200 && res.statusCode < 300) {
              return callback(false, receipt);
            }
            else if (res.statusCode >= 400) {
              return callback(res.statusCode, {});
            }
          });
        });
      });
    }
  }

};