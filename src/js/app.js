module.exports = function(options) {

  var commonBlockchain = options.commonBlockchain;
  var network = options.network;
  var commonWalletNonceStore = options.commonWalletNonceStore;
  var profilesStore = options.profilesStore;

  var bitcoin = require('bitcoinjs-lib');

  /*

    Open Publish state
    ------------------

  */

  var openpublishState = require('openpublish-state')({
    network: network
  });

  /*

    app
    ---
    express

     cors
     body-parser
     express-common-wallet

  */

  var express = require('express');
  var cors = require('cors');
  var bodyParser = require('body-parser');
  var expressCommonWallet = require('express-common-wallet');
  var app = express();
  app.use(cors());
  app.use(bodyParser());
  app.use("/", expressCommonWallet({
    commonWalletNonceStore: commonWalletNonceStore
  }));

  /*

    verification middleware
    -----------------------

    depends on express-common-wallet router middleware

  */

  var verifyTip = function(req, res, next) {
    var verifiedAddress = req.verifiedAddress;
    var sha1 = req.params.sha1;
    if (sha1 && verifiedAddress) {
      openpublishState.findTipsByUser({address: verifiedAddress}, function(err, tips) {
        tips.forEach(function(tip) {
          if (tip.opendoc_sha1 === sha1) {
            req.tipVerified = true;
          }
        });
        next();
      });
    }
    else {
      next();
    }
  };

  var verifyAddress = function(req, res, next) {
    var verifiedAddress = req.verifiedAddress;
    if (!verifiedAddress) {
      return res.status(401).send("Unauthorized");
    } 
    next();
  };

  /*

    get and post comments endpoints
    -------------------------------

  */

  app.get("/profile/:address", verifyAddress, function(req, res) {
    var address = req.params.address;
    profilesStore.get(address, function(err, profile) {
      if (err) {
        res.status(500).send("Error");
      }
      res.status(200).send(profile);
    });
  });

  app.get("/profiles/:addresses", verifyAddress, function(req, res) {
    var addresses = req.params.addresses.split(",");
    profilesStore.getBatch(addresses, function(err, profiles) {
      if (err) {
        res.status(500).send("Error");
      }
      res.status(200).send(profiles);
    });
  });

  app.post("/profile/:address", verifyAddress, function(req, res) {
    var address = req.params.address;
    var verifiedAddress = req.verifiedAddress;
    var network = req.headers["x-common-wallet-network"] == "testnet" ? bitcoin.networks.testnet : bitcoin.networks.bitcoin;
    var profileJSON = req.body.profileJSON;
    var signedProfileJSON = req.body.signedProfileJSON;
    var profileIsVerified;
    try {
      profileIsVerified = bitcoin.Message.verify(verifiedAddress, signedProfileJSON, profileJSON, network);
    }
    catch(e) {
      profileIsVerified = false;
    }
    if (!profileIsVerified || address !== verifiedAddress) {
      return res.status(401).send("Unauthorized");
    }
    var profile;
    try {
      profile = JSON.parse(profileJSON);
    }
    catch (e) {
      return res.status(500).send("Error");
    }
    profilesStore.set(address, profile, function(err, receipt) {
      if (err) {
        res.status(500).send("Error");
      }
      res.status(200).send("ok");
    });
  });

  return app;
}