const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// =====================================
// 1. 식물 도감 전체 조회
// =====================================
export async function getAllSpecies(keyword = "", light = "") {

    const params = new URLSearchParams();

    if (keyword) params.append("keyword", keyword);
    if (light) params.append("light", light);

    const res = await fetch(`${BASE}/species?${params.toString()}`);

    if (!res.ok) {
        throw new Error("도감 데이터를 불러오지 못했습니다.");
    }

    return res.json();
}

// =====================================
// 2. 식물 도감 한 건 조회
// =====================================
export async function getSpeciesDetail(speciesId) {

    const res = await fetch(`${BASE}/species/${speciesId}`);

    if (!res.ok) {
        throw new Error("식물 상세 정보를 불러오지 못했습니다.");
    }

    return res.json();
}