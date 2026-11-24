
"use client";

// 내 식물 카드 한 장 (B 담당)
// props : plant = {id, nickname, species_name, location, photo_url}

import { useState } from "react";
import Link from "next/link";
import { getPhotoUrl } from "../../service/plantsApi";

export default function PlantCard({ plant }) {

  // 사진 로딩 실패 상태
  const [imgFailed, setImgFailed] = useState(false);

  // 서버에서 받은 사진 주소 변환
  const src = getPhotoUrl(plant.photo_url);

  return (
    <Link
      href={`/plants/${plant.id}`}
      style={{
        display: "block",
        border: "1px solid #ccc",
        borderRadius: "12px",
        overflow: "hidden",
        textDecoration: "none",
        color: "inherit",
      }}
    >
      {/* 식물 사진 */}
      {src && !imgFailed ? (
        <img
          src={src}
          alt={plant.nickname}
          onError={() => setImgFailed(true)}
          style={{
            width: "100%",
            height: "140px",
            objectFit: "cover",
            display: "block"
          }}
        />
      ) : (
        <div
          style={{
            height: "140px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "48px",
            background: "#eef4ec"
          }}
        >
          🪴
        </div>
      )}

      {/* 식물 정보 */}
      <div style={{ padding: "10px 12px" }}>

        <div style={{ fontWeight: "bold" }}>
          {plant.nickname}
        </div>

        <div style={{ fontSize: "14px", opacity: 0.8 }}>
          {plant.species_name}
        </div>

        <div style={{ fontSize: "13px", opacity: 0.6 }}>
          {plant.location || "위치 미입력"}
        </div>

      </div>
    </Link>
  );
}