// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth"; // 👈 Make sure this is imported!
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAwNdmXeSC8srrELlp3VX_jln3BpYpSxKU",
  authDomain: "medixiq-a13e2.firebaseapp.com",
  projectId: "medixiq-a13e2",
  storageBucket: "medixiq-a13e2.firebasestorage.app",
  messagingSenderId: "867628274547",
  appId: "1:867628274547:web:f3271921f9ca3803a1ab06",
  measurementId: "G-P5FPZ8F2R9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const auth = getAuth(app);