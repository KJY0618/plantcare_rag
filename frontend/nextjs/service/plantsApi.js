// 내 식물 API (B). 백엔드 주소는 .env.local 의 NEXT_PUBLIC_API_SERVER
const API = process.env.NEXT_PUBLIC_API_SERVER;

// 서버 연결 자체가 실패한 경우와 서버가 오류를 돌려준 경우를 구분
async function request(url, options) {
  try {
    return await fetch(url, options);
  } catch {
    throw new Error("서버에 연결할 수 없습니다. 백엔드가 켜져 있는지 확인해 주세요.");
  }
}

async function readError(res) {
  try {
    const body = await res.json();
    // 직접 던진 오류는 문자열, Pydantic 검증 오류는 배열
    if (typeof body.detail === "string") return body.detail;
  } catch {}
  return "입력값을 확인해 주세요.";
}

// 도감 식물 한 건 (등록 화면에서 이름과 계절별 물주기를 보여주기 위해)
export async function getSpeciesBrief(id) {
  const res = await request(`${API}/species/${id}`);
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

// 내 식물 등록. formData 로 보낸다 (사진 때문에 JSON 이 아님). 성공하면 { id }
export async function createPlant(formData) {
  const res = await request(`${API}/plants`, { method: "POST", body: formData });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}