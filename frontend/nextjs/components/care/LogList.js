// 케어 기록 목록 (상세 화면의 "최근 기록", 일기 화면의 "전체 기록"에서 같이 사용)
//   logs : 백엔드가 보내 준 기록 목록 [{ id, log_type, logged_at, memo, photo_url }]

import { makePhotoUrl } from "@/service/careApi";
import styles from "./LogList.module.css";

// 기록 종류 → 화면에 보여 줄 글자
const TYPE_LABEL = {
    water: "물주기",
    fertilizer: "비료",
    repot: "분갈이",
    issue: "이상 기록",
};

export default function LogList({ logs }) {
    // 기록이 하나도 없을 때
    if (!logs || logs.length === 0) {
        return <p className={styles.empty}>아직 기록이 없습니다.</p>;
    }

    return (
        <ul className={styles.list}>
            {logs.map((log) => (
                <li key={log.id} className={styles.item}>
                    <div className={styles.top}>
                        <span className={styles.type}>{TYPE_LABEL[log.log_type]}</span>
                        <span className={styles.date}>{log.logged_at}</span>
                    </div>

                    {log.memo && <p className={styles.memo}>{log.memo}</p>}

                    {log.photo_url && (
                        // 서버 사진 주소를 그대로 쓰기 때문에 일반 img 태그 사용
                        <img
                            className={styles.photo}
                            src={makePhotoUrl(log.photo_url)}
                            alt={TYPE_LABEL[log.log_type] + " 사진"}
                        />
                    )}
                </li>
            ))}
        </ul>
    );
}