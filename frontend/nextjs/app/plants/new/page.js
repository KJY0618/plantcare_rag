"use client";
import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createPlant, getSpeciesBrief } from "@/service/plantsApi";
import styles from "./new.module.css";

const MAX_MB = 5;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

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
  const submitting = useRef(false); // 버튼이 비활성화되기 전의 연타까지 막음

  useEffect(() => {
    if (!speciesId) return;
    getSpeciesBrief(speciesId)
      .then((s) => { setSpecies(s); setSpeciesState("ready"); })
      .catch((e) => { setSpeciesError(e.message); setSpeciesState("error"); });
  }, [speciesId]);

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
    <main>
      <form className={styles.form} onSubmit={onSubmit} aria-busy={saving}>
        <h1>내 식물 추가</h1>

        {speciesState === "none" && (
          <label>
            종류 (도감에 없는 식물)
            <input name="custom_species_name" placeholder="예: 이름 모를 풀" />
          </label>
        )}
        {speciesState === "loading" && <p>도감 정보를 불러오는 중...</p>}
        {speciesState === "ready" && <p>도감 식물: <strong>{species.name}</strong></p>}
        {speciesState === "error" && (
          <p role="alert" className={styles.error}>
            {speciesError} <Link href="/species">도감에서 다시 고르기</Link>
          </p>
        )}

        <label>
          별명 *
          <input name="nickname" required maxLength={50} />
        </label>

        <label>
          물주기 주기(일) *
          <input name="water_interval_days" type="number" inputMode="numeric" min={1} required />
        </label>
        {speciesState === "ready" && (
          <p className={styles.hint}>
            도감 참고 ({seasonName}): {species[seasonKey] || "도감에 정보가 없습니다"}
          </p>
        )}

        <label>
          마지막으로 물 준 날짜 *
          <input name="last_watered_at" type="date" max={todayStr()} defaultValue={todayStr()} required />
        </label>

        <label>
          구매일
          <input
            name="purchase_date"
            type="date"
            max={todayStr()}
          />
        </label>

        <label>
          위치
          <input name="location" placeholder="예: 거실 창가" />
        </label>

        <label>
          대표 사진 (jpg, png, webp / 최대 {MAX_MB}MB)
          <input name="photo" type="file" accept="image/jpeg,image/png,image/webp" />
        </label>

        {error && <p role="alert" className={styles.error}>{error}</p>}
        <button type="submit" disabled={blocked}>{saving ? "저장 중..." : "저장"}</button>
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