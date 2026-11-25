"use client";

// 내 식물 상세 : /plants/1 처럼 식물 번호로 들어오는 화면
//   위쪽 : 사진·이름·요약
//   왼쪽 : 물주기·관리 기록 / 도감 정보 / 최근 기록
//   오른쪽 : 이상 기록 쓰기
//   도감에서 고른 식물이 아니면(직접 입력) 도감 관련 부분은 숨김

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import LogList, { TYPE_LABEL } from "@/components/care/LogList";
import {
    addLog,
    deleteLog,
    deletePlant,
    getPlantDetail,
    makePhotoUrl,
    waterPlant,
} from "@/service/careApi";
import { updatePlant } from "@/service/plantsApi";   // B 담당 : 식물 수정 (사진만 보내서 대표 사진 변경에 사용)
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

// 광도 태그 이어 붙이기
//   도감 데이터가 "중간 광도(800~1,500 Lux)" 를 쉼표에서 잘라 저장해 둬서 ["중간 광도(800~1", "500 Lux)"] 로 옴
//   → 쉼표로 다시 이어 붙이면 원래 글자가 됨
function showLight(tags) {
    if (tags && tags.length > 0) {
        return tags.join(",");
    }
    return "정보 없음";
}

// D-day 숫자를 짧은 글자로 바꿈 (D-5 / 오늘 / 2일 지남)
function ddayShort(dDay) {
    if (dDay === null || dDay === undefined) {
        return "기록 없음";
    }
    if (dDay === 0) {
        return "오늘";
    }
    if (dDay < 0) {
        return -dDay + "일 지남";
    }
    return "D-" + dDay;
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

// 이번 계절의 도감 물주기 글자 (3~5 봄, 6~8 여름, 9~11 가을, 12~2 겨울)
function seasonWater(species) {
    const month = new Date().getMonth() + 1;   // getMonth() 는 0부터 시작해서 1을 더함
    if (month >= 3 && month <= 5) {
        return species.water_spring;
    }
    if (month >= 6 && month <= 8) {
        return species.water_summer;
    }
    if (month >= 9 && month <= 11) {
        return species.water_autumn;
    }
    return species.water_winter;
}

export default function PlantDetailPage() {
    const params = useParams();
    const router = useRouter();
    const plantId = params.id;            // 주소의 식물 번호
    // 도감 정보 모달창을 열고 닫기 위한 참조
    const speciesDialogRef = useRef(null);
    // 대표 사진 변경용 숨겨진 파일 선택칸
    const photoInputRef = useRef(null);
    // 고른 사진을 올리기 전에 확인하는 창
    const photoDialogRef = useRef(null);

    const [plant, setPlant] = useState(null);      // 서버에서 받은 식물 상세
    const [loading, setLoading] = useState(true);  // 처음 불러오는 중
    const [error, setError] = useState("");        // 불러오기 실패 이유
    const [message, setMessage] = useState("");    // 버튼을 누른 결과 안내
    const [saving, setSaving] = useState(false);   // 저장 중이면 버튼 잠금
    const [aiNotice, setAiNotice] = useState(false); // "AI 준비 중" 안내를 보여 줄지
    const [photoNote, setPhotoNote] = useState("");  // 대표 사진 변경 결과 안내
    const [photoError, setPhotoError] = useState(false); // 안내가 오류인지
    const [pendingFile, setPendingFile] = useState(null);   // 확인창에서 기다리는 사진 파일
    const [pendingUrl, setPendingUrl] = useState("");       // 그 사진의 미리보기 주소

    // 이상 기록 입력칸
    const [memo, setMemo] = useState("");
    const [photo, setPhoto] = useState(null);
    const [previewUrl, setPreviewUrl] = useState("");  // 고른 사진을 미리 보여 주는 임시 주소
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

    // 대표 사진 변경 1단계 : 사진을 고르면 바로 올리지 않고 확인창에 미리 보여 줌
    function handleProfilePhoto(event) {
        const file = event.target.files[0];
        event.target.value = "";        // 같은 사진을 다시 골라도 동작하도록 비움
        if (!file || saving) {
            return;
        }
        setPhotoNote("");
        setPhotoError(false);

        // 사진 검사 (jpg / png / webp, 5MB 이하) - 서버도 한 번 더 검사함
        const okTypes = ["image/jpeg", "image/png", "image/webp"];
        if (!okTypes.includes(file.type)) {
            setPhotoNote("사진은 jpg, png, webp 만 올릴 수 있어요.");
            setPhotoError(true);
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            setPhotoNote("사진은 5MB 이하만 올릴 수 있어요.");
            setPhotoError(true);
            return;
        }

        // 검사를 통과하면 확인창을 열어서 고른 사진을 보여 줌
        setPendingFile(file);
        setPendingUrl(URL.createObjectURL(file));
        photoDialogRef.current?.showModal();
    }

    // 확인창이 닫힐 때 (취소, ESC, 변경 후) : 임시 미리보기 주소를 정리
    function handlePhotoDialogClose() {
        if (pendingUrl) {
            URL.revokeObjectURL(pendingUrl);
        }
        setPendingUrl("");
        setPendingFile(null);
    }

    // 대표 사진 변경 2단계 : "이 사진으로 변경"을 누르면 서버에 올려서 식물 사진으로 바꿈
    //   PUT /plants/{id} 는 보낸 항목만 바꾸기 때문에 사진만 보내면 됨
    async function confirmProfilePhoto() {
        const file = pendingFile;
        photoDialogRef.current?.close();      // 확인창 닫기 (임시 주소도 같이 정리됨)
        if (!file || saving) {
            return;
        }

        setSaving(true);
        try {
            const formData = new FormData();
            formData.append("photo", file);
            await updatePlant(plantId, formData);
            setPhotoNote("대표 사진을 바꿨어요.");
            await loadPlant();
        } catch (e) {
            setPhotoNote(e.message);
            setPhotoError(true);
        } finally {
            setSaving(false);
        }
    }

    // 사진 고르기 : 고른 사진을 상자 안에 미리 보여 줌
    function handlePhotoChange(event) {
        const file = event.target.files[0] || null;
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);       // 이전 미리보기 주소는 정리
        }
        setPhoto(file);
        if (file) {
            setPreviewUrl(URL.createObjectURL(file));
        } else {
            setPreviewUrl("");
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
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
            }
            setPreviewUrl("");
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

    const species = plant.species;                  // 도감에서 고른 식물이면 정보가 있음 (직접 입력이면 null)
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

    // 위쪽 요약의 세 번째 칸 : 도감 식물은 권장 환경, 직접 입력 식물은 "직접 관리 중"
    let thirdLabel = "관리 방식";
    let thirdValue = "직접 관리 중";
    if (species) {
        thirdLabel = "도감 권장 환경";
        // 광요구도는 괄호 앞 글자만 (예: "중간 광도(800~1,500 Lux)" → "중간 광도")
        const light = showLight(species.tags?.light).split("(")[0].trim();
        const temp = species.growth_temp;
        const parts = [];
        if (light && light !== "정보 없음") {
            parts.push(light);
        }
        if (temp) {
            parts.push(temp);
        }
        thirdValue = parts.length > 0 ? parts.join(" · ") : "정보 없음";
    }

    return (
        <main className={styles.page}>
            {/* 맨 위 줄 : 목록으로 돌아가기, 수정, 삭제 */}
            <div className={styles.topBar}>
                <Link href="/plants" className={styles.back}>← 내 식물 목록으로</Link>
                <div className={styles.topActions}>
                    <Link className={styles.smallButton} href={"/plants/" + plantId + "/edit"}>
                        ✏ 수정
                    </Link>
                    <button
                        className={styles.smallDanger}
                        onClick={handleDelete}
                        disabled={saving}
                    >
                        🗑 삭제
                    </button>
                </div>
            </div>

            {/* 위쪽 : 사진, 이름, 요약 */}
            <section className={styles.hero}>
                <div className={styles.photoWrap}>
                    {/* 사진을 누르면 파일 선택창이 열리고, 고르면 대표 사진으로 바뀜 */}
                    <button
                        type="button"
                        className={styles.photoBox}
                        onClick={() => photoInputRef.current?.click()}
                        disabled={saving}
                        aria-label="대표 사진 변경"
                    >
                        <span className={styles.noPhoto}>🌿</span>
                        {photoUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                className={styles.photo}
                                src={photoUrl}
                                alt={plant.nickname}
                                onError={(e) => {
                                    e.currentTarget.style.display = "none";
                                }}
                            />
                        )}
                        <span className={styles.photoEdit}>
                            {saving ? "올리는 중..." : "📷 사진 변경"}
                        </span>
                    </button>
                    <input
                        ref={photoInputRef}
                        className={styles.fileInput}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleProfilePhoto}
                        tabIndex={-1}
                    />
                    {photoNote && (
                        <p className={photoError ? styles.photoNoteError : styles.photoNote} role="status">
                            {photoNote}
                        </p>
                    )}
                </div>

                <div className={styles.heroBody}>
                    <div className={styles.heroTop}>
                        <div className={styles.eyebrowRow}>
                            <span className={styles.eyebrow}>MY PLANT</span>
                            <span className={styles.ddayPill}>{ddayShort(plant.d_day)}</span>
                        </div>
                        {species && (
                            <button
                                type="button"
                                className={styles.speciesTopButton}
                                onClick={() => speciesDialogRef.current?.showModal()}
                            >
                                📖 도감 정보 상세보기 →
                            </button>
                        )}
                    </div>

                    <h1 className={styles.nickname}>{plant.nickname}</h1>

                    {/* 도감 식물은 학명(기울임), 직접 입력 식물은 입력한 종류 이름 */}
                    {species && species.scientific_name && (
                        <p className={styles.scientific}>{species.scientific_name}</p>
                    )}
                    {!species && speciesName && (
                        <p className={styles.speciesName}>{speciesName}</p>
                    )}

                    <div className={styles.chips}>
                        <span className={styles.chip}>📍 위치: {showValue(plant.location)}</span>
                        <span className={styles.chip}>🛒 구입일: {showValue(plant.purchase_date)}</span>
                        <span className={styles.chip}>💧 물주기: {plant.water_interval_days}일마다</span>
                    </div>

                    <div className={styles.summary}>
                        <div className={styles.summaryCell}>
                            <span className={styles.summaryLabel}>다음 물주기</span>
                            <strong className={styles.summaryValue}>{showValue(plant.next_water_date)}</strong>
                        </div>
                        <div className={styles.summaryCell}>
                            <span className={styles.summaryLabel}>마지막으로 준 날</span>
                            <strong className={styles.summaryValue}>{showValue(plant.last_watered_at)}</strong>
                        </div>
                        <div className={styles.summaryCell}>
                            <span className={styles.summaryLabel}>{thirdLabel}</span>
                            <strong className={styles.summaryValueText}>{thirdValue}</strong>
                        </div>
                    </div>
                </div>
            </section>

            <div className={styles.layout}>
                {/* 왼쪽 열 */}
                <div className={styles.column}>
                    {/* 물주기 · 관리 기록 */}
                    <section className={styles.card}>
                        <div className={styles.cardHead}>
                            <h2 className={styles.cardTitle}>💧 물주기 · 관리 기록</h2>
                            <span className={styles.badge}>{ddayShort(plant.d_day)}</span>
                        </div>

                        <div className={styles.buttons}>
                            <button
                                className={styles.primary}
                                onClick={handleWater}
                                disabled={saving || waterLocked}
                            >
                                {waterLocked ? "💧 물주기 완료" : "💧 물 줬어요"}
                            </button>
                            <button
                                className={styles.button}
                                onClick={() =>
                                    handleSimpleLog("fertilizer", "비료 준 기록을 저장했어요.", fertilizerConfirm)
                                }
                                disabled={saving || fertilizerDone}
                            >
                                {fertilizerDone ? "🌱 오늘 비료 기록함" : "🌱 비료 줬어요"}
                            </button>
                            <button
                                className={styles.button}
                                onClick={() =>
                                    handleSimpleLog("repot", "분갈이 기록을 저장했어요.", repotConfirm)
                                }
                                disabled={saving || repotDone}
                            >
                                {repotDone ? "🪴 오늘 분갈이 기록함" : "🪴 분갈이 했어요"}
                            </button>
                        </div>

                        {/* 마지막으로 한 날짜 : 실수로 또 누르기 전에 눈으로 확인 */}
                        <div className={styles.lastRow}>
                            <div className={styles.lastCell}>
                                <span>마지막 비료</span>
                                <strong>{lastText(plant.last_fertilized_at)}</strong>
                            </div>
                            <div className={styles.lastCell}>
                                <span>마지막 분갈이</span>
                                <strong>{lastText(plant.last_repotted_at)}</strong>
                            </div>
                        </div>

                        {message && <p className={styles.message}>{message}</p>}
                    </section>

                    {/* 도감 정보 : 도감에서 고른 식물만 보임 */}
                    {species && (
                        <section className={styles.card}>
                            <div className={styles.cardHead}>
                                <h2 className={styles.cardTitle}>
                                    📖 도감 정보 <span className={styles.titleLabel}>ENCYCLOPEDIA</span>
                                </h2>
                                <button
                                    type="button"
                                    className={styles.linkButton}
                                    onClick={() => speciesDialogRef.current?.showModal()}
                                >
                                    도감 상세보기 →
                                </button>
                            </div>

                            <div className={styles.tiles}>
                                <div className={styles.tile}>
                                    <span className={styles.tileLabel}>☀ 광요구도</span>
                                    <strong className={styles.tileValue}>{showLight(species.tags?.light)}</strong>
                                </div>
                                <div className={styles.tile}>
                                    <span className={styles.tileLabel}>🌡 적정 온도</span>
                                    <strong className={styles.tileValue}>{showValue(species.growth_temp)}</strong>
                                </div>
                                <div className={styles.tile}>
                                    <span className={styles.tileLabel}>💧 물주기 기준</span>
                                    <strong className={styles.tileValue}>{showValue(seasonWater(species))}</strong>
                                </div>
                            </div>

                            {species.function_info && (
                                <p className={styles.speciesDesc}>{species.function_info}</p>
                            )}
                        </section>
                    )}

                    {/* 최근 기록 */}
                    <section className={styles.card}>
                        <div className={styles.cardHead}>
                            <h2 className={styles.cardTitle}>🕘 최근 기록</h2>
                            <Link className={styles.linkButton} href={"/plants/" + plantId + "/diary"}>
                                전체 보기
                            </Link>
                        </div>
                        <LogList logs={plant.recent_logs} onDelete={handleDeleteLog} disabled={saving} />
                    </section>
                </div>

                {/* 오른쪽 열 : 이상 기록 쓰기 */}
                <aside className={styles.issueCard}>
                    <div className={styles.issueHead}>
                        <span className={styles.issueTitle}>⚠ 이상 기록</span>
                        <span className={styles.issueLabel}>SYMPTOM LOG</span>
                    </div>

                    <form onSubmit={handleIssueSubmit} className={styles.issueBody}>
                        <p className={styles.issueHint}>잎이 노랗게 변했거나 벌레가 보일 때 남겨 두세요.</p>

                        <span className={styles.fieldLabel}>사진 첨부</span>
                        <label htmlFor="issue-photo" className={styles.fileBox}>
                            {previewUrl ? (
                                // 고른 사진 미리보기 (이 주소는 내 컴퓨터 안에서만 쓰는 임시 주소라 일반 img 사용)
                                // eslint-disable-next-line @next/next/no-img-element
                                <img className={styles.previewImg} src={previewUrl} alt="고른 사진 미리보기" />
                            ) : (
                                <span className={styles.fileIcon}>📷</span>
                            )}
                            <strong>{photo ? photo.name : "사진 파일 선택하기"}</strong>
                            <span className={styles.fileHint}>
                                {photo ? "다른 사진을 고르려면 다시 누르세요" : "JPG, PNG, WEBP · 5MB 이하"}
                            </span>
                        </label>
                        <input
                            key={fileKey}
                            id="issue-photo"
                            className={styles.fileInput}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={handlePhotoChange}
                        />

                        <label htmlFor="issue-memo" className={styles.fieldLabel}>메모</label>
                        <textarea
                            id="issue-memo"
                            className={styles.textarea}
                            value={memo}
                            onChange={(e) => setMemo(e.target.value)}
                            placeholder="예) 아랫잎이 노랗게 변했어요"
                            rows={4}
                        />

                        {issueError && <p className={styles.error}>{issueError}</p>}

                        <button className={styles.issueSubmit} type="submit" disabled={saving}>
                            {saving ? "저장 중..." : "💾 이상 기록 저장"}
                        </button>
                    </form>

                    <div className={styles.issueFooter}>
                        <span>원인이 궁금하다면</span>
                        <button
                            type="button"
                            className={styles.aiChip}
                            onClick={() => setAiNotice(true)}
                        >
                            AI에게 증상 물어보기
                        </button>
                    </div>
                    {aiNotice && (
                        <p className={styles.aiNotice} role="status">
                            AI 도우미는 준비 중이에요. 조금만 기다려 주세요.
                        </p>
                    )}
                </aside>
            </div>

            {/* 대표 사진 변경 확인창 : 고른 사진을 보고 "변경" 또는 "취소" */}
            <dialog
                ref={photoDialogRef}
                className={styles.photoDialog}
                onClose={handlePhotoDialogClose}
                aria-labelledby="photo-dialog-title"
            >
                <h2 id="photo-dialog-title" className={styles.photoDialogTitle}>
                    대표 사진을 이 사진으로 바꿀까요?
                </h2>
                {pendingUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className={styles.photoDialogImage} src={pendingUrl} alt="바꿀 사진 미리보기" />
                )}
                <div className={styles.photoDialogButtons}>
                    <button
                        type="button"
                        className={styles.button}
                        onClick={() => photoDialogRef.current?.close()}
                    >
                        취소
                    </button>
                    <button
                        type="button"
                        className={styles.primary}
                        onClick={confirmProfilePhoto}
                    >
                        이 사진으로 변경
                    </button>
                </div>
            </dialog>

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
                            aria-label="닫기"
                        >
                            ✕
                        </button>
                    </div>

                    {/* 도감 사진 */}
                    {(species.image_url || species.thumb_url) && (
                        // eslint-disable-next-line @next/next/no-img-element
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
                            <li>광도 : {showLight(species.tags?.light)}</li>
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
        </main>
    );
}