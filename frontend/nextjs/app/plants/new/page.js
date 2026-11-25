
"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createPlant, getSpeciesBrief } from "../../../service/plantsApi";
import styles from "./new.module.css";

const MAX_MB = 5;
const TYPES = ["image/jpeg", "image/png", "image/webp"];
const QUICK_DAYS = [3, 5, 7, 14];   // 물주기 주기 빠른 선택 버튼

function todayStr() {
  const today = new Date();
  const offset = today.getTimezoneOffset() * 60000;
  return new Date(today.getTime() - offset).toISOString().slice(0, 10);
}

function NewPlantForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const speciesId = searchParams.get("species_id");

  const [species, setSpecies] = useState(null);
  const [speciesState, setSpeciesState] = useState("loading");
  const [speciesError, setSpeciesError] = useState("");

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [waterInterval, setWaterInterval] = useState("");
  const [photoPreview, setPhotoPreview] = useState(null);

  const submitting = useRef(false);

  // 도감에서 선택한 식물 정보 불러오기
  useEffect(() => {
    if (!speciesId) {
      setSpeciesState("ready");
      return;
    }

    let cancelled = false;

    async function loadSpecies() {
      try {
        setSpeciesState("loading");

        const data = await getSpeciesBrief(speciesId);

        if (!cancelled) {
          setSpecies(data);
          setSpeciesState("ready");
        }
      } catch (err) {
        if (!cancelled) {
          setSpeciesError("식물 정보를 불러오지 못했습니다.");
          setSpeciesState("error");
        }
      }
    }

    loadSpecies();

    return () => {
      cancelled = true;
    };
  }, [speciesId]);

  // 사진 미리보기
  function onPhotoChange(e) {
    const file = e.target.files?.[0];

    setPhotoPreview(null);
    setError("");

    if (!file) return;

    if (!TYPES.includes(file.type)) {
      setError("JPG, PNG, WEBP 형식의 사진만 등록할 수 있습니다.");
      e.target.value = "";
      return;
    }

    if (file.size > MAX_MB * 1024 * 1024) {
      setError("사진은 최대 5MB까지 등록할 수 있습니다.");
      e.target.value = "";
      return;
    }

    setPhotoPreview(URL.createObjectURL(file));
  }

  // 사진 미리보기 URL 정리
  useEffect(() => {
    return () => {
      if (photoPreview) {
        URL.revokeObjectURL(photoPreview);
      }
    };
  }, [photoPreview]);

  // 식물 등록
  async function onSubmit(e) {
    e.preventDefault();

    if (submitting.current) return;

    setError("");

    const form = new FormData(e.currentTarget);
    const photo = form.get("photo");

    if (photo && photo.size > 0) {
      if (!TYPES.includes(photo.type)) {
        setError("JPG, PNG, WEBP 형식의 사진만 등록할 수 있습니다.");
        return;
      }

      if (photo.size > MAX_MB * 1024 * 1024) {
        setError("사진은 최대 5MB까지 등록할 수 있습니다.");
        return;
      }
    } else {
      form.delete("photo");
    }

    if (speciesId) {
      form.set("species_id", speciesId);
    }

    if (
      !speciesId &&
      !String(form.get("custom_species_name") || "").trim()
    ) {
      setError("식물 이름을 입력해 주세요.");
      return;
    }

    const interval = Number(form.get("water_interval_days"));

    if (!interval || interval < 1) {
      setError("올바른 물주기 주기를 입력해 주세요.");
      return;
    }

    for (const key of [
      "purchase_date",
      "location",
      "custom_species_name",
    ]) {
      if (!String(form.get(key) || "").trim()) {
        form.delete(key);
      }
    }

    submitting.current = true;
    setSaving(true);

    try {
      const { id } = await createPlant(form);
      router.push(`/plants/${id}`);
    } catch (err) {
      setError(err.message || "식물 등록에 실패했습니다.");
      submitting.current = false;
      setSaving(false);
    }
  }

  const speciesName =
    species?.name ||
    species?.common_name ||
    species?.korean_name ||
    "";

  return (
    <main className={styles.page}>
      {/* 페이지 제목 */}
      <section className={styles.intro}>
        <div className={styles.introTop}>
          <Link href="/plants" className={styles.backLink}>
            ← 내 식물 목록으로
          </Link>

          <span className={styles.requiredNotice}>
            <span>*</span> 표시는 필수 입력 항목입니다.
          </span>
        </div>

        <p className={styles.eyebrow}>ADD PLANT</p>
        <h1>내 식물 추가</h1>
        <p className={styles.description}>
          도감에 있는 식물을 연결하거나 직접 이름을 적어 새 식물을 등록해 보세요.
        </p>
      </section>

      {/* 등록 폼 */}
      <section className={styles.content}>
        <form className={styles.form} onSubmit={onSubmit}>
          <div className={styles.leftColumn}>
            {/* 기본 정보 */}
            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <h2>
                  <span>🌱</span> 기본 정보
                </h2>

                {speciesId && (
                  <Link href="/species" className={styles.changeLink}>
                    다른 식물 고르기
                  </Link>
                )}
              </div>

              <div className={styles.infoGrid}>
                {/* 식물 종류 */}
                <label className={styles.field}>
                  <span>종류 (도감 식물)</span>

                  {speciesId ? (
                    <div className={styles.speciesBox}>
                      {speciesState === "loading"
                        ? "식물 정보를 불러오는 중..."
                        : speciesState === "error"
                        ? speciesError
                        : speciesName || "선택한 식물"}
                    </div>
                  ) : (
                    <input
                      type="text"
                      name="custom_species_name"
                      placeholder="예: 몬스테라"
                      required
                    />
                  )}
                </label>

                {/* 별명 */}
                <label className={styles.field}>
                  <span>별명 <b>*</b></span>
                  <input
                    type="text"
                    name="nickname"
                    placeholder="예: 거실 초록이"
                    required
                  />
                </label>

                {/* 위치 */}
                <label className={styles.field}>
                  <span>위치</span>
                  <input
                    type="text"
                    name="location"
                    placeholder="예: 거실 창가"
                  />
                </label>

                {/* 구매일 */}
                <label className={styles.field}>
                  <span>구매일</span>
                  <input
                    type="date"
                    name="purchase_date"
                  />
                </label>
              </div>
            </section>

            {/* 물주기 일정 */}
            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <h2>
                  <span>💧</span> 물주기 일정
                </h2>
              </div>

              <div className={styles.infoGrid}>
                <label className={styles.field}>
                  <span>물주기 주기(일) <b>*</b></span>

                  <input
                    type="number"
                    name="water_interval_days"
                    min="1"
                    placeholder="예: 5"
                    value={waterInterval}
                    onChange={(e) => setWaterInterval(e.target.value)}
                    required
                  />

                  <div className={styles.quickButtons}>
                    {[3, 5, 7, 14].map((day) => (
                      <button
                        key={day}
                        type="button"
                        className={
                          Number(waterInterval) === day
                            ? styles.quickActive
                            : styles.quickButton
                        }
                        onClick={() => setWaterInterval(String(day))}
                      >
                        {day}일
                      </button>
                    ))}
                  </div>
                </label>

                <label className={styles.field}>
                  <span>마지막으로 물 준 날짜 <b>*</b></span>

                  <input
                    type="date"
                    name="last_watered_at"
                    defaultValue={todayStr()}
                    required
                  />

                  <p className={styles.fieldHint}>
                    입력한 주기에 맞춰 다음 물주기 날짜를 계산해요.
                  </p>
                </label>
              </div>

              <div className={styles.tip}>
                도감 참고 (가을): 흙을 촉촉하게 유지함(물에 잠기지 않도록 주의)
              </div>
            </section>

            {/* 오류 메시지 */}
            {error && (
              <p className={styles.error}>{error}</p>
            )}

            {/* 버튼 */}
            <div className={styles.actions}>
              <Link href="/plants" className={styles.cancelButton}>
                취소
              </Link>

              <button
                type="submit"
                className={styles.saveButton}
                disabled={saving || speciesState === "loading"}
              >
                {saving ? "저장 중..." : "✓ 내 식물 저장"}
              </button>
            </div>
          </div>

          {/* 대표 사진 */}
          <div className={styles.rightColumn}>
            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <h2>
                  <span>📷</span> 대표 사진
                </h2>
              </div>

              <label className={styles.uploadBox}>
                <input
                  type="file"
                  name="photo"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={onPhotoChange}
                />

                {photoPreview ? (
                  <img
                    src={photoPreview}
                    alt="선택한 식물 사진"
                    className={styles.previewImage}
                  />
                ) : (
                  <div className={styles.uploadContent}>
                    <span className={styles.cameraIcon}>📷</span>
                    <strong>사진 파일 선택하기</strong>
                    <small>JPG, PNG, WEBP · 최대 5MB</small>
                  </div>
                )}
              </label>

              <p className={styles.photoHint}>
                사진을 등록하지 않으면 도감 기본 이미지 또는 기본 식물 이미지가 표시돼요.
              </p>
            </section>
          </div>
        </form>
      </section>
    </main>
  );
}

export default function PlantNewPage() {
  return (
    <Suspense fallback={<div>불러오는 중...</div>}>
      <NewPlantForm />
    </Suspense>
  );
}
