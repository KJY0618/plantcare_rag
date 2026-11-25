"use client";

// 식물 도우미 챗봇 창 : 화면 오른쪽 아래에 떠 있음
//   - 동그란 버튼을 누르면 창이 열리고 닫힘
//   - 질문을 보내면 서버(POST /chat)가 돌려준 답변과 근거를 말풍선으로 보여 줌
//   - 홈·상세의 "AI에게 물어보기" 버튼이 openChat() 신호를 보내면 창이 열리고 입력칸에 질문이 채워짐

import { useEffect, useRef, useState } from "react";
import { askChat, OPEN_CHAT_EVENT } from "@/service/chatApi";
import styles from "./ChatWidget.module.css";

// 입력칸 위의 빠른 질문 버튼 (누르면 입력칸에 채워지기만 하고 보내지는 않음)
const QUICK_QUESTIONS = [
    "내 식물 중 잎이 노래진 식물 있어?",
    "겨울에 물은 어떻게 줘?",
    "이번 주에 물 줄 식물 알려줘",
];

// 근거 종류 → 화면에 보여 줄 글자
const SOURCE_LABEL = {
    my_record: "내 기록",
    species: "도감",
};

// 처음 창을 열었을 때 보이는 인사 말풍선
const GREETING = {
    id: 0,
    role: "bot",
    text: "안녕하세요! 도감 정보와 내 식물 기록을 바탕으로 답해 드려요. 궁금한 점을 물어보세요.",
    time: "",
    sources: [],
    error: false,
};

// 지금 시각을 "오전 11:30" 같은 글자로 만듦
function nowText() {
    return new Date().toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" });
}

export default function ChatWidget() {
    const [open, setOpen] = useState(false);            // 창이 열려 있는지
    const [messages, setMessages] = useState([GREETING]);   // 말풍선 목록
    const [input, setInput] = useState("");             // 입력칸 글자
    const [loading, setLoading] = useState(false);      // 답변을 기다리는 중인지

    const nextId = useRef(1);       // 말풍선마다 붙일 번호 (화면 목록의 key 로 사용)
    const listRef = useRef(null);   // 말풍선 목록 칸 (자동으로 맨 아래로 내리려고 사용)
    const inputRef = useRef(null);  // 입력칸 (열릴 때 커서를 두려고 사용)
    const [wide, setWide] = useState(false);              // 창을 크게 보는 중인지

    // 1. 다른 화면의 버튼이 보낸 "챗봇 열어 줘" 신호를 듣고 있다가 창을 열고 질문을 채움
    useEffect(() => {
        function handleOpen(event) {
            setOpen(true);
            const question = event.detail && event.detail.question;
            if (question) {
                setInput(question);
            }
        }
        window.addEventListener(OPEN_CHAT_EVENT, handleOpen);

        // 이 화면이 사라질 때 듣기를 멈춤 (안 하면 신호를 여러 번 받게 됨)
        return () => {
            window.removeEventListener(OPEN_CHAT_EVENT, handleOpen);
        };
    }, []);

    // 2. 말풍선이 늘어나거나 창이 열리면 맨 아래로 내림
    useEffect(() => {
        if (open && listRef.current) {
            listRef.current.scrollTop = listRef.current.scrollHeight;
        }
    }, [messages, loading, open]);

    // 3. 창이 열리면 입력칸에 커서를 둠
    useEffect(() => {
        if (open && inputRef.current) {
            inputRef.current.focus();
        }
    }, [open]);

    // 말풍선 한 개 추가
    function addMessage(role, text, sources, error) {
        const message = {
            id: nextId.current,
            role: role,
            text: text,
            time: nowText(),
            sources: sources || [],
            error: error || false,
        };
        nextId.current = nextId.current + 1;
        setMessages((old) => [...old, message]);   // 기존 목록 뒤에 새 말풍선을 붙임
    }

    // 질문 보내기
    async function handleSend(event) {
        event.preventDefault();             // 폼이 페이지를 새로고침하지 않게 막음
        const question = input.trim();
        if (question === "" || loading) {
            return;                         // 빈 질문이거나 답변을 기다리는 중이면 무시 (중복 전송 방지)
        }

        addMessage("user", question);
        setInput("");
        setLoading(true);
        try {
            const data = await askChat(question);
            addMessage("bot", data.answer, data.sources, false);
        } catch (e) {
            addMessage("bot", e.message, [], true);     // 실패는 오류 말풍선으로 보여 줌
        }
        setLoading(false);
    }

    // 대화 초기화
    function handleReset() {
        // 대화가 있을 때만 한 번 더 물어봄 (첫 인사뿐이면 지울 게 없음)
        if (messages.length > 1 && !window.confirm("대화를 모두 지울까요?")) {
            return;                     // "취소"를 누르면 아무것도 안 함
        }
        setMessages([GREETING]);
        setInput("");
    }

    return (
        <div className={styles.wrap}>
            {/* 열린 창 */}
            {open && (
                <section
                    className={wide ? styles.panel + " " + styles.panelWide : styles.panel}
                    aria-label="식물 도우미 챗봇"
                >
                    {/* 위쪽 띠 */}
                    <header className={styles.header}>
                        <img className={styles.headerImg} src="/chatbot.png" alt="" />
                        <div className={styles.headerText}>
                            <strong className={styles.title}>PlantCare AI 도우미</strong>
                            <span className={styles.subtitle}>도감 · 내 식물 기록 기반 상담</span>
                        </div>
                        <button
                            type="button"
                            className={styles.iconButton}
                            onClick={handleReset}
                            aria-label="대화 초기화"
                            title="대화 초기화"
                        >
                            ↻
                        </button>
                        <button
                            type="button"
                            className={styles.iconButton}
                            onClick={() => setWide(!wide)}
                            aria-label={wide ? "작게 보기" : "크게 보기"}
                            title={wide ? "작게 보기" : "크게 보기"}
                        >
                            {wide ? (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="4 14 10 14 10 20" />
                                    <polyline points="20 10 14 10 14 4" />
                                    <line x1="14" y1="10" x2="21" y2="3" />
                                    <line x1="3" y1="21" x2="10" y2="14" />
                                </svg>
                            ) : (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="15 3 21 3 21 9" />
                                    <polyline points="9 21 3 21 3 15" />
                                    <line x1="21" y1="3" x2="14" y2="10" />
                                    <line x1="3" y1="21" x2="10" y2="14" />
                                </svg>
                            )}
                        </button>
                        <button
                            type="button"
                            className={styles.iconButton}
                            onClick={() => setOpen(false)}
                            aria-label="챗봇 닫기"
                            title="닫기"
                        >
                            ✕
                        </button>
                    </header>

                    {/* 말풍선 목록 */}
                    <div className={styles.list} ref={listRef}>
                        {messages.map((m) => (
                            <div
                                key={m.id}
                                className={m.role === "user" ? styles.rowUser : styles.rowBot}
                            >
                                <div
                                    className={
                                        m.role === "user"
                                            ? styles.bubbleUser
                                            : m.error
                                                ? styles.bubbleError
                                                : styles.bubbleBot
                                    }
                                >
                                    <p className={styles.text}>{m.text}</p>

                                    {/* 답변의 근거 : 내 기록 / 도감 으로 구분해서 보여 줌 */}
                                    {m.role === "bot" && !m.error && m.id !== 0 && (
                                        <div className={styles.sources}>
                                            {m.sources.length === 0 ? (
                                                <p className={styles.noSource}>참고한 자료가 없어요.</p>
                                            ) : (
                                                <>
                                                    <span className={styles.sourcesLabel}>참고한 자료</span>
                                                    <ul className={styles.sourceList}>
                                                        {m.sources.map((s, index) => (
                                                            <li key={index} className={styles.source}>
                                                                <span
                                                                    className={
                                                                        s.type === "my_record"
                                                                            ? styles.tagRecord
                                                                            : styles.tagSpecies
                                                                    }
                                                                >
                                                                    {SOURCE_LABEL[s.type] || "기타"}
                                                                </span>
                                                                <span className={styles.sourceBody}>
                                                                    <strong>{s.title}</strong>
                                                                    {s.text && <span>{s.text}</span>}
                                                                </span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                                {m.time && <span className={styles.time}>{m.time}</span>}
                            </div>
                        ))}

                        {/* 답변을 기다리는 중 */}
                        {loading && (
                            <div className={styles.rowBot}>
                                <div className={styles.bubbleBot}>
                                    <span className={styles.typing} aria-label="답변을 찾는 중">
                                        <i></i>
                                        <i></i>
                                        <i></i>
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 빠른 질문 */}
                    <div className={styles.quick}>
                        {QUICK_QUESTIONS.map((q) => (
                            <button
                                key={q}
                                type="button"
                                className={styles.quickButton}
                                onClick={() => {
                                    setInput(q);
                                    inputRef.current?.focus();
                                }}
                            >
                                {q}
                            </button>
                        ))}
                    </div>

                    {/* 입력칸 */}
                    <form className={styles.form} onSubmit={handleSend}>
                        <input
                            ref={inputRef}
                            className={styles.input}
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="식물 이름이나 고민을 입력해 보세요."
                            aria-label="질문 입력"
                        />
                        <button
                            type="submit"
                            className={styles.send}
                            disabled={loading || input.trim() === ""}
                            aria-label="보내기"
                        >
                            ➤
                        </button>
                    </form>

                    {/* 안내 문구 (계획서 : 진단이 아님, 외부 AI로 전송됨) */}
                    <p className={styles.notice}>
                        답변은 진단이나 치료 방법이 아니에요. 질문은 외부 AI로 전송돼요.
                    </p>
                </section>
            )}

            {/* 동그란 열기·닫기 버튼 */}
            <button
                type="button"
                className={styles.fab}
                onClick={() => setOpen(!open)}
                aria-label={open ? "챗봇 닫기" : "챗봇 열기"}
                aria-expanded={open}
            >
                {open ? (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2.5"
                        strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="6 9 12 15 18 9" />
                    </svg>
                ) : (
                    <img className={styles.fabImg} src="/chatbot.png" alt="" />
                )}
            </button>
        </div>
    );
}