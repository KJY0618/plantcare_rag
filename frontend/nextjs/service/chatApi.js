// 챗봇 API 호출

const API = process.env.NEXT_PUBLIC_API_SERVER;

// 챗봇 창을 여는 신호의 이름(보내는 쪽과 듣는 쪽이 같은 이름을 써야 함)
export const OPEN_CHAT_EVENT = "plantcar:open-chat"

export async function askChat(question) {
    let res;
    try {
        res = await fetch(API + "/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ question: question }),
        })
    } catch (error) {
        // 서버에 아예 연결하지 못한 경우
        throw new Error("서버에 연결할 수 없어요. 백엔드가 켜져 있는지 확인해주세요.")
    }

    // 서버가 오류를 돌려준 경우 (422, 503)
    if (!res.ok) {
        let message = "답변을 받지 못했어요. 잠시 뒤에 다시 시도해주세요";
        try {
            const body = await res.json();
            if(typeof body.detail === "string") {
                message = body.detail       // 서버가 보낸 안내 글자가 있으면 그걸 사용
            }
        } catch(error) {
            // 오류 내용을 읽지 못하면 위의 기본 글자를 사용 (message)
        }
        throw new Error(message);
    }
    return await res.json();
}

// 어느 화면에서든 챗봇 창을 열고, 입력칸에 질문을 채워 줌 (전송은 하지 않음)
export function openChat(question) {
    window.dispatchEvent(
        new CustomEvent(OPEN_CHAT_EVENT, {detail: {question: question || ""}})
    )
}