"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getToday, waterPlant } from "@/service/careApi";
import styles from "./home.module.css";

const API = process.env.NEXT_PUBLIC_API_SERVER;

// 사진 주소 만들기
// 내가 올린 사진은 "/uploads/..." 로 오기 때문에 앞에 서버 주소를 붙임
// 도감 사진은 처음부터 "http..." 전체 주소
function makePhotoUrl(photoUrl) {
  if (!photoUrl) return null;
  if (photoUrl.startsWith("http")) return photoUrl;
  return API + photoUrl;
}

// D-day 를 화면에 보여줄 글자로 변경
function ddayText(dDay) {
  if (dDay === 0) return "오늘 물 주기";
  if (dDay < 0) return `${-dDay}일 지남`;
  return `D-${dDay}`;
}

export default function HomePage() {
  const [plants, setPlants] = useState([]);        // 오늘 할 일 목록
  const [loading, setLoading] = useState(true);    // 불러오는 중인지
  const [error, setError] = useState("");          // 오류 안내 글자
  const [wateringId, setWateringId] = useState(null); // 물주기 처리 중인 식물 번호

  // 서버에서 오늘 할 일 목록을 받아옴
  async function loadToday() {
    try {
      const data = await getToday();
      setPlants(data);
      setError("");
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }

  // 화면이 처음 열릴 때 한 번 실행
  useEffect(() => {
    loadToday();
  }, []);

  // "했어요" 버튼 : 물주기 기록 후 목록을 다시 받아옴
  async function handleWater(plantId) {
    if (wateringId !== null) return;   // 처리 중이면 또 누른 것은 무시 (중복 방지)
    setWateringId(plantId);
    try {
      await waterPlant(plantId);
      await loadToday();               // D-day 가 바뀌었으니 다시 불러옴
    } catch (e) {
      setError(e.message);
    }
    setWateringId(null);
  }

  // 1. 불러오는 중
  if (loading) {
    return <main className={styles.page}><p>불러오는 중...</p></main>;
  }

  return (
    <main className={styles.page}>
      <h1>오늘 할 일</h1>

      {/* 2. 오류 안내 */}
      {error && <p role="alert" className={styles.error}>{error}</p>}

      {/* 3. 식물이 없을 때 */}
      {!error && plants.length === 0 && (
        <p>
          등록된 식물이 없습니다. <Link href="/species">도감에서 식물을 골라 보세요.</Link>
        </p>
      )}

      {/* 4. 식물 목록 */}
      <ul className={styles.list}>
        {plants.map((plant) => {
          const photo = makePhotoUrl(plant.photo_url);
          return (
            <li key={plant.plant_id} className={styles.card}>
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo} alt={plant.nickname} className={styles.photo} />
              ) : (
                <div className={styles.photo} />
              )}

              <div className={styles.info}>
                <div className={styles.name}>
                  <Link href={`/plants/${plant.plant_id}`}>{plant.nickname}</Link>
                </div>
                <div className={styles.sub}>{plant.location || "위치 없음"}</div>
                <div className={plant.d_day < 0 ? styles.late : plant.d_day === 0 ? styles.today : ""}>
                  {ddayText(plant.d_day)}
                </div>
                {plant.season_water_text && (
                  <div className={styles.sub}>도감 참고: {plant.season_water_text}</div>
                )}
              </div>

              <button
                className={styles.button}
                onClick={() => handleWater(plant.plant_id)}
                disabled={wateringId !== null || plant.d_day > 0}
              >
                {wateringId === plant.plant_id
                  ? "저장 중..."
                  : plant.d_day > 0
                    ? "완료"
                    : "했어요"}
              </button>
            </li>
          );
        })}
      </ul>
    </main>
  );
}