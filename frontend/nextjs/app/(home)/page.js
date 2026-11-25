"use client";

// 홈 (오늘의 물주기) : 오늘 물 줄 식물과 앞으로 물 줄 식물을 카드로 보여 줌

import Link from "next/link";
import { useEffect, useState } from "react";
import { getToday, waterPlant } from "@/service/careApi";
import styles from "./home.module.css";
import { openChat } from "@/service/chatApi";

const API = process.env.NEXT_PUBLIC_API_SERVER;

// "아직 여유 있어요" 구역에서 처음에 보여 줄 카드 수 (나머지는 "더 보기"로 펼침)
const WAIT_LIMIT = 8;

// 사진 주소 만들기
// 내가 올린 사진은 "/uploads/..." 로 오기 때문에 앞에 서버 주소를 붙임
// 도감 사진은 처음부터 "http..." 전체 주소
function makePhotoUrl(photoUrl) {
  if (!photoUrl) return null;
  if (photoUrl.startsWith("http")) return photoUrl;
  return API + photoUrl;
}

// D-day 를 짧은 글자로 변경 (카드 오른쪽 위 알약, 통계 칸에서 사용)
function ddayShort(dDay) {
  if (dDay === 0) return "오늘";
  if (dDay < 0) return `${-dDay}일 지남`;
  return `D-${dDay}`;
}

// D-day 로 카드 상태 정하기 (지남 / 오늘 / 여유) → 상태마다 알약 색이 달라짐
function getStatus(dDay) {
  if (dDay < 0) return "late";
  if (dDay === 0) return "today";
  return "wait";
}

// 이번 달에 맞는 계절 물주기 팁 (3~5 봄, 6~8 여름, 9~11 가을, 12~2 겨울)
//   tipParts : [앞 글자, 굵게 보일 글자, 뒤 글자] 로 나눠 둠
function getSeasonInfo() {
  const month = new Date().getMonth() + 1;   // getMonth() 는 0부터 시작해서 1을 더함
  if (month >= 3 && month <= 5) {
    return {
      month,
      icon: "🌸",
      title: "봄철 물주기 팁",
      tipParts: ["봄에는 새잎이 나기 시작해요. 흙이 마르는 속도를 보면서 ", "물 주는 간격을 조금 줄여", " 보세요."],
      chips: ["✔ 겉흙 마름 확인 후 관수", "🌱 새잎이 나면 물 조금 늘리기"],
    };
  }
  if (month >= 6 && month <= 8) {
    return {
      month,
      icon: "☀️",
      title: "여름철 물주기 팁",
      tipParts: ["여름에는 흙이 빨리 말라요. ", "아침이나 저녁처럼 시원한 때", "에 물을 주면 좋아요."],
      chips: ["🕗 시원한 시간대에 관수", "🌬 장마철에는 통풍 확인"],
    };
  }
  if (month >= 9 && month <= 11) {
    return {
      month,
      icon: "🍂",
      title: "가을철 물주기 팁",
      tipParts: ["가을에는 식물이 천천히 자라요. ", "물 주는 간격을 조금씩 늘려", " 보세요."],
      chips: ["✔ 겉흙 마름 확인 후 관수", "💧 미지근한 물 사용"],
    };
  }
  return {
    month,
    icon: "❄️",
    title: "겨울철 물주기 팁",
    tipParts: ["겨울에는 물을 덜 마셔요. ", "흙 속까지 말랐는지 확인", "하고 물을 주세요."],
    chips: ["✔ 흙 속까지 확인 후 관수", "💧 미지근한 물 사용"],
  };
}

// 필터 : 이 식물을 보여 줄지 정함
function passFilter(plant, filter) {
  if (filter === "now") return plant.d_day <= 0;
  if (filter === "wait") return plant.d_day > 0;
  if (filter === "issue") return Boolean(plant.recent_issue);
  return true;   // "all" 이면 전부 보여 줌
}

// 정렬 : "date" 이면 서버가 보낸 순서(급한 순) 그대로, "name" 이면 이름 가나다 순
function sortList(list, sort) {
  const copy = [...list];      // 원래 목록은 건드리지 않고 복사해서 정렬
  if (sort === "name") {
    copy.sort((a, b) => a.nickname.localeCompare(b.nickname, "ko"));
  }
  return copy;
}

export default function HomePage() {
  const [plants, setPlants] = useState([]);           // 오늘 할 일 목록
  const [loading, setLoading] = useState(true);       // 불러오는 중인지
  const [error, setError] = useState("");             // 오류 안내 글자
  const [message, setMessage] = useState("");         // 물주기 성공 안내 글자
  const [wateringId, setWateringId] = useState(null); // 물주기 처리 중인 식물 번호
  const [filter, setFilter] = useState("all");        // 카드 필터 (all / now / wait / issue)
  const [sort, setSort] = useState("date");           // 카드 정렬 (date / name)
  const [showAllWait, setShowAllWait] = useState(false); // 여유 구역을 전부 펼쳤는지

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
    const status = getStatus(plant.d_day);
    const issue = plant.recent_issue;       // 최근 이상 기록 (없으면 null)
    const canWater = plant.d_day <= 0;      // D-day 가 0 이하일 때만 물을 줄 수 있음

    return (
      <li key={plant.plant_id} className={styles.card + " " + styles[status]}>
        {/* 사진 : 대체 그림을 먼저 깔고, 사진이 있으면 그 위에 덮음 (사진이 깨지면 숨겨서 대체 그림이 보임) */}
        <div className={styles.thumb}>
          <div className={styles.noPhoto}>🌿</div>
          {photo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo}
              alt={plant.nickname}
              className={styles.photo}
              loading="lazy"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          )}
        </div>

        <div className={styles.body}>
          <div className={styles.titleRow}>
            {/* 이 링크가 카드 전체 크기로 늘어나서 카드 어디를 눌러도 상세로 이동함 */}
            <h3 className={styles.name}>
              <Link href={`/plants/${plant.plant_id}`}>{plant.nickname}</Link>
            </h3>
            <span className={styles.dday}>{ddayShort(plant.d_day)}</span>
          </div>

          <div>
            <span className={styles.location}>📍 {plant.location || "위치 없음"}</span>
          </div>

          {/* 최근 7일 안에 이상 기록이 있으면 주의 표시 (누르면 일기 화면으로 이동) */}
          {issue && (
            <Link href={`/plants/${plant.plant_id}/diary`} className={styles.issue}>
              ⚠ 이상 기록 {issue.days_ago === 0 ? "오늘" : `${issue.days_ago}일 전`}
              {issue.memo ? ` · ${issue.memo}` : ""}
            </Link>
          )}

          {plant.season_water_text && (
            <p className={styles.tip}>도감 참고: {plant.season_water_text}</p>
          )}

          <div className={styles.footer}>
            <button
              className={styles.button}
              onClick={() => handleWater(plant)}
              disabled={wateringId !== null || !canWater}
            >
              {wateringId === plant.plant_id
                ? "저장 중..."
                : canWater
                  ? "💧 물 줬어요"
                  : plant.d_day === 1
                    ? "💧 내일 물주기"
                    : `💧 ${plant.d_day}일 뒤 물주기`}
            </button>
          </div>
        </div>
      </li>
    );
  }

  // "새 식물 등록하기" 카드
  function renderAddCard() {
    return (
      <li key="add" className={styles.addCard}>
        <Link href="/plants/new" className={styles.addLink}>
          <span className={styles.plus}>+</span>
          <strong>새 식물 등록하기</strong>
          <span className={styles.addSub}>키우는 식물을 추가하면 물 줄 날짜를 알려드려요.</span>
        </Link>
      </li>
    );
  }

  // 구역 한 개 (제목 + 카드 목록). withSort : 정렬 선택칸을 붙일지, withAdd : 등록 카드를 붙일지,
  //   canFold : 카드가 많을 때 일부만 보여 주고 "더 보기" 버튼을 붙일지
  function renderSection(title, list, withSort, withAdd, canFold) {
    const needFold = canFold && list.length > WAIT_LIMIT;       // 접을 만큼 많은지
    const folded = needFold && !showAllWait;                     // 지금 접힌 상태인지
    const shownList = folded ? list.slice(0, WAIT_LIMIT) : list; // 실제로 그릴 카드

    return (
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>
            {title} <span className={styles.count}>{list.length}</span>
          </h2>
          {withSort && (
            <select
              className={styles.select}
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              aria-label="카드 정렬"
            >
              <option value="date">가까운 일정 순</option>
              <option value="name">이름 순</option>
            </select>
          )}
        </div>
        <ul className={styles.grid}>
          {shownList.map(renderCard)}
          {withAdd && renderAddCard()}
        </ul>

        {/* 카드가 많을 때만 : 더 보기 / 접기 */}
        {needFold && (
          <div className={styles.moreRow}>
            <button className={styles.moreButton} onClick={() => setShowAllWait(!showAllWait)}>
              {folded ? `나머지 ${list.length - WAIT_LIMIT}개 더 보기 ▾` : "접기 ▴"}
            </button>
          </div>
        )}
      </section>
    );
  }

  // 1. 불러오는 중
  if (loading) {
    return (
      <main className={styles.page}>
        <p className={styles.state}>불러오는 중...</p>
      </main>
    );
  }

  // 식물을 "지금 물 줄 식물"과 "아직 여유 있는 식물"로 나눔 (목록은 급한 순으로 이미 정렬돼 있음)
  const nowList = [];      // D-day 0 이하 (오늘이거나 지남)
  const waitList = [];     // D-day 1 이상
  let lateCount = 0;       // 그중 이미 지난 식물 수
  let issueCount = 0;      // 최근 이상 기록이 있는 식물 수
  for (const plant of plants) {
    if (plant.d_day <= 0) {
      nowList.push(plant);
      if (plant.d_day < 0) {
        lateCount = lateCount + 1;
      }
    } else {
      waitList.push(plant);
    }
    if (plant.recent_issue) {
      issueCount = issueCount + 1;
    }
  }

  // 필터와 정렬을 적용한 목록 (화면에 실제로 그려지는 것)
  const showNow = [];
  const showWait = [];
  for (const plant of sortList(nowList, sort)) {
    if (passFilter(plant, filter)) showNow.push(plant);
  }
  for (const plant of sortList(waitList, sort)) {
    if (passFilter(plant, filter)) showWait.push(plant);
  }

  const season = getSeasonInfo();
  const dateText = new Date().toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  // 위쪽 설명 문장
  let subtitle = "오늘은 물 줄 식물이 없어요. 느긋하게 식물을 둘러보세요 🌱";
  if (plants.length === 0) {
    subtitle = "아직 등록된 식물이 없어요. 첫 식물을 등록해 보세요.";
  } else if (nowList.length > 0) {
    subtitle = `오늘 물 줄 식물이 ${nowList.length}개 있어요.`;
    if (lateCount > 0) {
      subtitle = subtitle + ` (물 줄 날이 지난 식물 ${lateCount}개 포함)`;
    }
  }

  // 정렬 선택칸과 등록 카드를 붙일 구역 정하기 (가장 위 구역에 정렬, 가장 아래 구역에 등록 카드)
  const sortOnNow = showNow.length > 0;
  const addOnWait = showWait.length > 0;
  const addOnNow = showWait.length === 0 && showNow.length > 0;
  const nothingShown = showNow.length === 0 && showWait.length === 0;

  return (
    <main className={styles.page}>
      {/* 1. 위쪽 : 제목과 계절 팁 */}
      <div className={styles.hero}>
        <div className={styles.heroText}>
          <div className={styles.eyebrow}>DAILY WATERING · {dateText}</div>
          <h1 className={styles.title}>오늘의 물주기</h1>
          <p className={styles.subtitle}>{subtitle}</p>
        </div>

        <div className={styles.side}>
          <aside className={styles.tipCard}>
            {/* 위쪽 띠 : 아이콘, 제목, 월 표시 */}
            <div className={styles.tipHead}>
              <span className={styles.tipIcon}>{season.icon}</span>
              <strong className={styles.tipTitle}>{season.title}</strong>
              <span className={styles.tipLabel}>SEASONAL CARE</span>
              <span className={styles.badge}>{season.month}월 가이드</span>
            </div>

            {/* 본문 : 팁 한 줄 + 칩 */}
            <div className={styles.tipBody}>
              <p className={styles.tipText}>
                {season.tipParts[0]}
                <strong>{season.tipParts[1]}</strong>
                {season.tipParts[2]}
              </p>
              <div className={styles.chips}>
                {season.chips.map((chip) => (
                  <span key={chip} className={styles.chip}>{chip}</span>
                ))}
              </div>
            </div>

            {/* 아래 줄 : AI 도우미 입구 */}
            <div className={styles.tipFooter}>
              <span>내 식물 기준 맞춤 주기가 궁금하다면</span>
              <button
                className={styles.aiButton}
                onClick={() => openChat("가을에는 우리 집 식물 물을 어떻게 줘야 해?")}
              >
                AI에게 물어보기
              </button>
            </div>
          </aside>

          {plants.length > 0 && (
            <select
              className={styles.filter}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              aria-label="카드 보기 방식"
            >
              <option value="all">전체 식물 ({plants.length})</option>
              <option value="now">지금 물 줄 식물 ({nowList.length})</option>
              <option value="wait">아직 여유 있어요 ({waitList.length})</option>
              <option value="issue">이상 기록 있는 식물 ({issueCount})</option>
            </select>
          )}
        </div>
      </div>

      {/* 2. 오류 / 물주기 성공 안내 */}
      {error && <p role="alert" className={styles.error}>{error}</p>}
      {message && <p className={styles.message}>{message}</p>}

      {/* 3. 통계 */}
      {plants.length > 0 && (
        <div className={styles.stats}>
          <div className={nowList.length > 0 ? styles.stat + " " + styles.statAlert : styles.stat}>
            <div>
              <div className={styles.statLabel}>오늘 물 줄 식물</div>
              <div className={styles.statValue}>{nowList.length}</div>
              {lateCount > 0 && <div className={styles.statSub}>지난 식물 {lateCount}개 포함</div>}
            </div>
            <span className={styles.statIcon}>✅</span>
          </div>
          <div className={styles.stat}>
            <div>
              <div className={styles.statLabel}>다가오는 물주기</div>
              <div className={styles.statValue}>{waitList.length}</div>
            </div>
            <span className={styles.statIcon}>💧</span>
          </div>
          <div className={styles.stat}>
            <div>
              <div className={styles.statLabel}>다음 일정</div>
              <div className={styles.statValueSmall}>
                {plants[0].nickname} · {ddayShort(plants[0].d_day)}
              </div>
            </div>
            <span className={styles.statIcon}>📅</span>
          </div>
        </div>
      )}

      {/* 4. 지금 물 줄 식물 */}
      {showNow.length > 0 && renderSection("지금 물 줄 식물", showNow, sortOnNow, addOnNow)}

      {/* 5. 아직 여유 있어요 */}
      {showWait.length > 0 &&
        renderSection("아직 여유 있어요", showWait, !sortOnNow, addOnWait, true)}

      {/* 6. 보여 줄 카드가 없을 때 (식물이 없거나, 필터에 맞는 식물이 없을 때) */}
      {nothingShown && (
        <section className={styles.section}>
          {plants.length > 0 && (
            <p className={styles.state}>이 조건에 맞는 식물이 없어요.</p>
          )}
          {plants.length === 0 && !error && (
            <p className={styles.state}>
              도감에서 식물을 골라 등록할 수도 있어요. <Link href="/species">도감 보러 가기</Link>
            </p>
          )}
          <ul className={styles.grid}>{renderAddCard()}</ul>
        </section>
      )}
    </main>
  );
}