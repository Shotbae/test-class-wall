// Firebase & Firestore 초기화
// ===================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

// Firebase 프로젝트 설정
const firebaseConfig = {
  apiKey: "AIzaSyBNKHy5tGjN66-67b3Ki9Tk6D_0veC4nvA",
  authDomain: "hongikgh-hanje.firebaseapp.com",
  projectId: "hongikgh-hanje",
  storageBucket: "hongikgh-hanje.firebasestorage.app",
  messagingSenderId: "958709864162",
  appId: "1:958709864162:web:5db43df480321253edb0bb"
};

// Firebase 및 Firestore, Auth 객체 생성
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
const memosCol = collection(db, "memos");

// 현재 로그인한 사용자 정보
let currentUser = null;


// ===================================================
// 데이터를 다루는 함수 세 개 (Firestore 연동)
// ===================================================

// 메모를 읽어 옵니다.
// Firestore의 memos 컬렉션에서 createdAt 순으로 가져옵니다.
async function loadMemos() {
  const q = query(memosCol, orderBy("createdAt", "asc"));
  const snapshot = await getDocs(q);
  const result = [];
  snapshot.forEach(function (docSnap) {
    result.push({
      id: docSnap.id,
      ...docSnap.data()
    });
  });
  return result;
}

// 메모를 새로 씁니다.
// Firestore의 memos 컬렉션에 새 문서를 추가합니다.
// 입력 내용이 5글자 이상일 때만 저장됩니다.
async function addMemo(text) {
  if (!text || text.length < 5) {
    return;
  }
  await addDoc(memosCol, {
    text: text,
    createdAt: serverTimestamp()
  });
}

// 메모를 지웁니다.
// Firestore의 memos 컬렉션에서 해당 ID의 문서를 삭제합니다.
async function deleteMemo(id) {
  await deleteDoc(doc(db, "memos", id));
}


// ===================================================
// 화면 그리기
// ===================================================

async function render() {
  const wall = document.getElementById("wall");
  wall.innerHTML = "";

  const memos = await loadMemos();
  memos.forEach(function (memo) {
    wall.appendChild(makeMemo(memo));
  });
}

// 메모 한 장 만들기
function makeMemo(memo) {
  const div = document.createElement("div");
  div.className = "memo";

  const del = document.createElement("button");
  del.textContent = "×";
  del.addEventListener("click", async function () {
    await deleteMemo(memo.id);
    await render();
  });
  div.appendChild(del);

  const span = document.createElement("span");
  span.textContent = memo.text;
  div.appendChild(span);

  return div;
}


// ===================================================
// 메모 쓰는 칸
// 엔터를 누르면 담벼락에 붙습니다 (줄바꿈은 Shift + 엔터)
// ===================================================

const input = document.getElementById("input");

input.addEventListener("keydown", async function (e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();

    const text = input.value.trim();
    if (text === "") return;

    if (text.length < 5) {
      alert("메모는 5글자 이상 입력해 주세요.");
      return;
    }

    input.value = "";
    await addMemo(text);
    await render();
  }
});


// ===================================================
// 사용자 로그인 / 로그아웃 영역
// ===================================================

const userArea = document.getElementById("userArea");

function renderUserArea() {
  userArea.innerHTML = "";

  if (currentUser) {
    const userInfo = document.createElement("span");
    userInfo.textContent = `${currentUser.displayName || currentUser.email}님 환영합니다! `;
    userInfo.style.marginRight = "10px";

    const logoutBtn = document.createElement("button");
    logoutBtn.textContent = "로그아웃";
    logoutBtn.addEventListener("click", async function () {
      await signOut(auth);
    });

    userArea.appendChild(userInfo);
    userArea.appendChild(logoutBtn);
  } else {
    const loginBtn = document.createElement("button");
    loginBtn.textContent = "Google 계정으로 로그인";
    loginBtn.addEventListener("click", async function () {
      try {
        await signInWithPopup(auth, googleProvider);
      } catch (err) {
        console.error("로그인 실패:", err);
        alert("로그인에 실패했습니다: " + err.message);
      }
    });

    userArea.appendChild(loginBtn);
  }
}

// 로그인 상태 감지
onAuthStateChanged(auth, function (user) {
  currentUser = user;
  renderUserArea();
});


// 첫 화면 그리기
render();
input.focus();
