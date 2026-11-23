
"use client";

// 내 식물 수정 페이지 (B 담당)

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import styles from "./edit.module.css";

// 공통 입력 폼
import PlantForm from "../../../../components/plants/PlantForm";

// 백엔드 API 함수
import {
  getPlantById,
  updatePlant,
  getPhotoUrl
} from "../../../../service/plantsApi";


export default function PlantEditPage() {

  // 주소에서 식물 ID 가져오기
  // 예: /plants/3/edit -> id = 3
  const { id } = useParams();

  // 페이지 이동
  const router = useRouter();

  // 서버에서 가져온 식물 정보
  const [plant, setPlant] = useState(null);

  // 로딩 상태
  const [loading, setLoading] = useState(true);

  // 저장 중 상태
  const [submitting, setSubmitting] = useState(false);

  // 조회 및 저장 오류
  const [error, setError] = useState("");
  const [serverError, setServerError] = useState("");


  // ====================================
  // 1. 기존 식물 정보 가져오기
  // ====================================

  useEffect(() => {

    if (!id) return;

    let cancelled = false;

    async function loadPlant() {

      setLoading(true);
      setError("");
      setPlant(null);

      try {

        // GET /plants/{id}
        const data = await getPlantById(id);

        if (!cancelled) {
          setPlant(data);
        }

      } catch (err) {

        if (!cancelled) {
          setError(
            err.message || "식물 정보를 불러오지 못했습니다."
          );
        }

      } finally {

        if (!cancelled) {
          setLoading(false);
        }

      }
    }

    loadPlant();

    // 다른 페이지로 이동하면 이전 요청 결과를 무시
    return () => {
      cancelled = true;
    };

  }, [id]);


  // ====================================
  // 2. 수정 데이터 저장
  // ====================================

  async function handleSave(formData) {

    // 저장 버튼 중복 클릭 방지
    if (submitting) return;

    setSubmitting(true);
    setServerError("");

    try {

      // PUT /plants/{id}
      await updatePlant(id, formData);

      // 저장 성공 후 식물 상세 페이지 이동
      router.push(`/plants/${id}`);
      router.refresh();

    } catch (err) {

      // 실패하면 오류 메시지 표시
      setServerError(
        err.message || "식물 수정에 실패했습니다."
      );

    } finally {

      setSubmitting(false);

    }
  }


  // ====================================
  // 3. 로딩 화면
  // ====================================

  if (loading) {
    return (
      <main style={{ padding: "40px" }}>
        <p>식물 정보를 불러오는 중입니다...</p>
      </main>
    );
  }


  // ====================================
  // 4. 오류 화면
  // ====================================

  if (error || !plant) {
    return (
      <main style={{ padding: "40px" }}>

        <h2>식물 정보를 불러오지 못했습니다.</h2>

        <p>{error}</p>

        <Link href="/plants">
          내 식물 목록으로 돌아가기
        </Link>

      </main>
    );
  }


  // ====================================
  // 5. 기존 데이터 준비
  // ====================================

  // PlantForm에 기존 정보를 전달
  const initial = {
    ...plant,
    species_id: plant.species_id ?? plant.species?.id ?? null
  };

  // 현재 사진 주소
  const photoUrl = plant.photo_url ||
    (
      plant.photo_path
        ? `/uploads/${plant.photo_path}`
        : null
    );

  const currentPhotoUrl = getPhotoUrl(photoUrl);


  // ====================================
  // 6. 수정 화면
  // ====================================

  
return (
  <main className={styles.container}>
    <div className={styles.content}>

      {/* 이전 페이지 */}
      <Link
        href={`/plants/${id}`}
        className={styles.backLink}
      >
        ← 식물 상세로 돌아가기
      </Link>

      {/* 페이지 제목 */}
      <header className={styles.header}>
        <p className={styles.subtitle}>
          MY GREEN SPACE
        </p>

        <h1 className={styles.title}>
          내 식물 수정
        </h1>

        <p className={styles.description}>
          등록한 식물의 정보를 수정할 수 있어요.
        </p>
      </header>

      {/* 입력 폼 영역 */}
      <section className={styles.formCard}>

        <PlantForm
          mode="edit"
          initial={initial}
          currentPhotoUrl={currentPhotoUrl}
          onSubmit={handleSave}
          submitting={submitting}
          serverError={serverError}
        />

      </section>

    </div>
  </main>
);

}
