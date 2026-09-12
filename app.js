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
  getDoc,
  updateDoc,
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

// 현재 로그인한 사용자 정보 및 역할 ('teacher' 또는 'student')
let currentUser = null;
let currentUserRole = "student";


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
// 로그인한 사용자만 가능하며, 입력 내용이 5글자 이상일 때만 저장됩니다.
async function addMemo(text) {
  if (!currentUser) {
    alert("로그인 후 메모를 작성할 수 있습니다.");
    return;
  }

  if (!text || text.length < 5) {
    return;
  }

  await addDoc(memosCol, {
    text: text,
    uid: currentUser.uid,
    authorName: currentUser.displayName || "익명",
    createdAt: serverTimestamp()
  });
}

// 메모를 지웁니다.
// Firestore의 memos 컬렉션에서 해당 ID의 문서를 삭제합니다. (교사만 권한 부여)
async function deleteMemo(id) {
  if (currentUserRole !== "teacher") {
    alert("메모 삭제 권한은 교사에게만 있습니다.");
    return;
  }
  await deleteDoc(doc(db, "memos", id));
}

// AI 코멘트를 요청하고 Firestore에 저장합니다. (교사만 권한 부여)
async function requestAiComment(memoId, text) {
  if (currentUserRole !== "teacher") {
    alert("AI 코멘트 요청 권한은 교사에게만 있습니다.");
    return;
  }

  try {
    const res = await fetch("/api/gemini", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `서버 오류 (${res.status})`);
    }

    const data = await res.json();
    if (data.comment) {
      // Firestore 메모 문서에 aiComment 필드 업데이트
      await updateDoc(doc(db, "memos", memoId), {
        aiComment: data.comment
      });
      await render();
    }
  } catch (err) {
    console.error("AI 코멘트 요청 실패:", err);
    alert("AI 코멘트를 가져오지 못했습니다: " + err.message);
  }
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

  // 상단 버튼 영역 (교사용)
  if (currentUserRole === "teacher") {
    const actions = document.createElement("div");
    actions.className = "memo-actions";

    // AI 코멘트 생성 버튼
    const aiBtn = document.createElement("button");
    aiBtn.textContent = memo.aiComment ? "🤖 AI 재작성" : "🤖 AI 코멘트";
    aiBtn.title = "Gemini AI 코멘트 달기";
    aiBtn.addEventListener("click", async function () {
      aiBtn.disabled = true;
      aiBtn.textContent = "생성 중...";
      await requestAiComment(memo.id, memo.text);
      aiBtn.disabled = false;
    });
    actions.appendChild(aiBtn);

    // 삭제 버튼
    const del = document.createElement("button");
    del.textContent = "×";
    del.title = "삭제 (교사 전용)";
    del.addEventListener("click", async function () {
      await deleteMemo(memo.id);
      await render();
    });
    actions.appendChild(del);

    div.appendChild(actions);
  }

  // 메모 본문
  const textDiv = document.createElement("div");
  textDiv.className = "memo-text";
  textDiv.textContent = memo.text;
  div.appendChild(textDiv);

  // AI 코멘트가 있을 경우 표시
  if (memo.aiComment) {
    const aiDiv = document.createElement("div");
    aiDiv.className = "ai-comment";

    const aiTitle = document.createElement("div");
    aiTitle.className = "ai-comment-title";
    aiTitle.textContent = "🤖 AI 교사 피드백";

    const aiContent = document.createElement("div");
    aiContent.textContent = memo.aiComment;

    aiDiv.appendChild(aiTitle);
    aiDiv.appendChild(aiContent);
    div.appendChild(aiDiv);
  }

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

    if (!currentUser) {
      alert("로그인 후 메모를 입력할 수 있습니다.");
      return;
    }

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

// Firestore의 users/{uid} 문서에서 역할(teacher/student)을 조회합니다.
async function fetchUserRole(uid) {
  try {
    const userDoc = await getDoc(doc(db, "users", uid));
    if (userDoc.exists() && userDoc.data().role) {
      return userDoc.data().role;
    }
  } catch (err) {
    console.error("사용자 역할 조회 실패:", err);
  }
  return "student"; // 기본값은 학생
}

function renderUserArea() {
  userArea.innerHTML = "";

  if (currentUser) {
    const roleBadge = currentUserRole === "teacher" ? " [교사]" : " [학생]";
    const userInfo = document.createElement("span");
    userInfo.textContent = `${currentUser.displayName || currentUser.email}님${roleBadge} 환영합니다! `;
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

// 로그인 상태 감지 및 역할 동기화
onAuthStateChanged(auth, async function (user) {
  currentUser = user;
  if (user) {
    currentUserRole = await fetchUserRole(user.uid);
  } else {
    currentUserRole = "student";
  }
  renderUserArea();
  render(); // 역할에 따라 삭제 버튼 등 권한 UI 갱신
});


// 첫 화면 그리기
render();
input.focus();
