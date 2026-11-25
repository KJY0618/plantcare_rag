"use client";

// 케어 일기 (C) : /plants/1/diary
//   위쪽 : 식물 사진·이름
//   왼쪽 : 종류별 거르기 버튼 + 기록 목록 (최근 날짜가 먼저)
//   오른쪽 : 이번 달 기록 요약

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { TYPE_LABEL } from "@/components/care/LogList";
import { deleteLog, getLogs, getPlantDetail, makePhotoUrl } from "@/service/careApi";
import styles from "./diary.module.css";

// 거르기 버튼 목록 : value 가 "" 이면 전체
const FILTERS = [
    { value: "", label: "전체" },
    { value: "water", label: "물주기" },
    { value: "fertilizer", label: "비료" },
    { value: "repot", label: "분갈이" },
    { value: "issue", label: "이상 기록" },
];

// 처음에 보여 줄 기록 개수 (더 보기를 누를 때마다 이만큼씩 늘어남)
const PAGE_SIZE = 10;

// 기록 종류별 아이콘 / 작은 설명 글자 / 메모가 없을 때 대신 보여 줄 글자
const TYPE_INFO = {
    water: { icon: "💧", tag: "정기 관수", empty: "물을 줬어요" },
    fertilizer: { icon: "🌱", tag: "영양 관리", empty: "비료를 줬어요" },
    repot: { icon: "🏺", tag: "화분 교체", empty: "분갈이를 했어요" },
    issue: { icon: "⚠", tag: "증상 메모", empty: "메모 없음" },
};

export default function DiaryPage() {
    const params = useParams();
    const plantId = params.id;              // 주소의 식물 번호
    // 기록에 붙인 사진을 크게 보여 주는 창
    const photoDialogRef = useRef(null);

    const [plant, setPlant] = useState(null);      // 위쪽에 보여 줄 식물 정보
    const [logs, setLogs] = useState([]);          // 서버에서 받은 전체 기록 (최근 날짜 먼저)
    const [logType, setLogType] = useState("");    // 지금 고른 종류 ("" 이면 전체)
    const [month, setMonth] = useState("");        // 지금 고른 달 ("2026-11" 모양, "" 이면 전체 기간)
    const [visible, setVisible] = useState(PAGE_SIZE);  // 지금 화면에 보여 주는 기록 개수
    const [loading, setLoading] = useState(true);  // 처음 불러오는 중
    const [error, setError] = useState("");        // 불러오기 실패 이유
    const [notice, setNotice] = useState("");      // 삭제 결과 안내
    const [deleting, setDeleting] = useState(false);   // 삭제 처리 중이면 버튼 잠금
    const [photoView, setPhotoView] = useState("");    // 크게 보고 있는 사진 주소

    // 기록 목록만 다시 불러옴 (삭제한 뒤에도 사용)
    async function loadLogs() {
        const data = await getLogs(plantId, "");
        setLogs(data);
    }

    // 화면이 처음 열릴 때 식물 정보와 기록을 함께 불러옴
    useEffect(() => {
        let canceled = false;

        async function load() {
            try {
                const [plantData, logData] = await Promise.all([
                    getPlantDetail(plantId),
                    getLogs(plantId, ""),
                ]);
                if (!canceled) {
                    setPlant(plantData);
                    setLogs(logData);
                }
            } catch (e) {
                if (!canceled) {
                    setError(e.message);
                }
            } finally {
                if (!canceled) {
                    setLoading(false);
                }
            }
        }
        load();

        return () => {
            canceled = true;
        };
    }, [plantId]);

    // 기록 1건 삭제 (잘못 누른 기록 되돌리기)
    async function handleDelete(log) {
        if (deleting) {
            return;
        }
        let question = log.logged_at + " " + TYPE_LABEL[log.log_type] + " 기록을 삭제할까요?";
        if (log.log_type === "water") {
            question = question + "\n물주기 기록을 지우면 다음 물주기 날짜가 바뀌어요.";
        }
        if (!window.confirm(question)) {
            return;
        }
        setDeleting(true);
        setNotice("");
        try {
            await deleteLog(plantId, log.id);
            setNotice("기록을 삭제했어요.");
            await loadLogs();               // 목록을 다시 불러옴
        } catch (e) {
            setNotice(e.message);
        }
        setDeleting(false);
    }

    // 종류를 바꾸면 보여 주는 개수를 처음으로 되돌림
    function changeType(value) {
        setLogType(value);
        setVisible(PAGE_SIZE);
    }

    // 달을 바꾸면 보여 주는 개수를 처음으로 되돌림
    function changeMonth(value) {
        setMonth(value);
        setVisible(PAGE_SIZE);
    }

    // 기록 사진 크게 보기
    function openPhoto(url) {
        setPhotoView(url);
        photoDialogRef.current?.showModal();
    }

    // ---------------- 화면 ----------------

    if (loading) {
        return <p className={styles.state}>불러오는 중...</p>;
    }
    if (error || !plant) {
        return (
            <div className={styles.state}>
                <p>{error || "식물 정보를 불러오지 못했어요."}</p>
                <Link href="/plants">내 식물 목록으로</Link>
            </div>
        );
    }

    // 기록이 있는 달 목록 (최근 달이 먼저) : "2026-11" 모양, 달마다 기록 수도 함께 셈
    const monthList = [];
    const monthTotals = {};
    for (const log of logs) {
        const key = log.logged_at.slice(0, 7);
        if (monthTotals[key] === undefined) {
            monthTotals[key] = 0;
            monthList.push(key);
        }
        monthTotals[key] = monthTotals[key] + 1;
    }
    // 고른 달의 기록을 모두 지워서 목록에서 사라졌으면 전체 기간으로 봄
    const activeMonth = monthList.includes(month) ? month : "";

    // 고른 달의 기록 (종류 거르기 전)
    const monthLogs = [];
    for (const log of logs) {
        if (activeMonth === "" || log.logged_at.startsWith(activeMonth)) {
            monthLogs.push(log);
        }
    }

    // 종류별 개수 (거르기 버튼 옆 숫자) : 고른 달 기준
    const counts = { "": monthLogs.length, water: 0, fertilizer: 0, repot: 0, issue: 0 };
    for (const log of monthLogs) {
        counts[log.log_type] = counts[log.log_type] + 1;
    }

    // 이번 달 기록 개수 (오른쪽 요약)
    const now = new Date();
    const monthKey = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");   // "2026-11"
    const monthCounts = { water: 0, fertilizer: 0, repot: 0, issue: 0 };
    for (const log of logs) {
        if (log.logged_at.startsWith(monthKey)) {
            monthCounts[log.log_type] = monthCounts[log.log_type] + 1;
        }
    }

    // 고른 종류만 남김
    const filteredLogs = [];
    for (const log of monthLogs) {
        if (logType === "" || log.log_type === logType) {
            filteredLogs.push(log);
        }
    }
    // 그중 앞에서부터 visible 개만 화면에 보여 줌 (나머지는 "더 보기")
    const shownLogs = filteredLogs.slice(0, visible);
    const restCount = filteredLogs.length - shownLogs.length;

    // 위쪽 식물 설명 : "가울테리아 (Gaultheria procumbens) · 거실 창가"
    const species = plant.species;
    let speciesText = plant.custom_species_name || "";
    if (species) {
        speciesText = species.name;
        if (species.scientific_name) {
            speciesText = speciesText + " (" + species.scientific_name + ")";
        }
    }
    const subParts = [];
    if (speciesText) {
        subParts.push(speciesText);
    }
    if (plant.location) {
        subParts.push(plant.location);
    }
    const photoUrl = makePhotoUrl(plant.photo_url);

    return (
        <main className={styles.page}>
            {/* 맨 위 줄 */}
            <div className={styles.topBar}>
                <Link href={"/plants/" + plantId} className={styles.back}>← 식물 상세로</Link>
                <span className={styles.totalText}>🗓 {logs.length}건의 관리 기록</span>
            </div>

            {/* 식물 소개 */}
            <section className={styles.hero}>
                <div className={styles.thumb}>
                    <span className={styles.thumbEmpty}>🌿</span>
                    {photoUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            className={styles.thumbImg}
                            src={photoUrl}
                            alt={plant.nickname}
                            onError={(e) => {
                                e.currentTarget.style.display = "none";
                            }}
                        />
                    )}
                </div>
                <div>
                    <div className={styles.eyebrow}>CARE DIARY</div>
                    <h1 className={styles.title}>케어 일기</h1>
                    <p className={styles.sub}>
                        <strong>{plant.nickname}</strong>
                        {subParts.length > 0 && " · " + subParts.join(" · ")}
                    </p>
                </div>
            </section>

            <div className={styles.layout}>
                {/* 왼쪽 : 거르기 + 목록 */}
                <div className={styles.main}>
                    <div className={styles.filters}>
                        {FILTERS.map((f) => (
                            <button
                                key={f.value}
                                type="button"
                                className={logType === f.value ? styles.chipActive : styles.chip}
                                onClick={() => changeType(f.value)}
                            >
                                {f.label} <span className={styles.chipCount}>{counts[f.value]}</span>
                            </button>
                        ))}

                        {/* 달 고르기 : 기록이 있는 달만 나옴 */}
                        <select
                            className={styles.monthSelect}
                            value={activeMonth}
                            onChange={(e) => changeMonth(e.target.value)}
                            aria-label="기간 고르기"
                        >
                            <option value="">전체 기간</option>
                            {monthList.map((key) => (
                                <option key={key} value={key}>
                                    {key.replace("-", ".")} ({monthTotals[key]})
                                </option>
                            ))}
                        </select>
                    </div>

                    {notice && <p className={styles.notice}>{notice}</p>}

                    {shownLogs.length === 0 && (
                        <p className={styles.empty}>
                            {logs.length === 0 ? "아직 기록이 없어요." : "이 조건에 맞는 기록이 없어요."}
                        </p>
                    )}

                    <ul className={styles.list}>
                        {shownLogs.map((log) => {
                            const info = TYPE_INFO[log.log_type];
                            const isIssue = log.log_type === "issue";
                            const logPhoto = makePhotoUrl(log.photo_url);
                            return (
                                <li key={log.id} className={styles.row}>
                                    <span className={isIssue ? styles.iconIssue : styles.icon}>{info.icon}</span>

                                    <div className={styles.rowBody}>
                                        <div className={styles.rowTitle}>
                                            <strong>{TYPE_LABEL[log.log_type]}</strong>
                                            <span className={isIssue ? styles.tagIssue : styles.tag}>{info.tag}</span>
                                        </div>
                                        <p className={styles.memo}>
                                            {log.memo ? log.memo : info.empty}
                                            {logPhoto && (
                                                <>
                                                    {" · "}
                                                    <button
                                                        type="button"
                                                        className={styles.photoLink}
                                                        onClick={() => openPhoto(logPhoto)}
                                                    >
                                                        📷 사진 보기
                                                    </button>
                                                </>
                                            )}
                                        </p>
                                    </div>

                                    <span className={styles.date}>{log.logged_at}</span>
                                    <button
                                        type="button"
                                        className={styles.delete}
                                        onClick={() => handleDelete(log)}
                                        disabled={deleting}
                                        aria-label={log.logged_at + " " + TYPE_LABEL[log.log_type] + " 기록 삭제"}
                                    >
                                        삭제
                                    </button>
                                </li>
                            );
                        })}
                    </ul>

                    {/* 기록이 더 있으면 : 더 보기 */}
                    {restCount > 0 && (
                        <div className={styles.moreRow}>
                            <button
                                type="button"
                                className={styles.moreButton}
                                onClick={() => setVisible(visible + PAGE_SIZE)}
                            >
                                나머지 {restCount}개 더 보기 ▾
                            </button>
                        </div>
                    )}
                </div>

                {/* 오른쪽 : 이번 달 요약 */}
                <aside className={styles.summary}>
                    <div className={styles.summaryHead}>
                        <h2 className={styles.summaryTitle}>📊 기록 요약</h2>
                        <span className={styles.summaryMonth}>
                            {now.getFullYear()}.{String(now.getMonth() + 1).padStart(2, "0")}
                        </span>
                    </div>
                    <div className={styles.tiles}>
                        <div className={styles.tile}>
                            <span>물주기</span>
                            <strong>{monthCounts.water}회</strong>
                        </div>
                        <div className={styles.tile}>
                            <span>비료</span>
                            <strong>{monthCounts.fertilizer}회</strong>
                        </div>
                        <div className={styles.tile}>
                            <span>분갈이</span>
                            <strong>{monthCounts.repot}회</strong>
                        </div>
                        <div className={styles.tile}>
                            <span>⚠ 이상 기록</span>
                            <strong>{monthCounts.issue}건</strong>
                        </div>
                    </div>
                    <Link href={"/plants/" + plantId} className={styles.backButton}>
                        ← {plant.nickname} 상세로 돌아가기
                    </Link>
                </aside>
            </div>

            {/* 기록 사진 크게 보기 */}
            <dialog
                ref={photoDialogRef}
                className={styles.photoDialog}
                onClose={() => setPhotoView("")}
                aria-label="기록 사진"
            >
                {photoView && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className={styles.photoDialogImage} src={photoView} alt="기록 사진" />
                )}
                <button
                    type="button"
                    className={styles.photoDialogClose}
                    onClick={() => photoDialogRef.current?.close()}
                >
                    닫기
                </button>
            </dialog>
        </main>
    );
}