"use client";

// 위쪽 메뉴 : 모든 화면에서 보임. 지금 있는 화면의 메뉴는 알약 모양으로 표시함

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./Header.module.css";

// 메뉴 목록 (주소가 바뀌면 여기만 고치면 됨)
const MENUS = [
    { href: "/", label: "오늘 할 일" },
    { href: "/species", label: "도감" },
    { href: "/plants", label: "내 식물" },
];

export default function Header() {
    const pathname = usePathname();   // 지금 주소 (예: "/plants/1")

    // 지금 주소가 이 메뉴에 속하는지 확인 (홈은 정확히 "/" 일 때만)
    function isActive(href) {
        if (href === "/") {
            return pathname === "/";
        }
        return pathname.startsWith(href);
    }

    return (
        <header className={styles.header}>
            <div className={styles.inner}>
                <Link href="/" className={styles.logo}>
                    <span className={styles.logoIcon}>🌱</span>
                    PlantCare
                </Link>
                <nav className={styles.nav}>
                    {MENUS.map((menu) => (
                        <Link
                            key={menu.href}
                            href={menu.href}
                            className={isActive(menu.href) ? styles.active : styles.link}
                        >
                            {menu.label}
                        </Link>
                    ))}
                </nav>
            </div>
        </header>
    );
}