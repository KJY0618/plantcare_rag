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
  if (dDay === 0) return "오늘 물 주는 날";
  if (dDay < 0) return `물 줄 날이 ${-dDay}일 지났어요`;
  return `D-${dDay}`;
}

// D-day 로 카드 상태 정하기 (지남 / 오늘 / 여유) → 상태마다 카드 색이 달라짐
function getStatus(dDay) {
  if (dDay < 0) return "late";
  if (dDay === 0) return "today";
  return "wait";
}

// 계절에 맞는 물주기 한 줄 팁 (3~5 봄, 6~8 여름, 9~11 가을, 12~2 겨울)
function getSeasonTip() {
  const month = new Date().getMonth() + 1;   // getMonth() 는 0부터 시작해서 1을 더함
  if (month >= 3 && month <= 5) {
    return "봄에는 새잎이 나기 시작해요. 흙이 마르는 속도를 보면서 물 주는 간격을 조금 줄여 보세요.";
  }
  if (month >= 6 && month <= 8) {
    return "여름에는 흙이 빨리 말라요. 아침이나 저녁처럼 시원한 때에 물을 주면 좋아요.";
  }
  if (month >= 9 && month <= 11) {
    return "가을에는 식물이 천천히 자라요. 물 주는 간격을 조금씩 늘려 보세요.";
  }
  return "겨울에는 물을 덜 마셔요. 흙 속까지 말랐는지 확인하고 물을 주세요.";
}

export default function HomePage() {
  const [plants, setPlants] = useState([]);        // 오늘 할 일 목록
  const [loading, setLoading] = useState(true);    // 불러오는 중인지
  const [error, setError] = useState("");          // 오류 안내 글자
  const [message, setMessage] = useState("");      // 물주기 성공 안내 글자
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

  // "물 줬어요" 버튼 : 물주기 기록 후 목록을 다시 받아옴
  async function handleWater(plant) {
    if (wateringId !== null) return;   // 처리 중이면 또 누른 것은 무시 (중복 방지)
    setWateringId(plant.plant_id);
    setMessage("");
    try {
      await waterPlant(plant.plant_id);
      await loadToday();               // D-day 가 바뀌었으니 다시 불러옴
      setMessage(`${plant.nickname}에게 물 준 기록을 저장했어요.`);
    } catch (e) {
      setError(e.message);
    }
    setWateringId(null);
  }

  // 식물 한 개를 카드로 그림
  function renderCard(plant) {
    const photo = makePhotoUrl(plant.photo_url);
    const issue = plant.recent_issue;       // 최근 이상 기록 (없으면 null)

    return (
      // 카드에 상태(late / today / wait) 클래스를 같이 붙여서 색을 나눔
      <li
        key={plant.plant_id}
        className={styles.card + " " + styles[getStatus(plant.d_day)]}
      >
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
          <div>
            <span className={styles.location}>{plant.location || "위치 없음"}</span>
          </div>
          <div>
            <span className={styles.dday}>{ddayText(plant.d_day)}</span>
          </div>

          {/* 최근 7일 안에 이상 기록이 있으면 주의 표시 (누르면 일기 화면으로 이동) */}
          {issue && (
            <Link href={`/plants/${plant.plant_id}/diary`} className={styles.issue}>
              ⚠ 이상 기록 {issue.days_ago === 0 ? "오늘" : `${issue.days_ago}일 전`}
              {issue.memo ? ` · ${issue.memo}` : ""}
            </Link>
          )}

          {plant.season_water_text && (
            <div className={styles.tip}>도감 참고: {plant.season_water_text}</div>
          )}
        </div>

        <div className={styles.actions}>
          <button
            className={styles.button}
            onClick={() => handleWater(plant)}
            disabled={wateringId !== null || plant.d_day > 0}
          >
            {wateringId === plant.plant_id
              ? "저장 중..."
              : plant.d_day > 0
                ? "완료"
                : "물 줬어요"}
          </button>
        </div>
      </li>
    );
  }

  // 1. 불러오는 중
  if (loading) {
    return <main className={styles.page}><p>불러오는 중...</p></main>;
  }

  // 식물을 "지금 물 줄 식물"과 "아직 여유 있는 식물"로 나눔 (목록은 급한 순으로 이미 정렬돼 있음)
  const nowList = [];      // D-day 0 이하 (오늘이거나 지남)
  const waitList = [];     // D-day 1 이상
  let lateCount = 0;       // 그중 이미 지난 식물 수
  for (const plant of plants) {
    if (plant.d_day <= 0) {
      nowList.push(plant);
      if (plant.d_day < 0) {
        lateCount = lateCount + 1;
      }
    } else {
      waitList.push(plant);
    }
  }

  // 오늘 날짜 글자 (예: 11월 24일 화요일)
  const dateText = new Date().toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>오늘의 물주기</h1>

      {/* 2. 오류 안내 */}
      {error && <p role="alert" className={styles.error}>{error}</p>}

      {/* 3. 식물이 없을 때 */}
      {!error && plants.length === 0 && (
        <p>
          등록된 식물이 없습니다. <Link href="/species">도감에서 식물을 골라 보세요.</Link>
        </p>
      )}

      {/* 4. 오늘 요약 : 물 줄 식물이 몇 개인지 한눈에 */}
      {plants.length > 0 && (
        <section className={nowList.length > 0 ? styles.summary : styles.summaryDone}>
          <div className={styles.date}>{dateText}</div>
          {nowList.length > 0 ? (
            <div className={styles.summaryText}>
              오늘 물 줄 식물이 <strong>{nowList.length}개</strong> 있어요
              {lateCount > 0 && ` (물 줄 날이 지난 식물 ${lateCount}개 포함)`}
            </div>
          ) : (
            <div className={styles.summaryText}>
              오늘은 물 줄 식물이 없어요 🌱 가장 가까운 물주기는{" "}
              <strong>
                {waitList[0].nickname} (D-{waitList[0].d_day})
              </strong>
              예요
            </div>
          )}
          <div className={styles.season}>{getSeasonTip()}</div>
        </section>
      )}

      {/* 물주기를 저장했을 때 안내 */}
      {message && <p className={styles.message}>{message}</p>}

      {/* 5. 지금 물 줄 식물 */}
      {nowList.length > 0 && (
        <>
          <h2 className={styles.sectionTitle}>지금 물 줄 식물</h2>
          <ul className={styles.list}>{nowList.map(renderCard)}</ul>
        </>
      )}

      {/* 6. 아직 여유 있는 식물 */}
      {waitList.length > 0 && (
        <>
          <h2 className={styles.sectionTitle}>아직 여유 있어요</h2>
          <ul className={styles.list}>{waitList.map(renderCard)}</ul>
        </>
      )}
    </main>
  );
}