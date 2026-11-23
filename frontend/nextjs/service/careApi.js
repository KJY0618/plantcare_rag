// 케어 기록 API 호출
const API = process.env.NEXT_PUBLIC_API_SERVER;

// 오늘 할 일 목록 (D-day 가 작은 순)
export async function getToday() {
  let res;
  try {
    res = await fetch(`${API}/today`);
  } catch {
    throw new Error("서버에 연결할 수 없습니다. 백엔드가 켜져 있는지 확인해 주세요.");
  }
  if (!res.ok) {
    throw new Error("오늘 할 일을 불러오지 못했습니다.");
  }
  return res.json();
}

// 물주기 기록 (오늘 날짜로 저장)
export async function waterPlant(plantId) {
  let res;
  try {
    res = await fetch(`${API}/plants/${plantId}/water`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
  } catch {
    throw new Error("서버에 연결할 수 없습니다. 백엔드가 켜져 있는지 확인해 주세요.");
  }
  if (res.status === 409) {
    throw new Error("아직 물 줄 날이 아닙니다.");
  }
  if (!res.ok) {
    throw new Error("물주기 기록에 실패했습니다.");
  }
  return res.json();
}