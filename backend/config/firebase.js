const admin = require("firebase-admin");

let serviceAccount;

if (process.env.RENDER) {
  // ☁️ PRODUCTION: We are on Render. Parse the JSON from the Environment Variable.
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else {
  // 💻 LOCAL: We are on your computer. Read the local ignored file.
  serviceAccount = require("../firebaseServiceAccount.json");
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

module.exports = admin;












// const admin = require("firebase-admin");
// const serviceAccount = require("../firebaseServiceAccount.json"); // Adjust path if needed

// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount)
// });

// module.exports = admin;