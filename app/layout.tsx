import type { Metadata } from 'next';
import './globals.css';
import { CartProvider } from '@/components/cart-provider';
import { AuthProvider } from '@/components/auth-provider';
import { LanguageProvider } from '@/components/language-provider';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { BackToTop } from '@/components/back-to-top';

export const metadata: Metadata={title:'KURA｜季節と愉しむ酒のセレクトショップ',description:'つくり手の美意識を、食卓へ。',icons:{icon:'/icon.svg'}};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="ja"><body><LanguageProvider><AuthProvider><CartProvider><Header/><main>{children}</main><Footer/><BackToTop/></CartProvider></AuthProvider></LanguageProvider></body></html>}
