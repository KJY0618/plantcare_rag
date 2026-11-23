
/*
  내 식물 API (B 담당)

  역할:
  Next.js에서 FastAPI 서버로 요청을 보내고
  서버가 반환한 데이터를 받아온다.
*/

// =====================================
// 1. 백엔드 서버 주소
// =====================================

// .env.local에 설정된 서버 주소를 가져온다.
// 환경변수가 없으면 로컬 서버 주소를 사용한다.
const API = (
  process.env.NEXT_PUBLIC_API_SERVER ||
  "http://127.0.0.1:8000"
).replace(/\/$/, "");


// =====================================
// 2. 공통 서버 요청 함수
// =====================================

async function request(url, options = {}) {
  try {
    return await fetch(url, options);

  } catch (error) {
    // 서버 자체에 연결하지 못한 경우
    throw new Error(
      "서버에 연결할 수 없습니다. 백엔드가 켜져 있는지 확인해 주세요."
    );
  }
}


// =====================================
// 3. 서버 오류 메시지 처리
// =====================================

async function readError(res) {
  try {
    const body = await res.json();

    // FastAPI에서 직접 작성한 오류
    if (typeof body.detail === "string") {
      return body.detail;
    }

    // Pydantic 입력값 검증 오류
    if (Array.isArray(body.detail)) {
      return body.detail
        .map(item => item.msg)
        .join(" / ");
    }

  } catch (error) {
    console.error("오류 응답 처리 실패:", error);
  }

  return `요청에 실패했습니다. (${res.status})`;
}


// =====================================
// 4. 식물 도감 상세 조회 (A 담당 API)
// =====================================

// 등록 화면에서 식물 이름과 계절별 물주기 표시
export async function getSpeciesBrief(id) {

  const res = await request(`${API}/species/${id}`);

  if (!res.ok) {
    throw new Error(await readError(res));
  }

  return await res.json();
}


// =====================================
// 5. 내 식물 전체 조회
// GET /plants
// =====================================

// 내 식물 목록 페이지에서 사용
export async function getAllPlants() {

  const res = await request(`${API}/plants`, {
    cache: "no-store"
  });

  if (!res.ok) {
    throw new Error(await readError(res));
  }

  return await res.json();
}


// =====================================
// 6. 내 식물 한 건 조회
// GET /plants/{id}
// =====================================

// 식물 수정 페이지에서 기존 정보를 가져온다.
// 이 API는 C 담당이 구현한다.
export async function getPlantById(id) {

  const res = await request(`${API}/plants/${id}`, {
    cache: "no-store"
  });

  if (!res.ok) {
    throw new Error(await readError(res));
  }

  return await res.json();
}


// =====================================
// 7. 내 식물 등록
// POST /plants
// =====================================

// 사진이 있으므로 FormData 사용
export async function createPlant(formData) {

  const res = await request(`${API}/plants`, {
    method: "POST",
    body: formData
  });

  if (!res.ok) {
    throw new Error(await readError(res));
  }

  return await res.json();
}


// =====================================
// 8. 내 식물 수정
// PUT /plants/{id}
// =====================================

// 기존 식물 정보 수정
export async function updatePlant(id, formData) {

  const res = await request(`${API}/plants/${id}`, {
    method: "PUT",
    body: formData
  });

  if (!res.ok) {
    throw new Error(await readError(res));
  }

  return await res.json();
}


// =====================================
// 9. 내 식물 삭제
// DELETE /plants/{id}
// =====================================

export async function deletePlant(id) {

  const res = await request(`${API}/plants/${id}`, {
    method: "DELETE"
  });

  if (!res.ok) {
    throw new Error(await readError(res));
  }

  return await res.json();
}


// =====================================
// 10. 식물 사진 주소 변환
// =====================================

export function photoSrc(photoUrl) {

  // 사진이 없다면 null 반환
  if (!photoUrl) {
    return null;
  }

  // 농사로 공공데이터 이미지 URL
  if (
    photoUrl.startsWith("http://") ||
    photoUrl.startsWith("https://")
  ) {
    return photoUrl;
  }

  // 브라우저 미리보기용 blob URL
  if (photoUrl.startsWith("blob:")) {
    return photoUrl;
  }

  // 사용자가 업로드한 사진
  // 예: /uploads/abc.jpg
  return `${API}/${photoUrl.replace(/^\/+/, "")}`;
}

// 기존 컴포넌트에서 getPhotoUrl을 쓰는 경우도 지원
export const getPhotoUrl = photoSrc;
