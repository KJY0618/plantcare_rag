"use client";

// 내 식물 상세 : /plants/1 처럼 식물 번호로 들어오는 화면
//   식물 정보, 다음 물주기, 물주기·비료·분갈이 버튼, 이상 기록 쓰기, 최근 기록, 수정·삭제

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import LogList, { TYPE_LABEL } from "@/components/care/LogList";
import {
    addLog,
    ddayText,
    deleteLog,
    deletePlant,
    getPlantDetail,
    makePhotoUrl,
    waterPlant,
} from "@/service/careApi";
import styles from "./detail.module.css";

// 도감 값이 비어 있으면 "정보 없음" 으로 보여 줌
function showValue(value) {
    if (value) {
        return value;
    }
    return "정보 없음";
}

// 도감의 목록 값(광요구도, 배치장소)을 "a, b" 글자로 바꿈
function showTags(tags) {
    if (tags && tags.length > 0) {
        return tags.join(", ");
    }
    return "정보 없음";
}

// 오늘 날짜를 "2026-11-24" 글자로 만듦 (서버가 보내는 기록 날짜와 같은 모양)
function todayString() {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");   // 1 → "01"
    const day = String(now.getDate()).padStart(2, "0");
    return now.getFullYear() + "-" + month + "-" + day;
}

// "2026-11-10" 이 오늘로부터 며칠 전인지 계산
function daysAgo(dateString) {
    const parts = dateString.split("-");
    const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((today - date) / (1000 * 60 * 60 * 24));   // 밀리초 차이를 일 수로 변경
}

// 마지막 기록 날짜를 화면 글자로 변경 (예: "2026-11-10 (14일 전)")
function lastText(dateString) {
    if (!dateString) {
        return "아직 기록이 없어요";
    }
    const days = daysAgo(dateString);
    if (days === 0) {
        return dateString + " (오늘)";
    }
    return dateString + " (" + days + "일 전)";
}

export default function PlantDetailPage() {
    const params = useParams();
    const router = useRouter();
    const plantId = params.id;            // 주소의 식물 번호
    // 도감 정보 모달창을 열고 닫기 위한 참조
    const speciesDialogRef = useRef(null);

    const [plant, setPlant] = useState(null);      // 서버에서 받은 식물 상세
    const [loading, setLoading] = useState(true);  // 처음 불러오는 중
    const [error, setError] = useState("");        // 불러오기 실패 이유
    const [message, setMessage] = useState("");    // 버튼을 누른 결과 안내
    const [saving, setSaving] = useState(false);   // 저장 중이면 버튼 잠금

    // 이상 기록 입력칸
    const [memo, setMemo] = useState("");
    const [photo, setPhoto] = useState(null);
    const [fileKey, setFileKey] = useState(0);     // 저장 후 파일 선택칸을 비우려고 사용
    const [issueError, setIssueError] = useState("");

    // 식물 상세를 서버에서 다시 불러옴
    async function loadPlant() {
        try {
            const data = await getPlantDetail(plantId);
            setPlant(data);
            setError("");
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }

    // 화면이 처음 열릴 때 한 번 불러옴
    useEffect(() => {
        loadPlant();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [plantId]);

    // 물주기 버튼
    async function handleWater() {
        if (saving) {
            return;
        }
        setSaving(true);
        setMessage("");
        try {
            await waterPlant(plantId);
            setMessage("물주기를 기록했어요.");
            await loadPlant();
        } catch (e) {
            setMessage(e.message);
        } finally {
            setSaving(false);
        }
    }

    // 비료 / 분갈이 버튼 (확인창에서 "확인"을 누르면 오늘 날짜로 저장)
    //   confirmText : 실수로 누르는 것을 막으려고 먼저 물어보는 글자
    async function handleSimpleLog(logType, doneText, confirmText) {
        if (saving) {
            return;
        }
        if (!window.confirm(confirmText)) {
            return;
        }
        setSaving(true);
        setMessage("");
        try {
            const formData = new FormData();
            formData.append("log_type", logType);
            await addLog(plantId, formData);
            setMessage(doneText);
            await loadPlant();
        } catch (e) {
            setMessage(e.message);
        } finally {
            setSaving(false);
        }
    }

    // 기록 1건 삭제 (잘못 누른 기록 되돌리기)
    async function handleDeleteLog(log) {
        if (saving) {
            return;
        }
        let question = log.logged_at + " " + TYPE_LABEL[log.log_type] + " 기록을 삭제할까요?";
        if (log.log_type === "water") {
            question = question + "\n물주기 기록을 지우면 다음 물주기 날짜가 바뀌어요.";
        }
        if (!window.confirm(question)) {
            return;
        }
        setSaving(true);
        setMessage("");
        try {
            await deleteLog(plantId, log.id);
            setMessage("기록을 삭제했어요.");
            await loadPlant();
        } catch (e) {
            setMessage(e.message);
        } finally {
            setSaving(false);
        }
    }

    // 이상 기록 저장 (메모나 사진 중 하나는 꼭 있어야 함)
    async function handleIssueSubmit(event) {
        event.preventDefault();
        if (saving) {
            return;
        }
        setIssueError("");
        setMessage("");

        const text = memo.trim();
        if (text === "" && photo === null) {
            setIssueError("메모나 사진 중 하나는 넣어 주세요.");
            return;
        }

        // 사진 검사 (jpg / png / webp, 5MB 이하) - 서버도 한 번 더 검사함
        if (photo !== null) {
            const okTypes = ["image/jpeg", "image/png", "image/webp"];
            if (!okTypes.includes(photo.type)) {
                setIssueError("사진은 jpg, png, webp 만 올릴 수 있어요.");
                return;
            }
            if (photo.size > 5 * 1024 * 1024) {
                setIssueError("사진은 5MB 이하만 올릴 수 있어요.");
                return;
            }
        }

        setSaving(true);
        try {
            const formData = new FormData();
            formData.append("log_type", "issue");
            if (text !== "") {
                formData.append("memo", text);
            }
            if (photo !== null) {
                formData.append("photo", photo);
            }
            await addLog(plantId, formData);

            setMessage("이상 기록을 저장했어요.");
            setMemo("");
            setPhoto(null);
            setFileKey(fileKey + 1);      // 파일 선택칸 비우기
            await loadPlant();
        } catch (e) {
            setIssueError(e.message);
        } finally {
            setSaving(false);
        }
    }

    // 식물 삭제
    async function handleDelete() {
        if (saving) {
            return;
        }
        if (!window.confirm("이 식물을 삭제할까요? 되돌릴 수 없어요.")) {
            return;
        }
        setSaving(true);
        try {
            await deletePlant(plantId);
            router.push("/");
        } catch (e) {
            setMessage(e.message);
            setSaving(false);
        }
    }

    // ---------------- 화면 ----------------

    if (loading) {
        return <p className={styles.state}>불러오는 중...</p>;
    }
    if (error) {
        return (
            <div className={styles.state}>
                <p>{error}</p>
                <Link href="/plants">내 식물 목록으로</Link>
            </div>
        );
    }

    const species = plant.species;                  // 도감에서 고른 식물이면 정보가 있음
    let speciesName = plant.custom_species_name;    // 직접 입력한 식물이면 입력한 이름
    if (species) {
        speciesName = species.name;
    }
    const photoUrl = makePhotoUrl(plant.photo_url);

    // 오늘 이미 비료 / 분갈이를 기록했으면 버튼 잠금 (같은 날 여러 번 누르는 실수 방지)
    const today = todayString();
    const fertilizerDone = plant.last_fertilized_at === today;
    const repotDone = plant.last_repotted_at === today;

    // 확인창에 보여 줄 마지막 기록 안내
    const fertilizerConfirm =
        "오늘 비료를 줬다고 기록할까요?\n마지막 비료: " + lastText(plant.last_fertilized_at);
    const repotConfirm =
        "분갈이는 자주 하지 않는 작업이에요. 오늘 분갈이를 했다고 기록할까요?\n마지막 분갈이: " +
        lastText(plant.last_repotted_at);

    // 물주기 버튼 : 아직 물 줄 날이 아니면(D-day 가 1 이상) 잠금
    const waterLocked = plant.d_day !== null && plant.d_day > 0;


    // 도감 상세 모달에서 사용할 정보
    // 기존 plant.species 데이터를 항목별로 정리
    const speciesSections = species ? [
        {
            title: "기본 정보",
            items: [
                ["학명", species.scientific_name],
                ["영문명", species.english_name],
                ["유통명", species.distribution_name],
                ["원산지", species.origin],
                ["과명", species.family_name],
                ["생장 높이", species.growth_height ? `${species.growth_height} cm` : null],
                ["생장 너비", species.growth_width ? `${species.growth_width} cm` : null],
            ],
        },
        {
            title: "생육 환경",
            items: [
                ["광도", showTags(species.tags?.light)],
                ["배치 장소", showTags(species.tags?.placement)],
                ["생육 온도", species.growth_temp],
                ["최저 월동 온도", species.winter_min_temp],
                ["습도", species.humidity],
            ],
        },
        {
            title: "계절별 물주기",
            items: [
                ["봄", species.water_spring],
                ["여름", species.water_summer],
                ["가을", species.water_autumn],
                ["겨울", species.water_winter],
            ],
        },
        {
            title: "관리 정보",
            items: [
                ["관리 난이도", species.manage_level],
                ["관리 요구도", species.manage_demand],
                ["비료", species.fertilizer_info],
                ["토양", species.soil_info],
                ["번식 시기", species.propagation_period],
                ["잎 형태", species.leaf_form],
            ],
        },
        {
            title: "식물 특징",
            items: [
                ["특징", species.function_info],
            ],
        },
    ] : [];


    return (
        <main className={styles.page}>
            {/* 위쪽 : 사진과 이름 */}
            <section className={styles.head}>
                {photoUrl ? (
                    <img className={styles.photo} src={photoUrl} alt={plant.nickname} />
                ) : (
                    <div className={styles.noPhoto}>사진 없음</div>
                )}
                <h1 className={styles.nickname}>{plant.nickname}</h1>
                <p className={styles.sub}>{showValue(speciesName)}</p>
                <p className={styles.sub}>
                    위치 : {showValue(plant.location)} · 구입일 : {showValue(plant.purchase_date)}
                </p>
            </section>

            {/* 물주기 */}
            <section className={styles.card}>
                <h2>물주기</h2>
                <p className={styles.dday}>{ddayText(plant.d_day)}</p>
                <p className={styles.sub}>
                    마지막으로 준 날 : {showValue(plant.last_watered_at)}
                    <br />
                    다음 물주기 : {showValue(plant.next_water_date)} ({plant.water_interval_days}일마다)
                </p>

                <div className={styles.buttons}>
                    <button
                        className={styles.primary}
                        onClick={handleWater}
                        disabled={saving || waterLocked}
                    >
                        {waterLocked ? "물주기 완료" : "물 줬어요"}
                    </button>
                    <button
                        className={styles.button}
                        onClick={() =>
                            handleSimpleLog("fertilizer", "비료 준 기록을 저장했어요.", fertilizerConfirm)
                        }
                        disabled={saving || fertilizerDone}
                    >
                        {fertilizerDone ? "오늘 비료 기록함" : "비료 줬어요"}
                    </button>
                    <button
                        className={styles.button}
                        onClick={() =>
                            handleSimpleLog("repot", "분갈이 기록을 저장했어요.", repotConfirm)
                        }
                        disabled={saving || repotDone}
                    >
                        {repotDone ? "오늘 분갈이 기록함" : "분갈이 했어요"}
                    </button>
                </div>

                {/* 마지막으로 한 날짜 : 실수로 또 누르기 전에 눈으로 확인 */}
                <p className={styles.last}>
                    마지막 비료 : {lastText(plant.last_fertilized_at)}
                    <br />
                    마지막 분갈이 : {lastText(plant.last_repotted_at)}
                </p>

                {message && <p className={styles.message}>{message}</p>}
            </section>


            {/* 도감 정보 */}
            <section className={styles.card}>
                {species ? (
                    <button
                        type="button"
                        className={styles.speciesOpenButton}
                        onClick={() => speciesDialogRef.current?.showModal()}
                    >
                        <span>📖 도감 정보</span>
                        <span>상세 보기 →</span>
                    </button>
                ) : (
                    <>
                        <h2>도감 정보</h2>
                        <p className={styles.sub}>
                            직접 입력한 식물이라 도감 정보가 없어요.
                            물주기는 {plant.water_interval_days}일마다로 계산해요.
                        </p>
                    </>
                )}
            </section>

            {/* 도감 상세 모달창 */}
            {species && (
                <dialog
                    ref={speciesDialogRef}
                    className={styles.speciesDialog}
                    aria-labelledby="species-dialog-title"
                >
                    {/* 모달 상단 */}
                    <div className={styles.speciesDialogHeader}>
                        <h2 id="species-dialog-title">
                            🌿 {species.name} 도감 상세
                        </h2>

                        <button
                            type="button"
                            onClick={() => speciesDialogRef.current?.close()}
                        >
                            ✕
                        </button>
                    </div>

                    {/* 도감 사진 */}
                    {(species.image_url || species.thumb_url) && (
                        <img
                            src={species.image_url || species.thumb_url}
                            alt={species.name}
                            className={styles.speciesDialogImage}
                        />
                    )}

                    {/* 모달 내부 정보 */}
                    <div className={styles.speciesDialogBody}>

                        <h3>기본 정보</h3>
                        <ul className={styles.info}>
                            <li>학명 : {showValue(species.scientific_name)}</li>
                            <li>영문명 : {showValue(species.english_name)}</li>
                            <li>유통명 : {showValue(species.distribution_name)}</li>
                            <li>원산지 : {showValue(species.origin)}</li>
                            <li>과명 : {showValue(species.family_name)}</li>
                            <li>생장 높이 : {showValue(species.growth_height)}</li>
                            <li>생장 너비 : {showValue(species.growth_width)}</li>
                        </ul>

                        <h3>생육 환경</h3>
                        <ul className={styles.info}>
                            <li>광도 : {showTags(species.tags?.light)}</li>
                            <li>배치 장소 : {showTags(species.tags?.placement)}</li>
                            <li>생육 온도 : {showValue(species.growth_temp)}</li>
                            <li>최저 월동 온도 : {showValue(species.winter_min_temp)}</li>
                            <li>습도 : {showValue(species.humidity)}</li>
                        </ul>

                        <h3>계절별 물주기</h3>
                        <ul className={styles.info}>
                            <li>봄 : {showValue(species.water_spring)}</li>
                            <li>여름 : {showValue(species.water_summer)}</li>
                            <li>가을 : {showValue(species.water_autumn)}</li>
                            <li>겨울 : {showValue(species.water_winter)}</li>
                        </ul>

                        <h3>관리 정보</h3>
                        <ul className={styles.info}>
                            <li>관리 난이도 : {showValue(species.manage_level)}</li>
                            <li>관리 요구도 : {showValue(species.manage_demand)}</li>
                            <li>비료 : {showValue(species.fertilizer_info)}</li>
                            <li>토양 : {showValue(species.soil_info)}</li>
                            <li>번식 시기 : {showValue(species.propagation_period)}</li>
                            <li>잎 형태 : {showValue(species.leaf_form)}</li>
                        </ul>

                        <h3>식물 특징</h3>
                        <p>
                            {showValue(species.function_info)}
                        </p>

                    </div>

                    {/* 모달 닫기 */}
                    <button
                        type="button"
                        className={styles.speciesModalBottomButton}
                        onClick={() => speciesDialogRef.current?.close()}
                    >
                        닫기
                    </button>
                </dialog>
            )}


            {/* 이상 기록 쓰기 */}
            <section className={styles.card}>
                <h2>이상 기록</h2>
                <p className={styles.sub}>잎이 노랗게 변했거나 벌레가 보일 때 남겨 두세요.</p>
                <form onSubmit={handleIssueSubmit} className={styles.form}>
                    <label htmlFor="issue-memo">메모</label>
                    <textarea
                        id="issue-memo"
                        value={memo}
                        onChange={(e) => setMemo(e.target.value)}
                        placeholder="예) 아랫잎이 노랗게 변했어요"
                        rows={3}
                    />

                    <label htmlFor="issue-photo">사진 (jpg, png, webp / 5MB 이하)</label>
                    <input
                        key={fileKey}
                        id="issue-photo"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(e) => setPhoto(e.target.files[0] || null)}
                    />

                    {issueError && <p className={styles.error}>{issueError}</p>}

                    <button className={styles.primary} type="submit" disabled={saving}>
                        {saving ? "저장 중..." : "이상 기록 저장"}
                    </button>
                </form>
            </section>

            {/* 최근 기록 */}
            <section className={styles.card}>
                <div className={styles.rowBetween}>
                    <h2>최근 기록</h2>
                    <Link href={"/plants/" + plantId + "/diary"}>전체 보기</Link>
                </div>
                <LogList logs={plant.recent_logs} onDelete={handleDeleteLog} disabled={saving} />
            </section>

            {/* 수정 / 삭제 */}
            <section className={styles.bottom}>
                <Link className={styles.button} href={"/plants/" + plantId + "/edit"}>
                    수정
                </Link>
                <button className={styles.danger} onClick={handleDelete} disabled={saving}>
                    삭제
                </button>
            </section>
        </main>
    );
}