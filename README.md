# PlantCare

우리 집 식물 케어 AI 도우미

## 구조
- frontend/nextjs : Next.js App Router
- backend : FastAPI (main.py 한 파일에 모든 API 경로), service/ 에 처리 로직
- backend/data, scripts/import_species_json.py : DB 구축 전 임시 데이터 (DB 완성 후 제거)
