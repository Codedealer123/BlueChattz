import { initializeApp } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-app.js";
import { getDatabase, ref, push, onChildAdded, get } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-database.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.0.0/firebase-auth.js";

// 🔧 Replace with your Firebase project config
const firebaseConfig = {
  apiKey: "AIzaSyCLazp2qv4DNxsMHG8qOFSOcjEjL27MVjk",
  authDomain: "bluechatz-cdgamez.firebaseapp.com",
  projectId: "bluechatz-cdgamez",
  storageBucket: "bluechatz-cdgamez.firebasestorage.app",
  messagingSenderId: "656327817979",
  appId: "1:656327817979:web:d659d8a6db013b3ed9ce5e"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

let currentUserEmail = null;

// 🔐 Prompt login/signup
function promptLogin() {
  const email = prompt("Enter your email:");
  const password = prompt("Enter your password:");

  signInWithEmailAndPassword(auth, email, password)
    .then(() => {
      console.log("Signed in as:", email);
    })
    .catch((error) => {
      if (error.code === "auth/user-not-found") {
        // Auto-create account
        createUserWithEmailAndPassword(auth, email, password)
          .then(() => {
            alert("Account created and signed in!");
          })
          .catch((err) => {
            console.error("Signup error:", err);
            alert("Signup failed: " + err.message);
          });
      } else {
        console.error("Login error:", error);
        alert("Login failed: " + error.message);
      }
    });
}

// 🔄 Watch auth state
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUserEmail = user.email;
    console.log("Logged in as:", currentUserEmail);
    initChat();
  } else {
    promptLogin();
  }
});

function initChat() {
  const params = new URLSearchParams(window.location.search);
  const roomNumber = params.get('roomNumber');

  if (!roomNumber) {
    alert("No room number provided. Redirecting...");
    window.location.href = "index.html";
    return;
  }

  document.getElementById("roomInfo").innerText = `Room: ${roomNumber}`;
  const messagesRef = ref(db, `rooms/${roomNumber}/messages`);

  // 👂 Listen for messages
  onChildAdded(messagesRef, (data) => {
    const { text, sender } = data.val();
    const msgEl = document.createElement("div");
    msgEl.className = "message";

    const senderName = (sender === currentUserEmail) ? "You" : getDisplayName(sender);
    msgEl.textContent = `${senderName}: ${text}`;

    document.getElementById("messages").appendChild(msgEl);
    scrollToBottom();
  });

  // 📩 Send message
  window.sendMessage = function () {
    const input = document.getElementById("messageInput");
    const text = input.value.trim();
    if (!text) return;

    push(messagesRef, {
      text,
      sender: currentUserEmail,
      timestamp: Date.now()
    });

    input.value = "";
    document.getElementById("sendButton").disabled = true;
  };

  // 📝 Enable/disable Send button
  document.getElementById("messageInput").addEventListener("input", function () {
    const text = this.value.trim();
    document.getElementById("sendButton").disabled = !text;
  });

  // 🕐 Show if no messages
  get(messagesRef).then((snapshot) => {
    if (!snapshot.exists()) {
      document.getElementById("messages").innerText = "No messages yet. Be the first to send one!";
    }
  });
}

// 🧠 Convert email to name (e.g., "john.doe@gmail.com" → "John.doe")
function getDisplayName(email) {
  if (!email) return "Unknown";
  const name = email.split("@")[0];
  return name.charAt(0).toUpperCase() + name.slice(1);
}

// 🔽 Scroll to bottom
function scrollToBottom() {
  const messagesDiv = document.getElementById("messages");
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}
