import Image from 'next/image';
export default function About() {
  return (
    <>
      <section className="bg-[#f3f0ea]">
        <div className="wrap grid min-h-[560px] items-end gap-10 py-16 md:grid-cols-2">
          <div className="pb-8">
            <p className="eyebrow">Our story</p>
            <h1 className="serif mt-7 text-5xl leading-tight md:text-6xl">
              酒と人のあいだに、
              <br />
              豊かな余白を。
            </h1>
          </div>
          <div className="relative h-[350px] md:h-[470px]">
            <Image
              fill
              sizes="(max-width: 767px) 100vw, 50vw"
              className="object-cover"
              src="https://images.unsplash.com/photo-1528823872057-9c018a7a7553?auto=format&fit=crop&w=1200&q=80"
              alt="KURAの店内"
            />
          </div>
        </div>
      </section>
      <section className="wrap grid gap-10 py-24 md:grid-cols-[.7fr_1.3fr] md:py-32">
        <p className="eyebrow">Since 1998 / Kagurazaka</p>
        <div>
          <h2 className="serif text-4xl leading-tight">
            街の酒屋から、
            <br />
            一杯の案内人へ。
          </h2>
          <p className="mt-8 max-w-xl text-sm leading-8 text-stone-600">
            KURAの始まりは、神楽坂の路地裏にあった小さな酒屋です。棚に並ぶ一本一本の向こうに、土地の気候、蔵の空気、つくり手の判断があります。その物語を手渡すように酒を選んできました。
          </p>
          <p className="mt-5 max-w-xl text-sm leading-8 text-stone-600">
            オンラインでも変わらないのは、数ではなく、確信で選ぶこと。飲む人の時間まで想像しながら、私たちは今日も生産者を訪ねます。
          </p>
        </div>
      </section>
      <section className="border-y line bg-[#faf8f4]">
        <div className="wrap py-24">
          <p className="eyebrow">Our principles</p>
          <div className="mt-10 grid gap-8 md:grid-cols-3">
            {[
              ['土地を味わう', '風土の個性が、まっすぐに表れた酒を。'],
              ['つくり手に会う', '顔の見える関係から、確かな一本を。'],
              ['時間を贈る', 'その酒がある食卓の景色まで考える。'],
            ].map(([heading, text], index) => (
              <div className="border-t border-[#a68451] pt-6" key={heading}>
                <span className="text-xs text-stone-500">0{index + 1}</span>
                <h2 className="serif mt-6 text-2xl">{heading}</h2>
                <p className="mt-4 text-sm leading-7 text-stone-600">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="wrap py-20">
        <p className="eyebrow">Store information</p>
        <h2 className="serif mt-4 text-3xl">店舗情報</h2>
        <div className="mt-8 border-y line">
          <div className="grid gap-2 py-5 text-sm md:grid-cols-[240px_1fr]">
            <span className="text-stone-500">通信販売酒類小売業免許取得済</span>
            <span>免許情報はお客様承認後に掲載予定です。</span>
          </div>
        </div>
      </section>
    </>
  );
}
