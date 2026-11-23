"use client";

// 내 식물 목록 페이지 (B 담당)

import { useState, useEffect } from "react";
import Link from "next/link";

// 식물 카드 컴포넌트
import PlantCard from "../../components/plants/plantCard";

// 백엔드 API 호출 함수
import { getAllPlants } from "../../service/plantsApi";

// CSS
import styles from "./plants.module.css";


export default function PlantsPage() {

    // 서버에서 가져온 식물 목록을 저장
    const [plants, setPlants] = useState([]);

    // 데이터를 불러오는 중인지 확인
    const [loading, setLoading] = useState(true);

    // 오류 메시지 저장
    const [error, setError] = useState("");


    // ========================================
    // 1. 내 식물 전체 조회
    // ========================================

    async function loadPlants() {

        setLoading(true);
        setError("");

        try {

            // plantsApi.js의 함수 실행
            // FastAPI GET /plants 요청
            const data = await getAllPlants();

            // 서버에서 받아온 식물 목록 저장
            setPlants(data);

        } catch (err) {

            console.error(err);

            setError("식물 목록을 불러오지 못했습니다.");

        } finally {

            // 성공하거나 실패해도 로딩 종료
            setLoading(false);
        }
    }


    // ========================================
    // 2. 페이지가 처음 열릴 때 실행
    // ========================================

    useEffect(() => {
        loadPlants();
    }, []);


    // ========================================
    // 3. 화면 출력
    // ========================================

    return (

        <main className={styles.container}>

            {/* 페이지 상단 */}
            <section className={styles.header}>

                <div>
                    <p className={styles.subtitle}>
                        MY PLANTS
                    </p>

                    <h1>내 식물 목록</h1>

                    <p className={styles.description}>
                        내가 키우는 식물들을 한눈에 관리해 보세요.
                    </p>
                </div>

                {/* 식물 등록 페이지 이동 */}
                <Link
                    href="/plants/new"
                    className={styles.addButton}
                >
                    + 식물 추가
                </Link>

            </section>


            {/* 식물 개수 */}
            <div className={styles.summary}>

                <span>
                    등록된 식물
                    <strong> {plants.length}개</strong>
                </span>

                <button
                    type="button"
                    onClick={loadPlants}
                    disabled={loading}
                    className={styles.refreshButton}
                >
                    새로고침
                </button>

            </div>


            {/* 로딩 중 */}
            {loading && (
                <div className={styles.message}>
                    식물 정보를 불러오는 중입니다...
                </div>
            )}


            {/* 오류 발생 */}
            {!loading && error && (
                <div className={styles.message}>
                    <p>{error}</p>

                    <button
                        type="button"
                        onClick={loadPlants}
                        className={styles.retryButton}
                    >
                        다시 시도
                    </button>
                </div>
            )}


            {/* 등록된 식물이 없는 경우 */}
            {!loading && !error && plants.length === 0 && (

                <div className={styles.message}>

                    <div className={styles.emptyIcon}>
                        🪴
                    </div>

                    <h2>등록된 식물이 없습니다.</h2>

                    <p>
                        첫 번째 반려식물을 등록해 보세요!
                    </p>

                    <Link
                        href="/plants/new"
                        className={styles.emptyButton}
                    >
                        식물 등록하기
                    </Link>

                </div>
            )}


            {/* 식물 목록 출력 */}
            {!loading && !error && plants.length > 0 && (

                <section className={styles.grid}>

                    {plants.map((plant) => (

                        <PlantCard
                            key={plant.id}
                            plant={plant}
                        />

                    ))}

                </section>
            )}

        </main>
    );
}
