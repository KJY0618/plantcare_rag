// 모든 화면에 공통으로 씌우는 틀 : 위쪽 메뉴(Header) + 각 화면(children)
// 각 화면 파일이 이미 <main> 을 쓰고 있어서 여기서는 <main> 을 또 쓰지 않음

import "./globals.css";
import Header from "@/components/Header";
import ChatWidget from "@/components/chat/ChatWidget";   // 오른쪽 아래 챗봇 창

// 브라우저 탭에 보이는 제목과 설명
export const metadata = {
    title: "PlantCare",
    description: "우리 집 식물 케어 AI 도우미",
};

export default function RootLayout({ children }) {
    return (
        <html lang="ko">
            <body>
                <Header />
                {children}
                <ChatWidget />
            </body>
        </html>
    );
}