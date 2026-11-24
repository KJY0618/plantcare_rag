// 케어 기록 API 호출
const API = process.env.NEXT_PUBLIC_API_SERVER;   // .env.local 에 적어 둔 서버 주소


// ---------------------------------------------------------------
// 공통 : 요청 보내고 결과 받기
// ---------------------------------------------------------------

// 서버에 요청을 보내고 JSON 을 돌려줌. 실패하면 서버가 보낸 이유(detail)로 에러를 던짐
async function request(path, options) {
    const res = await fetch(API + path, options);

    let data = null;
    try {
        data = await res.json();
    } catch (e) {
        data = null;            // 삭제처럼 돌려주는 내용이 없으면 비어 있음
    }

    if (!res.ok) {
        let message = "요청에 실패했습니다.";
        if (data && typeof data.detail === "string") {
            message = data.detail;      // 서버가 보낸 이유를 그대로 사용
        }
        throw new Error(message);
    }
    return data;
}


// ---------------------------------------------------------------
// 화면에서 쓰는 작은 도우미
// ---------------------------------------------------------------

// 사진 주소 만들기 : 서버에 올린 사진("/uploads/...")은 서버 주소를 앞에 붙임
//   도감 사진은 이미 "http..." 로 시작하니 그대로 사용, 사진이 없으면 None
export function makePhotoUrl(photoUrl) {
    if (!photoUrl) {
        return null;
    }
    if (photoUrl.startsWith("http")) {
        return photoUrl;
    }
    return API + photoUrl;
}

// D-day 숫자를 글자로 바꿈 (0: 오늘 물 주기, 음수: 지난 날 수, 양수: 남은 날 수)
export function ddayText(dDay) {
    if (dDay === null || dDay === undefined) {
        return "물주기 기록 없음";
    }
    if (dDay === 0) {
        return "오늘 물 주기";
    }
    if (dDay < 0) {
        return -dDay + "일 지남";
    }
    return "D-" + dDay;
}


// ---------------------------------------------------------------
// 홈 : 오늘 할 일 / 물주기
// ---------------------------------------------------------------

// 오늘 할 일 목록 가져오기
export async function getToday() {
    return request("/today");
}

// 물주기 (아직 물 줄 날이 아니면 서버가 409 로 막고, 그 이유가 에러로 던져짐)
export async function waterPlant(plantId) {
    return request("/plants/" + plantId + "/water", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
    });
}


// ---------------------------------------------------------------
// 내 식물 상세 / 기록
// ---------------------------------------------------------------

// 내 식물 상세 (도감 정보 + 다음 물주기 + 마지막 비료·분갈이 날짜 + 최근 기록 5건)
export async function getPlantDetail(plantId) {
    return request("/plants/" + plantId);
}

// 케어 기록 목록 (최근 기록이 먼저). logType 을 주면 그 종류만 (water, fertilizer, repot, issue)
export async function getLogs(plantId, logType) {
    let path = "/plants/" + plantId + "/logs";
    if (logType) {
        path = path + "?log_type=" + logType;
    }
    return request(path);
}

// 비료 / 분갈이 / 이상 기록 저장 (사진이 있을 수 있어서 FormData 로 보냄)
//   formData 에는 log_type, memo, photo 등을 담아서 넘김
//   FormData 를 보낼 때는 Content-Type 을 직접 적지 않음 (브라우저가 알아서 정함)
//   같은 날짜에 비료·분갈이를 또 저장하면 서버가 409 로 막고, 그 이유가 에러로 던져짐
export async function addLog(plantId, formData) {
    return request("/plants/" + plantId + "/logs", {
        method: "POST",
        body: formData,
    });
}

// 기록 1건 삭제 (잘못 누른 기록 되돌리기)
//   식물의 마지막 물주기 기록은 서버가 409 로 막음
export async function deleteLog(plantId, logId) {
    return request("/plants/" + plantId + "/logs/" + logId, {
        method: "DELETE",
    });
}

// 식물 삭제 (식물 등록·수정을 맡은 B 파트의 DELETE /plants/{id} 를 호출)
export async function deletePlant(plantId) {
    return request("/plants/" + plantId, {
        method: "DELETE",
    });
}
