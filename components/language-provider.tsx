'use client';
import {createContext,useContext,useEffect,useState} from 'react';
export type Locale='ja'|'en'|'zh'|'ko';
type Language={locale:Locale;setLocale:(locale:Locale)=>void;t:(ja:string,en:string,zh:string,ko?:string)=>string;categoryLabel:(category:string)=>string};
const C=createContext<Language|undefined>(undefined);
const categoryNames:Record<string,[string,string,string,string]>={'日本酒':['日本酒','Sake','日本清酒','사케'],'ウイスキー':['ウイスキー','Whisky','威士忌','위스키'],'焼酎':['焼酎','Shochu','烧酒','소주'],'ワイン':['ワイン','Wine','葡萄酒','와인'],'シャンパン':['シャンパン','Champagne','香槟','샴페인'],'リキュール':['リキュール','Liqueur','利口酒','리큐르']};
export function LanguageProvider({children}:{children:React.ReactNode}){const [locale,setLocale]=useState<Locale>('ja');useEffect(()=>{const saved=localStorage.getItem('kura-locale') as Locale|null;if(saved)setLocale(saved)},[]);const update=(next:Locale)=>{setLocale(next);localStorage.setItem('kura-locale',next)};const t=(ja:string,en:string,zh:string,ko=en)=>locale==='ja'?ja:locale==='en'?en:locale==='zh'?zh:ko;const categoryLabel=(category:string)=>{const value=categoryNames[category];return value?value[locale==='ja'?0:locale==='en'?1:locale==='zh'?2:3]:category};return <C.Provider value={{locale,setLocale:update,t,categoryLabel}}>{children}</C.Provider>}
export const useLanguage=()=>{const value=useContext(C);if(!value)throw new Error('Language unavailable');return value};
