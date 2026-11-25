"use client";
import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createPlant, getSpeciesBrief } from "@/service/plantsApi";
import styles from "./new.module.css";

const MAX_MB = 5;
const TYPES = ["image/jpeg", "image/png", "image/webp"];
const QUICK_DAYS = [3, 5, 7, 14];   // 물주기 주기 빠른 선택 버튼

function todayStr() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

// 3~5 봄, 6~8 여름, 9~11 가을, 12~2 겨울
function currentSeason() {
  const m = new Date().getMonth() + 1;
  if (m >= 3 && m <= 5) return ["봄", "water_spring"];
  if (m >= 6 && m <= 8) return ["여름", "water_summer"];
  if (m >= 9 && m <= 11) return ["가을", "water_autumn"];
  return ["겨울", "water_winter"];
}

function NewPlantForm() {
  const router = useRouter();
  const speciesId = useSearchParams().get("species_id"); // 도감 상세에서 넘어오면 있음
  const [species, setSpecies] = useState(null);
  const [speciesState, setSpeciesState] = useState(speciesId ? "loading" : "none"); // none | loading | ready | error
  const [speciesError, setSpeciesError] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [intervalDays, setIntervalDays] = useState("");   // 물주기 주기 (빠른 선택 버튼과 같이 쓰려고 상태로 둠)
  const [photoUrl, setPhotoUrl] = useState("");           // 고른 사진의 미리보기 주소
  const submitting = useRef(false); // 버튼이 비활성화되기 전의 연타까지 막음
  const photoInputRef = useRef(null);

  useEffect(() => {
    if (!speciesId) return;
    getSpeciesBrief(speciesId)
      .then((s) => { setSpecies(s); setSpeciesState("ready"); })
      .catch((e) => { setSpeciesError(e.message); setSpeciesState("error"); });
  }, [speciesId]);

  // 미리보기 주소가 바뀌거나 화면이 사라지면 이전 주소를 정리함
  useEffect(() => {
    return () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    };
  }, [photoUrl]);

  // 사진을 골랐을 때 : 검사하고 미리보기를 보여 줌
  function onPhotoChange(e) {
    const file = e.target.files[0];
    setError("");
    if (!file) {                      // 선택창에서 취소하면 파일이 비워짐
      setPhotoUrl("");
      return;
    }
    if (!TYPES.includes(file.type)) {
      e.target.value = "";
      setPhotoUrl("");
      return setError("jpg, png, webp 사진만 올릴 수 있습니다.");
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      e.target.value = "";
      setPhotoUrl("");
      return setError(`사진은 ${MAX_MB}MB 이하만 올릴 수 있습니다.`);
    }
    setPhotoUrl(URL.createObjectURL(file));
  }

  // 고른 사진 지우기
  function removePhoto() {
    photoInputRef.current.value = "";
    setPhotoUrl("");
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (submitting.current) return;
    setError("");
    const form = new FormData(e.currentTarget);

    const photo = form.get("photo");
    if (photo && photo.size > 0) {
      if (!TYPES.includes(photo.type)) return setError("jpg, png, webp 사진만 올릴 수 있습니다.");
      if (photo.size > MAX_MB * 1024 * 1024) return setError(`사진은 ${MAX_MB}MB 이하만 올릴 수 있습니다.`);
    } else {
      form.delete("photo"); // 선택하지 않았으면 보내지 않음
    }
    if (speciesId) form.set("species_id", speciesId);
    if (!speciesId && !String(form.get("custom_species_name") || "").trim()) {
      return setError("도감에서 식물을 고르거나 종류를 직접 입력해 주세요.");
    }
    // 비어 있는 선택 항목은 보내지 않음
    for (const k of ["purchase_date", "location", "custom_species_name"]) {
      if (!String(form.get(k) || "").trim()) form.delete(k);
    }

    submitting.current = true;
    setSaving(true);
    try {
      const { id } = await createPlant(form);
      router.push(`/plants/${id}`);
    } catch (err) {
      setError(err.message);
      submitting.current = false;
      setSaving(false);
    }
  }

  const [seasonName, seasonKey] = currentSeason();
  const blocked = saving || speciesState === "loading" || speciesState === "error";

  return (
    <main className={styles.wrap}>
      {/* 위쪽 제목 영역 */}
      <div className={styles.top}>
        <div className={styles.topInner}>
          <div className={styles.topBar}>
            <Link href="/plants" className={styles.back}>← 내 식물 목록으로</Link>
            <span className={styles.legend}>
              <span className={styles.star}>*</span> 표시는 필수 입력 항목입니다
            </span>
          </div>
          <p className={styles.eyebrow}>ADD PLANT</p>
          <h1 className={styles.title}>내 식물 추가</h1>
          <p className={styles.subtitle}>
            도감에 있는 식물을 연결하거나 직접 이름을 적어 새 식물을 등록해 보세요.
          </p>
        </div>
      </div>

      <form className={styles.form} onSubmit={onSubmit} aria-busy={saving}>
        {/* 왼쪽 : 입력 카드 2개 + 버튼 */}
        <div className={styles.column}>
          <section className={styles.card}>
            <div className={styles.cardHead}>
              <h2 className={styles.cardTitle}>🌱 기본 정보</h2>
              <Link href="/species" className={styles.findButton}>
                {speciesState === "ready" ? "다른 식물 고르기" : "도감에서 찾기"}
              </Link>
            </div>

            <div className={styles.grid}>
              {speciesState === "none" && (
                <label className={styles.field}>
                  <span className={styles.label}>종류 (도감에 없는 식물)</span>
                  <input name="custom_species_name" placeholder="예: 이름 모를 풀" className={styles.input} />
                </label>
              )}
              {speciesState === "loading" && (
                <div className={styles.field}>
                  <span className={styles.label}>종류</span>
                  <p className={styles.speciesBox}>도감 정보를 불러오는 중...</p>
                </div>
              )}
              {speciesState === "ready" && (
                <div className={styles.field}>
                  <span className={styles.label}>종류 (도감 식물)</span>
                  <p className={styles.speciesBox}>{species.name}</p>
                </div>
              )}
              {speciesState === "error" && (
                <div className={styles.field}>
                  <span className={styles.label}>종류</span>
                  <p role="alert" className={styles.error}>
                    {speciesError} <Link href="/species" className={styles.errorLink}>도감에서 다시 고르기</Link>
                  </p>
                </div>
              )}

              <label className={styles.field}>
                <span className={styles.label}>별명 <span className={styles.star}>*</span></span>
                <input name="nickname" required maxLength={50} placeholder="예: 거실 초록이" className={styles.input} />
              </label>

              <label className={styles.field}>
                <span className={styles.label}>위치</span>
                <input name="location" placeholder="예: 거실 창가" className={styles.input} />
              </label>

              <label className={styles.field}>
                <span className={styles.label}>구매일</span>
                <input name="purchase_date" type="date" max={todayStr()} className={styles.input} />
              </label>
            </div>
          </section>

          <section className={styles.card}>
            <div className={styles.cardHead}>
              <h2 className={styles.cardTitle}>💧 물주기 일정</h2>
            </div>

            <div className={styles.grid}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="interval">
                  물주기 주기(일) <span className={styles.star}>*</span>
                </label>
                <input
                  id="interval"
                  name="water_interval_days"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  required
                  placeholder="예: 5"
                  value={intervalDays}
                  onChange={(e) => setIntervalDays(e.target.value)}
                  className={styles.input}
                />
                <div className={styles.chips}>
                  {QUICK_DAYS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      className={String(d) === intervalDays ? `${styles.chip} ${styles.chipOn}` : styles.chip}
                      aria-pressed={String(d) === intervalDays}
                      onClick={() => setIntervalDays(String(d))}
                    >
                      {d}일
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="last">
                  마지막으로 물 준 날짜 <span className={styles.star}>*</span>
                </label>
                <input
                  id="last"
                  name="last_watered_at"
                  type="date"
                  max={todayStr()}
                  defaultValue={todayStr()}
                  required
                  className={styles.input}
                />
                <p className={styles.hint}>입력한 주기에 맞춰 다음 물주기 날짜를 계산해요.</p>
              </div>
            </div>

            {speciesState === "ready" && (
              <p className={styles.speciesHint}>
                도감 참고 ({seasonName}): {species[seasonKey] || "도감에 정보가 없습니다"}
              </p>
            )}
          </section>

          {error && <p role="alert" className={styles.error}>{error}</p>}

          <div className={styles.actions}>
            <Link href="/plants" className={styles.cancel}>취소</Link>
            <button type="submit" className={styles.submit} disabled={blocked}>
              {saving ? "저장 중..." : "✓ 내 식물 저장"}
            </button>
          </div>
        </div>

        {/* 오른쪽 : 대표 사진 */}
        <aside className={styles.card}>
          <div className={styles.cardHead}>
            <h2 className={styles.cardTitle}>📷 대표 사진</h2>
          </div>

          {/* 진짜 파일 입력칸은 숨겨 두고, 아래 박스를 눌러 대신 엶 */}
          <input
            ref={photoInputRef}
            name="photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={onPhotoChange}
            className={styles.hiddenInput}
          />

          {photoUrl ? (
            <div>
              <img src={photoUrl} alt="고른 대표 사진 미리보기" className={styles.preview} />
              <div className={styles.photoButtons}>
                <button type="button" className={styles.smallButton} onClick={() => photoInputRef.current.click()}>
                  사진 변경
                </button>
                <button type="button" className={styles.smallButton} onClick={removePhoto}>
                  삭제
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className={styles.photoBox} onClick={() => photoInputRef.current.click()}>
              <span className={styles.photoIcon}>📷</span>
              <strong>사진 파일 선택하기</strong>
              <span className={styles.photoRule}>JPG, PNG, WEBP · 최대 {MAX_MB}MB</span>
            </button>
          )}

          <p className={styles.hint}>
            사진을 등록하지 않으면 도감 기본 이미지 또는 기본 식물 이미지가 표시돼요.
          </p>
        </aside>
      </form>
    </main>
  );
}

// useSearchParams 는 Suspense 로 감싸야 빌드에서 오류가 나지 않음
export default function PlantNewPage() {
  return (
    <Suspense fallback={<p>불러오는 중...</p>}>
      <NewPlantForm />
    </Suspense>
  );
}