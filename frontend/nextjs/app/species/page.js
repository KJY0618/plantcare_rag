
"use client";

// React Hook
import { useState, useEffect } from "react";

// 식물 도감 카드 컴포넌트
import SpeciesCard from "../../components/species/speciesCard";

// 백엔드 API 호출 함수
import { getAllSpecies } from "../../service/speciesApi";

// CSS
import styles from "./page.module.css";

export default function SpeciesPage() {

  // 식물 도감 목록
  const [species, setSpecies] = useState([]);

  // 로딩 상태
  const [loading, setLoading] = useState(true);

  // 오류 메시지
  const [error, setError] = useState("");

  // 현재 페이지
  const [currentPage, setCurrentPage] = useState(1);

  // 식물 이름 검색어
  const [keyword, setKeyword] = useState("");

  // 식물 광요구도 필터
  const [light, setLight] = useState("");

  // 한 페이지에 표시할 식물 수
  const itemsPerPage = 10;

  // 전체 페이지 수
  const totalPages = Math.ceil(species.length / itemsPerPage);

  // 현재 페이지에 표시할 데이터 계산
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentSpecies = species.slice(startIndex, endIndex);


  // 1. 식물 도감 전체 조회
  async function loadSpecies() {

    setLoading(true);
    setError("");

    try {

      // 백엔드 API 호출
      const data = await getAllSpecies();

      // 서버에서 받아온 도감 목록 저장
      setSpecies(data);

      // 첫 페이지로 이동
      setCurrentPage(1);

    } catch (err) {

      console.error(err);
      setError("식물 도감 정보를 불러오지 못했습니다.");

    } finally {

      setLoading(false);
    }
  }


  // 2. 식물 도감 검색
  async function handleSearch() {

    setLoading(true);
    setError("");

    try {

      // 검색 조건을 전달하여 백엔드 API 호출
      const data = await getAllSpecies(keyword, light);

      // 검색 결과 목록 저장
      setSpecies(data);

      // 첫 페이지로 이동
      setCurrentPage(1);

    } catch (err) {

      console.error(err);
      setError("식물 검색에 실패했습니다.");

    } finally {

      setLoading(false);
    }
  }


  // 3. 페이지가 처음 열릴 때 실행
  useEffect(() => {
    loadSpecies();
  }, []);


  // 4. 페이지 이동
  function changePage(page) {

    if (page < 1 || page > totalPages) {
      return;
    }

    setCurrentPage(page);

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }


  // 5. 화면 렌더링
  return (
    <main className={styles.container}>

      {/* 상단 제목 및 검색 영역 */}
      <header className={styles.header}>

        {/* 제목 영역 */}
        <div>
          <p className={styles.subtitle}>
            PLANT ENCYCLOPEDIA
          </p>

          <h1>식물 도감</h1>

          <p className={styles.description}>
            다양한 식물의 정보를 확인해 보세요.
          </p>
        </div>

        {/* 검색 및 필터 영역 */}
        <div className={styles.searchArea}>

          {/* 식물 이름 검색 */}
          <div className={styles.searchInput}>
            <input
              type="text"
              placeholder="식물 이름을 검색하세요."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSearch();
                }
              }}
            />

            <button
              type="button"
              onClick={handleSearch}
            >
              검색
            </button>
          </div>

          {/* 광요구도 선택 */}
          <div className={styles.filterArea}>
            <select
              value={light}
              onChange={(e) => setLight(e.target.value)}
            >
              <option value="">전체 광요구도</option>
              <option value="낮은 광도">낮은 광도</option>
              <option value="중간 광도">중간 광도</option>
              <option value="높은 광도">높은 광도</option>
            </select>
          </div>

        </div>

      </header>


      {/* 식물 개수 및 새로고침 */}
      <div className={styles.summary}>

        <div>
          총 <strong>{species.length}</strong>개의 식물
        </div>

      </div>


      {/* 식물 목록 */}
      {loading ? (

        <div className={styles.message}>
          식물 정보를 불러오는 중입니다.
        </div>

      ) : error ? (

        <div className={styles.message}>
          <h2>오류가 발생했습니다.</h2>
          <p>{error}</p>

          <button
            type="button"
            className={styles.retryButton}
            onClick={loadSpecies}
          >
            다시 시도
          </button>
        </div>

      ) : species.length === 0 ? (

        <div className={styles.message}>
          <div className={styles.emptyIcon}>🌱</div>
          <h2>검색 결과가 없습니다.</h2>
          <p>다른 검색어나 광요구도를 선택해 보세요.</p>
        </div>

      ) : (

        <section className={styles.grid}>

          {currentSpecies.map((item) => (
            <SpeciesCard
              key={item.id}
              species={item}
            />
          ))}

        </section>

      )}


      {/* 페이지네이션 */}
      {!loading && !error && totalPages > 0 && (

        <nav className={styles.pagination}>

          {/* 이전 페이지 */}
          <button
            type="button"
            className={styles.pageButton}
            onClick={() => changePage(currentPage - 1)}
            disabled={currentPage === 1}
          >
            &lt;
          </button>

          {/* 페이지 번호 */}
          {Array.from(
            { length: totalPages },
            (_, index) => index + 1
          ).map((page) => (

            <button
              key={page}
              type="button"
              className={`${styles.pageButton} ${
                currentPage === page
                  ? styles.activePage
                  : ""
              }`}
              onClick={() => changePage(page)}
            >
              {page}
            </button>

          ))}

          {/* 다음 페이지 */}
          <button
            type="button"
            className={styles.pageButton}
            onClick={() => changePage(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            &gt;
          </button>

        </nav>

      )}

    </main>
  );
}
