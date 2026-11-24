
"use client";

// 식물 도감 카드 한 장
// props : species = {id, name, scientific_name, english_name, thumb_url, origin}

import { useState } from "react";
import Link from "next/link";

export default function SpeciesCard({ species }) {

  // 사진 로딩 실패 상태
  const [imgFailed, setImgFailed] = useState(false);

  // 농사로에서 받은 사진 주소
  const src = species.image_url || species.thumb_url;

  return (
    <Link
      href={`/species/${species.id}`}
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
          alt={species.name}
          onError={() => setImgFailed(true)}
          onLoad={(e) => {
            console.log(
              "이미지 원본 크기:",
              e.target.naturalWidth,
              "x",
              e.target.naturalHeight
            );
          }}
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
          {species.name}
        </div>

        <div style={{ fontSize: "14px", opacity: 0.8 }}>
          {species.scientific_name}
        </div>

        <div style={{ fontSize: "13px", opacity: 0.6 }}>
          {species.english_name || "영문명 정보 없음"}
        </div>

      </div>
    </Link>
  );
}
