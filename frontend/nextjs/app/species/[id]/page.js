
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getSpeciesDetail } from "@/service/speciesApi";
import styles from "./detail.module.css";

// =====================================
// 1. 정보 표시 헬퍼 함수
// =====================================

function showValue(value) {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    return value;
}

// =====================================
// 2. 정보 항목 컴포넌트
// =====================================

function InfoItem({ label, value }) {
    const displayValue = showValue(value);

    if (displayValue === null) return null;

    return (
        <div className={styles.infoItem}>
            <span className={styles.infoLabel}>{label}</span>
            <span className={styles.infoValue}>{displayValue}</span>
        </div>
    );
}

// =====================================
// 3. 태그 목록 컴포넌트
// =====================================

function TagList({ label, tags }) {
    if (!Array.isArray(tags) || tags.length === 0) {
        return null;
    }

    const displayTags = label === "광도"
        ? [
            "중간 광도(800~1,500 Lux)",
            "높은 광도(1,500~10,000 Lux)"
        ]
        : tags;

    return (
        <div className={styles.infoItem}>
            <span className={styles.infoLabel}>{label}</span>

            <div className={styles.tagList}>
                {displayTags.map((tag, index) => (
                    <span key={index} className={styles.tag}>
                        {tag}
                    </span>
                ))}
            </div>
        </div>
    );
}

// =====================================
// 4. 식물 도감 상세 페이지
// =====================================

export default function SpeciesDetailPage() {

    const params = useParams();
    const router = useRouter();

    const speciesId = params.id;

    const [species, setSpecies] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [imageError, setImageError] = useState(false);

    // =====================================
    // 5. 식물 상세 정보 조회
    // =====================================

    async function loadSpecies() {

        setLoading(true);
        setError("");

        try {
            const data = await getSpeciesDetail(speciesId);

            setSpecies(data);
            setImageError(false);

        } catch (e) {
            setError(e.message);

        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (speciesId) {
            loadSpecies();
        }
    }, [speciesId]);

    // =====================================
    // 6. 로딩 및 오류 처리
    // =====================================

    if (loading) {
        return (
            <div className={styles.page}>
                <p className={styles.state}>식물 정보를 불러오는 중입니다...</p>
            </div>
        );
    }

    if (error || !species) {
        return (
            <div className={styles.page}>
                <p className={styles.state}>
                    {error || "식물 정보를 찾을 수 없습니다."}
                </p>

                <button
                    className={`${styles.button} ${styles.primary}`}
                    onClick={() => router.back()}
                >
                    돌아가기
                </button>
            </div>
        );
    }

    // =====================================
    // 7. 식물 이미지 설정
    // =====================================

    const imageUrl = species.image_url || species.thumb_url;

    return (
        <main className={styles.page}>

            {/* 식물 기본 정보 */}
            <section className={styles.head}>

                {!imageError && imageUrl ? (
                    <img
                        src={imageUrl}
                        alt={species.name}
                        className={styles.photo}
                        onError={() => setImageError(true)}
                    />
                ) : (
                    <div className={styles.noPhoto}>
                        🪴
                    </div>
                )}

                <h1 className={styles.nickname}>
                    {species.name}
                </h1>

                {species.scientific_name && (
                    <p className={styles.sub}>
                        {species.scientific_name}
                    </p>
                )}

                {species.english_name && (
                    <p className={styles.sub}>
                        {species.english_name}
                    </p>
                )}

            </section>

            {/* 기본 정보 */}
            <section className={styles.card}>

                <h2>기본 정보</h2>

                <div className={styles.info}>
                    <InfoItem
                        label="유통명"
                        value={species.distribution_name}
                    />

                    <InfoItem
                        label="원산지"
                        value={species.origin}
                    />

                    <InfoItem
                        label="과명"
                        value={species.family_name}
                    />

                    <InfoItem
                        label="생장 높이"
                        value={species.growth_height ? `${species.growth_height} cm` : null}
                    />

                    <InfoItem
                        label="생장 너비"
                        value={species.growth_width ? `${species.growth_width} cm` : null}
                    />

                </div>
            </section>

            {/* 생육 환경 */}
            <section className={styles.card}>

                <h2>생육 환경</h2>

                <div className={styles.info}>

                    <TagList
                        label="광도"
                        tags={species.tags?.light}
                    />

                    <TagList
                        label="배치 장소"
                        tags={species.tags?.placement}
                    />

                    <InfoItem
                        label="생육 온도"
                        value={species.growth_temp}
                    />

                    <InfoItem
                        label="최저 월동 온도"
                        value={species.winter_min_temp}
                    />

                    <InfoItem
                        label="습도"
                        value={species.humidity}
                    />

                </div>
            </section>

            {/* 물주기 정보 */}
            <section className={styles.card}>

                <h2>계절별 물주기</h2>

                <div className={styles.info}>

                    <InfoItem
                        label="봄"
                        value={species.water_spring}
                    />

                    <InfoItem
                        label="여름"
                        value={species.water_summer}
                    />

                    <InfoItem
                        label="가을"
                        value={species.water_autumn}
                    />

                    <InfoItem
                        label="겨울"
                        value={species.water_winter}
                    />

                </div>
            </section>

            {/* 관리 정보 */}
            <section className={styles.card}>

                <h2>관리 정보</h2>

                <div className={styles.info}>

                    <InfoItem
                        label="관리 난이도"
                        value={species.manage_level}
                    />

                    <InfoItem
                        label="관리 요구도"
                        value={species.manage_demand}
                    />

                    <InfoItem
                        label="비료"
                        value={species.fertilizer_info}
                    />

                    <InfoItem
                        label="토양"
                        value={species.soil_info}
                    />

                    <InfoItem
                        label="번식 시기"
                        value={species.propagation_period}
                    />

                    <InfoItem
                        label="잎 형태"
                        value={species.leaf_form}
                    />

                </div>
            </section>

            {/* 식물 특징 */}
            <section className={styles.card}>

                <h2>식물 특징</h2>

                <p className={styles.description}>
                    {species.function_info || "등록된 정보가 없습니다."}
                </p>

            </section>

            {/* 하단 버튼 */}
            <div className={styles.bottom}>

                <Link
                    href="/species"
                    className={`${styles.button} ${styles.primary}`}
                >
                    도감 목록으로
                </Link>

            </div>

        </main>
    );
}
