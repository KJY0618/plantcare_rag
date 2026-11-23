// 도감 API 호출
const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function getAllSpecies() {
    const res = await fetch(`${BASE}/species`);
    return res.json();
}