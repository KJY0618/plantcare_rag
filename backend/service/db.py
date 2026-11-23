"""MariaDB 연결 (A)"""

import os
from pathlib import Path

import pymysql
from dotenv import load_dotenv


# .env 파일 경로
BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")


# DB 접속 정보
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "3306"))
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_NAME = os.getenv("DB_NAME")


def get_connection():
    """생성된 DB에 연결"""

    return pymysql.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME,
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor
    )


def initialize_database():
    """DB와 테이블 생성"""

    # DB 이름이 없는 경우
    if not DB_NAME:
        raise ValueError("DB_NAME이 .env에 설정되어 있지 않습니다.")

    # 1. MariaDB 서버에 연결 (특정 DB 선택하지 않음)
    connection = pymysql.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD,
        charset="utf8mb4"
    )

    try:
        with connection.cursor() as cursor:

            # 2. DB 생성
            cursor.execute(
                f"CREATE DATABASE IF NOT EXISTS `{DB_NAME}` "
                "DEFAULT CHARACTER SET utf8mb4 "
                "COLLATE utf8mb4_unicode_ci"
            )

            # 3. 생성한 DB 선택
            cursor.execute(f"USE `{DB_NAME}`")

            # 4. SQL 파일 읽기
            sql_path = BASE_DIR / "scripts" / "init_db.sql"
            sql_text = sql_path.read_text(encoding="utf-8")

            # 5. SQL 문장별 실행
            statements = [
                statement.strip()
                for statement in sql_text.split(";")
                if statement.strip()
            ]

            for statement in statements:
                cursor.execute(statement)

        connection.commit()
        print(f"'{DB_NAME}' 데이터베이스 및 테이블 생성 완료")

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


if __name__ == "__main__":
    initialize_database()
