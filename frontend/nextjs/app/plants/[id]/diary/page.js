"use client";

// 케어 일기 (C) : /plants/1/diary
//   식물의 모든 케어 기록을 최근 날짜가 먼저 오도록 보여 주고, 종류별로 걸러 볼 수 있음

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import LogList from "@/components/care/LogList";
import { getLogs } from "@/service/careApi";
import styles from "./diary.module.css";

// 거르기 버튼 목록 : value 가 "" 이면 전체
const FILTERS = [
    { value: "", label: "전체" },
    { value: "water", label: "물주기" },
    { value: "fertilizer", label: "비료" },
    { value: "repot", label: "분갈이" },
    { value: "issue", label: "이상 기록" },
];

export default function DiaryPage() {
    const params = useParams();
    const plantId = params.id;              // 주소의 식물 번호

    const [logType, setLogType] = useState("");    // 지금 고른 종류 ("" 이면 전체)
    const [logs, setLogs] = useState([]);          // 서버에서 받은 기록 목록
    const [loading, setLoading] = useState(true);  // 불러오는 중
    const [error, setError] = useState("");        // 불러오기 실패 이유

    // 처음 열릴 때, 그리고 종류를 바꿀 때마다 기록을 다시 불러옴
    useEffect(() => {
        let canceled = false;     // 종류를 빨리 바꿨을 때 이전 요청 결과가 덮어쓰지 않게 함

        async function load() {
            setLoading(true);
            setError("");
            try {
                const data = await getLogs(plantId, logType);
                if (!canceled) {
                    setLogs(data);
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
    }, [plantId, logType]);

    return (
        <main className={styles.page}>
            <div className={styles.top}>
                <h1 className={styles.title}>케어 일기</h1>
                <Link href={"/plants/" + plantId}>← 식물 상세로</Link>
            </div>

            {/* 종류 거르기 */}
            <div className={styles.filters}>
                {FILTERS.map((f) => (
                    <button
                        key={f.value}
                        className={logType === f.value ? styles.active : styles.filter}
                        onClick={() => setLogType(f.value)}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {/* 목록 */}
            {loading && <p className={styles.state}>불러오는 중...</p>}
            {!loading && error && <p className={styles.error}>{error}</p>}
            {!loading && !error && <LogList logs={logs} />}
        </main>
    );
}