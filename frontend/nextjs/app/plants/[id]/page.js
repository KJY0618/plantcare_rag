"use client";

// 내 식물 상세 : /plants/1 처럼 식물 번호로 들어오는 화면
//   식물 정보, 다음 물주기, 물주기·비료·분갈이 버튼, 이상 기록 쓰기, 최근 기록, 수정·삭제

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import LogList from "@/components/care/LogList";
import {
    addLog,
    ddayText,
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

export default function PlantDetailPage() {
    const params = useParams();
    const router = useRouter();
    const plantId = params.id;            // 주소의 식물 번호

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

    // 비료 / 분갈이 버튼 (오늘 날짜로 바로 저장)
    async function handleSimpleLog(logType, doneText) {
        if (saving) {
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

    // 물주기 버튼 : 아직 물 줄 날이 아니면(D-day 가 1 이상) 잠금
    const waterLocked = plant.d_day !== null && plant.d_day > 0;

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
                        onClick={() => handleSimpleLog("fertilizer", "비료 준 기록을 저장했어요.")}
                        disabled={saving}
                    >
                        비료 줬어요
                    </button>
                    <button
                        className={styles.button}
                        onClick={() => handleSimpleLog("repot", "분갈이 기록을 저장했어요.")}
                        disabled={saving}
                    >
                        분갈이 했어요
                    </button>
                </div>

                {message && <p className={styles.message}>{message}</p>}
            </section>

            {/* 도감 정보 */}
            <section className={styles.card}>
                <h2>도감 정보</h2>
                {species ? (
                    <ul className={styles.info}>
                        <li>봄 물주기 : {showValue(species.water_spring)}</li>
                        <li>여름 물주기 : {showValue(species.water_summer)}</li>
                        <li>가을 물주기 : {showValue(species.water_autumn)}</li>
                        <li>겨울 물주기 : {showValue(species.water_winter)}</li>
                        <li>빛 : {showTags(species.tags && species.tags.light)}</li>
                        <li>놓을 곳 : {showTags(species.tags && species.tags.placement)}</li>
                        <li>비료 : {showValue(species.fertilizer_info)}</li>
                        <li>토양 : {showValue(species.soil_info)}</li>
                        <li>습도 : {showValue(species.humidity)}</li>
                        <li>겨울 최저 온도 : {showValue(species.winter_min_temp)}</li>
                        <li>관리 난이도 : {showValue(species.manage_level)}</li>
                    </ul>
                ) : (
                    <p className={styles.sub}>
                        직접 입력한 식물이라 도감 정보가 없어요. 물주기는 {plant.water_interval_days}일마다로 계산해요.
                    </p>
                )}
            </section>

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
                <LogList logs={plant.recent_logs} />
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